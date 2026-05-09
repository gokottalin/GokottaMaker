const REF_DES_PATTERN = /^[A-Z][A-Z0-9_]*[0-9]+$/;
const NET_PATTERN = /^[A-Z][A-Z0-9_+\-]*$/;
const TERMINAL_REF_PATTERN = /^([A-Z][A-Z0-9_]*[0-9]+)\.([A-Z][A-Z0-9_+\-]*)$/;
const TERMINAL_PATTERN = /^[A-Z][A-Z0-9_+\-]*$/;

const SUPPLY_TERMINALS = new Set(["V+", "VCC", "VDD", "IN", "POS"]);
const RETURN_TERMINALS = new Set(["V-", "VSS", "VEE", "GND", "NEG"]);
const OUTPUT_TERMINALS = new Set(["OUT", "Y"]);
const DEFAULT_RESISTOR_POWER_W = 0.25;

const makeDiagnostic = (level, code, message, target) => ({
  level,
  code,
  message,
  ...(target ? { target } : {})
});

const parseTerminalRef = (terminalRef) => {
  const match = terminalRef.match(TERMINAL_REF_PATTERN);
  if (!match) return null;
  return { refdes: match[1], terminal: match[2] };
};

const parseRule = (rule) => {
  const match = String(rule).trim().match(/^([a-z_]+)\((.*)\)$/i);
  if (!match) return { name: "unknown", args: [] };
  const args = match[2].trim() === ""
    ? []
    : match[2].split(",").map((arg) => arg.trim()).filter(Boolean);
  return { name: match[1], args };
};

const terminalAllowedBySpec = (spec, terminal, device) => {
  if (spec.terminals?.includes(terminal)) return true;
  if (spec.terminal_pattern && new RegExp(spec.terminal_pattern).test(terminal)) {
    const pinCountLimited = device.component_type === "CONNECTOR_N"
      || spec.boundary_conditions?.forbid_implicit_pins_above_pin_count
      || spec.boundary_conditions?.declared_pin_count_must_match_terminals
      || spec.boundary_conditions?.declared_pin_count_must_match_p_terminals;

    if (pinCountLimited && /^P[0-9]+$/.test(terminal)) {
      const pinCount = Number(device.parameters?.pin_count);
      const pinMatch = terminal.match(/^P([0-9]+)$/);
      return Number.isInteger(pinCount) && pinMatch && Number(pinMatch[1]) >= 1 && Number(pinMatch[1]) <= pinCount;
    }

    if (device.component_type === "IC_GENERIC") {
      const declared = device.parameters?.terminal_list;
      if (typeof declared !== "string") return false;
      return declared.split(",").map((item) => item.trim()).includes(terminal);
    }

    return true;
  }
  return false;
};

const terminalInternallyTied = (device, terminal) =>
  (device.internal_ties ?? []).some((tie) => tie.includes(terminal));

const pairKey = (a, b) => [a, b].sort().join("\u0000");

const pairSet = (pairs = []) => new Set(pairs.map(([a, b]) => pairKey(a, b)));

const parseQuantity = (value, unitTable) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .replace(/\u03a9/g, "ohm")
    .replace(/\s+/g, "")
    .toLowerCase();
  const match = normalized.match(/^([-+]?[0-9]*\.?[0-9]+)([a-z%]*)$/);
  if (!match) return null;

  const [, numberText, suffix] = match;
  if (!(suffix in unitTable)) return null;
  return Number(numberText) * unitTable[suffix];
};

const parseVoltage = (value) => parseQuantity(value, {
  v: 1,
  mv: 1e-3,
  uv: 1e-6,
  kv: 1e3
});

const parseCurrent = (value) => parseQuantity(value, {
  a: 1,
  ma: 1e-3,
  ua: 1e-6,
  ka: 1e3
});

const parseResistance = (value) => parseQuantity(value, {
  ohm: 1,
  r: 1,
  "": 1,
  k: 1e3,
  kohm: 1e3,
  m: 1e6,
  mohm: 1e6,
  meg: 1e6
});

