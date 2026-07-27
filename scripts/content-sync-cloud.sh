#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
NODE_BIN="${NODE_BIN:-node}"
DATA_DIR="${DATA_DIR:-/srv/gokottamaker-data}"
MAX_BACKUP_AGE_HOURS="${CONTENT_SYNC_MAX_BACKUP_AGE_HOURS:-2}"
MODE="dry-run"
PACKAGE_PATH=""
EXPECTED_CHECKSUM=""
BACKUP_EVIDENCE=""
CONFIRMATION=""
SELF_TEST="false"
CHECKPOINT="arguments_not_validated"
BACKUP_DIR=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/content-sync-cloud.sh \
    --package content/calculation-books/<book>/generated/larkix-package.json \
    --checksum <sha256> \
    [--data-dir /srv/gokottamaker-data]

Apply (all gates are mandatory):
  bash scripts/content-sync-cloud.sh \
    --apply \
    --confirm APPLY_CONTENT_SYNC \
    --package <package.json> \
    --checksum <sha256> \
    --backup-evidence /srv/gokottamaker-backups/<stamp>/manifest.txt \
    [--data-dir /srv/gokottamaker-data]

Local disposable verification:
  bash scripts/content-sync-cloud.sh --self-test

The default mode is dry-run. It validates the package and checksum without
creating DATA_DIR, opening SQLite, contacting a host, or changing content.
EOF
}

fail() {
  local code="$1"
  shift
  echo "ERROR: $*" >&2
  exit "$code"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

absolute_file() {
  local filename="$1"
  local directory
  directory="$(cd "$(dirname "$filename")" && pwd -P)"
  printf '%s/%s\n' "$directory" "$(basename "$filename")"
}

canonical_existing_dir() {
  (cd "$1" && pwd -P)
}

manifest_value() {
  local key="$1"
  awk -F= -v wanted="$key" '$1 == wanted {sub(/^[^=]*=/, ""); print; exit}' "$BACKUP_EVIDENCE"
}

sha256_file() {
  "$NODE_BIN" -e '
const crypto = require("node:crypto");
const fs = require("node:fs");
const filename = process.argv[1];
const hash = crypto.createHash("sha256");
const stream = fs.createReadStream(filename);
stream.on("data", (chunk) => hash.update(chunk));
stream.on("end", () => process.stdout.write(hash.digest("hex")));
stream.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
' "$1"
}

verify_checksum_manifest_with_node() {
  "$NODE_BIN" - "$1" <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.resolve(process.argv[2]);
const root = path.dirname(manifestPath);
const lines = fs.readFileSync(manifestPath, "utf8").split(/\r?\n/).filter(Boolean);
if (!lines.length) throw new Error("backup checksum manifest is empty");

for (let line of lines) {
  if (line.startsWith("\\")) line = line.slice(1);
  const match = line.match(/^([a-f0-9]{64}) [ *](.+)$/i);
  if (!match) throw new Error(`unsupported checksum line: ${line}`);
  const filename = match[2].replace(/\\([\\\n])/g, "$1");
  const resolved = path.resolve(root, filename);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`checksum path escapes backup directory: ${filename}`);
  }
  const actual = crypto.createHash("sha256").update(fs.readFileSync(resolved)).digest("hex");
  if (actual !== match[1].toLowerCase()) throw new Error(`backup checksum mismatch: ${filename}`);
}
console.log(`Backup checksums verified with Node: ${lines.length} file(s)`);
NODE
}

