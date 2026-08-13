# A55 Private CMS Gateway Brief

## Role

Temporary short-task workbench.

Chinese role note:
`私有 CMS 网关：实现可轮换入口、独立认证命名空间与恒定 404 边界`

## Mission

Execute S46 for `REQ-20260812-003` after S45 acceptance. Add an environment
configured, high-entropy, rotatable CMS path namespace. Standard `/admin/`,
legacy management routes, login/session endpoints, and management APIs must
remain anonymous 404 even when a browser has an old session. The private path
is an additional gate, never a replacement for auth, CSRF, session security,
rate limiting, or failure audit.

## Allowed File Edits

- `server.js`
- `admin/admin.js`
- `admin/index.html`
- `deploy/nginx-gokottamaker.conf`
- `.env.example`
- `docs/deployment.md`
- `scripts/test-private-cms-gateway.js`
- `scripts/verify-api.ps1`
- `scripts/gokottamaker.env.example`
- affected isolated `scripts/test-*.js` launch environments for explicit legacy-loopback compatibility
- `package.json`
- `docs/codex-workline/slices/S46_private_cms_gateway_handoff.md`

## Required Behavior

1. Private CMS route comes only from protected deployment configuration and is
   validated for length/entropy; no real secret enters Git, logs, audit, or UI.
2. Private static files and private API namespace require the correct gateway;
   management operations still require authenticated session, authorization,
   and CSRF.
3. Standard and old paths return the same 404 before and after login.
4. Rotation invalidates the old path without changing Owner account or CMS data;
   existing sessions and CSRF tokens cannot bypass the new gateway.
5. HTTPS is mandatory outside an explicit loopback-only isolated-test override.

## Verification

- isolated correct/wrong/missing/rotated path matrix
- login rate limit, failure audit, session, CSRF, and logout checks
- secret absence scan
- Nginx production-policy assertion and deployment instructions
- `npm.cmd run codex:contract`

## Forbidden

- committing a real CMS path, credential, key, token, or recovery value
- current/production data, deployment, service restart, version, or Git writes
- formula model or visitor content changes outside the gateway boundary

## Handoff

Write `docs/codex-workline/slices/S46_private_cms_gateway_handoff.md` in Chinese
and return directly to A00.