const parsePower = (value) => parseQuantity(value, {
  w: 1,
  mw: 1e-3,
  uw: 1e-6,
  kw: 1e3
});

const parseVoltageIntervalText = (value) => {
  if (typeof value !== "string") return null;
  const rangeMatch = value.match(/([-+]?[0-9]*\.?[0-9]+)\s*(mV|uV|kV|V)\s*(?:to|\.\.|-)\s*([-+]?[0-9]*\.?[0-9]+)\s*(mV|uV|kV|V)/i);
  if (rangeMatch) {
    const a = parseVoltage(`${rangeMatch[1]}${rangeMatch[2]}`);
    const b = parseVoltage(`${rangeMatch[3]}${rangeMatch[4]}`);
    if (a !== null && b !== null) return { min: Math.min(a, b), max: Math.max(a, b), source: "text" };
  }

  const exactMatch = value.match(/([-+]?[0-9]*\.?[0-9]+)\s*(mV|uV|kV|V)/i);
  if (!exactMatch) return null;
  const voltage = parseVoltage(`${exactMatch[1]}${exactMatch[2]}`);
  return voltage === null ? null : { min: voltage, max: voltage, source: "text" };
};

const exactInterval = (value, source) => ({ min: value, max: value, source });

const shiftInterval = (interval, delta, source) => ({
  min: interval.min + delta,
  max: interval.max + delta,
  source
});

const intervalKnown = (interval) => interval && Number.isFinite(interval.min) && Number.isFinite(interval.max);

const intervalAbove = (a, b) => intervalKnown(a) && intervalKnown(b) && a.min > b.max;

const intervalBelow = (a, b) => intervalKnown(a) && intervalKnown(b) && a.max < b.min;

const maxAbsDelta = (a, b) => {
  if (!intervalKnown(a) || !intervalKnown(b)) return null;
  return Math.max(Math.abs(a.max - b.min), Math.abs(b.max - a.min));
};

const formatVoltage = (value) => `${Number(value.toFixed(6))}V`;

const getTerminalNet = (indexes, refdes, terminal) => indexes.terminalToNet.get(`${refdes}.${terminal}`);

