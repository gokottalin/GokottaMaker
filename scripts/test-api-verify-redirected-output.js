"use strict";

const assert = require("assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const verifyDataDir = path.join(root, ".verify-api-data");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function main() {
  const parentDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "larkix-api-redirect-parent-"));
  const port = await freePort();
  const password = `redirect-${crypto.randomBytes(18).toString("hex")}`;
  const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const args = process.platform === "win32"
    ? [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "scripts/verify-api.ps1",
        "-Port",
        String(port),
        "-AdminUsername",
        "Larkix",
        "-AdminPassword",
        password,
      ]
    : [
        "-NoProfile",
        "-File",
        "scripts/verify-api.ps1",
        "-Port",
        String(port),
        "-AdminUsername",
        "Larkix",
        "-AdminPassword",
        password,
      ];

  try {
    const result = spawnSync(powershell, args, {
      cwd: root,
      env: {
        ...process.env,
        DATA_DIR: parentDataDir,
        NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS || "1",
      },
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 120000,
    });

    const details = [result.error && result.error.message, result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n");
    assert.equal(result.error, undefined, details);
    assert.equal(result.status, 0, details);
    assert.match(result.stdout, /ok\s*:\s*True/i, details);
    assert.doesNotMatch(result.stderr, /API verify failed/i, details);
    assert.equal(fs.existsSync(verifyDataDir), false, "isolated .verify-api-data directory was not cleaned");
  } finally {
    fs.rmSync(parentDataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }

  console.log("Redirected PowerShell API verification passed with explicit UTF-8 curl response files and isolated cleanup.");
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
