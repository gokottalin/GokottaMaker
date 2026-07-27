# A23 Carousel Focus Buffer Brief

## Role

Temporary focus-aware carousel buffer and manual restore workbench.

Chinese role note: `轮播聚焦缓冲：自动下架越界轮播项，保留原信息，并由作者手动恢复`.

## Objective

Implement `REQ-20260726-002` after the global focus gate is accepted. Enabling
focus mode atomically moves only out-of-scope carousel entries into a persistent
CMS buffer. Disabling focus mode never auto-restores them; Owner restores
eligible entries manually.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/active/REQ-20260726-002.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260726-001.json`
- `docs/codex-workline/slices/S16_focus_mode_scope_gate_handoff.md`
- Current carousel API, visibility reason codes, CMS cards, content models,
  cleanup scripts, and tests

Stop unless A00 accepted S16.

## Allowed Outputs

- `migrations/019_carousel_focus_buffer.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `main.js`
- `scripts/test-carousel-focus-buffer.js`
- `scripts/check-carousel-db.js`
- `scripts/check-carousel-cloud.sh`
- `package.json`
- `docs/codex-workline/slices/S17_carousel_focus_buffer_handoff.md`

Do not repair unrelated carousel layout, auto-publish content, implement formula
features, touch cloud/production data, deploy, or perform Git operations.

## Buffer Contract

- On an enabled transition or idempotent reconciliation, buffer only featured
  post/project entries outside the accepted focus scopes.
- Keep eligible carousel entries active; never hide the entire carousel.
- Buffer records preserve content type, stable content identity, image
  reference, original slot/order, buffered reason code, and timestamps.
- Buffering removes active featured state without deleting content or changing
  publication state. The transaction is idempotent.
- Disabling focus mode does not restore any buffered item.
- CMS shows active slots and a distinct buffered list with clear reason/status.
- While focus is enabled, restore is allowed only if the item is currently
  eligible; reject an ineligible restore with a stable reason code and Chinese
  explanation.
- While focus is disabled, Owner may restore manually. Slot conflicts require
  an explicit Owner slot choice; never silently reorder existing entries.
- Missing or archived linked content remains visible in the buffer as a broken
  reference that can be removed from the buffer without deleting content.

## Verification

- Use a new isolated `DATA_DIR` with mixed allowed/disallowed, published/draft,
  and broken-reference fixtures.
- Prove selective and idempotent buffering, no auto-restore, blocked restore
  while focused, manual restore while unfocused, slot conflict behavior, and
  data/publication preservation.
- Prove CMS visitor visibility reason codes and half-width responsive layout.
- Run node syntax, API, focus, carousel, formula, Markdown, and contract
  regressions.

## Handoff

Write `docs/codex-workline/slices/S17_carousel_focus_buffer_handoff.md` with
the standard fields plus active/buffered counts, transition matrix, reason-code
evidence, restore evidence, data-preservation checks, and next handoff to A00.