const buildIndexes = (ir, componentLibrary, add) => {
  const nets = new Map();
  const devices = new Map();
  const terminalToNet = new Map();
  const netToTerminals = new Map();
  const connectedTerminalsByRefdes = new Map();

  if (ir.schema_version !== "0.1.0") {
    add("ERROR", "SCHEMA_VERSION", `Unsupported schema_version: ${ir.schema_version}`);
  }

  for (const net of ir.nets ?? []) {
    if (!NET_PATTERN.test(net.id)) add("ERROR", "NET_ID", `Invalid net id: ${net.id}`, net.id);
    if (nets.has(net.id)) add("ERROR", "DUPLICATE_NET", `Duplicate net id: ${net.id}`, net.id);
    nets.set(net.id, net);
    netToTerminals.set(net.id, []);
  }

  for (const device of ir.devices ?? []) {
    if (!REF_DES_PATTERN.test(device.refdes)) add("ERROR", "REFDES", `Invalid refdes: ${device.refdes}`, device.refdes);
    if (devices.has(device.refdes)) add("ERROR", "DUPLICATE_REFDES", `Duplicate refdes: ${device.refdes}`, device.refdes);

    const spec = componentLibrary[device.component_type];
    if (!spec) {
      add("ERROR", "UNKNOWN_COMPONENT", `Unknown component_type ${device.component_type} on ${device.refdes}`, device.refdes);
      continue;
    }

    if (spec.prefix && !device.refdes.startsWith(spec.prefix)) {
      add("WARNING", "REFDES_PREFIX", `${device.refdes} uses component_type ${device.component_type}, expected prefix ${spec.prefix}`, device.refdes);
    }

    for (const required of spec.required_parameters ?? []) {
      if (!(required in (device.parameters ?? {}))) {
        add("ERROR", "REQUIRED_PARAMETER", `${device.refdes} missing required parameter: ${required}`, device.refdes);
      }
    }

    if (spec.boundary_conditions?.requires_package_group && !device.package_group) {
      add("ERROR", "PACKAGE_GROUP_REQUIRED", `${device.refdes} requires package_group`, device.refdes);
    }

    if (spec.boundary_conditions?.requires_unit && !device.unit) {
      add("ERROR", "UNIT_REQUIRED", `${device.refdes} requires unit`, device.refdes);
    }

    const seenMappedTerminals = new Set();
    for (const [pin, terminal] of Object.entries(device.pin_map ?? {})) {
      if (!TERMINAL_PATTERN.test(terminal)) {
        add("ERROR", "PIN_MAP_TERMINAL", `${device.refdes}[${pin}] maps to invalid terminal ${terminal}`, `${device.refdes}[${pin}]`);
      } else if (!terminalAllowedBySpec(spec, terminal, device)) {
        add("ERROR", "PIN_MAP_TERMINAL", `${device.refdes}[${pin}] maps to unknown terminal ${terminal}`, `${device.refdes}[${pin}]`);
      }

      if (seenMappedTerminals.has(terminal)) {
        add("ERROR", "PIN_MAP_DUPLICATE_TERMINAL", `${device.refdes} maps multiple physical pins to terminal ${terminal}`, device.refdes);
      }
      seenMappedTerminals.add(terminal);
    }

    devices.set(device.refdes, { device, spec });
  }

  for (const connection of ir.connections ?? []) {
    if (!nets.has(connection.net)) add("ERROR", "UNKNOWN_NET", `Connection references unknown net: ${connection.net}`, connection.net);
    if (!netToTerminals.has(connection.net)) netToTerminals.set(connection.net, []);

    for (const terminalRef of connection.terminals ?? []) {
      const parsed = parseTerminalRef(terminalRef);
      if (!parsed) {
        add("ERROR", "TERMINAL_REF", `Invalid terminal reference: ${terminalRef}`, terminalRef);
        continue;
      }

      const record = devices.get(parsed.refdes);
      if (!record) {
        add("ERROR", "UNKNOWN_DEVICE", `Terminal ${terminalRef} references unknown device ${parsed.refdes}`, terminalRef);
        continue;
      }

      if (!terminalAllowedBySpec(record.spec, parsed.terminal, record.device)) {
        add("ERROR", "UNKNOWN_TERMINAL", `Terminal ${terminalRef} is not valid for ${record.device.component_type}`, terminalRef);
      }

      const previousNet = terminalToNet.get(terminalRef);
      if (previousNet && previousNet !== connection.net) {
        add("ERROR", "MULTI_NET_TERMINAL", `Terminal ${terminalRef} connects to both ${previousNet} and ${connection.net}`, terminalRef);
      }

      terminalToNet.set(terminalRef, connection.net);
      netToTerminals.get(connection.net).push(terminalRef);

      if (!connectedTerminalsByRefdes.has(parsed.refdes)) connectedTerminalsByRefdes.set(parsed.refdes, new Set());
      connectedTerminalsByRefdes.get(parsed.refdes).add(parsed.terminal);
    }
  }

  return { nets, devices, terminalToNet, netToTerminals, connectedTerminalsByRefdes };
};

