# A21 Linear Derivation Graph Brief

## Role

Temporary convergent, non-branching formula derivation graph workbench.

Chinese role note: `线性推导链：允许多来源汇入，但每张公式卡最多只有一个下一阶且禁止成环`.

## Objective

Implement `REQ-20260726-005`. Every derivation level is an independent formula
card. Many source cards may converge on one shared card, but each card has at
most one outgoing next-step relation and no relation may create a cycle.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/requirements/active/REQ-20260726-005.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260726-001.json`
- Accepted S09, S13, and S14 handoffs
- Formula catalog, versioning, knowledge-link, calculation-book, CMS, and
  visitor derivation code and tests

Stop unless A00 accepted all predecessor handoffs.

## Allowed Outputs

- `migrations/017_linear_derivation_graph.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `data/markdown-renderer.js`
- `post.js`
- `derive.html`
- `scripts/test-linear-derivation-graph.js`
- `scripts/test-calculation-book.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`
- `docs/codex-workline/slices/S15_linear_derivation_graph_handoff.md`

Do not edit prior migrations, invent engineering derivations, alter formula
version decisions, or touch focus/carousel, cloud/deployment, current data, or
Git state.

## Graph Contract

- Every L1, L2, L3, or later step is one stable formula card.
- Owner manually selects relations; do not infer or create them automatically.
- A source card has zero or one `next` target.
- A target card may have any number of incoming source cards.
- A second outgoing target is rejected or requires an explicit replacement
  transaction. Never silently branch.
- Self-links, cycles, dangling targets, and links to physically missing cards
  fail validation.
- CMS and visitor detail show all incoming sources and the unique next target.
- Visitors may repeatedly follow `next` from any source path.
- Archival does not destroy relation history; CMS shows a specific broken-chain
  state and visitor output remains deterministic.

## Verification

- Use a new isolated `DATA_DIR`.
- Build two different sources converging on one shared formula and continue
  through at least a third level.
- Prove second-outgoing rejection, explicit replacement, cycle rejection,
  incoming source display, unique next display, and archived-middle behavior.
- Verify every generated accepted calculation-book jump resolves.
- Run node syntax, catalog, authoring, versioning, calculation-book, Markdown,
  API, browser, and contract regressions.

## Handoff

Write `docs/codex-workline/slices/S15_linear_derivation_graph_handoff.md` with
the standard fields plus node/edge counts, convergence evidence, rejection
evidence, route checks, archived-chain behavior, and next handoff to A00.
