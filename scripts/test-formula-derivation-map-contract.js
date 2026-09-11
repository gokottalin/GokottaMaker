"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const schemaPath = path.join(root, "schemas", "formula-derivation-map.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.properties.contractVersion.const, "larkix.formula-derivation-map.v1");
assert.ok(schema["x-semanticRules"].some((rule) => rule.includes("acyclic")));

function reject(message) {
  const error = new Error(message);
  error.code = "FORMULA_MAP_CONTRACT";
  throw error;
}

function validate(graph) {
  assert.ok(graph && typeof graph === "object" && !Array.isArray(graph));
  assert.ok(["published", "current"].includes(graph.mode));
  for (const key of ["currentNodeId", "nodes", "edges", "initialNodeIds", "expandableNodeIds", "hiddenNodeCount", "truncated", "limits"]) {
    assert.ok(Object.hasOwn(graph, key), `missing ${key}`);
  }
  assert.ok(Array.isArray(graph.nodes) && Array.isArray(graph.edges));
  assert.ok(Number.isInteger(graph.hiddenNodeCount) && graph.hiddenNodeCount >= 0);
  assert.ok(graph.limits && Number.isInteger(graph.limits.initialNodes) && graph.limits.initialNodes > 0);
  assert.ok(Number.isInteger(graph.limits.payloadNodes) && graph.limits.payloadNodes > 0);
  const ids = new Set();
  for (const node of graph.nodes) {
    if (!node || !["formula", "article"].includes(node.nodeType)) reject("invalid node type");
    if (typeof node.id !== "string" || !node.id || /\s/.test(node.id) || ids.has(node.id)) reject("invalid or duplicate node id");
    ids.add(node.id);
    if (!Number.isInteger(node.rank) || typeof node.current !== "boolean" || typeof node.initiallyVisible !== "boolean") reject("invalid node layout fields");
    if (node.nodeType === "formula" && (!Object.hasOwn(node, "latex") || !["ancestor", "current", "dependency"].includes(node.direction))) reject("invalid formula node");
    if (node.nodeType === "article" && (node.direction !== "article" || node.current || !node.route || !Number.isInteger(node.referenceCount))) reject("invalid article node");
  }
  const current = graph.nodes.filter((node) => node.id === graph.currentNodeId && node.nodeType === "formula" && node.current);
  if (current.length !== 1 || graph.nodes.filter((node) => node.current).length !== 1) reject("invalid current node");
  for (const list of [graph.initialNodeIds, graph.expandableNodeIds]) {
    if (!Array.isArray(list) || new Set(list).size !== list.length || list.some((id) => !ids.has(id))) reject("invalid node id list");
  }
  const internal = ["formulaId", "revisionId", "postId", "publishStatus", "pendingPublication", "archiveState", "lifecycleState"];
  if (graph.mode === "published" && graph.nodes.some((node) => internal.some((key) => Object.hasOwn(node, key)))) reject("public identity/state leak");
  const outgoing = new Map([...ids].map((id) => [id, []]));
  const indegree = new Map([...ids].map((id) => [id, 0]));
  const edgeIds = new Set();
  for (const edge of graph.edges) {
    if (!edge || edgeIds.has(edge.id) || !["formula_dependency", "article_reference"].includes(edge.edgeType)) reject("invalid edge");
    edgeIds.add(edge.id);
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) reject("invalid edge endpoint");
    const source = graph.nodes.find((node) => node.id === edge.source);
    const target = graph.nodes.find((node) => node.id === edge.target);
    if (edge.edgeType === "formula_dependency" && (source.nodeType !== "formula" || target.nodeType !== "formula")) reject("invalid dependency edge types");
    if (edge.edgeType === "article_reference" && (source.nodeType !== "article" || target.nodeType !== "formula")) reject("invalid article edge types");
    if (graph.mode === "published" && ["provenance", "ordinal"].some((key) => Object.hasOwn(edge, key))) reject("public edge metadata leak");
    outgoing.get(edge.source).push(edge.target);
    indegree.set(edge.target, indegree.get(edge.target) + 1);
  }
  const queue = [...ids].filter((id) => indegree.get(id) === 0);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift(); visited += 1;
    for (const target of outgoing.get(id)) { indegree.set(target, indegree.get(target) - 1); if (indegree.get(target) === 0) queue.push(target); }
  }
  if (visited !== ids.size) reject("cycle detected");
  const continuation = graph.continuation;
  const validCursor = typeof continuation?.cursor === "string" && /^[A-Za-z0-9_-]{1,2047}\.[A-Za-z0-9_-]{1,2047}$/.test(continuation.cursor) && continuation.cursor.length >= 16;
  if (graph.truncated && (!continuation || continuation.hasMore !== true || !validCursor)) reject("invalid truncation cursor");
  if (!graph.truncated && continuation != null) reject("unexpected continuation");
  return true;
}