const evaluateConstraints = (ir, indexes, add) => {
  const allowedSameNetByTarget = new Map();
  const forbiddenSameNetByTarget = new Map();

  for (const constraint of ir.constraints ?? []) {
    const record = indexes.devices.get(constraint.target);
    if (!record) {
      add("ERROR", "CONSTRAINT_TARGET", `Constraint references unknown target ${constraint.target}`, constraint.target);
      continue;
    }

    const parsed = parseRule(constraint.rule);
    if (parsed.name === "same_net" && parsed.args.length === 2 && constraint.level === "allow") {
      if (!allowedSameNetByTarget.has(constraint.target)) allowedSameNetByTarget.set(constraint.target, new Set());
      allowedSameNetByTarget.get(constraint.target).add(pairKey(parsed.args[0], parsed.args[1]));
    }

    if (parsed.name === "terminal_connected") {
      for (const terminal of parsed.args) {
        const terminalRef = `${constraint.target}.${terminal}`;
        const connected = indexes.terminalToNet.has(terminalRef) || terminalInternallyTied(record.device, terminal);
        if (constraint.level === "must" && !connected) {
          add("ERROR", "CONSTRAINT_TERMINAL_CONNECTED", constraint.message ?? `${terminalRef} must be connected`, terminalRef);
        }
        if (constraint.level === "forbid" && connected) {
          add("ERROR", "CONSTRAINT_TERMINAL_FORBIDDEN", constraint.message ?? `${terminalRef} must not be connected`, terminalRef);
        }
      }
      continue;
    }

    if (parsed.name === "same_net") {
      const [a, b] = parsed.args;
      const netA = indexes.terminalToNet.get(`${constraint.target}.${a}`);
      const netB = indexes.terminalToNet.get(`${constraint.target}.${b}`);
      const same = netA && netB && netA === netB;
      if (constraint.level === "must" && !same) {
        add("ERROR", "CONSTRAINT_SAME_NET_REQUIRED", constraint.message ?? `${constraint.target}.${a} and ${constraint.target}.${b} must be on the same net`, constraint.target);
      }
      if (constraint.level === "forbid" && same) {
        add("ERROR", "CONSTRAINT_SAME_NET_FORBIDDEN", constraint.message ?? `${constraint.target}.${a} and ${constraint.target}.${b} must not be on the same net`, constraint.target);
      }
      continue;
    }

    if (parsed.name === "unpowered_use" && constraint.level === "forbid") {
      const unpowered = deviceLooksUnpowered(record, indexes);
      if (unpowered) add("ERROR", "CONSTRAINT_UNPOWERED_USE", constraint.message ?? `${constraint.target} must not be used without power rails`, constraint.target);
      continue;
    }

    add("WARNING", "CONSTRAINT_UNSUPPORTED", `Unsupported constraint rule: ${constraint.rule}`, constraint.target);
  }

  return { allowedSameNetByTarget, forbiddenSameNetByTarget };
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

const terminalPairSameNet = (refdes, a, b, indexes) => {
  const netA = indexes.terminalToNet.get(`${refdes}.${a}`);
  const netB = indexes.terminalToNet.get(`${refdes}.${b}`);
  return netA && netB && netA === netB;
};

const netHasSeriesCurrentLimit = (netId, indexes) => {
  const terminals = indexes.netToTerminals.get(netId) ?? [];
  return terminals.some((terminalRef) => {
    const parsed = parseTerminalRef(terminalRef);
    if (!parsed) return false;
    const record = indexes.devices.get(parsed.refdes);
    return ["RESISTOR", "CURRENT_SOURCE_DC", "FUSE"].includes(record?.device.component_type);
  });
};

const outputStageNeedsPullup = (device) =>
  ["open_drain", "open_collector"].includes(String(device.parameters?.output_stage ?? "").toLowerCase());

const netHasPullup = (netId, indexes) => {
  const terminals = indexes.netToTerminals.get(netId) ?? [];
  for (const terminalRef of terminals) {
    const parsed = parseTerminalRef(terminalRef);
    if (!parsed) continue;
    const record = indexes.devices.get(parsed.refdes);
    if (!record || record.device.component_type !== "RESISTOR") continue;
    const otherTerminal = record.spec.terminals.find((terminal) => terminal !== parsed.terminal);
    const otherNet = indexes.terminalToNet.get(`${parsed.refdes}.${otherTerminal}`);
    if (indexes.nets.get(otherNet)?.type === "power") return true;
  }
  return false;
};

const inferVoltageIntervals = (indexes, add) => {
  const intervals = new Map();

  for (const [netId, net] of indexes.nets.entries()) {
    if (net.type === "ground" || net.id === "GND") {
      intervals.set(netId, exactInterval(0, "ground"));
      continue;
    }

    const textInterval = parseVoltageIntervalText(`${net.alias ?? ""} ${net.description ?? ""}`);
    if (textInterval && (net.type === "power" || /^[+-]?[0-9]/.test(net.alias ?? ""))) {
      intervals.set(netId, textInterval);
    }
  }

  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;

    for (const { device } of indexes.devices.values()) {
      if (!["VOLTAGE_SOURCE_DC", "VOLTAGE_SOURCE_AC", "SIGNAL_SOURCE"].includes(device.component_type)) continue;
      const positiveTerminal = device.component_type === "SIGNAL_SOURCE" ? "OUT" : "POS";
      const negativeTerminal = device.component_type === "SIGNAL_SOURCE" ? "REF" : "NEG";
      const positiveNet = getTerminalNet(indexes, device.refdes, positiveTerminal);
      const negativeNet = getTerminalNet(indexes, device.refdes, negativeTerminal);
      if (!positiveNet || !negativeNet) continue;

      if (positiveNet === negativeNet) {
        add("ERROR", "SOURCE_SHORT", `${device.refdes} has ${positiveTerminal} and ${negativeTerminal} on the same net`, device.refdes);
        continue;
      }

      const sourceVoltage = parseVoltage(device.parameters?.voltage)
        ?? parseVoltage(device.parameters?.offset)
        ?? parseVoltage(device.parameters?.amplitude);
      if (sourceVoltage === null) continue;

      const positiveInterval = intervals.get(positiveNet);
      const negativeInterval = intervals.get(negativeNet);
      if (intervalKnown(positiveInterval) && intervalKnown(negativeInterval)) {
        const minDelta = positiveInterval.min - negativeInterval.max;
        const maxDelta = positiveInterval.max - negativeInterval.min;
        if (sourceVoltage < minDelta || sourceVoltage > maxDelta) {
          add("ERROR", "SOURCE_VOLTAGE_CONFLICT", `${device.refdes} declares ${formatVoltage(sourceVoltage)} but ${positiveNet}-${negativeNet} is ${formatVoltage(minDelta)}..${formatVoltage(maxDelta)}`, device.refdes);
        }
      }
      if (intervalKnown(negativeInterval) && !intervalKnown(positiveInterval)) {
        intervals.set(positiveNet, shiftInterval(negativeInterval, sourceVoltage, device.refdes));
        changed = true;
      }
      if (intervalKnown(positiveInterval) && !intervalKnown(negativeInterval)) {
        intervals.set(negativeNet, shiftInterval(positiveInterval, -sourceVoltage, device.refdes));
        changed = true;
      }
    }

    if (!changed) break;
  }

  return intervals;
};

