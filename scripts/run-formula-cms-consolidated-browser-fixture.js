"use strict";

const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createDatabase } = require("../lib/db");
const { createContentStore } = require("../lib/content");
const { validateFormulaCardPayload } = require("../lib/validators");

const ROOT = path.resolve(__dirname, "..");
const USERNAME = "BrowserFormulaTester";
const PASSWORD = "browser-formula-test-password";
const PRIVATE_PATH = "FormulaCmsBrowser_8u9Lr3xT5aP7mN2qV4cK6dF1hJ0sWzYe";
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-formula-cms-browser-"));
let child = null;
let cleaning = false;

function formula(id, name, latex) {
  return validateFormulaCardPayload({
    formulaId: `formula.browser.${id}`,
    slug: `browser-${id}`,
    displayName: name,
    moduleKey: "power-electronics",
    categoryPath: "浏览器验收/基础",
    purpose: "隔离浏览器验收公式",
    tags: ["scope:browser-test"],
    latex,
    markdownDerivation: "",
    revisionReason: "browser-fixture"
  });
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function cleanup(exitCode = 0) {
  if (cleaning) return;
  cleaning = true;
  if (child && child.exitCode === null) child.kill();
  setTimeout(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    process.exit(exitCode);
  }, 250).unref();
}

async function main() {
  const dbDir = path.join(tempRoot, "database");
  const db = createDatabase({
    root: ROOT,
    dataDir: tempRoot,
    dbDir,
    dbPath: path.join(dbDir, "gokottamaker.sqlite"),
    uploadDir: path.join(tempRoot, "uploads")
  });
  const store = createContentStore(db);
  for (const payload of [
    formula("input-voltage", "输入电压基准", "V_{in}=12\\,\\mathrm{V}"),
    formula("duty-cycle", "占空比基准", "D=1-\\frac{V_{in}}{V_{out}}")
  ]) {
    const saved = store.saveFormulaCard(payload);
    store.publishFormulaCard(saved.card.formulaId);
  }
  store.saveFormulaCard(formula("draft-secret", "未发布测试公式", "V_{secret}=0"));
  db.close();

  const port = await availablePort();
  child = spawn(process.execPath, ["--experimental-sqlite", "server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATA_DIR: tempRoot,
      HOST: "127.0.0.1",
      PORT: String(port),
      ADMIN_USERNAME: USERNAME,
      ADMIN_PASSWORD: PASSWORD,
      PRIVATE_CMS_PATH: PRIVATE_PATH,
      ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let serverOutput = "";
  child.stdout.on("data", (chunk) => { serverOutput += chunk; });
  child.stderr.on("data", (chunk) => { serverOutput += chunk; });
  child.once("exit", (code) => {
    if (!cleaning) {
      console.error(serverOutput);
      cleanup(code || 1);
    }
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) {
        console.log(JSON.stringify({
          url: `http://127.0.0.1:${port}/${PRIVATE_PATH}/admin/index.html#formulas`,
          username: USERNAME,
          password: PASSWORD,
          dataDir: tempRoot
        }));
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start: ${serverOutput}`);
}

process.on("SIGINT", () => cleanup(0));
process.on("SIGTERM", () => cleanup(0));
process.on("uncaughtException", (error) => {
  console.error(error);
  cleanup(1);
});

main().catch((error) => {
  console.error(error);
  cleanup(1);
});