const formula = (id, rank, extra = {}) => ({ id, nodeType: "formula", slug: id, displayName: id, latex: id, rank, direction: rank < 0 ? "ancestor" : rank > 0 ? "dependency" : "current", current: rank === 0, initiallyVisible: true, ...extra });
const nodes = [formula("f0", 0), formula("f1", 1), formula("f2a", 2), formula("f2b", 2), formula("f3", 3), formula("f4", 4), formula("f5", 5), formula("f6", 6)];
const pairs = [["f0","f1"],["f1","f2a"],["f1","f2b"],["f2a","f3"],["f2b","f3"],["f3","f4"],["f4","f5"],["f5","f6"]];
const validSixLevel = { contractVersion: "larkix.formula-derivation-map.v1", mode: "published", currentNodeId: "f0", source: { kind: "formula_card", id: "f0", revision: "r1" }, nodes, edges: pairs.map(([source,target], i) => ({ id: `e${i}`, edgeType: "formula_dependency", source, target, initiallyVisible: true })), initialNodeIds: nodes.map((node) => node.id), expandableNodeIds: [], hiddenNodeCount: 0, truncated: false, limits: { initialNodes: 12, payloadNodes: 120 } };
assert.equal(validate(validSixLevel), true);

const existingPublicApiFixture = { mode: "published", currentNodeId: "boost-duty", nodes: [formula("boost-duty", 0)], edges: [], initialNodeIds: ["boost-duty"], expandableNodeIds: [], hiddenNodeCount: 0, truncated: false, limits: { initialNodes: 12, payloadNodes: 120 } };
assert.equal(validate(existingPublicApiFixture), true);
const existingCmsApiFixture = { ...structuredClone(existingPublicApiFixture), mode: "current", nodes: [formula("F-001", 0, { slug: "boost-duty", formulaId: "F-001", revisionId: "F-001-r1", publishStatus: "draft", pendingPublication: false, archiveState: "active" })], currentNodeId: "F-001", initialNodeIds: ["F-001"] };
assert.equal(validate(existingCmsApiFixture), true);

function mustReject(mutator, label) {
  const fixture = structuredClone(validSixLevel); mutator(fixture);
  assert.throws(() => validate(fixture), { code: "FORMULA_MAP_CONTRACT" }, label);
}
mustReject((g) => g.edges.push({ id: "cycle", edgeType: "formula_dependency", source: "f6", target: "f0", initiallyVisible: true }), "cycle");
mustReject((g) => { g.nodes[1].nodeType = "folder"; }, "node type");
mustReject((g) => { g.nodes[1].revisionId = "draft-r9"; }, "public draft identity leak");
mustReject((g) => { g.truncated = true; g.continuation = { cursor: "bad", hasMore: true }; }, "cursor");
mustReject((g) => { g.truncated = true; }, "missing continuation");

const producerFiles = ["lib/content.js", "server.js", "formula-graph.js"];
for (const file of producerFiles) assert.ok(fs.existsSync(path.join(root, file)), `missing producer/consumer ${file}`);
const contentSource = fs.readFileSync(path.join(root, "lib/content.js"), "utf8");
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
assert.match(contentSource, /mode:\s*admin\s*\?\s*"current"\s*:\s*"published"/);
assert.match(contentSource, /edgeType:\s*"formula_dependency"/);
assert.match(contentSource, /edgeType:\s*"article_reference"/);
assert.match(serverSource, /mode:\s*"published"/);
console.log("Formula derivation map contract: 2 valid fixtures accepted; cycle, node type, public leak, and cursor failures rejected.");