const evaluateVoltageAndPolarityRules = (indexes, voltageIntervals, add) => {
  for (const [refdes, { device }] of indexes.devices.entries()) {
    if (device.component_type === "CAPACITOR_POLAR") {
      const positiveNet = getTerminalNet(indexes, refdes, "POS");
      const negativeNet = getTerminalNet(indexes, refdes, "NEG");
      const positive = voltageIntervals.get(positiveNet);
      const negative = voltageIntervals.get(negativeNet);
      if (intervalBelow(positive, negative)) {
        add("ERROR", "REVERSE_POLARITY", `${refdes}.POS voltage is below ${refdes}.NEG`, refdes);
      }

      const rating = parseVoltage(device.parameters?.voltage_rating);
      const stress = maxAbsDelta(positive, negative);
      if (rating !== null && stress !== null && stress > rating) {
        add("ERROR", "VOLTAGE_RATING_EXCEEDED", `${refdes} may see ${formatVoltage(stress)}, above rating ${formatVoltage(rating)}`, refdes);
      }
    }

    if (["DIODE", "LED", "ZENER_DIODE", "SCHOTTKY_DIODE"].includes(device.component_type)) {
      const anode = voltageIntervals.get(getTerminalNet(indexes, refdes, "A"));
      const cathode = voltageIntervals.get(getTerminalNet(indexes, refdes, "K"));
      if (intervalBelow(anode, cathode) && device.component_type !== "ZENER_DIODE") {
        add("WARNING", "DIODE_REVERSE_BIAS", `${refdes}.A appears below ${refdes}.K`, refdes);
      }

      const reverseRating = parseVoltage(device.parameters?.reverse_voltage) ?? parseVoltage(device.parameters?.zener_voltage);
      const reverseStress = intervalKnown(anode) && intervalKnown(cathode) ? cathode.max - anode.min : null;
      if (reverseRating !== null && reverseStress !== null && reverseStress > reverseRating) {
        add("ERROR", "REVERSE_VOLTAGE_EXCEEDED", `${refdes} reverse stress may be ${formatVoltage(reverseStress)}, above rating ${formatVoltage(reverseRating)}`, refdes);
      }
    }

    if (device.component_type.startsWith("MOS_NMOS")) {
      const source = voltageIntervals.get(getTerminalNet(indexes, refdes, "S"));
      const body = voltageIntervals.get(getTerminalNet(indexes, refdes, "B"));
      if (intervalAbove(body, source)) {
        add("WARNING", "MOS_BODY_POLARITY", `${refdes}.B is above ${refdes}.S for an NMOS body`, refdes);
      }
    }

    if (device.component_type.startsWith("MOS_PMOS")) {
      const source = voltageIntervals.get(getTerminalNet(indexes, refdes, "S"));
      const body = voltageIntervals.get(getTerminalNet(indexes, refdes, "B"));
      if (intervalBelow(body, source)) {
        add("WARNING", "MOS_BODY_POLARITY", `${refdes}.B is below ${refdes}.S for a PMOS body`, refdes);
      }
    }

    if (device.component_type === "BJT_NPN") {
      const base = voltageIntervals.get(getTerminalNet(indexes, refdes, "B"));
      const emitter = voltageIntervals.get(getTerminalNet(indexes, refdes, "E"));
      const collector = voltageIntervals.get(getTerminalNet(indexes, refdes, "C"));
      if (intervalBelow(base, emitter)) add("WARNING", "BJT_BIAS_POLARITY", `${refdes}.B appears below ${refdes}.E for NPN bias`, refdes);
      if (intervalBelow(collector, emitter)) add("WARNING", "BJT_CE_POLARITY", `${refdes}.C appears below ${refdes}.E for NPN operation`, refdes);
    }

    if (device.component_type === "BJT_PNP") {
      const base = voltageIntervals.get(getTerminalNet(indexes, refdes, "B"));
      const emitter = voltageIntervals.get(getTerminalNet(indexes, refdes, "E"));
      const collector = voltageIntervals.get(getTerminalNet(indexes, refdes, "C"));
      if (intervalAbove(base, emitter)) add("WARNING", "BJT_BIAS_POLARITY", `${refdes}.B appears above ${refdes}.E for PNP bias`, refdes);
      if (intervalAbove(collector, emitter)) add("WARNING", "BJT_CE_POLARITY", `${refdes}.C appears above ${refdes}.E for PNP operation`, refdes);
    }
  }
};