verify_backup_evidence() {
  [ -n "$BACKUP_EVIDENCE" ] || fail 20 "apply requires --backup-evidence <manifest.txt>"
  [ -f "$BACKUP_EVIDENCE" ] || fail 20 "backup evidence does not exist: $BACKUP_EVIDENCE"
  [ "$(basename "$BACKUP_EVIDENCE")" = "manifest.txt" ] || fail 20 "backup evidence must be manifest.txt"
  BACKUP_EVIDENCE="$(absolute_file "$BACKUP_EVIDENCE")"

  local source_dir
  local evidence_backup_dir
  local created_at
  local source_integrity
  local backup_integrity
  local canonical_data_dir
  local canonical_source_dir

  source_dir="$(manifest_value source_dir)"
  evidence_backup_dir="$(manifest_value backup_dir)"
  created_at="$(manifest_value created_at)"
  source_integrity="$(manifest_value source_database_integrity)"
  backup_integrity="$(manifest_value backup_database_integrity)"
  BACKUP_DIR="$(canonical_existing_dir "$(dirname "$BACKUP_EVIDENCE")")"

  [ -n "$source_dir" ] || fail 21 "backup manifest is missing source_dir"
  [ -n "$evidence_backup_dir" ] || fail 21 "backup manifest is missing backup_dir"
  [ -n "$created_at" ] || fail 21 "backup manifest is missing created_at"
  [ -d "$DATA_DIR" ] || fail 21 "apply DATA_DIR must exist before backup verification: $DATA_DIR"

  canonical_data_dir="$(canonical_existing_dir "$DATA_DIR")"
  [ -d "$source_dir" ] || fail 21 "backup source_dir is unavailable for comparison: $source_dir"
  canonical_source_dir="$(canonical_existing_dir "$source_dir")"
  [ "$canonical_source_dir" = "$canonical_data_dir" ] ||
    fail 21 "backup source_dir does not match DATA_DIR (${canonical_source_dir} != ${canonical_data_dir})"

  [ -d "$evidence_backup_dir" ] || fail 21 "backup_dir recorded by manifest does not exist"
  [ "$(canonical_existing_dir "$evidence_backup_dir")" = "$BACKUP_DIR" ] ||
    fail 21 "backup_dir recorded by manifest does not match evidence directory"

  case "$source_integrity" in
    ok|missing|skipped-sqlite3-missing) ;;
    *) fail 21 "source database integrity evidence is not successful: ${source_integrity:-missing}" ;;
  esac
  case "$backup_integrity" in
    ok|missing|skipped-sqlite3-missing) ;;
    *) fail 21 "backup database integrity evidence is not successful: ${backup_integrity:-missing}" ;;
  esac

  "$NODE_BIN" -e '
const createdAt = Date.parse(process.argv[1]);
const maxHours = Number(process.argv[2]);
if (!Number.isFinite(createdAt)) throw new Error("backup created_at is invalid");
if (!Number.isFinite(maxHours) || maxHours <= 0) throw new Error("maximum backup age must be positive");
const ageMs = Date.now() - createdAt;
if (ageMs < -300000) throw new Error("backup created_at is unexpectedly in the future");
if (ageMs > maxHours * 3600000) throw new Error(`backup is older than ${maxHours} hour(s)`);
' "$created_at" "$MAX_BACKUP_AGE_HOURS" ||
    fail 22 "backup freshness check failed"

  local checksum_manifest="${BACKUP_DIR}/manifest.sha256"
  [ -s "$checksum_manifest" ] || fail 23 "apply requires a non-empty backup manifest.sha256"
  if command_exists sha256sum; then
    (cd "$BACKUP_DIR" && sha256sum -c manifest.sha256)
  else
    verify_checksum_manifest_with_node "$checksum_manifest"
  fi

  echo "Backup evidence verified: $BACKUP_EVIDENCE"
}

