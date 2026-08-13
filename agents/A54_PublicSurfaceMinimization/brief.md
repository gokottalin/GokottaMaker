# A54 Public Surface Minimization Brief

## Role

Temporary short-task workbench.

Chinese role note:
`公开表面最小化：从服务端公开投影、路由和页面源代码清除聚焦禁用信息`

## Mission

Execute S45 for `REQ-20260812-003`. In focus mode, only MD2File may be public
among miniapps. Hidden posts, projects, miniapps, CMS links, internal status,
and management capabilities must not be serialized to anonymous clients.
Forbidden existing and random unknown routes must share a 404 surface.

## Allowed File Edits

- `server.js`
- `lib/seo.js`
- `data/miniapps.js`
- `index.html`
- `maker.html`
- `category.html`
- `projects.html`
- `miniapps.html`
- `post.html`
- `project.html`
- `derive.html`
- `tools/md2doc.html`
- `data/content-store.js`
- `site-layout.js`
- `main.js`
- `scripts/test-public-surface-minimization.js`
- `scripts/test-focus-mode.js`
- `scripts/test-md2file-public-entry.js`
- `scripts/test-public-content-freshness.js`
- `package.json`
- `docs/codex-workline/slices/S45_public_surface_minimization_handoff.md`

## Required Behavior

1. Public JSON/JS, HTML, SEO, RSS, sitemap, structured data, source, and preload
   paths contain only focus-allowed content.
2. MD2File is the only public miniapp identity; retained private miniapp data is
   never assigned to a public browser global.
3. Anonymous access to focus-forbidden content, miniapps, APIs, and assets uses
   the same 404 status/template policy as an unknown path.
4. Public pages contain no CMS links or management capability metadata.
5. Do not delete retained code, content, data, or historical assets.

## Verification

- syntax checks
- isolated public payload and route matrix
- source/SEO/miniapp identifier scan
- focus-mode and MD2File regressions
- desktop and mobile browser checks
- `npm.cmd run codex:contract`

## Forbidden

- private CMS gateway implementation reserved for S46
- formula schema or relation changes
- current/production data, deployment, secret values, version, or Git writes

## Handoff

Write `docs/codex-workline/slices/S45_public_surface_minimization_handoff.md`
in Chinese and return directly to A00.