const evaluateCurrentDirectionRules = (indexes, voltageIntervals, add) => {
  for (const [refdes, { device }] of indexes.devices.entries()) {
    if (device.component_type === "CURRENT_SOURCE_DC") {
      const current = parseCurrent(device.parameters?.current);
      const positiveNet = getTerminalNet(indexes, refdes, "POS");
      const negativeNet = getTerminalNet(indexes, refdes, "NEG");
      const positive = voltageIntervals.get(positiveNet);
      const negative = voltageIntervals.get(negativeNet);
      if (positiveNet === negativeNet) {
        add("ERROR", "CURRENT_SOURCE_SHORT", `${refdes}.POS and ${refdes}.NEG are on the same net`, refdes);
      }
      if (current !== null && current < 0) {
        add("WARNING", "CURRENT_DIRECTION_NEGATIVE", `${refdes} has negative current; declared direction POS->NEG is reversed`, refdes);
      }
      if (current !== null && current > 0 && intervalBelow(positive, negative)) {
        add("WARNING", "CURRENT_SOURCE_COMPLIANCE_RISK", `${refdes} drives POS->NEG while POS is below NEG`, refdes);
      }
    }
  }
};

const evaluatePowerRules = (indexes, voltageIntervals, add) => {
  for (const [refdes, { device }] of indexes.devices.entries()) {
    if (device.component_type !== "RESISTOR") continue;

    const resistance = parseResistance(device.parameters?.resistance);
    if (resistance === null || resistance <= 0) continue;

    const netA = getTerminalNet(indexes, refdes, "A");
    const netB = getTerminalNet(indexes, refdes, "B");
    const voltageA = voltageIntervals.get(netA);
    const voltageB = voltageIntervals.get(netB);
    const voltageStress = maxAbsDelta(voltageA, voltageB);
    if (voltageStress === null) continue;

    const estimatedPower = (voltageStress * voltageStress) / resistance;
    const rating = parsePower(device.parameters?.power_rating);
    if (rating !== null && estimatedPower > rating) {
      add("ERROR", "POWER_RATING_EXCEEDED", `${refdes} dissipates up to ${Number(estimatedPower.toFixed(6))}W, above rating ${Number(rating.toFixed(6))}W`, refdes);
    } else if (rating !== null && estimatedPower > rating * 0.8) {
      add("WARNING", "POWER_RATING_MARGIN", `${refdes} dissipates up to ${Number(estimatedPower.toFixed(6))}W, close to rating ${Number(rating.toFixed(6))}W`, refdes);
    } else if (rating === null && estimatedPower > DEFAULT_RESISTOR_POWER_W) {
      add("WARNING", "POWER_RATING_MISSING", `${refdes} may dissipate ${Number(estimatedPower.toFixed(6))}W; add power_rating`, refdes);
    }
  }
};

