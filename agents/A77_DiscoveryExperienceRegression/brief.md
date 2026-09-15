# Agent 77 Discovery Experience Regression（发现体验全批回归）

## Mission

对 S62-S66 形成的公式 CMS、发现权威、CMS 草稿与运营、公开搜索与首页编排、卡片/主题/版本/备案进行最终独立全批回归，输出可重复 runner 和证据。只做 QA，不在本包隐藏产品修复。

## Read First

- `AGENTS.md`
- `PROJECT_WINDOW.md`
- `docs/PROJECT_CHARTER.md`
- `docs/codex-workline/task_registry.json`
- `docs/codex-workline/slices/S62_formula_cms_consolidated_handoff.md`
- `docs/codex-workline/slices/S63_cross_content_discovery_authority_handoff.md`
- `docs/codex-workline/slices/S64_cms_draft_operations_controls_handoff.md`
- `docs/codex-workline/slices/S65_public_search_home_composition_handoff.md`
- `docs/codex-workline/slices/S66_public_card_theme_footer_version_handoff.md`
- `scripts/run-formula-workline-regression.js`
- `scripts/run-security-formula-regression.js`

## May Edit

- `scripts/run-discovery-experience-regression.js`
- `docs/discovery-experience-regression-evidence.md`
- `docs/codex-workline/slices/S67_discovery_experience_regression_handoff.md`

## Contract

- Runner 必须逐项执行 S66 focused static/browser、S65 static/browser、S64 static/browser、S63 migration/authority、S62 consolidated、S60、S50 与 `codex:contract`，任一失败整体非零退出。
- 汇总必须包含命令、退出状态、耗时、S60 digest、临时目录/进程清理与保护路径证明，不得把瞬时红灯静默记绿。
- 真实浏览器覆盖 390px、首帧 light/dark、CMS/公开边界、五类型搜索、首页八公式与三槽位、草稿冲突恢复。
- 不允许修改任何产品、CSS、HTML、API、CMS、迁移或既有测试；若发现稳定失败，写精确复现并返回 A00 退回对应原执行工作台。

## Checks

- `node scripts/run-discovery-experience-regression.js`
- `npm.cmd run codex:contract`
- `node --check scripts/run-discovery-experience-regression.js`
- `git diff --check`
- 保护路径、cached diff、临时目录与残留进程检查

## Forbidden

产品修复；放宽既有断言；当前/生产数据；Git；部署；云；服务；秘密；迁移；版本变更；mayEdit 外文件。

## Handoff

完成后写入 `docs/codex-workline/slices/S67_discovery_experience_regression_handoff.md` 并直接回传 A00。A00 独立重跑并裁决；A77 不执行 Git。
