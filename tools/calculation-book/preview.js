#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createContentStore } = require("../../lib/content");
const { createDatabase } = require("../../lib/db");
const { validateKnowledgeNodePayload } = require("../../lib/validators");
const { validateBookFile } = require("./validator");
const { generateLarkixPackage } = require("./larkix-generator");

const ROOT = path.resolve(__dirname, "../..");
const SCHEMA = path.join(ROOT, "schemas/calculation-book-master.schema.json");
const DEFAULT_BOOK = path.join(ROOT, "content/calculation-books/ccm-flyback-reference/calculation-book.json");

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function safeRemove(tempRoot) {
  const resolved = path.resolve(tempRoot);
  const base = path.resolve(os.tmpdir());
  if (!resolved.startsWith(`${base}${path.sep}`) || !path.basename(resolved).startsWith("larkix-calculation-preview-")) {
    throw new Error(`refusing to remove unexpected preview directory: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function main() {
  const bookPath = path.resolve(option("book", DEFAULT_BOOK));
  const port = Number(option("port", "1958"));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("--port must be an integer from 1024 to 65535");
  const validated = validateBookFile(bookPath, SCHEMA);
  if (!validated.report.ok) throw new Error(validated.report.errors.join("\n"));
  const previewPackage = generateLarkixPackage(validated.book, validated.report.evaluation, { preview: true });
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-calculation-preview-"));
  const dataDir = path.join(tempRoot, "data");
  const dbDir = path.join(dataDir, "database");
  const dbPath = path.join(dbDir, "gokottamaker.sqlite");
  const uploadDir = path.join(dataDir, "uploads");
  const db = createDatabase({ root: ROOT, dataDir, dbDir, dbPath, uploadDir });
  const store = createContentStore(db);
  for (const node of previewPackage.nodes) store.saveKnowledgeNode(validateKnowledgeNodePayload(node));
  db.close();

  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      PORT: String(port),
      HOST: "127.0.0.1",
      ADMIN_PASSWORD: "isolated-calculation-preview-only",
      SITE_URL: baseUrl
    },
    stdio: "inherit",
    windowsHide: true
  });
  let cleaned = false;
  let requestedExitCode = null;
  function finalize(exitCode = 0) {
    if (cleaned) return;
    cleaned = true;
    safeRemove(tempRoot);
    process.exitCode = exitCode;
  }
  function stop(exitCode = 0) {
    requestedExitCode = exitCode;
    if (child.exitCode === null) child.kill();
    else finalize(exitCode);
  }
  process.once("SIGINT", () => stop(0));
  process.once("SIGTERM", () => stop(0));
  child.once("exit", (code) => finalize(requestedExitCode ?? code ?? 0));
  child.once("error", (error) => {
    console.error(error.message);
    finalize(1);
  });

  console.log("Isolated Larkix calculation-book preview");
  console.log(`DATA_DIR: operating-system temporary directory (removed on exit)`);
  for (const node of previewPackage.nodes) console.log(`${baseUrl}/derive.html?slug=${node.slug}`);
  console.log("Press Ctrl+C to stop the preview and remove temporary data.");
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