const evaluateElectricalModelRules = (indexes, add) => {
  const voltageIntervals = inferVoltageIntervals(indexes, add);
  indexes.voltageIntervals = voltageIntervals;
  evaluateVoltageAndPolarityRules(indexes, voltageIntervals, add);
  evaluateCurrentDirectionRules(indexes, voltageIntervals, add);
  evaluatePowerRules(indexes, voltageIntervals, add);
};

const evaluateBoundaryConditions = (indexes, constraintState, add) => {
  const allowedNoConnect = indexes.allowedNoConnect ?? new Set();
  for (const [refdes, { device, spec }] of indexes.devices.entries()) {
    const connected = indexes.connectedTerminalsByRefdes.get(refdes) ?? new Set();
    const boundary = spec.boundary_conditions ?? {};

    for (const terminal of boundary.required_connected_terminals ?? []) {
      const terminalRef = `${refdes}.${terminal}`;
      if (!connected.has(terminal) && !terminalInternallyTied(device, terminal) && !allowedNoConnect.has(terminalRef)) {
        add("ERROR", "REQUIRED_TERMINAL", `${refdes}.${terminal} is required but not connected`, `${refdes}.${terminal}`);
      }
    }

    if (boundary.body_terminal_policy === "must_connect_or_internal_tie") {
      if (!connected.has("B") && !terminalInternallyTied(device, "B")) {
        add("ERROR", "BODY_TERMINAL", `${refdes}.B body terminal must be connected or internally tied`, `${refdes}.B`);
      }
    }

    if (boundary.declared_terminal_list_required && typeof device.parameters?.terminal_list !== "string") {
      add("ERROR", "TERMINAL_LIST_REQUIRED", `${refdes} requires parameters.terminal_list`, refdes);
    }

    if (boundary.forbid_unpowered_use && deviceLooksUnpowered({ device, spec }, indexes)) {
      add("ERROR", "UNPOWERED_DEVICE", `${refdes} has active circuitry without complete power/return connections`, refdes);
    }

    const allowed = new Set([
      ...pairSet(boundary.allowed_same_net),
      ...(constraintState.allowedSameNetByTarget.get(refdes) ?? [])
    ]);
    const forbidden = new Set([
      ...(constraintState.forbiddenSameNetByTarget.get(refdes) ?? [])
    ]);

    for (const [a, b] of boundary.warn_same_net ?? []) {
      if (terminalPairSameNet(refdes, a, b, indexes) && !allowed.has(pairKey(a, b))) {
        add("WARNING", "SAME_NET_RISK", `${refdes}.${a} and ${refdes}.${b} are on the same net`, refdes);
      }
    }

    for (const key of forbidden) {
      const [a, b] = key.split("\u0000");
      if (terminalPairSameNet(refdes, a, b, indexes)) {
        add("ERROR", "SAME_NET_FORBIDDEN", `${refdes}.${a} and ${refdes}.${b} are forbidden to share a net`, refdes);
      }
    }

    if (boundary.requires_current_limit) {
      const connectedNets = [...connected].map((terminal) => indexes.terminalToNet.get(`${refdes}.${terminal}`)).filter(Boolean);
      if (!connectedNets.some((netId) => netHasSeriesCurrentLimit(netId, indexes))) {
        add("WARNING", "CURRENT_LIMIT", `${refdes} should have an explicit current limiting path`, refdes);
      }
    }

    if (boundary.if_output_stage_open_drain_requires_pullup && outputStageNeedsPullup(device)) {
      const outputNet = indexes.terminalToNet.get(`${refdes}.OUT`);
      if (outputNet && !netHasPullup(outputNet, indexes)) {
        add("WARNING", "PULLUP_REQUIRED", `${refdes}.OUT is ${device.parameters.output_stage} but no pullup path was found on ${outputNet}`, `${refdes}.OUT`);
      }
    }
  }
};