validate_or_import_package() {
  local operation="$1"
  local test_failure_after="${CONTENT_SYNC_TEST_FAIL_AFTER:-0}"
  local allow_test_hook="${CONTENT_SYNC_ALLOW_TEST_HOOK:-false}"

  "$NODE_BIN" --experimental-sqlite - \
    "$operation" \
    "$APP_DIR" \
    "$PACKAGE_PATH" \
    "$DATA_DIR" \
    "$EXPECTED_CHECKSUM" \
    "$allow_test_hook" \
    "$test_failure_after" <<'NODE'
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const [
  operation,
  appDirInput,
  packagePathInput,
  dataDirInput,
  expectedChecksum,
  allowTestHook,
  testFailureAfterInput
] = process.argv.slice(2);
const appDir = path.resolve(appDirInput);
const packagePath = path.resolve(packagePathInput);
const dataDir = path.resolve(dataDirInput);
const packageBytes = fs.readFileSync(packagePath);
const actualChecksum = crypto.createHash("sha256").update(packageBytes).digest("hex");
if (actualChecksum !== expectedChecksum) throw new Error("package checksum changed after shell verification");

const pkg = JSON.parse(packageBytes.toString("utf8"));
if (pkg.schemaVersion !== "larkix.calculation-book-package.v1") {
  throw new Error("only larkix.calculation-book-package.v1 is accepted");
}
if (pkg.preview !== false) throw new Error("preview packages cannot be synchronized");
if (!/^[a-z0-9][a-z0-9._-]{1,127}$/i.test(String(pkg.bookId || ""))) {
  throw new Error("package bookId is missing or invalid");
}
if (!String(pkg.revision || "").trim()) throw new Error("package revision is required");
if (!/^[a-f0-9]{64}$/i.test(String(pkg.sourceDigest || ""))) {
  throw new Error("package sourceDigest must be a SHA-256 digest");
}
if (!Array.isArray(pkg.nodes) || pkg.nodes.length === 0) throw new Error("package nodes must not be empty");

const ids = new Set();
const slugs = new Set();
for (const node of pkg.nodes) {
  if (!node || typeof node !== "object") throw new Error("each package node must be an object");
  if (node.id !== node.slug) throw new Error(`stable identity requires id=slug: ${node.slug || "unknown"}`);
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(String(node.slug || ""))) {
    throw new Error(`invalid stable slug: ${node.slug || "unknown"}`);
  }
  if (ids.has(node.id) || slugs.has(node.slug)) throw new Error(`duplicate stable slug: ${node.slug}`);
  ids.add(node.id);
  slugs.add(node.slug);
}

const validationSummary = {
  ok: true,
  mode: operation,
  schemaVersion: pkg.schemaVersion,
  bookId: pkg.bookId,
  revision: pkg.revision,
  checksum: actualChecksum,
  stableSlugs: [...slugs].sort(),
  nodes: pkg.nodes.length
};

if (operation === "validate") {
  console.log(JSON.stringify({ ...validationSummary, writes: 0, network: false }, null, 2));
  process.exit(0);
}
if (operation !== "import") throw new Error(`unknown operation: ${operation}`);

const relativeToApp = path.relative(appDir, dataDir);
if (relativeToApp === "" || (!relativeToApp.startsWith("..") && !path.isAbsolute(relativeToApp))) {
  throw new Error("apply DATA_DIR must be outside the source tree");
}
const protectedPaths = new Set([path.parse(dataDir).root, path.resolve(os.homedir())]);
if (protectedPaths.has(dataDir)) throw new Error("apply DATA_DIR is too broad");

const testFailureAfter = Number(testFailureAfterInput || 0);
if (testFailureAfter > 0) {
  const marker = path.join(dataDir, ".larkix-content-sync-disposable");
  if (allowTestHook !== "true" || !fs.existsSync(marker)) {
    throw new Error("failure injection is restricted to a marked disposable DATA_DIR");
  }
}

const { createDatabase } = require(path.join(appDir, "lib/db"));
const { createContentStore } = require(path.join(appDir, "lib/content"));
const { validateKnowledgeNodePayload } = require(path.join(appDir, "lib/validators"));
const normalizedNodes = pkg.nodes.map((node) =>
  validateKnowledgeNodePayload({
    ...node,
    actor: { username: "content-sync-cloud" }
  })
);
const dbDir = path.join(dataDir, "database");
const dbPath = path.join(dbDir, "gokottamaker.sqlite");
const uploadDir = path.join(dataDir, "uploads");
const db = createDatabase({ root: appDir, dataDir, dbDir, dbPath, uploadDir });
const store = createContentStore(db);

