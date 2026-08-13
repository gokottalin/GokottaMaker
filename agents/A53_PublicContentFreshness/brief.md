# A53 Public Content Freshness Brief

## Role

Temporary short-task workbench.

Chinese role note:
`游客内容新鲜度：修复动态内容缓存并在公开页面有限重新验证`

## Mission

Implement `REQ-20260812-002`. Dynamic public content must never inherit static
JavaScript caching, already-open visitor pages must revalidate within five
seconds or immediately on focus, and CMS publish success must be based on the
persisted public projection rather than local state.

## Allowed File Edits

- `deploy/nginx-gokottamaker.conf`
- `server.js`
- `data/content-store.js`
- `site-layout.js`
- `main.js`
- `category-page.js`
- `post.js`
- `admin/admin.js`
- `maker.html`
- `category.html`
- `post.html`
- `scripts/test-public-content-freshness.js`
- `scripts/test-focus-mode.js`
- `package.json`
- `docs/codex-workline/slices/S44_public_content_freshness_handoff.md`

## Required Behavior

1. `/api/content` and `/api/content.js` receive dynamic no-store headers through
   both Node and production-equivalent Nginx; ordinary static JS keeps long cache.
2. Shared public content revalidation is ordered, no more frequent than every
   five seconds during visible use, and also runs on focus/visibility recovery.
3. Older or failed responses never replace a newer successful public snapshot.
4. Homepage, category page, and article details react to the same public snapshot.
5. CMS publish success waits for both public list and public detail confirmation.
6. Focus-mode filtering remains server-owned and unchanged.

## Verification

- syntax checks
- `npm.cmd run test:public-content-freshness`
- isolated API and CMS publish projection checks
- production-equivalent Nginx cache-policy test
- browser open-tab, focus, normal-refresh, half-width, and mobile checks
- `npm.cmd run codex:contract`

## Forbidden

- content or formula data edits
- migrations, version-only cache busting, or disabling all static cache
- current/production data mutation, deployment, service restart, or cloud writes
- Git staging, commit, push, branch, remote, or destructive operations

## Handoff

Write `docs/codex-workline/slices/S44_public_content_freshness_handoff.md` in
Chinese and return directly to `A00_ProjectDirector`.
