import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const inputArg = process.argv[2] ?? "output/sample-01/Sample-01-voltage-divider.ir.json";
const outputArg = process.argv[3] ?? "output/common-emitter.svg";

const resolvePath = (value) => path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
const inputPath = resolvePath(inputArg);
const outputPath = resolvePath(outputArg);
const ir = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const devices = ir.devices ?? [];
const nets = ir.nets ?? [];
const connections = ir.connections ?? [];
const netById = new Map(nets.map((net) => [net.id, net]));
const terminalPattern = /^([A-Z][A-Z0-9_]*[0-9]+)\.([A-Z][A-Z0-9_+\-]*)$/;
const netByTerminal = new Map();
const terminalsByDevice = new Map();

for (const connection of connections) {
  for (const terminalRef of connection.terminals ?? []) {
    const match = terminalRef.match(terminalPattern);
    if (!match) continue;
    const [, refdes, terminal] = match;
    const record = { refdes, terminal, terminalRef, net: connection.net };
    netByTerminal.set(terminalRef, connection.net);
    if (!terminalsByDevice.has(refdes)) terminalsByDevice.set(refdes, []);
    terminalsByDevice.get(refdes).push(record);
  }
}

const width = 1120;
const height = 760;
const inputTagVerticalOffset = 54;
const inputTagTipOffset = 74;
const inputTagRotatedTipOffset = 54;
const inputTagCollisionPadding = 6;
const lines = [];
const add = (line) => lines.push(line);
const drawnSegments = [];
const placedInputTagBoxes = [];

const netOf = (refdes, terminal) => netByTerminal.get(`${refdes}.${terminal}`);
const findDevice = (predicate) => devices.find(predicate);
const deviceRecords = (device) => terminalsByDevice.get(device.refdes) ?? [];
const deviceHasNets = (device, ...netIds) => {
  const actual = new Set(deviceRecords(device).map((record) => record.net));
  return netIds.every((netId) => actual.has(netId));
};
const findTwoTerminalBetween = (type, netA, netB, exclude = new Set()) => {
  if (!netA || !netB || netA === netB) return undefined;
  return devices.find((device) => {
    if (exclude.has(device.refdes) || device.component_type !== type) return false;
    return deviceHasNets(device, netA, netB);
  });
};

const paramValue = (device, preferred = []) => {
  if (device.value) return device.value;
  const params = device.parameters ?? {};
  for (const key of preferred) {
    if (params[key] !== undefined) return params[key];
  }
  if (device.model && preferred.includes("model")) return device.model;
  const firstKey = Object.keys(params)[0];
  return firstKey ? params[firstKey] : device.model ?? device.component_type;
};

