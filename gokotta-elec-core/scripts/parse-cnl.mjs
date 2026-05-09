import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const SCHEMA_VERSION = "0.1.0";

const LEVEL_WORDS = new Map([
  ["必须", "must"],
  ["允许", "allow"],
  ["禁止", "forbid"],
  ["警告", "warn"]
]);

const NET_TYPES = new Set([
  "ground",
  "power",
  "signal",
  "bias",
  "feedback",
  "input",
  "output",
  "internal"
]);

const STATEMENT_END = /[。;]/u;
const CHINESE_COMMA = /，/gu;
const terminalRefPatternForMessage = /^[A-Z][A-Z0-9_]*[0-9]+\.[A-Z][A-Z0-9_+\-]*$/u;

export const normalizeCnlSource = (source) => {
  let text = String(source ?? "").replace(/^\uFEFF/u, "").trim();
  const fenced = text.match(/^```(?:text|cnl|circuit-cnl)?\s*([\s\S]*?)\s*```$/iu);
  if (fenced) text = fenced[1].trim();
  return text;
};

export class CnlParseError extends Error {
  constructor(diagnostics) {
    super("CNL parse failed");
    this.name = "CnlParseError";
    this.diagnostics = diagnostics;
  }
}

const diagnostic = (line, code, message, text) => ({
  level: "ERROR",
  line,
  code,
  message,
  ...(text ? { text } : {})
});

const fail = (line, code, message, text) => {
  throw new CnlParseError([diagnostic(line, code, message, text)]);
};

