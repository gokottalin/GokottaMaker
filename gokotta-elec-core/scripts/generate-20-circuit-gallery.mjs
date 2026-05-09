#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(repoRoot, "output", "twenty-circuits");
const schemaVersion = "0.1.0";

function net(id, type, description = id) {
  return { id, type, description };
}

function device(refdes, component_type, parameters = {}, extra = {}) {
  return { refdes, component_type, parameters, ...extra };
}

function connection(netId, terminals) {
  return {
    net: netId,
    terminals: terminals.map(([refdes, pin]) => `${refdes}.${pin}`),
  };
}

function ir(id, title, nets, devices, connections, description = title) {
  return {
    schema_version: schemaVersion,
    circuit_id: id,
    title,
    description,
    nets,
    devices,
    connections,
  };
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: node ${args.join(" ")}`,
        result.stdout,
        result.stderr,
      ].filter(Boolean).join("\n"),
    );
  }
  return result;
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "ms-playwright", "chromium-1217", "chrome-win64", "chrome.exe")
      : null,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function renderPng(svgPath, pngPath) {
  const chrome = chromePath();
  if (!chrome) return false;
  const url = pathToFileURL(svgPath).href;
  const result = spawnSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--window-size=1120,760",
    `--screenshot=${pngPath}`,
    url,
  ], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `Chrome screenshot failed: ${svgPath}`,
        result.stdout,
        result.stderr,
      ].filter(Boolean).join("\n"),
    );
  }
  return true;
}

function renderGalleryPng(htmlPath, pngPath) {
  const chrome = chromePath();
  if (!chrome) return false;
  const result = spawnSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--window-size=2400,3200",
    `--screenshot=${pngPath}`,
    pathToFileURL(htmlPath).href,
  ], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `Chrome gallery screenshot failed: ${htmlPath}`,
        result.stdout,
        result.stderr,
      ].filter(Boolean).join("\n"),
    );
  }
  return true;
}

function voltageDivider({ index, slug, title, vin, rTop, rBottom }) {
  return {
    index,
    slug,
    ir: ir(
      `CIRCUIT_${String(index).padStart(2, "0")}_${slug.replaceAll("-", "_").toUpperCase()}`,
      title,
      [
        net("VIN", "input", "input supply"),
        net("VOUT", "output", "divided output"),
        net("GND", "ground", "ground reference"),
      ],
      [
        device("V1", "VOLTAGE_SOURCE_DC", { voltage: vin }),
        device("R1", "RESISTOR", { resistance: rTop }),
        device("R2", "RESISTOR", { resistance: rBottom }),
      ],
      [
        connection("VIN", [["V1", "POS"], ["R1", "A"]]),
        connection("VOUT", [["R1", "B"], ["R2", "A"]]),
        connection("GND", [["V1", "NEG"], ["R2", "B"]]),
      ],
    ),
  };
}

function rcLowPass({ index, slug, title, amplitude, frequency, resistance, capacitance }) {
  return {
    index,
    slug,
    ir: ir(
      `CIRCUIT_${String(index).padStart(2, "0")}_${slug.replaceAll("-", "_").toUpperCase()}`,
      title,
      [
        net("VIN", "input", "signal input"),
        net("VOUT", "output", "filtered output"),
        net("GND", "ground", "ground reference"),
      ],
      [
        device("V1", "SIGNAL_SOURCE", { waveform: "sine", amplitude, frequency }),
        device("R1", "RESISTOR", { resistance }),
        device("C1", "CAPACITOR_NONPOLAR", { capacitance }),
      ],
      [
        connection("VIN", [["V1", "OUT"], ["R1", "A"]]),
        connection("VOUT", [["R1", "B"], ["C1", "A"]]),
        connection("GND", [["V1", "REF"], ["C1", "B"]]),
      ],
    ),
  };
}

function commonEmitterNpn({ index, slug, title, vcc, rbTop, rbBottom, rc, re, inputCap }) {
  return {
    index,
    slug,
    ir: ir(
      `CIRCUIT_${String(index).padStart(2, "0")}_${slug.replaceAll("-", "_").toUpperCase()}`,
      title,
      [
        net("VCC", "power", "positive supply"),
        net("VIN", "input", "ac input"),
        net("N_IN", "internal", "coupled input"),
        net("N_BIAS", "internal", "base bias"),
        net("VOUT", "output", "collector output"),
        net("N_E", "internal", "emitter node"),
        net("GND", "ground", "ground reference"),
      ],
      [
        device("V1", "VOLTAGE_SOURCE_DC", { voltage: vcc }),
        device("V2", "SIGNAL_SOURCE", { waveform: "sine", amplitude: "50mV", frequency: "1kHz" }),
        device("Q1", "BJT_NPN", { model: "2N3904" }),
        device("R1", "RESISTOR", { resistance: rbTop }),
        device("R2", "RESISTOR", { resistance: rbBottom }),
        device("R3", "RESISTOR", { resistance: rc }),
        device("R4", "RESISTOR", { resistance: re }),
        device("C1", "CAPACITOR_NONPOLAR", { capacitance: inputCap }),
      ],
      [
        connection("VCC", [["V1", "POS"], ["R1", "A"], ["R3", "A"]]),
        connection("VIN", [["V2", "OUT"], ["C1", "A"]]),
        connection("N_IN", [["C1", "B"], ["Q1", "B"], ["R1", "B"], ["R2", "A"]]),
        connection("VOUT", [["R3", "B"], ["Q1", "C"]]),
        connection("N_E", [["Q1", "E"], ["R4", "A"]]),
        connection("GND", [["V1", "NEG"], ["V2", "REF"], ["R2", "B"], ["R4", "B"]]),
      ],
    ),
  };
}

function commonEmitterPnp({ index, slug, title, vcc, rbTop, rbBottom, rc, re, inputCap }) {
  return {
    index,
    slug,
    ir: ir(
      `CIRCUIT_${String(index).padStart(2, "0")}_${slug.replaceAll("-", "_").toUpperCase()}`,
      title,
      [
        net("VCC", "power", "positive supply"),
        net("VIN", "input", "ac input"),
        net("N_IN", "internal", "coupled input"),
        net("N_BIAS", "internal", "base bias"),
        net("VOUT", "output", "collector output"),
        net("N_E", "internal", "emitter node"),
        net("GND", "ground", "ground reference"),
      ],
      [
        device("V1", "VOLTAGE_SOURCE_DC", { voltage: vcc }),
        device("V2", "SIGNAL_SOURCE", { waveform: "sine", amplitude: "50mV", frequency: "1kHz" }),
        device("Q1", "BJT_PNP", { model: "2N3906" }),
        device("R1", "RESISTOR", { resistance: rbTop }),
        device("R2", "RESISTOR", { resistance: rbBottom }),
        device("R3", "RESISTOR", { resistance: rc }),
        device("R4", "RESISTOR", { resistance: re }),
        device("C1", "CAPACITOR_NONPOLAR", { capacitance: inputCap }),
      ],
      [
        connection("VCC", [["V1", "POS"], ["R1", "A"], ["R4", "A"]]),
        connection("VIN", [["V2", "OUT"], ["C1", "A"]]),
        connection("N_IN", [["C1", "B"], ["Q1", "B"], ["R1", "B"], ["R2", "A"]]),
        connection("N_E", [["Q1", "E"], ["R4", "B"]]),
        connection("VOUT", [["Q1", "C"], ["R3", "A"]]),
        connection("GND", [["V1", "NEG"], ["V2", "REF"], ["R2", "B"], ["R3", "B"]]),
      ],
    ),
  };
}

function emitterFollowerNpn({ index, slug, title, vcc, rbTop, rbBottom, re, inputCap }) {
  return {
    index,
    slug,
    ir: ir(
      `CIRCUIT_${String(index).padStart(2, "0")}_${slug.replaceAll("-", "_").toUpperCase()}`,
      title,
      [
        net("VCC", "power", "positive supply"),
        net("VIN", "input", "ac input"),
        net("N_IN", "internal", "coupled input"),
        net("N_BIAS", "internal", "base bias"),
        net("VOUT", "output", "emitter output"),
        net("GND", "ground", "ground reference"),
      ],
      [
        device("V1", "VOLTAGE_SOURCE_DC", { voltage: vcc }),
        device("V2", "SIGNAL_SOURCE", { waveform: "sine", amplitude: "100mV", frequency: "1kHz" }),
        device("Q1", "BJT_NPN", { model: "2N3904" }),
        device("R1", "RESISTOR", { resistance: rbTop }),
        device("R2", "RESISTOR", { resistance: rbBottom }),
        device("R3", "RESISTOR", { resistance: re }),
        device("C1", "CAPACITOR_NONPOLAR", { capacitance: inputCap }),
      ],
      [
        connection("VCC", [["V1", "POS"], ["Q1", "C"], ["R1", "A"]]),
        connection("VIN", [["V2", "OUT"], ["C1", "A"]]),
        connection("N_IN", [["C1", "B"], ["Q1", "B"], ["R1", "B"], ["R2", "A"]]),
        connection("VOUT", [["Q1", "E"], ["R3", "A"]]),
        connection("GND", [["V1", "NEG"], ["V2", "REF"], ["R2", "B"], ["R3", "B"]]),
      ],
    ),
  };
}

function npnLedSwitch({ index, slug, title, vcc, ledResistor, baseResistor, ledColor }) {
  return {
    index,
    slug,
    ir: ir(
      `CIRCUIT_${String(index).padStart(2, "0")}_${slug.replaceAll("-", "_").toUpperCase()}`,
      title,
      [
        net("VCC", "power", "positive supply"),
        net("CTRL", "input", "control input"),
        net("N_LED_A", "internal", "led anode"),
        net("N_COL", "internal", "collector node"),
        net("N_BASE", "internal", "base node"),
        net("GND", "ground", "ground reference"),
      ],
      [
        device("V1", "VOLTAGE_SOURCE_DC", { voltage: vcc }),
        device("R1", "RESISTOR", { resistance: ledResistor }),
        device("D1", "LED", { color: ledColor }),
        device("Q1", "BJT_NPN", { model: "2N3904" }),
        device("R2", "RESISTOR", { resistance: baseResistor }),
      ],
      [
        connection("VCC", [["V1", "POS"], ["R1", "A"]]),
        connection("N_LED_A", [["R1", "B"], ["D1", "A"]]),
        connection("N_COL", [["D1", "K"], ["Q1", "C"]]),
        connection("CTRL", [["R2", "A"]]),
        connection("N_BASE", [["R2", "B"], ["Q1", "B"]]),
        connection("GND", [["V1", "NEG"], ["Q1", "E"]]),
      ],
    ),
  };
}

function pnpLedSwitch({ index, slug, title, vcc, loadResistor, baseResistor, pullup, ledColor }) {
  return {
    index,
    slug,
    ir: ir(
      `CIRCUIT_${String(index).padStart(2, "0")}_${slug.replaceAll("-", "_").toUpperCase()}`,
      title,
      [
        net("VCC", "power", "positive supply"),
        net("CTRL", "input", "active-low control input"),
        net("N_BASE", "internal", "base node"),
        net("N_COL", "internal", "collector node"),
        net("N_LED_A", "internal", "led anode"),
        net("GND", "ground", "ground reference"),
      ],
      [
        device("V1", "VOLTAGE_SOURCE_DC", { voltage: vcc }),
        device("Q1", "BJT_PNP", { model: "2N3906" }),
        device("R1", "RESISTOR", { resistance: loadResistor }),
        device("D1", "LED", { color: ledColor }),
        device("R2", "RESISTOR", { resistance: baseResistor }),
        device("R3", "RESISTOR", { resistance: pullup }),
      ],
      [
        connection("VCC", [["V1", "POS"], ["Q1", "E"], ["R3", "A"]]),
        connection("CTRL", [["R2", "A"]]),
        connection("N_BASE", [["R2", "B"], ["R3", "B"], ["Q1", "B"]]),
        connection("N_COL", [["Q1", "C"], ["R1", "A"]]),
        connection("N_LED_A", [["R1", "B"], ["D1", "A"]]),
        connection("GND", [["V1", "NEG"], ["D1", "K"]]),
      ],
    ),
  };
}

function cmosInverter({ index, slug, title, vcc }) {
  return {
    index,
    slug,
    ir: ir(
      `CIRCUIT_${String(index).padStart(2, "0")}_${slug.replaceAll("-", "_").toUpperCase()}`,
      title,
      [
        net("VDD", "power", "logic supply"),
        net("VIN", "input", "logic input"),
        net("VOUT", "output", "logic output"),
        net("GND", "ground", "ground reference"),
      ],
      [
        device("V1", "VOLTAGE_SOURCE_DC", { voltage: vcc }),
        device("MP1", "MOS_PMOS_ENHANCEMENT", { model: "generic PMOS" }, { internal_ties: [["B", "S"]] }),
        device("MN1", "MOS_NMOS_ENHANCEMENT", { model: "generic NMOS" }, { internal_ties: [["B", "S"]] }),
      ],
      [
        connection("VDD", [["V1", "POS"], ["MP1", "S"]]),
        connection("VIN", [["MP1", "G"], ["MN1", "G"]]),
        connection("VOUT", [["MP1", "D"], ["MN1", "D"]]),
        connection("GND", [["V1", "NEG"], ["MN1", "S"]]),
      ],
    ),
  };
}

function opampNonInverting({ index, slug, title, vcc, rf, rg, amplitude }) {
  return {
    index,
    slug,
    ir: ir(
      `CIRCUIT_${String(index).padStart(2, "0")}_${slug.replaceAll("-", "_").toUpperCase()}`,
      title,
      [
        net("VCC", "power", "positive supply"),
        net("VIN", "input", "signal input"),
        net("VOUT", "output", "amplified output"),
        net("N_FB", "internal", "feedback node"),
        net("GND", "ground", "ground reference"),
      ],
      [
        device("V1", "VOLTAGE_SOURCE_DC", { voltage: vcc }),
        device("V2", "SIGNAL_SOURCE", { waveform: "sine", amplitude, frequency: "1kHz" }),
        device("U1", "OPAMP_SINGLE", { model: "generic op amp" }),
        device("R1", "RESISTOR", { resistance: rf }),
        device("R2", "RESISTOR", { resistance: rg }),
      ],
      [
        connection("VCC", [["V1", "POS"], ["U1", "V+"]]),
        connection("VIN", [["V2", "OUT"], ["U1", "IN+"]]),
        connection("VOUT", [["U1", "OUT"], ["R1", "A"]]),
        connection("N_FB", [["R1", "B"], ["R2", "A"], ["U1", "IN-"]]),
        connection("GND", [["V1", "NEG"], ["V2", "REF"], ["R2", "B"], ["U1", "V-"]]),
      ],
    ),
  };
}

const circuits = [
  voltageDivider({ index: 1, slug: "voltage-divider-5v-half", title: "Voltage Divider 5V Half", vin: "5V", rTop: "10kOhm", rBottom: "10kOhm" }),
  voltageDivider({ index: 2, slug: "voltage-divider-12v-third", title: "Voltage Divider 12V One Third", vin: "12V", rTop: "20kOhm", rBottom: "10kOhm" }),
  voltageDivider({ index: 3, slug: "sensor-bias-divider-3v3", title: "Sensor Bias Divider 3.3V", vin: "3.3V", rTop: "47kOhm", rBottom: "10kOhm" }),
  rcLowPass({ index: 4, slug: "rc-lowpass-audio", title: "RC Low Pass Audio", amplitude: "1V", frequency: "1kHz", resistance: "1kOhm", capacitance: "100nF" }),
  rcLowPass({ index: 5, slug: "rc-lowpass-antialias", title: "RC Low Pass Anti Alias", amplitude: "1V", frequency: "10kHz", resistance: "2.2kOhm", capacitance: "10nF" }),
  rcLowPass({ index: 6, slug: "rc-lowpass-debounce", title: "RC Low Pass Debounce", amplitude: "3.3V", frequency: "100Hz", resistance: "10kOhm", capacitance: "1uF" }),
  commonEmitterNpn({ index: 7, slug: "npn-common-emitter-small-signal", title: "NPN Common Emitter Small Signal", vcc: "12V", rbTop: "100kOhm", rbBottom: "22kOhm", rc: "4.7kOhm", re: "1kOhm", inputCap: "1uF" }),
  commonEmitterNpn({ index: 8, slug: "npn-common-emitter-high-gain", title: "NPN Common Emitter High Gain", vcc: "12V", rbTop: "180kOhm", rbBottom: "33kOhm", rc: "10kOhm", re: "1.5kOhm", inputCap: "470nF" }),
  commonEmitterNpn({ index: 9, slug: "npn-common-emitter-low-voltage", title: "NPN Common Emitter Low Voltage", vcc: "5V", rbTop: "47kOhm", rbBottom: "10kOhm", rc: "2.2kOhm", re: "470Ohm", inputCap: "1uF" }),
  commonEmitterPnp({ index: 10, slug: "pnp-common-emitter-small-signal", title: "PNP Common Emitter Small Signal", vcc: "12V", rbTop: "22kOhm", rbBottom: "100kOhm", rc: "4.7kOhm", re: "1kOhm", inputCap: "1uF" }),
  commonEmitterPnp({ index: 11, slug: "pnp-common-emitter-inverter-stage", title: "PNP Common Emitter Inverter Stage", vcc: "5V", rbTop: "10kOhm", rbBottom: "47kOhm", rc: "2.2kOhm", re: "680Ohm", inputCap: "470nF" }),
  emitterFollowerNpn({ index: 12, slug: "npn-emitter-follower-buffer", title: "NPN Emitter Follower Buffer", vcc: "12V", rbTop: "100kOhm", rbBottom: "47kOhm", re: "2.2kOhm", inputCap: "1uF" }),
  emitterFollowerNpn({ index: 13, slug: "npn-emitter-follower-low-z", title: "NPN Emitter Follower Low Z", vcc: "9V", rbTop: "68kOhm", rbBottom: "33kOhm", re: "1kOhm", inputCap: "2.2uF" }),
  npnLedSwitch({ index: 14, slug: "npn-low-side-red-led-switch", title: "NPN Low Side Red LED Switch", vcc: "5V", ledResistor: "330Ohm", baseResistor: "10kOhm", ledColor: "red" }),
  npnLedSwitch({ index: 15, slug: "npn-low-side-blue-led-switch", title: "NPN Low Side Blue LED Switch", vcc: "12V", ledResistor: "1kOhm", baseResistor: "22kOhm", ledColor: "blue" }),
  pnpLedSwitch({ index: 16, slug: "pnp-high-side-green-led-switch", title: "PNP High Side Green LED Switch", vcc: "5V", loadResistor: "330Ohm", baseResistor: "10kOhm", pullup: "47kOhm", ledColor: "green" }),
  pnpLedSwitch({ index: 17, slug: "pnp-high-side-amber-led-switch", title: "PNP High Side Amber LED Switch", vcc: "12V", loadResistor: "1kOhm", baseResistor: "22kOhm", pullup: "100kOhm", ledColor: "amber" }),
  cmosInverter({ index: 18, slug: "cmos-inverter-5v", title: "CMOS Inverter 5V", vcc: "5V" }),
  cmosInverter({ index: 19, slug: "cmos-inverter-3v3", title: "CMOS Inverter 3.3V", vcc: "3.3V" }),
  opampNonInverting({ index: 20, slug: "opamp-noninverting-gain-2", title: "Op Amp Non Inverting Gain 2", vcc: "5V", rf: "10kOhm", rg: "10kOhm", amplitude: "100mV" }),
];

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

const records = [];

for (const circuit of circuits) {
  const stem = `${String(circuit.index).padStart(2, "0")}-${circuit.slug}`;
  const dir = path.join(outputRoot, stem);
  fs.mkdirSync(dir, { recursive: true });
  const irPath = path.join(dir, `${stem}.ir.json`);
  const svgPath = path.join(dir, `${stem}.svg`);
  const pngPath = path.join(dir, `${stem}.png`);

  fs.writeFileSync(irPath, `${JSON.stringify(circuit.ir, null, 2)}\n`, "utf8");
  runNode(["scripts/elec-cli.mjs", "validate", irPath]);
  runNode(["scripts/render-svg.mjs", irPath, svgPath]);
  const hasPng = renderPng(svgPath, pngPath);

  records.push({
    index: circuit.index,
    title: circuit.ir.title,
    stem,
    irPath,
    svgPath,
    pngPath: hasPng ? pngPath : null,
  });
}

const galleryHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Twenty Circuit Gallery</title>
  <style>
    body {
      margin: 0;
      padding: 28px;
      background: #eef1f5;
      font: 14px/1.35 Arial, sans-serif;
      color: #17202a;
    }
    h1 {
      margin: 0 0 22px;
      font-size: 28px;
      font-weight: 700;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
    }
    .card {
      background: white;
      border: 1px solid #d9e0e8;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(17, 24, 39, 0.08);
    }
    .card img {
      display: block;
      width: 100%;
      aspect-ratio: 1120 / 760;
      object-fit: contain;
      background: white;
    }
    .caption {
      padding: 9px 11px 11px;
      border-top: 1px solid #edf1f5;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <h1>Twenty Circuit Gallery</h1>
  <div class="grid">
${records.map((record) => {
  const src = record.pngPath
    ? `./${record.stem}/${record.stem}.png`
    : `./${record.stem}/${record.stem}.svg`;
  return `    <figure class="card"><img src="${src}" alt="${record.title}"><figcaption class="caption">${String(record.index).padStart(2, "0")}. ${record.title}</figcaption></figure>`;
}).join("\n")}
  </div>
</body>
</html>
`;

const galleryPath = path.join(outputRoot, "gallery.html");
const galleryPngPath = path.join(outputRoot, "gallery.png");
fs.writeFileSync(galleryPath, galleryHtml, "utf8");
const hasGalleryPng = renderGalleryPng(galleryPath, galleryPngPath);

const summary = [
  "# Twenty Circuit Gallery",
  "",
  `Generated ${records.length} circuits.`,
  "",
  `Gallery HTML: ${galleryPath}`,
  hasGalleryPng ? `Gallery PNG: ${galleryPngPath}` : "Gallery PNG: not generated because Chrome was not found.",
  "",
  "| # | Circuit | SVG | PNG |",
  "|---|---|---|---|",
  ...records.map((record) => {
    const relSvg = path.relative(outputRoot, record.svgPath).replaceAll("\\", "/");
    const relPng = record.pngPath ? path.relative(outputRoot, record.pngPath).replaceAll("\\", "/") : "";
    return `| ${String(record.index).padStart(2, "0")} | ${record.title} | [svg](${relSvg}) | ${record.pngPath ? `[png](${relPng})` : ""} |`;
  }),
  "",
].join("\n");

fs.writeFileSync(path.join(outputRoot, "README.md"), summary, "utf8");

console.log(`Generated ${records.length} circuits in ${outputRoot}`);
console.log(`Gallery: ${galleryPath}`);
if (hasGalleryPng) console.log(`Preview: ${galleryPngPath}`);