const beginSvg = () => {
  add(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`);
  add(`<title id="title">${esc(ir.circuit?.title ?? ir.circuit?.id ?? "Circuit schematic")}</title>`);
  add(`<desc id="desc">Script generated schematic SVG from Circuit IR.</desc>`);
  add(`<style>
    .background { fill: #f8fafc; }
    .sheet { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1.2; }
    .title { fill: #0f172a; font: 700 22px Arial, sans-serif; }
    .subtitle { fill: #475569; font: 12px Arial, sans-serif; }
    .wire, .symbol, .port { fill: none; stroke: #0f172a; stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round; }
    .symbol-fill { fill: #ffffff; stroke: #0f172a; stroke-width: 2.1; }
    .symbol-arrow { fill: #0f172a; stroke: none; }
    .junction { fill: #0f172a; }
    .refdes { fill: #0f172a; font: 700 13px Arial, sans-serif; }
    .value { fill: #475569; font: 11px Arial, sans-serif; }
    .terminal { fill: #64748b; font: 10px Arial, sans-serif; }
    .polarity { fill: #0f172a; font: 700 17px Arial, sans-serif; }
    .net-label { fill: #1d4ed8; font: 700 12px Arial, sans-serif; }
    .net-tag { fill: #ffffff; stroke: #0f172a; stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round; }
    .net-tag-text { font: 700 12px Arial, sans-serif; }
    .net-power { fill: #dc2626; }
    .net-ground { fill: #334155; }
    .net-input { fill: #16a34a; }
    .net-output { fill: #2563eb; }
  </style>`);
  add(`<rect class="background" width="${width}" height="${height}" />`);
  add(`<rect class="sheet" x="28" y="24" width="${width - 56}" height="${height - 48}" rx="3" />`);
  add(`<text class="title" x="58" y="60">${esc(ir.circuit?.title ?? ir.circuit?.id ?? "Circuit schematic")}</text>`);
  add(`<text class="subtitle" x="58" y="80">IR ${esc(ir.schema_version)} | schematic symbols | ${devices.length} devices | ${nets.length} nets</text>`);
};

const endSvg = () => add(`</svg>`);
const segmentBounds = (segment) => ({
  x1: Math.min(segment.a.x, segment.b.x),
  y1: Math.min(segment.a.y, segment.b.y),
  x2: Math.max(segment.a.x, segment.b.x),
  y2: Math.max(segment.a.y, segment.b.y)
});
const inflateRect = (rect, padding) => ({
  x1: rect.x1 - padding,
  y1: rect.y1 - padding,
  x2: rect.x2 + padding,
  y2: rect.y2 + padding
});
const rectsIntersect = (a, b) =>
  a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;
const pointInRect = (point, rect) =>
  point.x >= rect.x1 && point.x <= rect.x2 && point.y >= rect.y1 && point.y <= rect.y2;
const orientation = (a, b, c) => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.001) return 0;
  return value > 0 ? 1 : 2;
};
const pointOnSegment = (a, b, c) =>
  b.x <= Math.max(a.x, c.x) + 0.001 && b.x >= Math.min(a.x, c.x) - 0.001
  && b.y <= Math.max(a.y, c.y) + 0.001 && b.y >= Math.min(a.y, c.y) - 0.001;
const segmentsIntersect = (s1, s2) => {
  const { a: p1, b: q1 } = s1;
  const { a: p2, b: q2 } = s2;
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(p1, p2, q1)) return true;
  if (o2 === 0 && pointOnSegment(p1, q2, q1)) return true;
  if (o3 === 0 && pointOnSegment(p2, p1, q2)) return true;
  return o4 === 0 && pointOnSegment(p2, q1, q2);
};
const segmentIntersectsRect = (segment, rect) => {
  if (!rectsIntersect(segmentBounds(segment), rect)) return false;
  if (pointInRect(segment.a, rect) || pointInRect(segment.b, rect)) return true;
  const edges = [
    { a: { x: rect.x1, y: rect.y1 }, b: { x: rect.x2, y: rect.y1 } },
    { a: { x: rect.x2, y: rect.y1 }, b: { x: rect.x2, y: rect.y2 } },
    { a: { x: rect.x2, y: rect.y2 }, b: { x: rect.x1, y: rect.y2 } },
    { a: { x: rect.x1, y: rect.y2 }, b: { x: rect.x1, y: rect.y1 } }
  ];
  return edges.some((edge) => segmentsIntersect(segment, edge));
};
const recordWireSegments = (points) => {
  for (let i = 1; i < points.length; i += 1) {
    drawnSegments.push({ a: points[i - 1], b: points[i] });
  }
};
const wire = (points) => {
  if (points.length < 2) return;
  recordWireSegments(points);
  add(`<path class="wire" d="${points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}" />`);
};
const junction = (x, y) => add(`<circle class="junction" cx="${x}" cy="${y}" r="4" />`);
const netLabel = (id, x, y, anchor = "middle") => {
  const klass = netById.get(id)?.type ? ` net-${netById.get(id).type}` : "";
  add(`<text class="net-label${klass}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(id)}</text>`);
};
const powerPort = (netId, x, y) => {
  add(`<path class="port" d="M ${x - 18} ${y} L ${x + 18} ${y} M ${x} ${y} L ${x} ${y + 22}" />`);
  netLabel(netId, x, y - 8);
};
const negativePort = (netId, x, y) => {
  add(`<path class="port" d="M ${x - 18} ${y} L ${x + 18} ${y} M ${x} ${y} L ${x} ${y - 22}" />`);
  netLabel(netId, x, y + 20);
};
const groundPort = (x, y, netId = "GND") => {
  add(`<path class="port" d="M ${x} ${y} L ${x} ${y + 12} M ${x - 18} ${y + 12} L ${x + 18} ${y + 12} M ${x - 12} ${y + 20} L ${x + 12} ${y + 20} M ${x - 6} ${y + 28} L ${x + 6} ${y + 28}" />`);
  if (netId) netLabel(netId, x + 28, y + 22, "start");
};
const inputPort = (netId, x, y) => {
  const klass = netById.get(netId)?.type ? ` net-${netById.get(netId).type}` : "";
  add(`<path class="net-tag" d="M ${x} ${y - 14} L ${x + 54} ${y - 14} L ${x + 74} ${y} L ${x + 54} ${y + 14} L ${x} ${y + 14} Z" />`);
  add(`<text class="net-tag-text${klass}" x="${x + 32}" y="${y + 5}" text-anchor="middle">${esc(netId)}</text>`);
};
const inputPortRotated = (netId, x, y) => {
  const klass = netById.get(netId)?.type ? ` net-${netById.get(netId).type}` : "";
  add(`<path class="net-tag" d="M ${x} ${y - 37} L ${x + 34} ${y - 37} L ${x + 54} ${y} L ${x + 34} ${y + 37} L ${x} ${y + 37} Z" />`);
  add(`<text class="net-tag-text${klass}" x="${x + 23}" y="${y + 4}" text-anchor="middle" transform="rotate(-90 ${x + 23} ${y + 4})">${esc(netId)}</text>`);
};
const inputTagYFor = (mainY, placement = "normal") => {
  if (placement === "above") return mainY - inputTagVerticalOffset;
  if (placement === "below") return mainY + inputTagVerticalOffset;
  if (placement === "far-above") return mainY - inputTagVerticalOffset * 2;
  if (placement === "far-below") return mainY + inputTagVerticalOffset * 2;
  return mainY;
};
const inputTagRect = (x, y, rotated = false) => rotated
  ? { x1: x, y1: y - 37, x2: x + 54, y2: y + 37 }
  : { x1: x, y1: y - 14, x2: x + 74, y2: y + 14 };
const inputTagIsClear = (rect) => {
  const padded = inflateRect(rect, inputTagCollisionPadding);
  if (padded.x1 < 34 || padded.x2 > width - 34 || padded.y1 < 92 || padded.y2 > height - 48) return false;
  if (placedInputTagBoxes.some((box) => rectsIntersect(padded, inflateRect(box, inputTagCollisionPadding)))) return false;
  return !drawnSegments.some((segment) => segmentIntersectsRect(segment, padded));
};
const inputPortCandidate = (x, mainY, joinX, placement, rotated = false) => {
  const tagY = inputTagYFor(mainY, placement);
  const tipOffset = rotated ? inputTagRotatedTipOffset : inputTagTipOffset;
  const path = tagY === mainY
    ? [{ x: x + tipOffset, y: tagY }, { x: joinX, y: mainY }]
    : [{ x: x + tipOffset, y: tagY }, { x: joinX, y: tagY }, { x: joinX, y: mainY }];
  return {
    x,
    tagY,
    rotated,
    path,
    rect: inputTagRect(x, tagY, rotated)
  };
};
const inputPortToNet = (netId, x, mainY, joinX, placement = "auto") => {
  const normalPlacements = placement === "auto"
    ? ["normal", "above", "below", "far-above", "far-below"]
    : [placement, "above", "below", "normal", "far-above", "far-below"];
  const rotatedPlacements = placement === "auto"
    ? ["normal", "above", "below", "far-above", "far-below"]
    : [placement, "normal", "above", "below", "far-above", "far-below"];
  const candidates = [
    ...normalPlacements.map((candidatePlacement) => inputPortCandidate(x, mainY, joinX, candidatePlacement, false)),
    ...rotatedPlacements.map((candidatePlacement) => inputPortCandidate(x, mainY, joinX, candidatePlacement, true))
  ];
  const chosen = candidates.find((candidate) => inputTagIsClear(candidate.rect))
    ?? candidates.find((candidate) => candidate.rotated)
    ?? candidates[0];

  if (chosen.rotated) {
    inputPortRotated(netId, chosen.x, chosen.tagY);
  } else {
    inputPort(netId, chosen.x, chosen.tagY);
  }
  placedInputTagBoxes.push(chosen.rect);
  wire(chosen.path);
  return { x: joinX, y: mainY };
};
const outputPort = (netId, x, y) => {
  const klass = netById.get(netId)?.type ? ` net-${netById.get(netId).type}` : "";
  add(`<path class="net-tag" d="M ${x - 74} ${y - 14} L ${x - 20} ${y - 14} L ${x} ${y} L ${x - 20} ${y + 14} L ${x - 74} ${y + 14} Z" />`);
  add(`<text class="net-tag-text${klass}" x="${x - 42}" y="${y + 5}" text-anchor="middle">${esc(netId)}</text>`);
};

const drawResistor = ({ device, x1, y1, x2, y2, labelSide = "right", labelPosition = "above" }) => {
  const vertical = Math.abs(x1 - x2) < Math.abs(y1 - y2);
  const body = 72;
  const amp = 9;
  const segments = 8;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const points = [];

  if (vertical) {
    const sign = y2 >= y1 ? 1 : -1;
    const bodyStart = cy - sign * body / 2;
    const bodyEnd = cy + sign * body / 2;
    wire([{ x: x1, y: y1 }, { x: x1, y: bodyStart }]);
    wire([{ x: x2, y: bodyEnd }, { x: x2, y: y2 }]);
    for (let i = 0; i <= segments; i += 1) {
      const y = bodyStart + sign * body * i / segments;
      const x = i === 0 || i === segments ? cx : cx + (i % 2 ? amp : -amp);
      points.push({ x, y });
    }
    wire(points);
  } else {
    const sign = x2 >= x1 ? 1 : -1;
    const bodyStart = cx - sign * body / 2;
    const bodyEnd = cx + sign * body / 2;
    wire([{ x: x1, y: y1 }, { x: bodyStart, y: y1 }]);
    wire([{ x: bodyEnd, y: y2 }, { x: x2, y: y2 }]);
    for (let i = 0; i <= segments; i += 1) {
      const x = bodyStart + sign * body * i / segments;
      const y = i === 0 || i === segments ? cy : cy + (i % 2 ? amp : -amp);
      points.push({ x, y });
    }
    wire(points);
  }

  const tx = vertical ? cx + (labelSide === "left" ? -38 : 38) : cx - 20;
  const ty = vertical ? cy - 8 : cy + (labelPosition === "below" ? 34 : -26);
  const anchor = vertical && labelSide === "left" ? "end" : "start";
  add(`<text class="refdes" x="${tx}" y="${ty}" text-anchor="${anchor}">${esc(device.refdes)}</text>`);
  add(`<text class="value" x="${tx}" y="${ty + 15}" text-anchor="${anchor}">${esc(paramValue(device, ["resistance"]))}</text>`);
};

const drawCapacitor = ({ device, x1, y1, x2, y2 }) => {
  const cx = Math.round((x1 + x2) / 2);
  wire([{ x: x1, y: y1 }, { x: cx - 10, y: y1 }]);
  wire([{ x: cx + 10, y: y2 }, { x: x2, y: y2 }]);
  add(`<path class="symbol" d="M ${cx - 10} ${y1 - 28} L ${cx - 10} ${y1 + 28} M ${cx + 10} ${y1 - 28} L ${cx + 10} ${y1 + 28}" />`);
  add(`<text class="refdes" x="${cx}" y="${y1 - 38}" text-anchor="middle">${esc(device.refdes)}</text>`);
  add(`<text class="value" x="${cx}" y="${y1 + 50}" text-anchor="middle">${esc(paramValue(device, ["capacitance"]))}</text>`);
};

const drawCapacitorVertical = ({ device, x, yTop, yBottom, labelSide = "right" }) => {
  const cy = Math.round((yTop + yBottom) / 2);
  wire([{ x, y: yTop }, { x, y: cy - 10 }]);
  wire([{ x, y: cy + 10 }, { x, y: yBottom }]);
  add(`<path class="symbol" d="M ${x - 28} ${cy - 10} L ${x + 28} ${cy - 10} M ${x - 28} ${cy + 10} L ${x + 28} ${cy + 10}" />`);
  const tx = x + (labelSide === "left" ? -44 : 44);
  const anchor = labelSide === "left" ? "end" : "start";
  add(`<text class="refdes" x="${tx}" y="${cy - 6}" text-anchor="${anchor}">${esc(device.refdes)}</text>`);
  add(`<text class="value" x="${tx}" y="${cy + 11}" text-anchor="${anchor}">${esc(paramValue(device, ["capacitance"]))}</text>`);
};

const drawVoltageSource = ({ device, x, topY, bottomY }) => {
  const cy = Math.round((topY + bottomY) / 2);
  wire([{ x, y: topY }, { x, y: cy - 30 }]);
  wire([{ x, y: cy + 30 }, { x, y: bottomY }]);
  add(`<circle class="symbol-fill" cx="${x}" cy="${cy}" r="30" />`);
  add(`<text class="polarity" x="${x}" y="${cy - 10}" text-anchor="middle">+</text>`);
  add(`<text class="polarity" x="${x}" y="${cy + 22}" text-anchor="middle">-</text>`);
  add(`<text class="refdes" x="${x - 42}" y="${cy - 4}" text-anchor="end">${esc(device.refdes)}</text>`);
  add(`<text class="value" x="${x - 42}" y="${cy + 13}" text-anchor="end">${esc(paramValue(device, ["voltage", "amplitude", "waveform"]))}</text>`);
};

const drawLedVertical = ({ device, x, yTop, yBottom }) => {
  const cy = Math.round((yTop + yBottom) / 2);
  wire([{ x, y: yTop }, { x, y: cy - 28 }]);
  wire([{ x, y: cy + 28 }, { x, y: yBottom }]);
  add(`<path class="symbol" d="M ${x - 24} ${cy - 18} L ${x + 24} ${cy - 18} L ${x} ${cy + 18} Z M ${x - 24} ${cy + 18} L ${x + 24} ${cy + 18}" />`);
  add(`<path class="symbol" d="M ${x + 28} ${cy - 25} L ${x + 44} ${cy - 41} M ${x + 38} ${cy - 41} L ${x + 44} ${cy - 41} L ${x + 44} ${cy - 35} M ${x + 18} ${cy - 32} L ${x + 34} ${cy - 48} M ${x + 28} ${cy - 48} L ${x + 34} ${cy - 48} L ${x + 34} ${cy - 42}" />`);
  add(`<text class="refdes" x="${x + 54}" y="${cy - 5}">${esc(device.refdes)}</text>`);
  add(`<text class="value" x="${x + 54}" y="${cy + 12}">${esc(paramValue(device, ["color"]))}</text>`);
};

const drawBjt = ({ device, x, y }) => {
  const isPnp = device.component_type === "BJT_PNP";
  const arrow = (tipX, tipY, dirX, dirY) => {
    const length = Math.hypot(dirX, dirY);
    const ux = dirX / length;
    const uy = dirY / length;
    const px = -uy;
    const py = ux;
    const baseX = tipX - ux * 13;
    const baseY = tipY - uy * 13;
    const p1 = `${tipX.toFixed(1)},${tipY.toFixed(1)}`;
    const p2 = `${(baseX + px * 6.5).toFixed(1)},${(baseY + py * 6.5).toFixed(1)}`;
    const p3 = `${(baseX - px * 6.5).toFixed(1)},${(baseY - py * 6.5).toFixed(1)}`;
    add(`<polygon class="symbol-arrow" points="${p1} ${p2} ${p3}" />`);
  };

  add(`<circle class="symbol-fill" cx="${x}" cy="${y}" r="44" />`);
  add(`<path class="symbol" d="M ${x - 26} ${y - 30} L ${x - 26} ${y + 30}" />`);
  add(`<path class="symbol" d="M ${x - 26} ${y - 16} L ${x + 24} ${y - 42}" />`);
  add(`<path class="symbol" d="M ${x - 26} ${y + 16} L ${x + 24} ${y + 42}" />`);
  if (isPnp) {
    arrow(x - 13, y - 23, -50, 26);
  } else {
    arrow(x + 20, y + 40, 50, 26);
  }
  wire([{ x: x - 74, y }, { x: x - 26, y }]);
  wire([{ x: x + 24, y: y - 42 }, { x: x + 24, y: y - 76 }]);
  wire([{ x: x + 24, y: y + 42 }, { x: x + 24, y: y + 76 }]);
  add(`<text class="terminal" x="${x - 40}" y="${y - 8}">B</text>`);
  add(`<text class="terminal" x="${x + 38}" y="${y - 48}">${isPnp ? "E" : "C"}</text>`);
  add(`<text class="terminal" x="${x + 38}" y="${y + 60}">${isPnp ? "C" : "E"}</text>`);
  add(`<text class="refdes" x="${x + 56}" y="${y - 6}">${esc(device.refdes)}</text>`);
  add(`<text class="value" x="${x + 56}" y="${y + 11}">${esc(paramValue(device, ["model"]))} ${isPnp ? "PNP" : "NPN"}</text>`);
  return {
    B: { x: x - 74, y },
    C: { x: x + 24, y: isPnp ? y + 76 : y - 76 },
    E: { x: x + 24, y: isPnp ? y - 76 : y + 76 }
  };
};

const drawMosNmos = ({ device, x, y }) => {
  add(`<path class="symbol" d="M ${x - 30} ${y - 36} L ${x - 30} ${y + 36} M ${x - 12} ${y - 38} L ${x - 12} ${y - 10} M ${x - 12} ${y + 10} L ${x - 12} ${y + 38}" />`);
  add(`<path class="symbol" d="M ${x - 12} ${y - 26} L ${x + 28} ${y - 26} L ${x + 28} ${y - 62} M ${x - 12} ${y + 26} L ${x + 28} ${y + 26} L ${x + 28} ${y + 62} M ${x - 30} ${y} L ${x - 72} ${y}" />`);
  add(`<path class="symbol" d="M ${x + 2} ${y + 8} L ${x + 16} ${y} L ${x + 2} ${y - 8}" />`);
  add(`<text class="terminal" x="${x - 50}" y="${y - 8}">G</text>`);
  add(`<text class="terminal" x="${x + 40}" y="${y - 42}">D</text>`);
  add(`<text class="terminal" x="${x + 40}" y="${y + 55}">S</text>`);
  add(`<text class="refdes" x="${x + 52}" y="${y - 5}">${esc(device.refdes)}</text>`);
  add(`<text class="value" x="${x + 52}" y="${y + 12}">${esc(paramValue(device, ["model"]))}</text>`);
  return { G: { x: x - 72, y }, D: { x: x + 28, y: y - 62 }, S: { x: x + 28, y: y + 62 } };
};

const drawMosPmos = ({ device, x, y }) => {
  add(`<path class="symbol" d="M ${x - 30} ${y - 36} L ${x - 30} ${y + 36} M ${x - 12} ${y - 38} L ${x - 12} ${y - 10} M ${x - 12} ${y + 10} L ${x - 12} ${y + 38}" />`);
  add(`<path class="symbol" d="M ${x - 12} ${y - 26} L ${x + 28} ${y - 26} L ${x + 28} ${y - 62} M ${x - 12} ${y + 26} L ${x + 28} ${y + 26} L ${x + 28} ${y + 62} M ${x - 30} ${y} L ${x - 46} ${y}" />`);
  add(`<circle class="symbol-fill" cx="${x - 52}" cy="${y}" r="6" />`);
  wire([{ x: x - 86, y }, { x: x - 58, y }]);
  add(`<path class="symbol" d="M ${x + 16} ${y - 8} L ${x + 2} ${y} L ${x + 16} ${y + 8}" />`);
  add(`<text class="terminal" x="${x - 64}" y="${y - 8}">G</text>`);
  add(`<text class="terminal" x="${x + 40}" y="${y - 42}">S</text>`);
  add(`<text class="terminal" x="${x + 40}" y="${y + 55}">D</text>`);
  add(`<text class="refdes" x="${x + 52}" y="${y - 5}">${esc(device.refdes)}</text>`);
  add(`<text class="value" x="${x + 52}" y="${y + 12}">${esc(paramValue(device, ["model"]))}</text>`);
  return { G: { x: x - 86, y }, S: { x: x + 28, y: y - 62 }, D: { x: x + 28, y: y + 62 } };
};

const drawOpamp = ({ device, x, y }) => {
  add(`<path class="symbol-fill" d="M ${x - 70} ${y - 72} L ${x - 70} ${y + 72} L ${x + 76} ${y} Z" />`);
  wire([{ x: x - 118, y: y - 32 }, { x: x - 70, y: y - 32 }]);
  wire([{ x: x - 118, y: y + 32 }, { x: x - 70, y: y + 32 }]);
  wire([{ x: x + 76, y }, { x: x + 126, y }]);
  add(`<text class="terminal" x="${x - 62}" y="${y - 28}">+</text>`);
  add(`<text class="terminal" x="${x - 62}" y="${y + 36}">-</text>`);
  add(`<text class="refdes" x="${x - 10}" y="${y - 8}" text-anchor="middle">${esc(device.refdes)}</text>`);
  add(`<text class="value" x="${x - 10}" y="${y + 10}" text-anchor="middle">${esc(paramValue(device, ["model"]))}</text>`);
  return {
    "IN+": { x: x - 118, y: y - 32 },
    "IN-": { x: x - 118, y: y + 32 },
    OUT: { x: x + 126, y },
    "V+": { x, y: y - 72 },
    "V-": { x, y: y + 72 }
  };
};

const renderEmitterFollower = () => {
  const q = findDevice((d) => d.component_type === "BJT_NPN" || d.component_type === "BJT_PNP");
  if (!q) return false;
  const isPnp = q.component_type === "BJT_PNP";
  const collectorNet = netOf(q.refdes, "C");
  const baseNet = netOf(q.refdes, "B");
  const emitterNet = netOf(q.refdes, "E");
  const outputNet = nets.find((net) => net.type === "output")?.id;
  const powerNet = nets.find((net) => net.type === "power")?.id;
  const groundNet = nets.find((net) => net.type === "ground")?.id;
  const inputNet = nets.find((net) => net.type === "input")?.id;
  if (!collectorNet || !baseNet || !emitterNet || outputNet !== emitterNet || !powerNet || !groundNet) return false;

  const used = new Set([q.refdes]);
  const biasTop = findTwoTerminalBetween("RESISTOR", powerNet, baseNet, used); if (biasTop) used.add(biasTop.refdes);
  const biasBottom = findTwoTerminalBetween("RESISTOR", baseNet, groundNet, used); if (biasBottom) used.add(biasBottom.refdes);
  const emitterLoad = findTwoTerminalBetween("RESISTOR", emitterNet, isPnp ? powerNet : groundNet, used); if (emitterLoad) used.add(emitterLoad.refdes);
  const inputCap = inputNet ? devices.find((d) => d.component_type.startsWith("CAPACITOR") && !used.has(d.refdes) && deviceHasNets(d, inputNet, baseNet)) : undefined;
  const source = devices.find((d) => d.component_type === "VOLTAGE_SOURCE_DC" && deviceHasNets(d, powerNet, groundNet));
  if (!emitterLoad) return false;

  beginSvg();
  const railY = 132, groundY = 624, qX = 610, qY = 360, dividerX = 350, inputX = 190, sourceX = 105;
  const baseNode = { x: 420, y: qY };
  const collectorNode = { x: qX + 24, y: isPnp ? qY + 118 : qY - 118 };
  const emitterNode = { x: qX + 24, y: isPnp ? qY - 118 : qY + 118 };

  powerPort(powerNet, dividerX, railY);
  wire([{ x: dividerX, y: railY + 22 }, { x: qX + 24, y: railY + 22 }]);
  junction(dividerX, railY + 22);
  if (source) {
    drawVoltageSource({ device: source, x: sourceX, topY: railY + 22, bottomY: groundY });
    wire([{ x: sourceX, y: railY + 22 }, { x: dividerX, y: railY + 22 }]);
    groundPort(sourceX, groundY, groundNet);
  }

  const pins = drawBjt({ device: q, x: qX, y: qY });
  wire([baseNode, pins.B]);
  wire([collectorNode, pins.C]);
  wire([emitterNode, pins.E]);

  if (isPnp) {
    groundPort(collectorNode.x, groundY, groundNet);
    wire([collectorNode, { x: collectorNode.x, y: groundY }]);
  } else {
    powerPort(powerNet, collectorNode.x, railY);
    wire([{ x: collectorNode.x, y: railY + 22 }, collectorNode]);
    junction(collectorNode.x, railY + 22);
  }

  if (biasTop) drawResistor({ device: biasTop, x1: dividerX, y1: railY + 22, x2: dividerX, y2: baseNode.y, labelSide: "left" });
  if (biasBottom) drawResistor({ device: biasBottom, x1: dividerX, y1: baseNode.y, x2: dividerX, y2: groundY, labelSide: "left" });
  wire([{ x: dividerX, y: baseNode.y }, baseNode]);
  junction(dividerX, baseNode.y);
  groundPort(dividerX, groundY, groundNet);
  if (inputCap && inputNet) {
    const inputJoin = inputPortToNet(inputNet, inputX, baseNode.y, inputX + 100);
    drawCapacitor({ device: inputCap, x1: inputJoin.x, y1: baseNode.y, x2: dividerX, y2: baseNode.y });
  }

  drawResistor({
    device: emitterLoad,
    x1: emitterNode.x,
    y1: emitterNode.y,
    x2: emitterNode.x,
    y2: isPnp ? railY + 22 : groundY
  });
  if (isPnp) {
    powerPort(powerNet, emitterNode.x, railY);
    junction(emitterNode.x, railY + 22);
  } else {
    groundPort(emitterNode.x, groundY, groundNet);
  }
  wire([emitterNode, { x: 846, y: emitterNode.y }]);
  junction(emitterNode.x, emitterNode.y);
  outputPort(outputNet, 920, emitterNode.y);
  netLabel(baseNet, baseNode.x + 10, baseNode.y - 14, "start");
  endSvg();
  return true;
};

const renderCommonEmitter = () => {
  const q = findDevice((d) => d.component_type === "BJT_NPN" || d.component_type === "BJT_PNP");
  if (!q) return false;
  const isPnp = q.component_type === "BJT_PNP";
  const collectorNet = netOf(q.refdes, "C");
  const baseNet = netOf(q.refdes, "B");
  const emitterNet = netOf(q.refdes, "E");
  const powerNet = nets.find((net) => net.type === "power")?.id;
  const groundNet = nets.find((net) => net.type === "ground")?.id;
  const inputNet = nets.find((net) => net.type === "input")?.id;
  const outputNet = nets.find((net) => net.type === "output")?.id ?? collectorNet;
  if (!collectorNet || !baseNet || !emitterNet || !powerNet || !groundNet) return false;

  const used = new Set([q.refdes]);
  const collectorReferenceNet = isPnp ? groundNet : powerNet;
  const emitterReferenceNet = isPnp ? powerNet : groundNet;
  const collectorR = findTwoTerminalBetween("RESISTOR", collectorReferenceNet, collectorNet, used); if (collectorR) used.add(collectorR.refdes);
  const emitterR = findTwoTerminalBetween("RESISTOR", emitterNet, emitterReferenceNet, used); if (emitterR) used.add(emitterR.refdes);
  const biasTop = findTwoTerminalBetween("RESISTOR", powerNet, baseNet, used); if (biasTop) used.add(biasTop.refdes);
  const biasBottom = findTwoTerminalBetween("RESISTOR", baseNet, groundNet, used); if (biasBottom) used.add(biasBottom.refdes);
  const inputCap = inputNet ? devices.find((d) => d.component_type.startsWith("CAPACITOR") && !used.has(d.refdes) && deviceHasNets(d, inputNet, baseNet)) : undefined;
  const source = devices.find((d) => d.component_type === "VOLTAGE_SOURCE_DC" && deviceHasNets(d, powerNet, groundNet));
  if (!collectorR) return false;

  beginSvg();
  const railY = 132, groundY = 624, qX = 610, qY = 360, dividerX = 350, inputX = 190, sourceX = 105;
  const baseNode = { x: 420, y: qY };
  const collectorNode = { x: qX + 24, y: isPnp ? qY + 118 : qY - 118 };
  const emitterNode = { x: qX + 24, y: isPnp ? qY - 118 : qY + 118 };

  powerPort(powerNet, qX + 24, railY);
  powerPort(powerNet, dividerX, railY);
  wire([{ x: qX + 24, y: railY + 22 }, { x: dividerX, y: railY + 22 }]);
  junction(qX + 24, railY + 22);
  junction(dividerX, railY + 22);
  if (source) {
    drawVoltageSource({ device: source, x: sourceX, topY: railY + 22, bottomY: groundY });
    wire([{ x: sourceX, y: railY + 22 }, { x: dividerX, y: railY + 22 }]);
    groundPort(sourceX, groundY, groundNet);
  }
  if (collectorR) {
    drawResistor({
      device: collectorR,
      x1: collectorNode.x,
      y1: isPnp ? collectorNode.y : railY + 22,
      x2: collectorNode.x,
      y2: isPnp ? groundY : collectorNode.y
    });
    if (isPnp) groundPort(collectorNode.x, groundY, groundNet);
  }
  const pins = drawBjt({ device: q, x: qX, y: qY });
  wire([collectorNode, pins.C]);
  wire([emitterNode, pins.E]);
  wire([baseNode, pins.B]);
  junction(collectorNode.x, collectorNode.y);
  if (emitterR) {
    drawResistor({
      device: emitterR,
      x1: emitterNode.x,
      y1: isPnp ? railY + 22 : emitterNode.y,
      x2: emitterNode.x,
      y2: isPnp ? emitterNode.y : groundY
    });
    if (isPnp) {
      powerPort(powerNet, emitterNode.x, railY);
      junction(emitterNode.x, railY + 22);
    } else {
      groundPort(emitterNode.x, groundY, groundNet);
    }
  } else if (isPnp) {
    wire([{ x: emitterNode.x, y: railY + 22 }, emitterNode]);
    powerPort(powerNet, emitterNode.x, railY);
    junction(emitterNode.x, railY + 22);
  }
  if (biasTop) drawResistor({ device: biasTop, x1: dividerX, y1: railY + 22, x2: dividerX, y2: baseNode.y, labelSide: "left" });
  if (biasBottom) drawResistor({ device: biasBottom, x1: dividerX, y1: baseNode.y, x2: dividerX, y2: groundY, labelSide: "left" });
  wire([{ x: dividerX, y: baseNode.y }, baseNode]);
  junction(dividerX, baseNode.y);
  groundPort(dividerX, groundY, groundNet);
  if (inputCap && inputNet) {
    const inputJoin = inputPortToNet(inputNet, inputX, baseNode.y, inputX + 100);
    drawCapacitor({ device: inputCap, x1: inputJoin.x, y1: baseNode.y, x2: dividerX, y2: baseNode.y });
  }
  wire([collectorNode, { x: 846, y: collectorNode.y }]);
  outputPort(outputNet, 920, collectorNode.y);
  netLabel(baseNet, baseNode.x + 10, baseNode.y - 14, "start");
  netLabel(emitterNet, emitterNode.x + 12, emitterNode.y + 20, "start");
  endSvg();
  return true;
};

const renderBjtLedSwitch = () => {
  const q = findDevice((d) => d.component_type === "BJT_NPN" || d.component_type === "BJT_PNP");
  const led = findDevice((d) => d.component_type === "LED");
  if (!q || !led) return false;

  const isPnp = q.component_type === "BJT_PNP";
  const powerNet = nets.find((net) => net.type === "power")?.id;
  const groundNet = nets.find((net) => net.type === "ground")?.id;
  const inputNet = nets.find((net) => net.type === "input")?.id;
  const baseNet = netOf(q.refdes, "B");
  const collectorNet = netOf(q.refdes, "C");
  const emitterNet = netOf(q.refdes, "E");
  const ledAnodeNet = netOf(led.refdes, "A");
  const ledCathodeNet = netOf(led.refdes, "K");
  if (!powerNet || !groundNet || !inputNet || !baseNet || !collectorNet || !emitterNet || !ledAnodeNet || !ledCathodeNet) return false;

  const used = new Set([q.refdes, led.refdes]);
  let loadResistor;
  let baseResistor;
  let basePullup;
  if (isPnp) {
    if (emitterNet !== powerNet || ledCathodeNet !== groundNet) return false;
    loadResistor = findTwoTerminalBetween("RESISTOR", collectorNet, ledAnodeNet, used);
    basePullup = findTwoTerminalBetween("RESISTOR", powerNet, baseNet, new Set([...used, loadResistor?.refdes].filter(Boolean)));
    baseResistor = findTwoTerminalBetween("RESISTOR", inputNet, baseNet, new Set([...used, loadResistor?.refdes, basePullup?.refdes].filter(Boolean)));
  } else {
    if (emitterNet !== groundNet || ledCathodeNet !== collectorNet) return false;
    loadResistor = findTwoTerminalBetween("RESISTOR", powerNet, ledAnodeNet, used);
    baseResistor = findTwoTerminalBetween("RESISTOR", inputNet, baseNet, new Set([...used, loadResistor?.refdes].filter(Boolean)));
  }
  if (!loadResistor || !baseResistor) return false;

  const source = devices.find((d) => d.component_type === "VOLTAGE_SOURCE_DC" && deviceHasNets(d, powerNet, groundNet));
  beginSvg();

  const railY = 132;
  const groundY = 624;
  const sourceX = 120;
  const ctrlX = 210;
  const qX = 610;
  const qY = isPnp ? 300 : 470;
  const loadX = qX + 24;
  const baseNode = { x: 430, y: qY };

  powerPort(powerNet, loadX, railY);
  if (source) {
    drawVoltageSource({ device: source, x: sourceX, topY: railY + 22, bottomY: groundY });
    wire([{ x: sourceX, y: railY + 22 }, { x: loadX, y: railY + 22 }]);
    groundPort(sourceX, groundY, groundNet);
  }

  const pins = drawBjt({ device: q, x: qX, y: qY });
  wire([baseNode, pins.B]);

  const inputJoin = inputPortToNet(inputNet, ctrlX, baseNode.y, ctrlX + 108);
  drawResistor({ device: baseResistor, x1: inputJoin.x, y1: baseNode.y, x2: baseNode.x, y2: baseNode.y, labelPosition: "below" });
  junction(baseNode.x, baseNode.y);

  if (isPnp) {
    wire([{ x: loadX, y: railY + 22 }, pins.E]);
    junction(loadX, railY + 22);
    if (basePullup) {
      drawResistor({ device: basePullup, x1: baseNode.x, y1: railY + 22, x2: baseNode.x, y2: baseNode.y, labelSide: "left" });
      junction(baseNode.x, railY + 22);
    }
    wire([{ x: baseNode.x, y: baseNode.y }, { x: baseNode.x, y: pins.B.y }]);
    drawResistor({ device: loadResistor, x1: pins.C.x, y1: pins.C.y, x2: pins.C.x, y2: 470 });
    netLabel(collectorNet, pins.C.x + 16, pins.C.y + 22, "start");
    drawLedVertical({ device: led, x: pins.C.x, yTop: 470, yBottom: 560 });
    netLabel(ledAnodeNet, pins.C.x + 16, 464, "start");
    wire([{ x: pins.C.x, y: 560 }, { x: pins.C.x, y: groundY }]);
    groundPort(pins.C.x, groundY, groundNet);
  } else {
    drawResistor({ device: loadResistor, x1: loadX, y1: railY + 22, x2: loadX, y2: 255 });
    junction(loadX, railY + 22);
    netLabel(ledAnodeNet, loadX + 16, 250, "start");
    drawLedVertical({ device: led, x: loadX, yTop: 255, yBottom: 365 });
    netLabel(collectorNet, loadX + 16, 386, "start");
    wire([{ x: loadX, y: 365 }, pins.C]);
    wire([pins.E, { x: pins.E.x, y: groundY }]);
    groundPort(pins.E.x, groundY, groundNet);
  }

  netLabel(baseNet, baseNode.x + 10, baseNode.y - 14, "start");
  endSvg();
  return true;
};

const renderNmosLedSwitch = () => {
  const mos = findDevice((d) => d.component_type === "MOS_NMOS_ENHANCEMENT");
  const led = findDevice((d) => d.component_type === "LED");
  if (!mos || !led) return false;
  const powerNet = nets.find((net) => net.type === "power")?.id;
  const groundNet = nets.find((net) => net.type === "ground")?.id;
  const inputNet = nets.find((net) => net.type === "input")?.id;
  const drainNet = netOf(mos.refdes, "D");
  const ledAnodeNet = netOf(led.refdes, "A");
  if (!powerNet || !groundNet || !inputNet || !drainNet || !ledAnodeNet) return false;
  const resistor = findTwoTerminalBetween("RESISTOR", powerNet, ledAnodeNet);
  const source = devices.find((d) => d.component_type === "VOLTAGE_SOURCE_DC" && deviceHasNets(d, powerNet, groundNet));
  if (!resistor) return false;

  beginSvg();
  const railY = 132, groundY = 624, x = 590, mosY = 462, sourceX = 120, ctrlX = 255;
  powerPort(powerNet, x, railY);
  if (source) {
    drawVoltageSource({ device: source, x: sourceX, topY: railY + 22, bottomY: groundY });
    wire([{ x: sourceX, y: railY + 22 }, { x, y: railY + 22 }]);
    groundPort(sourceX, groundY, groundNet);
  }
  junction(x, railY + 22);
  drawResistor({ device: resistor, x1: x, y1: railY + 22, x2: x, y2: 270 });
  netLabel(ledAnodeNet, x + 16, 264, "start");
  drawLedVertical({ device: led, x, yTop: 270, yBottom: 365 });
  netLabel(drainNet, x + 16, 386, "start");
  const pins = drawMosNmos({ device: mos, x, y: mosY });
  wire([{ x, y: 365 }, pins.D]);
  wire([pins.S, { x: pins.S.x, y: groundY }]);
  groundPort(pins.S.x, groundY, groundNet);
  const ctrlJoin = inputPortToNet(inputNet, ctrlX, pins.G.y, ctrlX + 108);
  wire([ctrlJoin, pins.G]);
  endSvg();
  return true;
};

const renderCmosInverter = () => {
  const nmos = findDevice((d) => d.component_type === "MOS_NMOS_ENHANCEMENT");
  const pmos = findDevice((d) => d.component_type === "MOS_PMOS_ENHANCEMENT");
  if (!nmos || !pmos) return false;

  const powerNet = netOf(pmos.refdes, "S");
  const groundNet = netOf(nmos.refdes, "S");
  const inputNet = netOf(nmos.refdes, "G");
  const outputNet = netOf(nmos.refdes, "D");
  if (!powerNet || !groundNet || !inputNet || !outputNet) return false;
  if (netOf(pmos.refdes, "G") !== inputNet || netOf(pmos.refdes, "D") !== outputNet) return false;

  const source = devices.find((d) => d.component_type === "VOLTAGE_SOURCE_DC" && deviceHasNets(d, powerNet, groundNet));
  beginSvg();

  const railY = 132;
  const groundY = 624;
  const mosX = 600;
  const pmosY = 262;
  const nmosY = 488;
  const sourceX = 120;
  const inputX = 190;
  const gateBusX = 395;
  const gateMidY = Math.round((pmosY + nmosY) / 2);

  powerPort(powerNet, mosX + 28, railY);
  if (source) {
    drawVoltageSource({ device: source, x: sourceX, topY: railY + 22, bottomY: groundY });
    wire([{ x: sourceX, y: railY + 22 }, { x: mosX + 28, y: railY + 22 }]);
    groundPort(sourceX, groundY, groundNet);
  }

  const pPins = drawMosPmos({ device: pmos, x: mosX, y: pmosY });
  const nPins = drawMosNmos({ device: nmos, x: mosX, y: nmosY });
  wire([{ x: pPins.S.x, y: railY + 22 }, pPins.S]);
  junction(pPins.S.x, railY + 22);

  const outputY = Math.round((pPins.D.y + nPins.D.y) / 2);
  wire([pPins.D, { x: pPins.D.x, y: outputY }, { x: 846, y: outputY }]);
  wire([nPins.D, { x: nPins.D.x, y: outputY }]);
  junction(pPins.D.x, outputY);
  outputPort(outputNet, 920, outputY);

  wire([nPins.S, { x: nPins.S.x, y: groundY }]);
  groundPort(nPins.S.x, groundY, groundNet);

  const inputJoin = inputPortToNet(inputNet, inputX, gateMidY, inputX + 108);
  wire([inputJoin, { x: gateBusX, y: gateMidY }]);
  wire([{ x: gateBusX, y: pPins.G.y }, { x: gateBusX, y: nPins.G.y }]);
  wire([{ x: gateBusX, y: pPins.G.y }, pPins.G]);
  wire([{ x: gateBusX, y: nPins.G.y }, nPins.G]);
  junction(gateBusX, gateMidY);

  endSvg();
  return true;
};

const renderOpampNonInverting = () => {
  const opamp = findDevice((d) => d.component_type === "OPAMP_SINGLE");
  if (!opamp) return false;
  const positiveSupplyNet = netOf(opamp.refdes, "V+");
  const negativeSupplyNet = netOf(opamp.refdes, "V-");
  const groundNet = nets.find((net) => net.type === "ground")?.id;
  const inputNet = netOf(opamp.refdes, "IN+");
  const outputNet = netOf(opamp.refdes, "OUT");
  const feedbackNet = netOf(opamp.refdes, "IN-");
  if (!positiveSupplyNet || !negativeSupplyNet || !groundNet || !inputNet || !outputNet || !feedbackNet) return false;
  const rFeedback = findTwoTerminalBetween("RESISTOR", outputNet, feedbackNet);
  const rGround = findTwoTerminalBetween("RESISTOR", feedbackNet, groundNet, new Set([rFeedback?.refdes].filter(Boolean)));
  const vcc = devices.find((d) => d.component_type === "VOLTAGE_SOURCE_DC" && deviceHasNets(d, positiveSupplyNet, groundNet));
  const negativeSupplyIsGround = negativeSupplyNet === groundNet || netById.get(negativeSupplyNet)?.type === "ground";
  const vee = negativeSupplyIsGround
    ? undefined
    : devices.find((d) => d.component_type === "VOLTAGE_SOURCE_DC" && d.refdes !== vcc?.refdes && deviceHasNets(d, negativeSupplyNet, groundNet));
  const sig = devices.find((d) => d.component_type === "SIGNAL_SOURCE" && deviceHasNets(d, inputNet, groundNet));
  if (!rFeedback || !rGround) return false;

  beginSvg();
  const opX = 620, opY = 352, groundY = 624, railY = 132, vccSourceX = 115, veeSourceX = 205, signalSourceX = 300;
  const pins = drawOpamp({ device: opamp, x: opX, y: opY });
  powerPort(positiveSupplyNet, pins["V+"].x, railY);
  wire([{ x: pins["V+"].x, y: railY + 22 }, pins["V+"]]);
  junction(pins["V+"].x, railY + 22);
  if (negativeSupplyIsGround) {
    wire([pins["V-"], { x: pins["V-"].x, y: groundY - 34 }]);
    groundPort(pins["V-"].x, groundY - 34, groundNet);
  } else {
    wire([pins["V-"], { x: pins["V-"].x, y: groundY - 22 }]);
    negativePort(negativeSupplyNet, pins["V-"].x, groundY);
  }
  if (vcc) {
    drawVoltageSource({ device: vcc, x: vccSourceX, topY: railY + 22, bottomY: groundY });
    wire([{ x: vccSourceX, y: railY + 22 }, { x: pins["V+"].x, y: railY + 22 }]);
    groundPort(vccSourceX, groundY, groundNet);
  }
  if (vee) {
    drawVoltageSource({ device: vee, x: veeSourceX, topY: 440, bottomY: groundY - 22 });
    groundPort(veeSourceX, 440, groundNet);
    wire([{ x: veeSourceX, y: groundY - 22 }, { x: pins["V-"].x, y: groundY - 22 }]);
  }
  if (sig) {
    drawVoltageSource({ device: sig, x: signalSourceX, topY: pins["IN+"].y, bottomY: pins["IN+"].y + 130 });
    const inputJoin = inputPortToNet(inputNet, 150, pins["IN+"].y, 224);
    wire([inputJoin, { x: signalSourceX, y: pins["IN+"].y }, pins["IN+"]]);
    groundPort(signalSourceX, pins["IN+"].y + 130, groundNet);
  } else {
    const inputJoin = inputPortToNet(inputNet, 110, pins["IN+"].y, 210);
    wire([inputJoin, pins["IN+"]]);
  }
  const outputBranch = { x: 822, y: pins.OUT.y };
  const outputTagInput = { x: 862, y: pins.OUT.y };
  wire([pins.OUT, outputBranch, outputTagInput]);
  outputPort(outputNet, 936, pins.OUT.y);
  const fbNode = { x: pins["IN-"].x - 34, y: pins["IN-"].y };
  wire([pins["IN-"], fbNode, { x: fbNode.x, y: 500 }]);
  drawResistor({ device: rFeedback, x1: fbNode.x, y1: 500, x2: outputBranch.x, y2: 500, labelPosition: "below" });
  junction(fbNode.x, 500);
  wire([{ x: outputBranch.x, y: 500 }, outputBranch]);
  junction(outputBranch.x, outputBranch.y);
  drawResistor({ device: rGround, x1: fbNode.x, y1: 500, x2: fbNode.x, y2: groundY });
  groundPort(fbNode.x, groundY, groundNet);
  netLabel(feedbackNet, fbNode.x + 12, fbNode.y - 14, "start");
  endSvg();
  return true;
};

const renderVoltageDivider = () => {
  if (devices.some((device) => ["BJT_NPN", "BJT_PNP", "MOS_NMOS_ENHANCEMENT", "MOS_PMOS_ENHANCEMENT", "OPAMP_SINGLE"].includes(device.component_type))) return false;
  const source = findDevice((device) => device.component_type === "VOLTAGE_SOURCE_DC");
  const outputNet = nets.find((net) => net.type === "output")?.id;
  const topNet = nets.find((net) => net.type === "power")?.id ?? (source ? netOf(source.refdes, "POS") : undefined);
  const groundNet = nets.find((net) => net.type === "ground")?.id ?? (source ? netOf(source.refdes, "NEG") : undefined);
  if (!source || !outputNet || !topNet || !groundNet) return false;

  const topResistor = findTwoTerminalBetween("RESISTOR", topNet, outputNet);
  const bottomResistor = findTwoTerminalBetween("RESISTOR", outputNet, groundNet, new Set([topResistor?.refdes].filter(Boolean)));
  if (!topResistor || !bottomResistor) return false;

  beginSvg();
  const railY = 132;
  const groundY = 624;
  const dividerX = 560;
  const sourceX = 180;
  const outputY = 360;

  powerPort(topNet, dividerX, railY);
  drawVoltageSource({ device: source, x: sourceX, topY: railY + 22, bottomY: groundY });
  wire([{ x: sourceX, y: railY + 22 }, { x: dividerX, y: railY + 22 }]);
  junction(dividerX, railY + 22);
  groundPort(sourceX, groundY, groundNet);
  drawResistor({ device: topResistor, x1: dividerX, y1: railY + 22, x2: dividerX, y2: outputY });
  drawResistor({ device: bottomResistor, x1: dividerX, y1: outputY, x2: dividerX, y2: groundY });
  groundPort(dividerX, groundY, groundNet);
  wire([{ x: dividerX, y: outputY }, { x: 846, y: outputY }]);
  junction(dividerX, outputY);
  outputPort(outputNet, 920, outputY);
  endSvg();
  return true;
};

const renderRcLowPass = () => {
  if (devices.some((device) => ["BJT_NPN", "BJT_PNP", "MOS_NMOS_ENHANCEMENT", "OPAMP_SINGLE"].includes(device.component_type))) return false;
  const source = findDevice((device) => device.component_type === "SIGNAL_SOURCE");
  const resistor = findDevice((device) => device.component_type === "RESISTOR");
  const capacitor = findDevice((device) => device.component_type.startsWith("CAPACITOR"));
  const inputNet = nets.find((net) => net.type === "input")?.id;
  const outputNet = nets.find((net) => net.type === "output")?.id;
  const groundNet = nets.find((net) => net.type === "ground")?.id;
  if (!source || !resistor || !capacitor || !inputNet || !outputNet || !groundNet) return false;
  if (!deviceHasNets(resistor, inputNet, outputNet) || !deviceHasNets(capacitor, outputNet, groundNet)) return false;

  beginSvg();
  const sourceX = 260;
  const signalY = 340;
  const groundY = 624;
  const nodeX = 650;

  const inputJoin = inputPortToNet(inputNet, 70, signalY, 210);
  drawVoltageSource({ device: source, x: sourceX, topY: signalY, bottomY: groundY });
  wire([
    inputJoin,
    { x: sourceX, y: signalY },
    { x: 335, y: signalY }
  ]);
  junction(sourceX, signalY);
  drawResistor({ device: resistor, x1: 335, y1: signalY, x2: nodeX, y2: signalY });
  wire([{ x: nodeX, y: signalY }, { x: 846, y: signalY }]);
  junction(nodeX, signalY);
  outputPort(outputNet, 920, signalY);
  drawCapacitorVertical({ device: capacitor, x: nodeX, yTop: signalY, yBottom: groundY });
  groundPort(sourceX, groundY, groundNet);
  groundPort(nodeX, groundY, groundNet);
  endSvg();
  return true;
};

const renderFallback = () => {
  beginSvg();
  add(`<text class="subtitle" x="58" y="116">No dedicated schematic recognizer matched; showing deterministic symbol summary.</text>`);
  devices.forEach((device, i) => {
    const x = 90 + (i % 3) * 330;
    const y = 160 + Math.floor(i / 3) * 145;
    add(`<rect class="symbol-fill" x="${x}" y="${y}" width="240" height="84" rx="4" />`);
    add(`<text class="refdes" x="${x + 18}" y="${y + 28}">${esc(device.refdes)}</text>`);
    add(`<text class="value" x="${x + 18}" y="${y + 48}">${esc(device.component_type)}</text>`);
    add(`<text class="terminal" x="${x + 18}" y="${y + 68}">${esc(deviceRecords(device).map((r) => `${r.terminal}:${r.net}`).join("  "))}</text>`);
  });
  endSvg();
};

if (!renderBjtLedSwitch() && !renderEmitterFollower() && !renderCommonEmitter() && !renderCmosInverter() && !renderNmosLedSwitch() && !renderOpampNonInverting() && !renderVoltageDivider() && !renderRcLowPass()) {
  renderFallback();
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`OK: ${path.relative(repoRoot, outputPath)}`);