const evaluateNetRisks = (indexes, add) => {
  const hasGround = [...indexes.nets.values()].some((net) => net.type === "ground" || net.id === "GND");
  if (!hasGround) add("WARNING", "NO_GROUND", "Circuit has no ground/reference net");

  for (const [netId, net] of indexes.nets.entries()) {
    const terminals = indexes.netToTerminals.get(netId) ?? [];
    if (terminals.length === 0) {
      add("WARNING", "UNUSED_NET", `Net ${netId} has no connected terminals`, netId);
    }
    if (terminals.length === 1 && net.type !== "input" && net.type !== "output") {
      add("WARNING", "SINGLE_TERMINAL_NET", `Net ${netId} has only one terminal`, netId);
    }

    const activeOutputs = terminals.filter((terminalRef) => {
      const parsed = parseTerminalRef(terminalRef);
      if (!parsed) return false;
      const record = indexes.devices.get(parsed.refdes);
      if (!record) return false;
      return OUTPUT_TERMINALS.has(parsed.terminal)
        && !outputStageNeedsPullup(record.device)
        && record.spec.category !== "connector";
    });

    if (activeOutputs.length > 1) {
      add("WARNING", "OUTPUT_CONTENTION", `Net ${netId} has multiple active outputs: ${activeOutputs.join(", ")}`, netId);
    }
  }
};

export const runErc = (ir, componentLibrary) => {
  const diagnostics = [];
  const add = (level, code, message, target) => diagnostics.push(makeDiagnostic(level, code, message, target));

  const indexes = buildIndexes(ir, componentLibrary, add);
  indexes.allowedNoConnect = new Set(
    (ir.constraints ?? [])
      .filter((constraint) => constraint.level === "allow" && constraint.rule === "no_connect")
      .map((constraint) => constraint.target)
  );
  const constraintState = evaluateConstraints(ir, indexes, add);
  evaluateBoundaryConditions(indexes, constraintState, add);
  evaluateNetRisks(indexes, add);
  evaluateElectricalModelRules(indexes, add);

  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.level === "ERROR"),
    diagnostics,
    errors: diagnostics.filter((diagnostic) => diagnostic.level === "ERROR"),
    warnings: diagnostics.filter((diagnostic) => diagnostic.level === "WARNING"),
    indexes
  };
};