const splitTopLevel = (text, separator = ",") => {
  const result = [];
  let current = "";
  let depth = 0;

  for (const char of text) {
    if (char === "{" || char === "(" || char === "[") depth += 1;
    if (char === "}" || char === ")" || char === "]") depth -= 1;

    if (char === separator && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) result.push(current.trim());
  return result;
};

const splitStatements = (source) => {
  const statements = [];
  let current = "";
  let startLine = 1;
  let line = 1;

  for (const char of normalizeCnlSource(source).replace(/\r\n/g, "\n").replace(/\r/g, "\n")) {
    if (!current.trim() && char.trim()) startLine = line;

    if (STATEMENT_END.test(char)) {
      const text = current.trim();
      if (text) statements.push({ text, line: startLine });
      current = "";
    } else {
      current += char;
    }

    if (char === "\n") line += 1;
  }

  const trailing = current.trim();
  if (trailing) statements.push({ text: trailing, line: startLine });
  return statements;
};

const parseAssignments = (body, line, statementText) => {
  const assignments = {};
  if (!body.trim()) return assignments;

  for (const item of splitTopLevel(body.replace(CHINESE_COMMA, ","))) {
    const match = item.match(/^([^=]+)=(.+)$/u);
    if (!match) fail(line, "ASSIGNMENT", `Invalid assignment: ${item}`, statementText);

    const key = match[1].trim();
    const value = match[2].trim();
    if (!key || !value) fail(line, "ASSIGNMENT", `Invalid assignment: ${item}`, statementText);
    assignments[key] = value;
  }

  return assignments;
};

const parseTailFields = (tail, line, statementText) => {
  const fields = {};
  const normalized = tail.replace(CHINESE_COMMA, ",").replace(/^,/, "").trim();
  if (!normalized) return fields;

  for (const item of splitTopLevel(normalized)) {
    const match = item.match(/^([^=]+)=(.*)$/u);
    if (!match) fail(line, "FIELD", `Invalid field: ${item}`, statementText);
    fields[match[1].trim()] = match[2].trim();
  }

  return fields;
};

const parseStatement = ({ text, line }) => {
  let match = text.match(/^电路\s+([A-Za-z][A-Za-z0-9_-]*)\s+版本\s+([0-9]+\.[0-9]+\.[0-9]+)$/u);
  if (match) {
    return { kind: "circuit", id: match[1], version: match[2], line };
  }

  match = text.match(/^网络\s+([A-Z][A-Z0-9_+\-]*)\s+是\s+([a-z_]+)(.*)$/u);
  if (match) {
    const fields = parseTailFields(match[3], line, text);
    return {
      kind: "net",
      id: match[1],
      type: match[2],
      alias: fields["别名"] || fields.alias,
      description: fields["说明"] || fields.description,
      line
    };
  }

  match = text.match(/^器件\s+(\S+)\s+是\s+([A-Z][A-Z0-9_]*)(.*)$/u);
  if (match) {
    if (!/^[A-Z][A-Z0-9_]*[0-9]+$/u.test(match[1])) {
      fail(line, "REFDES", `Invalid refdes: ${match[1]}. Refdes must end with a number, for example R1, R_GATE1, M1, LED1`, text);
    }
    const parameterMatch = match[3].match(/参数\{([\s\S]*)\}/u);
    const tail = match[3]
      .replace(/[,，]?\s*参数\{[\s\S]*\}/u, "")
      .replace(CHINESE_COMMA, ",")
      .trim();
    const fields = parseTailFields(tail, line, text);

    return {
      kind: "device",
      refdes: match[1],
      component_type: match[2],
      model: fields["型号"] || fields.model,
      value: fields["值"] || fields.value,
      package: fields["封装"] || fields.package,
      parameters: parameterMatch ? parseAssignments(parameterMatch[1], line, text) : undefined,
      line
    };
  }

  match = text.match(/^引脚映射\s+(\S+)\{([\s\S]*)\}$/u);
  if (match) {
    if (!/^[A-Z][A-Z0-9_]*[0-9]+$/u.test(match[1])) {
      fail(line, "REFDES", `Invalid refdes in pin map: ${match[1]}`, text);
    }
    return {
      kind: "pin_map",
      refdes: match[1],
      pin_map: parseAssignments(match[2], line, text),
      line
    };
  }

  match = text.match(/^连接\s+([^:]+):\s*(.+)$/u);
  if (match) {
    const netId = match[1].trim();
    if (terminalRefPatternForMessage.test(netId)) {
      fail(line, "CONNECTION_NET_IS_TERMINAL", `Connection left side must be a net id, not a terminal reference: ${netId}. Create a net and put ${netId} on the right side`, text);
    }
    if (!/^[A-Z][A-Z0-9_+\-]*$/u.test(netId)) {
      fail(line, "NET_ID", `Invalid connection net id: ${netId}`, text);
    }
    return {
      kind: "connection",
      net: netId,
      terminals: splitTopLevel(match[2].replace(CHINESE_COMMA, ",")).map((terminal) => terminal.trim()),
      line
    };
  }

  match = text.match(/^约束\s+(\S+)\s+(必须|允许|禁止|警告)\s+(.+)$/u);
  if (match) {
    return {
      kind: "constraint",
      target: match[1],
      level: LEVEL_WORDS.get(match[2]),
      rule: match[3].trim(),
      line
    };
  }

  match = text.match(/^未连接\s+([A-Z][A-Z0-9_]*[0-9]+\.[A-Z][A-Z0-9_+\-]*)\s*[,，]?\s*原因=(.+)$/u);
  if (match) {
    return {
      kind: "no_connect",
      terminal: match[1],
      reason: match[2].trim(),
      line
    };
  }

  match = text.match(/^封装连接\s+([A-Z][A-Z0-9_+\-]*):\s*(.+)$/u);
  if (match) {
    return {
      kind: "package_connection",
      net: match[1],
      pins: splitTopLevel(match[2].replace(CHINESE_COMMA, ",")).map((pin) => pin.trim()),
      line
    };
  }

  fail(line, "UNKNOWN_STATEMENT", "Unknown or unsupported CNL statement", text);
};

export const parseCnl = (source) => {
  const diagnostics = [];
  const ast = [];

  for (const statement of splitStatements(source)) {
    try {
      ast.push(parseStatement(statement));
    } catch (error) {
      if (error instanceof CnlParseError) {
        diagnostics.push(...error.diagnostics);
      } else {
        throw error;
      }
    }
  }

  if (diagnostics.length > 0) throw new CnlParseError(diagnostics);
  return ast;
};

const assertUnique = (map, key, line, code, label, diagnostics) => {
  if (map.has(key)) {
    diagnostics.push(diagnostic(line, code, `${label} declared more than once: ${key}`));
    return false;
  }
  map.set(key, line);
  return true;
};

const normalizePackagePin = (pin, devicesByRefdes, line, diagnostics) => {
  const match = pin.match(/^([A-Z][A-Z0-9_]*[0-9]+)\[([A-Za-z0-9_\-]+)\]$/u);
  if (!match) {
    diagnostics.push(diagnostic(line, "PACKAGE_PIN", `Invalid package pin reference: ${pin}`));
    return undefined;
  }

  const [, refdes, pinNumber] = match;
  const device = devicesByRefdes.get(refdes);
  if (!device) {
    diagnostics.push(diagnostic(line, "PACKAGE_PIN_DEVICE", `Package pin references unknown device: ${refdes}`));
    return undefined;
  }

  const terminal = device.pin_map?.[pinNumber];
  if (!terminal) {
    diagnostics.push(diagnostic(line, "PACKAGE_PIN_MAP", `No pin_map entry for ${refdes}[${pinNumber}]`));
    return undefined;
  }

  return `${refdes}.${terminal}`;
};

export const cnlToIr = (source) => {
  const ast = parseCnl(normalizeCnlSource(source));
  const diagnostics = [];
  const netIds = new Map();
  const deviceIds = new Map();
  const devicesByRefdes = new Map();
  const terminalToNet = new Map();

  const ir = {
    schema_version: SCHEMA_VERSION,
    circuit: undefined,
    nets: [],
    devices: [],
    connections: [],
    constraints: []
  };

  for (const statement of ast) {
    if (statement.kind === "circuit") {
      if (ir.circuit) {
        diagnostics.push(diagnostic(statement.line, "DUPLICATE_CIRCUIT", "Circuit declared more than once"));
      } else {
        ir.circuit = { id: statement.id, version: statement.version };
      }
      continue;
    }

    if (statement.kind === "net") {
      if (!NET_TYPES.has(statement.type)) {
        diagnostics.push(diagnostic(statement.line, "NET_TYPE", `Unknown net type: ${statement.type}`));
      }
      if (assertUnique(netIds, statement.id, statement.line, "DUPLICATE_NET", "Net", diagnostics)) {
        ir.nets.push({
          id: statement.id,
          type: statement.type,
          ...(statement.alias ? { alias: statement.alias } : {}),
          ...(statement.description ? { description: statement.description } : {})
        });
      }
      continue;
    }

    if (statement.kind === "device") {
      if (assertUnique(deviceIds, statement.refdes, statement.line, "DUPLICATE_DEVICE", "Device", diagnostics)) {
        const device = {
          refdes: statement.refdes,
          component_type: statement.component_type,
          ...(statement.model ? { model: statement.model } : {}),
          ...(statement.value ? { value: statement.value } : {}),
          ...(statement.package ? { package: statement.package } : {}),
          ...(statement.parameters ? { parameters: statement.parameters } : {})
        };
        ir.devices.push(device);
        devicesByRefdes.set(statement.refdes, device);
      }
      continue;
    }

    if (statement.kind === "pin_map") {
      const device = devicesByRefdes.get(statement.refdes);
      if (!device) {
        diagnostics.push(diagnostic(statement.line, "PIN_MAP_DEVICE", `Pin map references unknown device: ${statement.refdes}`));
      } else {
        device.pin_map = statement.pin_map;
      }
      continue;
    }

    if (statement.kind === "connection") {
      ir.connections.push({ net: statement.net, terminals: statement.terminals });
      continue;
    }

    if (statement.kind === "package_connection") {
      const terminals = statement.pins
        .map((pin) => normalizePackagePin(pin, devicesByRefdes, statement.line, diagnostics))
        .filter(Boolean);
      ir.connections.push({ net: statement.net, terminals });
      continue;
    }

    if (statement.kind === "constraint") {
      ir.constraints.push({
        target: statement.target,
        level: statement.level,
        rule: statement.rule
      });
      continue;
    }

    if (statement.kind === "no_connect") {
      ir.constraints.push({
        target: statement.terminal,
        level: "allow",
        rule: "no_connect",
        message: statement.reason
      });
    }
  }

  if (!ir.circuit) {
    diagnostics.push(diagnostic(1, "MISSING_CIRCUIT", "Missing circuit declaration"));
  }

  for (const connection of ir.connections) {
    if (!netIds.has(connection.net)) {
      diagnostics.push(diagnostic(1, "UNKNOWN_NET", `Connection references unknown net: ${connection.net}`));
    }

    for (const terminal of connection.terminals) {
      const terminalMatch = terminal.match(/^([A-Z][A-Z0-9_]*[0-9]+)\.([A-Z][A-Z0-9_+\-]*)$/u);
      if (!terminalMatch) {
        diagnostics.push(diagnostic(1, "TERMINAL", `Invalid terminal reference: ${terminal}`));
        continue;
      }

      const refdes = terminalMatch[1];
      if (!devicesByRefdes.has(refdes)) {
        diagnostics.push(diagnostic(1, "TERMINAL_DEVICE", `Terminal references unknown device: ${terminal}`));
        continue;
      }

      const previousNet = terminalToNet.get(terminal);
      if (previousNet && previousNet !== connection.net) {
        diagnostics.push(diagnostic(1, "TERMINAL_MULTI_NET", `${terminal} is connected to both ${previousNet} and ${connection.net}`));
      }
      terminalToNet.set(terminal, connection.net);
    }
  }

  if (diagnostics.length > 0) throw new CnlParseError(diagnostics);
  if (ir.constraints.length === 0) delete ir.constraints;

  return ir;
};

const resolvePath = (relativeOrAbsolutePath) =>
  path.isAbsolute(String(relativeOrAbsolutePath).replace(/^["']|["']$/g, ""))
    ? String(relativeOrAbsolutePath).replace(/^["']|["']$/g, "")
    : path.resolve(repoRoot, String(relativeOrAbsolutePath).replace(/^["']|["']$/g, ""));

const printDiagnostics = (diagnostics) => {
  for (const item of diagnostics) {
    const text = item.text ? `: ${item.text}` : "";
    console.error(`${item.level}: ${item.code} [line ${item.line}]: ${item.message}${text}`);
  }
};

const runCli = () => {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath) {
    console.error("Usage: node scripts/parse-cnl.mjs <input.cnl> [output.ir.json]");
    process.exit(2);
  }

  const absoluteInputPath = resolvePath(inputPath);
  const absoluteOutputPath = outputPath
    ? resolvePath(outputPath)
    : absoluteInputPath.replace(/\.(cnl|txt)$/i, ".ir.json");

  try {
    const source = fs.readFileSync(absoluteInputPath, "utf8");
    const ir = cnlToIr(source);
    fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(ir, null, 2)}\n`, "utf8");
    console.log(`OK: ${path.relative(repoRoot, absoluteOutputPath)}`);
  } catch (error) {
    if (error instanceof CnlParseError) {
      printDiagnostics(error.diagnostics);
      process.exit(1);
    }
    throw error;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
