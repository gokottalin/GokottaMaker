import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyModelPackageDefaults, readModelPackageLibrary } from "./model-packages.mjs";

const modulePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(modulePath);
const repoRoot = path.resolve(__dirname, "..");

const TERMINAL_REF_PATTERN = /^([A-Z][A-Z0-9_]*[0-9]+)\.([A-Z][A-Z0-9_+\-]*)$/;
const TERMINAL_PATTERN = /^[A-Z][A-Z0-9_+\-]*$/;
const OUTPUT_TERMINALS = new Set(["OUT", "Y"]);
const SUPPLY_TERMINALS = new Set(["V+", "VCC", "VDD", "IN", "POS"]);
const RETURN_TERMINALS = new Set(["V-", "VSS", "VEE", "GND", "NEG"]);

const readJson = (relativeOrAbsolutePath) => {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(repoRoot, relativeOrAbsolutePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
};

const parseTerminalRef = (terminalRef) => {
  const match = String(terminalRef).match(TERMINAL_REF_PATTERN);
  if (!match) return null;
  return { refdes: match[1], terminal: match[2] };
};

const pairKey = (a, b) => [a, b].sort().join("\u0000");
const pairSet = (pairs = []) => new Set(pairs.map(([a, b]) => pairKey(a, b)));

const terminalAllowedBySpec = (spec, terminal, device) => {
  if (spec.terminals?.includes(terminal)) return true;
  if (!spec.terminal_pattern || !new RegExp(spec.terminal_pattern).test(terminal)) return false;

  const pinCountLimited = device.component_type === "CONNECTOR_N"
    || spec.boundary_conditions?.forbid_implicit_pins_above_pin_count
    || spec.boundary_conditions?.declared_pin_count_must_match_terminals
    || spec.boundary_conditions?.declared_pin_count_must_match_p_terminals;

  if (pinCountLimited && /^P[0-9]+$/.test(terminal)) {
    const pinCount = Number(device.parameters?.pin_count);
    const pinMatch = terminal.match(/^P([0-9]+)$/);
    return Number.isInteger(pinCount)
      && Boolean(pinMatch)
      && Number(pinMatch[1]) >= 1
      && Number(pinMatch[1]) <= pinCount;
  }

  if (device.component_type === "IC_GENERIC") {
    const declared = device.parameters?.terminal_list;
    if (typeof declared !== "string") return false;
    return declared.split(",").map((item) => item.trim()).includes(terminal);
  }

  return true;
};

const terminalInternallyTied = (device, terminal) =>
  (device.internal_ties ?? []).some((tie) => tie.includes(terminal));

const outputStageNeedsPullup = (device) =>
  ["open_drain", "open-drain", "open_collector", "open-collector"].includes(
    String(device.parameters?.output_stage ?? "").toLowerCase()
  );

const buildIndexes = (ir, componentLibrary, add) => {
  const nets = new Map();
  const devices = new Map();
  const terminalToNet = new Map();
  const terminalUseSites = new Map();
  const netToTerminals = new Map();
  const connectedTerminalsByRefdes = new Map();

  for (const net of ir.nets ?? []) {
    if (nets.has(net.id)) add("ERROR", "DUPLICATE_NET", `Duplicate net id ${net.id}`, net.id);
    nets.set(net.id, net);
    netToTerminals.set(net.id, []);
  }

  for (const device of ir.devices ?? []) {
    if (devices.has(device.refdes)) {
      add("ERROR", "DUPLICATE_REFDES", `Duplicate refdes ${device.refdes}`, device.refdes);
    }

    const spec = componentLibrary[device.component_type];
    if (!spec) {
      add("ERROR", "UNKNOWN_COMPONENT", `${device.refdes} uses unknown component_type ${device.component_type}`, device.refdes);
      continue;
    }

    if (spec.prefix && !device.refdes.startsWith(spec.prefix)) {
      add("WARNING", "REFDES_PREFIX", `${device.refdes} should use prefix ${spec.prefix} for ${device.component_type}`, device.refdes);
    }

    for (const requiredParameter of spec.required_parameters ?? []) {
      if (!(requiredParameter in (device.parameters ?? {}))) {
        add("ERROR", "REQUIRED_PARAMETER", `${device.refdes} missing required parameter ${requiredParameter}`, device.refdes);
      }
    }

    const pinMapTargets = new Set();
    for (const [pin, terminal] of Object.entries(device.pin_map ?? {})) {
      if (!TERMINAL_PATTERN.test(terminal)) {
        add("ERROR", "PIN_MAP_TERMINAL", `${device.refdes}[${pin}] maps to invalid terminal ${terminal}`, `${device.refdes}[${pin}]`);
      } else if (!terminalAllowedBySpec(spec, terminal, device)) {
        add("ERROR", "PIN_MAP_TERMINAL", `${device.refdes}[${pin}] maps to terminal ${terminal}, not in ${device.component_type}`, `${device.refdes}[${pin}]`);
      }

      if (pinMapTargets.has(terminal)) {
        add("ERROR", "PIN_MAP_DUPLICATE_TERMINAL", `${device.refdes} maps more than one physical pin to logical terminal ${terminal}`, device.refdes);
      }
      pinMapTargets.add(terminal);
    }

    devices.set(device.refdes, { device, spec });
  }

  for (const connection of ir.connections ?? []) {
    if (!nets.has(connection.net)) {
      add("ERROR", "UNKNOWN_NET", `Connection references unknown net ${connection.net}`, connection.net);
      netToTerminals.set(connection.net, netToTerminals.get(connection.net) ?? []);
    }

    for (const terminalRef of connection.terminals ?? []) {
      const parsed = parseTerminalRef(terminalRef);
      if (!parsed) {
        add("ERROR", "TERMINAL_REF", `Invalid terminal reference ${terminalRef}`, terminalRef);
        continue;
      }

      const record = devices.get(parsed.refdes);
      if (!record) {
        add("ERROR", "UNKNOWN_DEVICE", `${terminalRef} references unknown device ${parsed.refdes}`, terminalRef);
        continue;
      }

      if (!terminalAllowedBySpec(record.spec, parsed.terminal, record.device)) {
        add("ERROR", "UNKNOWN_TERMINAL", `${terminalRef} is not a valid terminal for ${record.device.component_type}`, terminalRef);
      }

      const previousNet = terminalToNet.get(terminalRef);
      if (previousNet && previousNet !== connection.net) {
        add("ERROR", "TERMINAL_MULTI_NET", `${terminalRef} is connected to both ${previousNet} and ${connection.net}`, terminalRef);
      }

      terminalToNet.set(terminalRef, connection.net);
      terminalUseSites.set(terminalRef, [...(terminalUseSites.get(terminalRef) ?? []), connection.net]);
      netToTerminals.set(connection.net, [...(netToTerminals.get(connection.net) ?? []), terminalRef]);

      const connected = connectedTerminalsByRefdes.get(parsed.refdes) ?? new Set();
      connected.add(parsed.terminal);
      connectedTerminalsByRefdes.set(parsed.refdes, connected);
    }
  }

  for (const [terminalRef, netIds] of terminalUseSites.entries()) {
    const uniqueNets = new Set(netIds);
    if (uniqueNets.size === 1 && netIds.length > 1) {
      add("WARNING", "TERMINAL_DUPLICATED_ON_NET", `${terminalRef} appears ${netIds.length} times on net ${netIds[0]}`, terminalRef);
    }
  }

  return { nets, devices, terminalToNet, netToTerminals, connectedTerminalsByRefdes };
};

const sameNet = (indexes, refdes, a, b) => {
  const netA = indexes.terminalToNet.get(`${refdes}.${a}`);
  const netB = indexes.terminalToNet.get(`${refdes}.${b}`);
  return Boolean(netA && netB && netA === netB);
};

const deviceLooksUnpowered = ({ device, spec }, indexes) => {
  const terminals = spec.terminals ?? [];
  const hasSupplyTerminal = terminals.some((terminal) => SUPPLY_TERMINALS.has(terminal));
  const hasReturnTerminal = terminals.some((terminal) => RETURN_TERMINALS.has(terminal));
  if (!hasSupplyTerminal || !hasReturnTerminal) return false;

  const connected = indexes.connectedTerminalsByRefdes.get(device.refdes) ?? new Set();
  return !terminals.some((terminal) => SUPPLY_TERMINALS.has(terminal) && connected.has(terminal))
    || !terminals.some((terminal) => RETURN_TERMINALS.has(terminal) && connected.has(terminal));
};

const netHasPowerPullupThroughResistor = (netId, indexes) => {
  const terminals = indexes.netToTerminals.get(netId) ?? [];
  for (const terminalRef of terminals) {
    const parsed = parseTerminalRef(terminalRef);
    if (!parsed) continue;

    const record = indexes.devices.get(parsed.refdes);
    if (record?.device.component_type !== "RESISTOR") continue;

    const otherTerminal = record.spec.terminals.find((terminal) => terminal !== parsed.terminal);
    const otherNet = indexes.terminalToNet.get(`${parsed.refdes}.${otherTerminal}`);
    if (indexes.nets.get(otherNet)?.type === "power") return true;
  }
  return false;
};

const checkBoundaryRules = (indexes, add) => {
  const allowedNoConnect = indexes.allowedNoConnect ?? new Set();
  for (const [refdes, { device, spec }] of indexes.devices.entries()) {
    const boundary = spec.boundary_conditions ?? {};
    const connected = indexes.connectedTerminalsByRefdes.get(refdes) ?? new Set();
    const allowedSameNet = pairSet(boundary.allowed_same_net);

    for (const terminal of boundary.required_connected_terminals ?? []) {
      const terminalRef = `${refdes}.${terminal}`;
      if (!connected.has(terminal) && !terminalInternallyTied(device, terminal) && !allowedNoConnect.has(terminalRef)) {
        add("ERROR", "REQUIRED_TERMINAL", `${refdes}.${terminal} is required by ${device.component_type} but is not connected`, `${refdes}.${terminal}`);
      }
    }

    if (boundary.body_terminal_policy === "must_connect_or_internal_tie") {
      const hasBodyConnection = connected.has("B") || terminalInternallyTied(device, "B");
      if (!hasBodyConnection) {
        add("ERROR", "MOS_BODY_FLOATING", `${refdes}.B body/bulk must be connected or declared in internal_ties`, `${refdes}.B`);
      }
    }

    if (device.component_type.startsWith("MOS_")) {
      if (!connected.has("G") && !terminalInternallyTied(device, "G")) {
        add("ERROR", "MOS_GATE_FLOATING", `${refdes}.G gate is floating`, `${refdes}.G`);
      }
      if (sameNet(indexes, refdes, "G", "S")) {
        add("WARNING", "MOS_GATE_SOURCE_SAME_NET", `${refdes}.G and ${refdes}.S are on the same net`, refdes);
      }
      if (sameNet(indexes, refdes, "G", "D")) {
        add("WARNING", "MOS_GATE_DRAIN_SAME_NET", `${refdes}.G and ${refdes}.D are on the same net`, refdes);
      }
      if (sameNet(indexes, refdes, "D", "S")) {
        add("WARNING", "MOS_DRAIN_SOURCE_SAME_NET", `${refdes}.D and ${refdes}.S are on the same net`, refdes);
      }
    }

    if (boundary.forbid_unpowered_use && deviceLooksUnpowered({ device, spec }, indexes)) {
      add("ERROR", "UNPOWERED_ACTIVE_DEVICE", `${refdes} requires complete supply and return terminal connections`, refdes);
    }

    if (device.component_type.startsWith("OPAMP_")) {
      const vPlus = indexes.terminalToNet.get(`${refdes}.V+`);
      const vMinus = indexes.terminalToNet.get(`${refdes}.V-`);
      if (!vPlus || !vMinus) {
        add("ERROR", "OPAMP_SUPPLY_MISSING", `${refdes} op-amp must connect both V+ and V-`, refdes);
      } else if (vPlus === vMinus) {
        add("ERROR", "OPAMP_SUPPLY_SHORTED", `${refdes}.V+ and ${refdes}.V- are on ${vPlus}`, refdes);
      }
    }

    if (boundary.if_output_stage_open_drain_requires_pullup && outputStageNeedsPullup(device)) {
      const outputNet = indexes.terminalToNet.get(`${refdes}.OUT`);
      if (!outputNet) {
        add("ERROR", "COMPARATOR_OUTPUT_FLOATING", `${refdes}.OUT is open drain/open collector and is not connected`, `${refdes}.OUT`);
      } else if (!netHasPowerPullupThroughResistor(outputNet, indexes)) {
        add("WARNING", "COMPARATOR_PULLUP_HINT", `${refdes}.OUT is ${device.parameters.output_stage}; add a resistor pull-up to a power net if this output must produce a high level`, `${refdes}.OUT`);
      }
    }

    for (const [a, b] of boundary.warn_same_net ?? []) {
      if (sameNet(indexes, refdes, a, b) && !allowedSameNet.has(pairKey(a, b))) {
        add("WARNING", "SAME_NET_DEVICE_TERMINALS", `${refdes}.${a} and ${refdes}.${b} share one net`, refdes);
      }
    }
  }
};

const checkNetRules = (indexes, add) => {
  const hasGround = [...indexes.nets.values()].some((net) => net.type === "ground" || net.id === "GND");
  if (!hasGround) add("WARNING", "NO_GROUND", "Circuit has no explicit ground/reference net");

  for (const [netId, net] of indexes.nets.entries()) {
    const terminals = indexes.netToTerminals.get(netId) ?? [];
    const uniqueTerminals = new Set(terminals);
    if (uniqueTerminals.size === 0) {
      add("WARNING", "UNUSED_NET", `Net ${netId} has no terminals`, netId);
    } else if (uniqueTerminals.size === 1 && net.type !== "input" && net.type !== "output") {
      add("WARNING", "SINGLE_TERMINAL_NET", `Net ${netId} has only one unique terminal`, netId);
    }

    const activeOutputs = terminals.filter((terminalRef) => {
      const parsed = parseTerminalRef(terminalRef);
      const record = parsed ? indexes.devices.get(parsed.refdes) : null;
      return record
        && OUTPUT_TERMINALS.has(parsed.terminal)
        && !outputStageNeedsPullup(record.device)
        && record.spec.category !== "connector";
    });

    if (activeOutputs.length > 1) {
      add("WARNING", "OUTPUT_CONTENTION", `Net ${netId} has multiple push-pull outputs: ${activeOutputs.join(", ")}`, netId);
    }
  }
};

export const runErcCheck = (ir, componentLibrary) => {
  const diagnostics = [];
  const add = (level, code, message, target) => {
    diagnostics.push({ level, code, message, ...(target ? { target } : {}) });
  };

  const indexes = buildIndexes(ir, componentLibrary, add);
  indexes.allowedNoConnect = new Set(
    (ir.constraints ?? [])
      .filter((constraint) => constraint.level === "allow" && constraint.rule === "no_connect")
      .map((constraint) => constraint.target)
  );
  checkBoundaryRules(indexes, add);
  checkNetRules(indexes, add);

  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.level === "ERROR"),
    diagnostics,
    errors: diagnostics.filter((diagnostic) => diagnostic.level === "ERROR"),
    warnings: diagnostics.filter((diagnostic) => diagnostic.level === "WARNING")
  };
};

const isCli = process.argv[1] && path.resolve(process.argv[1]) === modulePath;

if (isCli) {
  const irPath = process.argv[2];

  if (!irPath) {
    console.error("Usage: node scripts/erc-check.mjs <ir.json>");
    process.exit(2);
  }

  const componentLibrary = readJson("components/core-components.v0.1.json").components;
  const modelPackageLibrary = readModelPackageLibrary();
  const ir = applyModelPackageDefaults(readJson(irPath), modelPackageLibrary);
  const result = runErcCheck(ir, componentLibrary);

  for (const diagnostic of result.diagnostics) {
    const target = diagnostic.target ? ` [${diagnostic.target}]` : "";
    console.log(`${diagnostic.level}: ${diagnostic.code}${target}: ${diagnostic.message}`);
  }

  if (!result.ok) process.exit(1);

  console.log(`OK: ${path.relative(repoRoot, path.resolve(repoRoot, irPath))}`);
}
