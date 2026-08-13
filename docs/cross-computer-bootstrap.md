# Cross-Computer Bootstrap

This is the portable Windows clone and Codex continuation contract. It does not
deploy the site or import existing content.

## Prerequisites

- Windows 10/11 with PowerShell 5.1 or newer
- Git available as `git`
- Node.js 22, with `node -v` at least `v22.5.0`
- npm from the same Node.js installation, available as `npm.cmd`
- Network access to GitHub and the npm registry for the initial clone/install

No current-machine absolute path, browser login, `.env`, SQLite file, uploads
folder, certificate, or private CMS value is needed.

## One Complete Verification

```powershell
git clone https://github.com/gokottalin/GokottaMaker.git LarkixMaker
Set-Location LarkixMaker
Get-Content -Encoding UTF8 -Raw AGENTS.md
npm.cmd run verify:clean-clone
```

The verifier performs the following repeatable sequence:

1. Checks Node.js, npm, Git, `package-lock.json`, and required source files.
2. Runs `npm ci` from the lockfile.
3. Chooses an unused loopback port and creates a uniquely named data root under
   the Windows temporary directory.
4. Generates a random test admin password and private CMS segment in memory.
5. Starts `server.js`, waits for `/healthz`, and confirms the isolated SQLite
   database was initialized.
6. Stops the service before running version, Markdown, security/formula, and
   Codex governance checks.
7. Stops any remaining child process, restores inherited environment variables,
   and removes temporary data and logs in `finally`, including failure paths.

The script does not print the random password or private CMS segment. Use
`-SkipInstall` only after dependencies were installed from the same lockfile:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-clean-clone.ps1 -SkipInstall
```

After a successful verification, resume project work from repository state:

```powershell
npm.cmd run codex:handoff
```

Read the printed `Next Agent brief`. A previous Codex conversation is optional;
the tracked governance files are authoritative.

## Environment Contract

`server.js` reads process environment variables; it does not automatically load
`.env.example`. The two example files contain placeholders only.

| Variable | Purpose and format | Source and rotation |
| --- | --- | --- |
| `NODE_ENV` | `development`, `test`, or `production`; production requires a private CMS path | Set by the runtime; change only with the runtime mode |
| `HOST` / `PORT` | Bind address and integer TCP port | Loopback locally; production value belongs to systemd/reverse-proxy configuration |
| `DATA_DIR` | Absolute or working-directory-relative writable data root | Use isolated/temp locally and `/srv/gokottamaker-data` in production; never point tests at current data |
| `DB_DIR` / `DB_PATH` | Optional SQLite directory/file overrides | Normally omit so `DATA_DIR` remains authoritative; change only during a planned migration |
| `UPLOAD_DIR` | Optional upload-root override | Normally omit; back up and migrate with the database |
| `BACKUP_ROOT` | Writable backup root outside application source | Use a separately protected production directory and retention policy |
| `FORMULA_BACKUP_DIR` | Formula snapshot directory | Keep outside Git; back up and rotate with operational data |
| `ELEC_TMP_DIR` / `ELEC_CORE_DIR` | Calculation-export temp root and optional core implementation root | Temp root must be disposable; core override is needed only for a separately managed installation |
| `ADMIN_USERNAME` | Non-secret administrator login name | Choose during provisioning; rotate together with access policy |
| `ADMIN_PASSWORD` | Unique random value, at least 32 characters | Generate outside Git; rotate on disclosure or administrator change |
| `ADMIN_RESET_PASSWORD_ON_START` | Boolean one-time reset switch | Keep `false`; set `true` only for one controlled restart, then restore `false` |
| `PRIVATE_CMS_PATH` | Unique URL-safe segment, 48-128 characters | Generate outside Git; rotate on disclosure and update the private bookmark |
| `ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK` | Boolean HTTP exception for isolated loopback tests | Keep `false` in production; the verifier temporarily uses `true` on loopback only |
| `ALLOW_HARD_DELETE` | Boolean destructive-delete gate | Keep `false`; enable only for one Owner-approved maintenance action |
| `MAX_BACKUP_AGE_HOURS` | Positive numeric backup freshness limit | Set from the backup schedule and review when that schedule changes |
| `OFFSITE_BACKUP_TARGET` / `OFFSITE_BACKUP_MODE` | Optional rsync/rclone destination and mode | Provision outside Git; rotate remote credentials independently |
| `SITE_URL` | Canonical absolute public URL | Use loopback for local verification and the HTTPS canonical domain in production |
| `GIT_COMMIT` / `GIT_BIN` | Optional release identity and Git executable override | Deployment automation may set these; local verification does not require them |

Do not reuse the verifier's ephemeral values for a real administrator. Generate
new production secrets using an approved password manager or platform secret
facility, store them only in the protected runtime environment, and restart the
service after rotation.

## Linux Production Boundary

Windows clean-clone verification is not a deployment rehearsal. Production uses
the pinned Node 22 executable, a systemd unit, `/etc/gokottamaker.env` (root-only
mode), persistent `/srv` data and backup roots, Nginx, TLS, firewall rules, and
an explicit backup/restore gate. The secret-free reference is
`scripts/gokottamaker.env.example`.

Only the Owner or an explicitly authorized release/deployment task may install
the environment file, mutate production data, restart systemd/Nginx, renew TLS,
or publish Git changes. This bootstrap performs none of those actions.

## Troubleshooting

- Node version failure: install Node.js 22 and open a new PowerShell window.
- `npm ci` failure: verify registry/network access and keep `package-lock.json`
  unchanged; do not replace it with an ad hoc install.
- Health timeout: read the sanitized temporary log tail printed by the failure,
  then rerun. The script never prints generated credentials.
- Contract failure: run `npm.cmd run codex:handoff`, read the active brief, and
  repair only within its allowed write set.