const comparableKeys = [
  "id",
  "slug",
  "nodeType",
  "symbol",
  "title",
  "summary",
  "markdown",
  "cover",
  "accentColor",
  "tags",
  "publishStatus",
  "visibilityStatus"
];
const samePayload = (existing, incoming) =>
  Boolean(existing) &&
  comparableKeys.every((key) => String(existing[key] ?? "") === String(incoming[key] ?? ""));

let result;
try {
  result = store.withTransaction(() => {
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let processed = 0;
    for (const node of normalizedNodes) {
      const existing = store.adminKnowledgeNode(node.id);
      if (samePayload(existing, node)) {
        unchanged += 1;
      } else {
        store.saveKnowledgeNode(node);
        if (existing) updated += 1;
        else created += 1;
      }
      processed += 1;
      if (testFailureAfter > 0 && processed >= testFailureAfter) {
        throw new Error(`SIMULATED_PARTIAL_FAILURE_AFTER_${processed}`);
      }
    }
    return { created, updated, unchanged, processed };
  });
} finally {
  db.close();
}

const receiptDir = path.join(dataDir, ".content-sync");
const safeBookId = String(pkg.bookId).replace(/[^a-z0-9._-]+/gi, "-");
const receiptPath = path.join(receiptDir, `${safeBookId}.json`);
const receiptTemp = `${receiptPath}.tmp-${process.pid}`;
fs.mkdirSync(receiptDir, { recursive: true });
fs.writeFileSync(
  receiptTemp,
  `${JSON.stringify(
    {
      schemaVersion: "larkix.content-sync-receipt.v1",
      bookId: pkg.bookId,
      revision: pkg.revision,
      packageChecksum: actualChecksum,
      sourceDigest: pkg.sourceDigest,
      stableSlugs: [...slugs].sort(),
      appliedAt: new Date().toISOString(),
      result
    },
    null,
    2
  )}\n`,
  { encoding: "utf8", flag: "wx" }
);
fs.renameSync(receiptTemp, receiptPath);

console.log(JSON.stringify({ ...validationSummary, ...result, receiptPath, network: false }, null, 2));
NODE
}

failure_help() {
  local exit_code="$1"
  trap - ERR
  echo >&2
  echo "CONTENT SYNC STOPPED (exit ${exit_code})." >&2
  echo "Last safe checkpoint: ${CHECKPOINT}" >&2
  echo "Package: ${PACKAGE_PATH:-unknown}" >&2
  echo "DATA_DIR: ${DATA_DIR:-unknown}" >&2
  echo "Backup: ${BACKUP_DIR:-unknown}" >&2
  echo "No automatic restore was attempted." >&2
  echo "The content transaction did not report success and is expected to have rolled back." >&2
  echo "Opening the database can apply additive migrations; use the verified backup if full data rollback is required." >&2
  if [ -n "$BACKUP_DIR" ]; then
    echo "Rollback validation:" >&2
    echo "  bash ${APP_DIR}/scripts/restore-linux.sh --dry-run ${BACKUP_DIR} ${DATA_DIR}" >&2
    echo "Operator-approved restore:" >&2
    echo "  sudo bash ${APP_DIR}/scripts/restore-linux.sh ${BACKUP_DIR} ${DATA_DIR}" >&2
  fi
  exit "$exit_code"
}

