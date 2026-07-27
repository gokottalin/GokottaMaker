# A00 Project Director Handoff

Status: `S12 accepted; automatic functional-Agent queue complete`.

## Confirmed Inputs

The following Owner-confirmed packages passed digest validation:

- `REQ-20260726-001` - 全站聚焦模式与首发内容范围
- `REQ-20260726-002` - 聚焦模式轮播内容缓冲与手动恢复
- `REQ-20260726-003` - 公式库分类管理与文章内公式卡创建
- `REQ-20260726-004` - 文章公式绑定与逐篇版本决策
- `REQ-20260726-005` - 可汇入且不分叉的多阶公式推导链

Machine dispatch:
`docs/codex-workline/requirements/dispatch/DISPATCH-20260726-001.json`.

## A00 Decisions

- Do not create one broad implementation Agent.
- Accept `A14_FormulaCatalogManagement`: S09 delivered 60 unique formula
  cards, immutable revisions, catalog search/pagination, archive/restore,
  deterministic import/export, local non-overwrite snapshots, and isolated
  CMS/visitor evidence.
- Accept `A19_ArticleFormulaAuthoring`: S13 preserves ordinary unbound LaTeX,
  provides existing-card search/insertion and exact-selection atomic card
  creation, stores stable card plus immutable revision identities, and passes
  isolated API, renderer, CMS, responsive browser, and regression checks.
- Accept `A20_FormulaReferenceVersioning`: S14 keeps metadata-only edits quiet,
  creates CMS-only per-article decisions for LaTeX revisions and archive
  events, preserves old visitor rendering, supports independent keep, adopt,
  or clone actions, retains superseded history, and passes isolated API, CMS,
  responsive browser, and regression checks.
- Accept `A21_LinearDerivationGraph`: S15 keeps every step as an independent
  formula card, allows manual many-incoming convergence with one unique next,
  rejects silent branching, self-links, dangling targets and cycles, preserves
  archived edge history, and passes isolated API, CMS, visitor, responsive
  browser, calculation-book and contract checks.
- Accept `A22_FocusModeScopeGate`: S16 delivers one default-enabled persistent
  switch, server-authoritative visitor/CMS scope, hidden direct-route rejection,
  focused public navigation and homepage entry points, isolated responsive
  browser evidence, and full regression coverage.
- Accept `A23_CarouselFocusBuffer`: S17 delivers transactional selective
  buffering, stable identity and snapshots, no automatic restore, explicit-slot
  Owner restore, conflict/reason codes, CMS dual views, isolated responsive
  browser evidence, and full regression coverage.
- Create and register missing `A15_ContentCloudSync` for S10, narrowed to
  dry-run-first local integration of backup, checksum, stable-slug idempotency,
  and rollback-aware failure gates.
- Accept `A15_ContentCloudSync`: S10 delivers default zero-write/zero-network
  dry-run, explicit apply confirmation, backup/checksum gates, stable-slug
  idempotency, transaction rollback evidence, operator-controlled restore
  guidance, and safe deployment-script integration.
- Create and register missing `A16_RegressionEvidenceMatrix` as the only next
  task, narrowed to evidence-only isolated regression and browser smoke.
- Accept `A16_RegressionEvidenceMatrix`: S11 records 17 passing commands,
  9 passing isolated browser scenarios, zero release-blocking failures,
  explicit tool limitations, complete cleanup, and protected boundaries.
- Create and register missing `A17_ReleaseGitGate` as the only next task,
  narrowed to planning-only staging inventory and release readiness.
- Accept `A17_ReleaseGitGate`: S12 classifies all 191 live status paths with no
  gap or overlap, provides 84 explicit future include paths, isolates 107
  review-required paths, preserves protected exclusions, and records local
  technical pass, conditional future staging, and production not-ready.
- Return control to `A00_ProjectDirector`; no functional Agent remains pending.
- Split article formula authoring from the catalog foundation so the data/API
  and editor interactions can be accepted independently.
- Serialize all six implementation slices because they share server, CMS, and
  persistence boundaries.
- Treat `electronics-basics` as the canonical focus module and existing
  `power-electronics` metadata/routes as compatibility aliases. This does not
  create or delete a stored business category.
- Enforce focus visibility in server public payloads and direct content lookup,
  not only navigation.
- Preserve publication state, formula revisions, article-bound versions,
  carousel identity, and hidden content throughout all transitions.

## Execution Order

1. `S09 / A14` - formula catalog foundation.
2. `S13 / A19` - article formula authoring.
3. `S14 / A20` - formula reference version decisions.
4. `S15 / A21` - convergent, non-branching derivation graph.
5. `S16 / A22` - global focus mode scope gate.
6. `S17 / A23` - carousel focus buffer and manual restore.
7. `S10 / A15` - content cloud sync.
8. `S11 / A16` - regression evidence matrix.
9. `S12 / A17` - release and Git gate.

No functional Agent is open. The planned queue is complete and control has
returned to A00. Every mutation gate remains closed until separately
authorized.

## Current Gate

- Allowed: A00 read-only acceptance/status reporting and future requirement
  routing under the direct-dispatch rule.
- Closed: source/test edits, current/production mutation, cloud, deployment,
  restore, rollback, staging, commit, push, and branch/remote changes.
- Required after governance edits: `npm.cmd run codex:contract`.
- Required before any future Git or release action: new explicit authorization,
  live worktree revalidation, exact path allowlist, staged diff/secret review,
  production backup/restore-dry-run/health gates, and updated regression.

## Next Handoff

```text
Agent 00 Project Director（项目导演：负责顺序、门禁和下一步裁决）：请进入 E:\Project\2607-LarkixWeb，运行 npm.cmd run codex:handoff，然后按输出的 controller brief 核对当前状态；当前无待派发职能 Agent；若收到新需求，直接交给对应职能 Agent，若不存在则由 A00 创建并注册后继续；使用中文交接，遵守 AGENTS.md 门禁。
```
