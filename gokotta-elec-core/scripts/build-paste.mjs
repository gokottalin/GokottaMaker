import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cnlToIr, CnlParseError, normalizeCnlSource } from "./parse-cnl.mjs";
import { runErcCheck } from "./erc-check.mjs";
import { applyModelPackageDefaults, readModelPackageLibrary } from "./model-packages.mjs";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const resolvePath = (value) => {
  const cleaned = String(value ?? "").trim().replace(/^["']|["']$/g, "");
  return path.isAbsolute(cleaned) ? cleaned : path.resolve(repoRoot, cleaned);
};

const readJson = (relativeOrAbsolutePath) =>
  JSON.parse(fs.readFileSync(resolvePath(relativeOrAbsolutePath), "utf8"));

const formatDiagnostic = (item) => {
  const target = item.target ? ` [${item.target}]` : "";
  return `${item.level}: ${item.code}${target}: ${item.message}`;
};

const slug = (value, index) =>
  String(value || `circuit_${index}`)
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
    .toLowerCase();

export const splitCircuitBlocks = (source) => {
  const text = normalizeCnlSource(source).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstCircuit = text.search(/电路\s+[A-Za-z][A-Za-z0-9_-]*\s+版本\s+[0-9]+\.[0-9]+\.[0-9]+/u);
  const useful = firstCircuit >= 0 ? text.slice(firstCircuit) : text;
  const starts = [...useful.matchAll(/(^|\n)\s*(电路\s+[A-Za-z][A-Za-z0-9_-]*\s+版本\s+[0-9]+\.[0-9]+\.[0-9]+。?)/gu)]
    .map((match) => match.index + match[1].length);

  if (starts.length === 0) return [];
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? useful.length;
    return useful.slice(start, end).trim();
  }).filter(Boolean);
};

const ensureSentenceEnd = (line) => /[。;]\s*$/u.test(line) ? line : `${line}。`;

