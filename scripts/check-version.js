const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function matchRequired(text, pattern, label) {
  const match = text.match(pattern);
  if (!match) {
    fail(`Missing ${label}.`);
    return "";
  }
  return match[1];
}

const serverText = read("server.js");
const serverVersion = matchRequired(serverText, /const\s+siteVersion\s*=\s*["']([^"']+)["']/, "server siteVersion");
const serverBuild = matchRequired(serverText, /const\s+siteBuild\s*=\s*["']([^"']+)["']/, "server siteBuild");
const serverLabel = `${serverVersion}+${serverBuild}`;

const siteMetaText = read(path.join("data", "site-meta.js"));
const metaVersion = matchRequired(siteMetaText, /version: "([^"]+)"/, "site-meta version");
const metaBuild = matchRequired(siteMetaText, /build: "([^"]+)"/, "site-meta build");
const metaLabel = matchRequired(siteMetaText, /versionLabel: "([^"]+)"/, "site-meta versionLabel");

const packageJson = JSON.parse(read("package.json"));
const packageVersion = packageJson.version;
const semverFromSite = serverVersion.replace(/^V/i, "");

if (metaVersion !== serverVersion) fail(`data/site-meta.js version ${metaVersion} does not match server.js ${serverVersion}.`);
if (metaBuild !== serverBuild) fail(`data/site-meta.js build ${metaBuild} does not match server.js ${serverBuild}.`);
if (metaLabel !== serverLabel) fail(`data/site-meta.js versionLabel ${metaLabel} does not match ${serverLabel}.`);
if (packageVersion !== semverFromSite) fail(`package.json version ${packageVersion} does not match site semver ${semverFromSite}.`);

const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith(".html"));
for (const htmlFile of htmlFiles) {
  const html = read(htmlFile);
  const resourceVersions = [...html.matchAll(/[?&]v=([0-9]{8}-[0-9]{4})/g)].map((match) => match[1]);
  for (const resourceVersion of resourceVersions) {
    if (resourceVersion !== serverBuild) {
      fail(`${htmlFile} uses resource version ${resourceVersion}, expected ${serverBuild}.`);
    }
  }
}

if (process.exitCode) {
  process.exit();
}

console.log(`Version check passed: ${serverLabel}`);
