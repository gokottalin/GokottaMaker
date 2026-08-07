# A37 CarouselSlotAuthority Brief

## Role

Temporary short-task workbench.

Chinese role note:
`轮播槽位权威源：四槽互斥、幽灵清除和排布页唯一聚焦开关`

## Mission

Make four persistent carousel slots the only Hero source, preserve focus buffering, and keep the sole focus-mode control inside the CMS layout view.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json`
- `docs/codex-workline/requirements/active/REQ-20260730-001.json`
- `docs/codex-workline/requirements/active/REQ-20260730-010.json`
- `migrations/019_carousel_focus_buffer.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `data/content-store.js`
- `maker.html`
- `main.js`
- `scripts/check-carousel-db.js`
- `scripts/test-carousel-focus-buffer.js`
- `scripts/test-focus-mode.js`

## Allowed Edits

- `migrations/026_hero_carousel_slots.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `data/content-store.js`
- `maker.html`
- `main.js`
- `scripts/check-carousel-db.js`
- `scripts/test-carousel-focus-buffer.js`
- `scripts/test-focus-mode.js`
- `scripts/test-hero-carousel-authority.js`
- `docs/carousel-slot-authority.md`
- `docs/codex-workline/slices/S31_carousel_slot_authority_handoff.md`

You are the only active writer for this list while S31_carousel_slot_authority is open. Other
Agents may be working elsewhere; preserve their edits and do not revert or
rewrite unrelated files.

## Required Outputs

- four database-enforced slots with no cross-type collision or silent overwrite
- Hero content derived only from configured slots with no fallback or static ghost article
- article publication and revision restore unable to bypass carousel management
- one focus-mode switch inside the layout view while all hidden business restrictions remain active
- `admin/index.html` loads `/data/math-renderer.js` before `/data/markdown-renderer.js` for A36; do not edit either JavaScript file

## Verification

- isolated DATA_DIR migration, conflict-report, concurrency, restore, and no-article-deletion checks
- carousel focus-buffer idempotency and explicit-slot restoration regression
- CMS carousel/layout/editor browser checks at desktop, half width, and mobile
- Hero exact-set and fifth-published-article exclusion checks

## Dependencies

- `DISPATCH-20260730-001`

## Forbidden

- files outside the declared mayEdit list
- current or production data mutation, physical cleanup, cloud writes, deployment, restore, rollback, or service restart
- Git staging, commit, push, branch, remote, reset, checkout, clean, stash, merge, rebase, or cherry-pick
- overwriting unrelated or concurrent edits; one file has one active writer
- silently choosing a winner for historical duplicate slots
- deleting articles, auto-swapping slots, latest-publish fallback, or changing cover behavior
- editing package.json, shared math files, MD2File files, lib/seo.js, or styles/20-content.css

## Handoff

Write `docs/codex-workline/slices/S31_carousel_slot_authority_handoff.md` in Chinese with
`status`, `scope_completed`, `files_created_or_changed`, `decisions`,
`risks`, `tests_or_checks`, and `next_handoff`. Return directly to
`A00_ProjectDirector`; do not ask the Owner to relay the result.