self_test() {
  local self
  local temp_root
  local node
  local base_package
  local package_one
  local package_two
  local package_fail
  local dry_data
  local data_dir
  local checksum_one
  local checksum_two
  local checksum_fail
  local backup_output
  local manifest_one
  local manifest_two
  local manifest_three
  local first_output
  local duplicate_output
  local changed_output
  local network_marker

  self="$(absolute_file "${BASH_SOURCE[0]}")"
  temp_root="$(mktemp -d "${TMPDIR:-/tmp}/larkix-content-sync-XXXXXX")"
  node="$(command -v "$NODE_BIN" || true)"
  [ -n "$node" ] || fail 90 "self-test cannot find NODE_BIN: $NODE_BIN"
  base_package="${APP_DIR}/content/calculation-books/ccm-flyback-reference/generated/larkix-package.json"
  package_one="${temp_root}/package-one.json"
  package_two="${temp_root}/package-two.json"
  package_fail="${temp_root}/package-fail.json"
  dry_data="${temp_root}/dry-run-data"
  data_dir="${temp_root}/data"
  network_marker="${temp_root}/network-attempted"

  cleanup_self_test() {
    rm -rf "$temp_root"
  }
  trap cleanup_self_test RETURN

  mkdir -p "${temp_root}/network-guard"
  for guarded in curl wget ssh scp rsync rclone; do
    printf '#!/usr/bin/env bash\nprintf "%%s\\n" "%s" >> "%s"\nexit 97\n' "$guarded" "$network_marker" \
      > "${temp_root}/network-guard/${guarded}"
    chmod +x "${temp_root}/network-guard/${guarded}"
  done

  "$node" -e '
const fs = require("node:fs");
const source = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
source.bookId = "larkix-content-sync-selftest";
source.revision = "selftest-r1";
source.nodes = source.nodes.slice(0, 2);
fs.writeFileSync(process.argv[2], `${JSON.stringify(source, null, 2)}\n`);
' "$base_package" "$package_one"
  checksum_one="$(sha256_file "$package_one")"

  PATH="${temp_root}/network-guard:${PATH}" APP_DIR="$APP_DIR" NODE_BIN="$node" \
    bash "$self" --package "$package_one" --checksum "$checksum_one" --data-dir "$dry_data" >/dev/null
  [ ! -e "$dry_data" ] || fail 91 "dry-run created DATA_DIR"

  if PATH="${temp_root}/network-guard:${PATH}" APP_DIR="$APP_DIR" NODE_BIN="$node" \
    bash "$self" --package "$package_one" --checksum \
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" --data-dir "$dry_data" >/dev/null 2>&1; then
    fail 92 "checksum mismatch was accepted"
  fi
  [ ! -e "$dry_data" ] || fail 92 "checksum mismatch created DATA_DIR"

  mkdir -p "${data_dir}/uploads"
  printf 'self-test\n' > "${data_dir}/uploads/self-test.txt"
  if PATH="${temp_root}/network-guard:${PATH}" APP_DIR="$APP_DIR" NODE_BIN="$node" \
    bash "$self" --apply --confirm APPLY_CONTENT_SYNC --package "$package_one" \
      --checksum "$checksum_one" --data-dir "$data_dir" >/dev/null 2>&1; then
    fail 93 "apply without backup evidence was accepted"
  fi

  backup_output="$(
    OFFSITE_BACKUP_TARGET="" RETENTION_DAYS=365 MIN_BACKUPS=0 \
      bash "${APP_DIR}/scripts/backup-linux.sh" "$data_dir" "${temp_root}/backups-one"
  )"
  manifest_one="$(printf '%s\n' "$backup_output" | awk -F': ' '/Manifest:/ {print $2}' | tail -n 1)"
  first_output="$(
    PATH="${temp_root}/network-guard:${PATH}" APP_DIR="$APP_DIR" NODE_BIN="$node" \
      bash "$self" --apply --confirm APPLY_CONTENT_SYNC --package "$package_one" \
        --checksum "$checksum_one" --backup-evidence "$manifest_one" --data-dir "$data_dir"
  )"
  printf '%s\n' "$first_output" | grep -q '"created": 2' || fail 94 "first apply did not create two nodes"

  duplicate_output="$(
    PATH="${temp_root}/network-guard:${PATH}" APP_DIR="$APP_DIR" NODE_BIN="$node" \
      bash "$self" --apply --confirm APPLY_CONTENT_SYNC --package "$package_one" \
        --checksum "$checksum_one" --backup-evidence "$manifest_one" --data-dir "$data_dir"
  )"
  printf '%s\n' "$duplicate_output" | grep -q '"unchanged": 2' || fail 95 "duplicate apply was not idempotent"

  "$node" -e '
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
pkg.revision = "selftest-r2";
pkg.nodes[0].title += "（修订）";
fs.writeFileSync(process.argv[2], `${JSON.stringify(pkg, null, 2)}\n`);
' "$package_one" "$package_two"
  checksum_two="$(sha256_file "$package_two")"
  backup_output="$(
    OFFSITE_BACKUP_TARGET="" RETENTION_DAYS=365 MIN_BACKUPS=0 \
      bash "${APP_DIR}/scripts/backup-linux.sh" "$data_dir" "${temp_root}/backups-two"
  )"
  manifest_two="$(printf '%s\n' "$backup_output" | awk -F': ' '/Manifest:/ {print $2}' | tail -n 1)"
  changed_output="$(
    PATH="${temp_root}/network-guard:${PATH}" APP_DIR="$APP_DIR" NODE_BIN="$node" \
      bash "$self" --apply --confirm APPLY_CONTENT_SYNC --package "$package_two" \
        --checksum "$checksum_two" --backup-evidence "$manifest_two" --data-dir "$data_dir"
  )"
  printf '%s\n' "$changed_output" | grep -q '"updated": 1' || fail 96 "changed package did not update one node"
  printf '%s\n' "$changed_output" | grep -q '"unchanged": 1' || fail 96 "changed package touched an unrelated package node"

  "$node" -e '
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
pkg.revision = "selftest-r3";
pkg.nodes[0].title += "（失败注入一）";
pkg.nodes[1].title += "（失败注入二）";
fs.writeFileSync(process.argv[2], `${JSON.stringify(pkg, null, 2)}\n`);
' "$package_two" "$package_fail"
  checksum_fail="$(sha256_file "$package_fail")"
  backup_output="$(
    OFFSITE_BACKUP_TARGET="" RETENTION_DAYS=365 MIN_BACKUPS=0 \
      bash "${APP_DIR}/scripts/backup-linux.sh" "$data_dir" "${temp_root}/backups-three"
  )"
  manifest_three="$(printf '%s\n' "$backup_output" | awk -F': ' '/Manifest:/ {print $2}' | tail -n 1)"
  : > "${data_dir}/.larkix-content-sync-disposable"
  if PATH="${temp_root}/network-guard:${PATH}" APP_DIR="$APP_DIR" NODE_BIN="$node" \
    CONTENT_SYNC_ALLOW_TEST_HOOK=true CONTENT_SYNC_TEST_FAIL_AFTER=1 \
    bash "$self" --apply --confirm APPLY_CONTENT_SYNC --package "$package_fail" \
      --checksum "$checksum_fail" --backup-evidence "$manifest_three" --data-dir "$data_dir" \
      >"${temp_root}/partial.out" 2>"${temp_root}/partial.err"; then
    fail 97 "partial-failure injection unexpectedly succeeded"
  fi
  grep -q "Last safe checkpoint: backup_verified_checksum_locked" "${temp_root}/partial.err" ||
    fail 97 "partial failure did not report its safe checkpoint"
  grep -q "restore-linux.sh --dry-run" "${temp_root}/partial.err" ||
    fail 97 "partial failure did not print rollback validation"

  "$node" --experimental-sqlite - "$APP_DIR" "$data_dir" "$package_two" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [appDir, dataDir, expectedPackage] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(expectedPackage, "utf8"));
