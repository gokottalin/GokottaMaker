# A26 Branching Derivation Graph Brief

## Role

Temporary branching derivation graph workbench.

Chinese role note:
`分支推导图：把线性公式链升级为可管理、可验证的分支 DAG 与网络视图`.

## Mission

Implement `REQ-20260728-005` on top of accepted S18 formula publication
semantics. Replace the one-next linear relation with revision-aware branching
and convergence, and make Markdown references plus CMS/public graph views use
one dependency source without exposing draft or pending-publication content.

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/implementation_slices.json`
- `docs/codex-workline/requirements/active/REQ-20260728-005.json`
- `docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json`
- `docs/codex-workline/slices/S15_linear_derivation_graph_handoff.md`
- `docs/codex-workline/slices/S18_formula_publication_workflow_handoff.md`
- `migrations/017_linear_derivation_graph.js`
- `migrations/020_formula_publication_workflow.js`
- `agents/A26_BranchingDerivationGraph/brief.md`

## Allowed Edits

- `migrations/021_branching_derivation_graph.js`
- `server.js`
- `lib/content.js`
- `lib/validators.js`
- `data/markdown-renderer.js`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `post.js`
- `derive.html`
- `formula-graph.js`
- `assets/vendor/cytoscape.min.js`
- `assets/vendor/cytoscape.LICENSE.txt`
- `scripts/test-linear-derivation-graph.js`
- `scripts/test-branching-derivation-graph.js`
- `package.json`
- `docs/calculation-book-authoring-guide.md`
- `docs/codex-workline/slices/S19_branching_derivation_graph_handoff.md`

Do not edit `styles/20-content.css`; it contains pre-existing local work and is
reserved for later media and inline-math tasks.

## Required Architecture

- Dependency identity is formula-card based, while dependency membership is
  revision-aware. CMS previews the current revision graph; visitors and public
  APIs start from the explicitly published revision only.
- Use one stable Markdown dependency representation, preferably
  `{{formula-ref:<formulaId>}}`. Saving a formula revision must parse and
  synchronize its dependency set in the same transaction.
- Markdown links and the network graph must read the same revision dependency
  records. Do not add a separately editable flowchart table or JSON blob.
- Reject self-reference, duplicate edges, dangling targets, direct cycles, and
  multi-hop cycles before the graph changes.
- Draft dependencies may be authored in a draft/pending revision, but publishing
  a parent revision must be blocked until every public dependency is eligible.
  Public graph payloads must never reveal draft card names, LaTeX, Markdown,
  internal IDs, or pending revisions.
- Preserve existing linear relations during migration. A legacy relation may be
  imported as an explicit compatibility dependency, but it must be visible in
  CMS and in the rendered dependency references, carry provenance, and become a
  normal Markdown dependency on the next explicit edit. Never silently delete
  an old edge or rewrite a published formula revision in place.
- Do not mutate S18 publication history. Existing `publishedRevisionId`,
  immutable revision IDs, article bindings, and publication audit remain valid.

## Required Behavior

- A formula revision can depend on multiple lower formulas; the same lower
  formula can be reused by multiple parents.
- Formula Markdown references render as visible, clickable links to public
  dependency pages when available.
- The formula visitor page places the network view before the conclusion
  formula. Current formula is highlighted, ancestors are above, dependencies
  are below, and nodes show a short name plus the public conclusion formula.
- Use a proven local graph engine. Vendor Cytoscape.js with its license inside
  the declared files; do not add a CDN dependency. Use its built-in directed
  layout, pan, zoom, drag, tap navigation, and deterministic initial framing.
- Large graphs default to the current path and a bounded node count. Other
  branches expand/collapse on demand without replacing the page layout.
- CMS provides dependency insertion/removal, cycle/dangling validation messages,
  publication-boundary warnings, and a graph preview driven by the same data.
- Keep controls Chinese and touch/keyboard usable. Network controls use familiar
  icons with tooltips rather than text-filled decorative pills.

## Verification

- Use a new temporary `DATA_DIR`; never open `database/` or `runtime-data/`.
- Add and run `npm.cmd run test:branching-derivation-graph`.
- Run `npm.cmd run test:linear-derivation-graph`.
- Run `npm.cmd run test:formula-publication`.
- Run `npm.cmd run test:formula-catalog`.
- Run `npm.cmd run test:article-formula-authoring`.
- Run `npm.cmd run test:formula-reference-versioning`.
- Run `npm.cmd run test:markdown`.
- Run `npm.cmd run test:calculation-book`.
- Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1`.
- Run `npm.cmd run codex:contract`.
- In an isolated browser, prove a three-level branch-and-merge fixture,
  self/direct/multi-hop/dangling rejection, public draft isolation, top graph
  order, click navigation, zoom, drag, expand/collapse, bounded large-graph
  startup, desktop/half-width/mobile layout, and nonblank graph pixels.

## Forbidden

- Formula drawer layout or fixed right-side authoring drawer.
- Legacy formula-system deletion or physical cleanup.
- Cover crop, reading time, general inline-math, media-fit, or dark-theme work.
- `styles/20-content.css`.
- Current or production database/runtime data.
- Cloud writes, deployment, restore, rollback, Git staging, commit, or push.
- Reverting or normalizing unrelated local changes.

## Handoff

Write `docs/codex-workline/slices/S19_branching_derivation_graph_handoff.md`
in Chinese with status, schema and migration compatibility, dependency syntax,
cycle/dangling evidence, publication-boundary matrix, graph payload contract,
CMS/public browser evidence, performance bounds, files, checks, risks, and
direct `next_handoff` to `A00_ProjectDirector`.