const splitStatements = (block) => {
  const result = [];
  let current = "";
  for (const char of block.replace(/\r\n/g, "\n").replace(/\r/g, "\n")) {
    if (char === "。" || char === ";") {
      const text = current.trim();
      if (text) result.push(text);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
};

const parseDeclaredNets = (statements) => new Set(
  statements.map((statement) => statement.match(/^网络\s+([A-Z][A-Z0-9_+\-]*)\s+是\s+[a-z_]+/u)?.[1]).filter(Boolean)
);

const refdesAliases = (statements) => {
  const aliases = new Map();
  for (const statement of statements) {
    const match = statement.match(/^器件\s+(\S+)\s+是\s+/u);
    if (!match) continue;
    const refdes = match[1];
    if (/^[A-Z][A-Z0-9_]*[0-9]+$/u.test(refdes)) continue;
    if (/^[A-Z][A-Z0-9_]*$/u.test(refdes)) aliases.set(refdes, `${refdes}1`);
  }
  return aliases;
};

const applyAliases = (statement, aliases) => {
  let result = statement;
  for (const [from, to] of aliases.entries()) {
    result = result.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gu"), to);
  }
  return result;
};

const terminalRefPattern = /^[A-Z][A-Z0-9_]*[0-9]+\.[A-Z][A-Z0-9_+\-]*$/u;
const netPattern = /^[A-Z][A-Z0-9_+\-]*$/u;

const sanitizeConnection = (statement, declaredNets, pendingAdditions) => {
  const match = statement.match(/^连接\s+([^:]+):\s*(.+)$/u);
  if (!match) return [statement];

  const left = match[1].trim();
  const right = match[2].trim();
  const reasonMatch = right.match(/原因\s*=\s*(.+)$/u);
  const reason = reasonMatch?.[1] ?? "";
  const rawItems = right
    .replace(/[，]/gu, ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^原因\s*=/u.test(item));
  const terminals = rawItems.filter((item) => terminalRefPattern.test(item));

  if (terminalRefPattern.test(left)) {
    const generatedNet = `N_${left.replace(".", "_")}`;
    if (!declaredNets.has(generatedNet)) {
      pendingAdditions.networks.push(`网络 ${generatedNet} 是 internal，说明=由兼容层为端子连接自动生成。`);
      declaredNets.add(generatedNet);
    }
    return [`连接 ${generatedNet}: ${[left, ...terminals].join(", ")}。`];
  }

  if (!netPattern.test(left)) return [];

  const mentionedExistingNet = reason.match(/已在\s*([A-Z][A-Z0-9_+\-]*)\s*中/u)?.[1]
    ?? reason.match(/连接到\s*([A-Z][A-Z0-9_+\-]*)/u)?.[1];
  if (!declaredNets.has(left) && mentionedExistingNet && declaredNets.has(mentionedExistingNet) && terminals.length > 0) {
    pendingAdditions.connectionTerminals.push({ net: mentionedExistingNet, terminals });
    return [];
  }

  if (!declaredNets.has(left)) {
    pendingAdditions.networks.push(`网络 ${left} 是 internal，说明=由兼容层根据连接语句自动声明。`);
    declaredNets.add(left);
  }

  if (terminals.length === 0) return [];
  return [`连接 ${left}: ${terminals.join(", ")}。`];
};

const sanitizeDevice = (statement) => {
  if (!/^器件\s+\S+\s+是\s+SIGNAL_SOURCE/u.test(statement)) return statement;
  if (/参数\{[^}]*\bwaveform\s*=/u.test(statement)) return statement;
  if (/参数\{/u.test(statement)) {
    return statement.replace(/参数\{/u, "参数{waveform=square, ");
  }
  return `${statement}，参数{waveform=square}`;
};

export const sanitizeLlmCnlBlock = (block) => {
  let statements = splitStatements(block)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => /^(电路|网络|器件|引脚映射|连接|未连接|约束)\s/u.test(statement));

  const aliases = refdesAliases(statements);
  statements = statements.map((statement) => applyAliases(statement, aliases));

  const declaredNets = parseDeclaredNets(statements);
  const pendingAdditions = { networks: [], connectionTerminals: [] };
  const output = [];
  let insertedNetworks = false;

  for (const statement of statements) {
    if (!insertedNetworks && /^(器件|引脚映射|连接|未连接|约束)\s/u.test(statement)) {
      output.push(...pendingAdditions.networks);
      pendingAdditions.networks.length = 0;
      insertedNetworks = true;
    }

    if (statement.startsWith("连接 ")) {
      output.push(...sanitizeConnection(statement, declaredNets, pendingAdditions).map((item) => item.replace(/[。;]\s*$/u, "")));
    } else if (statement.startsWith("器件 ")) {
      output.push(sanitizeDevice(statement));
    } else {
      output.push(statement);
    }
  }

  output.splice(
    Math.max(1, output.findIndex((statement) => statement.startsWith("器件 ")) === -1 ? output.length : output.findIndex((statement) => statement.startsWith("器件 "))),
    0,
    ...pendingAdditions.networks.map((statement) => statement.replace(/[。;]\s*$/u, ""))
  );

  const connectionIndexes = new Map();
  output.forEach((statement, index) => {
    const match = statement.match(/^连接\s+([A-Z][A-Z0-9_+\-]*):\s*(.+)$/u);
    if (match) connectionIndexes.set(match[1], index);
  });
  for (const addition of pendingAdditions.connectionTerminals) {
    const index = connectionIndexes.get(addition.net);
    if (index === undefined) {
      output.push(`连接 ${addition.net}: ${addition.terminals.join(", ")}`);
    } else {
      const match = output[index].match(/^(连接\s+[A-Z][A-Z0-9_+\-]*:\s*)(.+)$/u);
      const existing = match ? match[2].split(",").map((item) => item.trim()).filter(Boolean) : [];
      output[index] = `${match[1]}${[...new Set([...existing, ...addition.terminals])].join(", ")}`;
    }
  }

  return `${output.map(ensureSentenceEnd).join("\n")}\n`;
};

const runRenderer = (irPath, svgPath) => {
  const result = spawnSync(process.execPath, [
    path.resolve(repoRoot, "scripts/render-svg.mjs"),
    irPath,
    svgPath
  ], { cwd: repoRoot, encoding: "utf8" });
  return result;
};

export const buildPastedText = (source, outputDirArg) => {
  const outputDir = resolvePath(outputDirArg ?? "output/paste");
  const componentLibrary = readJson("components/core-components.v0.1.json").components;
  const modelLibrary = readModelPackageLibrary();
  const blocks = splitCircuitBlocks(source);
  const results = [];

  fs.mkdirSync(outputDir, { recursive: true });
  if (blocks.length === 0) throw new Error("No CNL circuit blocks found. Expected statements starting with: 电路 <ID> 版本 0.1.0。");

  blocks.forEach((block, index) => {
    const sanitized = sanitizeLlmCnlBlock(block);
    const circuitId = sanitized.match(/^电路\s+([A-Za-z][A-Za-z0-9_-]*)\s+版本/mu)?.[1] ?? `CIRCUIT_${index + 1}`;
    const dir = path.resolve(outputDir, `${String(index + 1).padStart(2, "0")}-${slug(circuitId, index + 1)}`);
    fs.mkdirSync(dir, { recursive: true });

    const cnlPath = path.resolve(dir, `${slug(circuitId, index + 1)}.cnl`);
    const irPath = path.resolve(dir, `${slug(circuitId, index + 1)}.ir.json`);
    const ercPath = path.resolve(dir, `${slug(circuitId, index + 1)}.erc.txt`);
    const svgPath = path.resolve(dir, `${slug(circuitId, index + 1)}.svg`);
    fs.writeFileSync(cnlPath, sanitized, "utf8");

    try {
      const ir = applyModelPackageDefaults(cnlToIr(sanitized), modelLibrary);
      fs.writeFileSync(irPath, `${JSON.stringify(ir, null, 2)}\n`, "utf8");
      const erc = runErcCheck(ir, componentLibrary);
      fs.writeFileSync(ercPath, erc.diagnostics.length ? `${erc.diagnostics.map(formatDiagnostic).join("\n")}\n` : "OK\n", "utf8");

      if (!erc.ok) {
        results.push({ circuitId, ok: false, dir, cnlPath, irPath, ercPath, svgPath: null, message: "ERC failed" });
        return;
      }

      const render = runRenderer(irPath, svgPath);
      if (render.status !== 0) {
        fs.writeFileSync(path.resolve(dir, "render-error.txt"), `${render.stdout ?? ""}\n${render.stderr ?? ""}`, "utf8");
        results.push({ circuitId, ok: false, dir, cnlPath, irPath, ercPath, svgPath: null, message: "Render failed" });
        return;
      }
      results.push({ circuitId, ok: true, dir, cnlPath, irPath, ercPath, svgPath, message: "OK" });
    } catch (error) {
      const diagnostics = error instanceof CnlParseError
        ? error.diagnostics.map((item) => `${item.level}: ${item.code} [line ${item.line}]: ${item.message}${item.text ? `: ${item.text}` : ""}`).join("\n")
        : error.stack ?? String(error);
      fs.writeFileSync(path.resolve(dir, "build-error.txt"), `${diagnostics}\n`, "utf8");
      results.push({ circuitId, ok: false, dir, cnlPath, irPath: null, ercPath: null, svgPath: null, message: "Parse/build failed" });
    }
  });

  const summary = results.map((result) => {
    const status = result.ok ? "OK" : "FAIL";
    const svg = result.svgPath ? ` SVG=${path.relative(repoRoot, result.svgPath)}` : "";
    return `${status}: ${result.circuitId} DIR=${path.relative(repoRoot, result.dir)}${svg}`;
  }).join("\n");
  fs.writeFileSync(path.resolve(outputDir, "summary.txt"), `${summary}\n`, "utf8");
  return { outputDir, results, summary };
};

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const input = process.argv[2];
  const output = process.argv[3] ?? "output/paste";
  if (!input) {
    console.error("Usage: node scripts/build-paste.mjs <input.txt> [output-dir]");
    process.exit(2);
  }
  const result = buildPastedText(fs.readFileSync(resolvePath(input), "utf8"), output);
  console.log(result.summary);
  if (result.results.some((item) => !item.ok)) process.exit(1);
}