const { createDatabase } = require(path.join(appDir, "lib/db"));
const { createContentStore } = require(path.join(appDir, "lib/content"));
const dbDir = path.join(dataDir, "database");
const db = createDatabase({
  root: appDir,
  dataDir,
  dbDir,
  dbPath: path.join(dbDir, "gokottamaker.sqlite"),
  uploadDir: path.join(dataDir, "uploads")
});
try {
  const store = createContentStore(db);
  for (const expected of pkg.nodes) {
    const actual = store.adminKnowledgeNode(expected.id);
    if (!actual || actual.title !== expected.title) {
      throw new Error(`transaction rollback failed for ${expected.id}`);
    }
  }
} finally {
  db.close();
}
NODE

  [ ! -e "$network_marker" ] || fail 98 "a guarded network command was attempted"
  echo "Content sync self-test passed:"
  echo "  dry-run writes=0; checksum mismatch blocked; missing backup blocked"
  echo "  first apply created=2; duplicate unchanged=2; changed update=1"
  echo "  partial failure rolled back and printed restore guidance; network attempts=0"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --package)
      [ "$#" -ge 2 ] || fail 2 "--package requires a path"
      PACKAGE_PATH="$2"
      shift 2
      ;;
    --checksum)
      [ "$#" -ge 2 ] || fail 2 "--checksum requires a SHA-256 digest"
      EXPECTED_CHECKSUM="$(printf '%s' "$2" | tr 'A-F' 'a-f')"
      shift 2
      ;;
    --data-dir)
      [ "$#" -ge 2 ] || fail 2 "--data-dir requires a path"
      DATA_DIR="$2"
      shift 2
      ;;
    --backup-evidence)
      [ "$#" -ge 2 ] || fail 2 "--backup-evidence requires a path"
      BACKUP_EVIDENCE="$2"
      shift 2
      ;;
    --confirm)
      [ "$#" -ge 2 ] || fail 2 "--confirm requires a value"
      CONFIRMATION="$2"
      shift 2
      ;;
    --max-backup-age-hours)
      [ "$#" -ge 2 ] || fail 2 "--max-backup-age-hours requires a value"
      MAX_BACKUP_AGE_HOURS="$2"
      shift 2
      ;;
    --apply)
      MODE="apply"
      shift
      ;;
    --dry-run)
      MODE="dry-run"
      shift
      ;;
    --self-test)
      SELF_TEST="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail 2 "unknown argument: $1"
      ;;
  esac
