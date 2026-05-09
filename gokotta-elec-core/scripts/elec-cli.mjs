import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { cnlToIr, CnlParseError } from "./parse-cnl.mjs";
import { runErcCheck } from "./erc-check.mjs";
import { applyModelPackageDefaults, readModelPackageLibrary } from "./model-packages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const cleanArg = (value) =>
  String(value ?? "").trim().replace(/^["']|["']$/g, "");

const resolvePath = (value) => {
  const cleaned = cleanArg(value);
  return path.isAbsolute(cleaned) ? cleaned : path.resolve(repoRoot, cleaned);
};

const readJson = (relativeOrAbsolutePath) =>
  JSON.parse(fs.readFileSync(resolvePath(relativeOrAbsolutePath), "utf8"));

const usage = () => {
  console.log(`GokottaElec v0.1

Usage:
  node scripts/elec-cli.mjs build <input.cnl|input.txt> [output-dir]
  node scripts/elec-cli.mjs paste <input.txt> [output-dir]
  node scripts/elec-cli.mjs validate <input.ir.json>
  node scripts/elec-cli.mjs render <input.ir.json> [output.svg]`);
};

const formatDiagnostic = (item) => {
  const target = item.target ? ` [${item.target}]` : "";
  return `${item.level}: ${item.code}${target}: ${item.message}`;
};

const runRenderer = (irPath, svgPath) => {
  const result = spawnSync(process.execPath, [
    path.resolve(repoRoot, "scripts/render-svg.mjs"),
    irPath,
    svgPath
  ], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const validateIr = (ir) => {
  const componentLibrary = readJson("components/core-components.v0.1.json").components;
  const result = runErcCheck(ir, componentLibrary);
  for (const diagnostic of result.diagnostics) console.log(formatDiagnostic(diagnostic));
  return result;
};

const applyDefaults = (ir) =>
  applyModelPackageDefaults(ir, readModelPackageLibrary());

const build = (inputArg, outputDirArg) => {
  if (!inputArg) {
    usage();
    process.exit(2);
  }

  const inputPath = resolvePath(inputArg);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputDir = outputDirArg
    ? resolvePath(outputDirArg)
    : path.resolve(repoRoot, "output", baseName);
  const irPath = path.resolve(outputDir, `${baseName}.ir.json`);
  const svgPath = path.resolve(outputDir, `${baseName}.svg`);
  const ercPath = path.resolve(outputDir, `${baseName}.erc.txt`);

  try {
    const source = fs.readFileSync(inputPath, "utf8");
    const ir = applyDefaults(cnlToIr(source));

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(irPath, `${JSON.stringify(ir, null, 2)}\n`, "utf8");

    const erc = validateIr(ir);
    const ercText = erc.diagnostics.length === 0
      ? "OK\n"
      : `${erc.diagnostics.map(formatDiagnostic).join("\n")}\n`;
    fs.writeFileSync(ercPath, ercText, "utf8");

    if (!erc.ok) {
      console.error(`Build stopped: ERC errors written to ${path.relative(repoRoot, ercPath)}`);
      process.exit(1);
    }

    runRenderer(irPath, svgPath);
    console.log(`IR: ${path.relative(repoRoot, irPath)}`);
    console.log(`ERC: ${path.relative(repoRoot, ercPath)}`);
    console.log(`SVG: ${path.relative(repoRoot, svgPath)}`);
  } catch (error) {
    if (error instanceof CnlParseError) {
      for (const item of error.diagnostics) {
        const text = item.text ? `: ${item.text}` : "";
        console.error(`${item.level}: ${item.code} [line ${item.line}]: ${item.message}${text}`);
      }
      process.exit(1);
    }
    throw error;
  }
};

const validate = (inputArg) => {
  if (!inputArg) {
    usage();
    process.exit(2);
  }

  const inputPath = resolvePath(inputArg);
  const erc = validateIr(applyDefaults(readJson(inputPath)));
  if (!erc.ok) process.exit(1);
  console.log(`OK: ${path.relative(repoRoot, inputPath)}`);
};

const render = (inputArg, outputArg) => {
  if (!inputArg) {
    usage();
    process.exit(2);
  }

  const inputPath = resolvePath(inputArg);
  const outputPath = outputArg
    ? resolvePath(outputArg)
    : inputPath.replace(/(?:\.ir)?\.json$/i, ".svg");
  runRenderer(inputPath, outputPath);
};

const paste = (inputArg, outputArg) => {
  if (!inputArg) {
    usage();
    process.exit(2);
  }

  const result = spawnSync(process.execPath, [
    path.resolve(repoRoot, "scripts/build-paste.mjs"),
    resolvePath(inputArg),
    outputArg ? resolvePath(outputArg) : path.resolve(repoRoot, "output", "paste")
  ], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const [command, ...args] = process.argv.slice(2);
const normalizedCommand = cleanArg(command);

if (!normalizedCommand || normalizedCommand === "help" || normalizedCommand === "--help" || normalizedCommand === "-h") {
  usage();
} else if (normalizedCommand === "build") {
  build(args[0], args[1]);
} else if (normalizedCommand === "paste") {
  paste(args[0], args[1]);
} else if (normalizedCommand === "validate") {
  validate(args[0]);
} else if (normalizedCommand === "render") {
  render(args[0], args[1]);
} else {
  console.error(`Unknown command: ${command}`);
  usage();
  process.exit(2);
}