done

if [ "$SELF_TEST" = "true" ]; then
  self_test
  exit 0
fi

command_exists "$NODE_BIN" || fail 3 "NODE_BIN is not executable: $NODE_BIN"
[ -n "$PACKAGE_PATH" ] || fail 4 "--package is required"
[ -f "$PACKAGE_PATH" ] || fail 4 "package does not exist: $PACKAGE_PATH"
PACKAGE_PATH="$(absolute_file "$PACKAGE_PATH")"
[[ "$EXPECTED_CHECKSUM" =~ ^[a-f0-9]{64}$ ]] || fail 5 "--checksum must be exactly 64 hexadecimal characters"

ACTUAL_CHECKSUM="$(sha256_file "$PACKAGE_PATH")"
[ "$ACTUAL_CHECKSUM" = "$EXPECTED_CHECKSUM" ] ||
  fail 10 "package checksum mismatch (expected ${EXPECTED_CHECKSUM}, got ${ACTUAL_CHECKSUM})"
CHECKPOINT="package_checksum_verified"

if [ "$MODE" = "dry-run" ]; then
  validate_or_import_package validate
  echo "Dry run completed. No files changed and no network command was used."
  exit 0
fi

[ "$CONFIRMATION" = "APPLY_CONTENT_SYNC" ] ||
  fail 12 "apply requires --confirm APPLY_CONTENT_SYNC"
verify_backup_evidence
CHECKPOINT="backup_verified_checksum_locked"
trap 'failure_help $?' ERR

IMPORT_OUTPUT="$(validate_or_import_package import)"
CHECKPOINT="content_transaction_committed"
trap - ERR
printf '%s\n' "$IMPORT_OUTPUT"
echo "Content sync apply completed with verified backup and package checksum."
