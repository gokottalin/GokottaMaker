# S28 Git 未来暂存计划

本文件仅提供未来、另行授权后的显式路径计划。下列 `git add` 命令未执行，严禁替换为 `git add .`。

## 口径

- 初始快照命令：`git status --porcelain=v1 --untracked-files=all`
- 初始快照：213 条，含 33 条 ` M` 与 180 条 `??`。
- 初始分类：`include=106`、`exclude=107`、`review-required=0`。
- S28 新增三份允许输出后：`include=109`、`exclude=107`、`review-required=0`，共 216 条。
- 2026-07-30 A00 获得 Owner 的明确 Git 授权，并将版本升级到
  `V2.5.2+20260730-0012`；版本同步新增 12 条 `include`，当前最终口径为
  `include=121`、`exclude=107`、`review-required=0`，共 228 条。
- `include`：accepted S18-S27 `mayEdit`/实际交付路径，或被 current workline、accepted dispatch 与 Codex contract 明确引用的活动治理路径。
- `exclude`：旧 `docs/Agent*` 历史证据，以及 handoff 明确标记为他人既有脏改的受保护路径。
- `review-required`：没有 accepted slice 或活动治理归属证据，禁止猜测纳入。

A00 对初始待判项 `lib/seo.js` 做了 blob 级核对：工作树、过滤后内容与 index 的
SHA-1 均为 `3695a7072958118e620b5571f343a9954bb8ab5c`，且 `git diff --quiet`
返回 0。该路径没有实际内容差异，也不属于 accepted S18-S27，因此明确归入
`exclude`，不保留待判项。

## 初始 213 条逐项清单

格式：`分类 | status | 路径 | 依据`。

```text
include | ?? | .codex/agents/a24-formula-publishing-workflow.toml | active governance
include | ?? | .codex/agents/a25-focused-content-media.toml | active governance
include | ?? | .codex/agents/a26-branching-derivation-graph.toml | active governance
include | ?? | .codex/agents/a27-formula-authoring-drawer.toml | active governance
include | ?? | .codex/agents/a28-legacy-formula-migration-safety.toml | active governance
include | ?? | .codex/agents/a29-post-cover-coordinates.toml | active governance
include | ?? | .codex/agents/a30-post-reading-minutes.toml | active governance
include | ?? | .codex/agents/a31-inline-math-layout.toml | active governance
include | ?? | .codex/agents/a32-full-site-dark-theme.toml | active governance
include | ?? | .codex/agents/a33-batch-regression-evidence.toml | active governance
include | ?? | .codex/agents/a34-release-git-gate.toml | active governance
include |  M | .codex/larkix-governance.json | active governance
include |  M | admin/admin.css | S18,S19,S20,S22,S23
include |  M | admin/admin.js | S18,S19,S20,S22,S23
include | ?? | admin/admin-dark.css | S26
include |  M | admin/course-paths.html | S26
include |  M | admin/index.html | S18,S19,S20,S22,S23,S26
include |  M | AGENTS.md | active governance
include |  M | agents/A00_ProjectDirector/brief.md | active governance
include | ?? | agents/A24_FormulaPublishingWorkflow/brief.md | active governance
include | ?? | agents/A25_FocusedContentMedia/brief.md | active governance
include | ?? | agents/A26_BranchingDerivationGraph/brief.md | active governance
include | ?? | agents/A27_FormulaAuthoringDrawer/brief.md | active governance
include | ?? | agents/A28_LegacyFormulaMigrationSafety/brief.md | active governance
include | ?? | agents/A29_PostCoverCoordinates/brief.md | active governance
include | ?? | agents/A30_PostReadingMinutes/brief.md | active governance
include | ?? | agents/A31_InlineMathLayout/brief.md | active governance
include | ?? | agents/A32_FullSiteDarkTheme/brief.md | active governance
include | ?? | agents/A33_BatchRegressionEvidence/brief.md | active governance
include | ?? | agents/A34_ReleaseGitGate/brief.md | active governance
include | ?? | assets/vendor/cytoscape.LICENSE.txt | S19
include | ?? | assets/vendor/cytoscape.min.js | S19
include |  M | category-page.js | S22,S23
include |  M | data/markdown-renderer.js | S18,S19,S24
include |  M | data/media.js | S22,S25
include |  M | data/posts.js | S23
include |  M | derive.html | S18,S19
include | ?? | docs/batch-regression-evidence.md | S27
include |  M | docs/calculation-book-authoring-guide.md | S18,S19,S20
include |  M | docs/codex-workline/A00_ProjectDirector_handoff.md | active governance
include |  M | docs/codex-workline/implementation_slices.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260728-001.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260728-002.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260728-003.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260728-004.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260728-005.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260728-006.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260728-007.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260728-008.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260728-009.json | active governance
include | ?? | docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json | active governance
include | ?? | docs/codex-workline/slices/S18_formula_publication_workflow_handoff.md | S18
include | ?? | docs/codex-workline/slices/S19_branching_derivation_graph_handoff.md | S19
include | ?? | docs/codex-workline/slices/S20_formula_authoring_drawer_handoff.md | S20
include | ?? | docs/codex-workline/slices/S21_legacy_formula_migration_safety_handoff.md | S21
include | ?? | docs/codex-workline/slices/S22_post_cover_coordinates_handoff.md | S22
include | ?? | docs/codex-workline/slices/S23_post_reading_minutes_handoff.md | S23
include | ?? | docs/codex-workline/slices/S24_inline_math_layout_handoff.md | S24
include | ?? | docs/codex-workline/slices/S25_focused_content_media_handoff.md | S25
include | ?? | docs/codex-workline/slices/S26_full_site_dark_theme_handoff.md | S26
include | ?? | docs/codex-workline/slices/S27_batch_regression_evidence_handoff.md | S27
include |  M | docs/codex-workline/task_registry.json | active governance
include | ?? | docs/focused-content-media.md | S25
include | ?? | docs/full-site-dark-theme.md | S26
include | ?? | docs/inline-math-layout.md | S24
include | ?? | docs/legacy-formula-migration.md | S21
include | ?? | docs/post-cover-coordinates.md | S22
include | ?? | docs/post-reading-minutes.md | S23
include |  M | docs/prompts/next_agents.md | active governance
include | ?? | formula-graph.js | S19
include |  M | lib/content.js | S18,S19,S21,S22,S23
include | ?? | lib/legacy-formula-migration.js | S21
include |  M | lib/validators.js | S18,S19,S21,S22,S23
include |  M | main.js | S22,S23,S25
include |  M | maker.html | S23
include | ?? | migrations/020_formula_publication_workflow.js | S18
include | ?? | migrations/021_branching_derivation_graph.js | S19
include | ?? | migrations/022_formula_revision_presentation_snapshot.js | S19
include | ?? | migrations/023_legacy_formula_migration_support.js | S21
include | ?? | migrations/024_post_cover_coordinates.js | S22
include | ?? | migrations/025_post_reading_minutes.js | S23
include |  M | package.json | S18,S19,S20,S21,S22,S23
include |  M | post.js | S18,S19,S22,S23
include |  M | PROJECT_WINDOW.md | active governance
include |  M | scripts/codex-handoff.js | active governance
include | ?? | scripts/migrate-legacy-formulas.js | S21
include | ?? | scripts/run-batch-regression-evidence.js | S27
include |  M | scripts/test-article-formula-authoring.js | S18,S20
include | ?? | scripts/test-branching-derivation-graph.js | S19
include | ?? | scripts/test-focused-content-media.js | S25
include | ?? | scripts/test-formula-authoring-drawer.js | S20
include |  M | scripts/test-formula-catalog.js | S18,S19
include | ?? | scripts/test-formula-publication-workflow.js | S18
include |  M | scripts/test-formula-reference-versioning.js | S18,S19
include | ?? | scripts/test-full-site-dark-theme.js | S26
include | ?? | scripts/test-inline-math-layout.js | S24
include | ?? | scripts/test-legacy-formula-migration.js | S21
include |  M | scripts/test-linear-derivation-graph.js | S19
include | ?? | scripts/test-post-cover-coordinates.js | S22
include | ?? | scripts/test-post-reading-minutes.js | S23
include |  M | server.js | S18,S19,S21
include |  M | styles.css | S22,S24,S25,S26
include | ?? | styles/25-cover-crop.css | S22
include | ?? | styles/26-inline-math.css | S24
include | ?? | styles/27-focused-content-media.css | S25
include | ?? | styles/28-full-site-dark.css | S26
exclude | ?? | docs/Agent0+总控与集成/2026-05-28_01-27_Agent0_项目目录整理与Agent输出契约.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_18-10_Agent00_top_down_dispatch.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_18-10_Agent00_自顶向下分发与自底向上收敛.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_18-52_Agent0_第一轮自底向上收敛检查版.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_18-52_Agent0_第一轮自底向上收敛检查版.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_19-01_Agent00_项目永久概述与Agent接口契约.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_20-35_Agent00_derivation_network_dispatch.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_20-35_Agent00_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_20-35_Agent00_公式变量推导网络与电力电子聚焦架构设计.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_20-47_Agent0_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_20-47_Agent0_公式变量推导网络子Agent任务下达.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_21-08_Agent0_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_21-08_Agent0_子Agent启动契约与更新协议.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_21-09_Agent0_child_agent_bootstrap_contract.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_21-09_Agent0_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-19_21-09_Agent0_子Agent启动任务包与契约确认.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_18-13_Agent0_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_18-13_Agent0_推导网络与聚焦模式子Agent回传收敛.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_18-30_Agent0_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_18-30_Agent0_最新契约复核与执行前检查.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_18-38_Agent0_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_18-38_Agent0_全部回传信息收敛.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_18-53_Agent00_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_18-53_Agent00_项目状态补签_未进入代码实现.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_19-01_Agent00_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_19-01_Agent00_重新裁决_仍未进入代码实现.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_19-12_Agent00_implementation_decisions.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_19-12_Agent00_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_19-12_Agent00_九项实现前架构裁决与Agent0实现批次授权.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_19-44_Agent0_implementation_batch_dispatch.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_19-44_Agent0_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-06-21_19-44_Agent0_实现批次设计_推导网络与电力电子聚焦.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-07-07_15-15_Agent0_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-07-07_15-15_Agent0_Task0回传收敛_Batch1仍关闭.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-07-08_23-15_Agent0_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-07-08_23-15_Agent0_Task0全部回传收敛_Batch1待开启裁决.md | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-07-09_00-00_Agent0_status.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-07-09_12-42_Agent0_project_handoff_snapshot.json | legacy historical evidence
exclude | ?? | docs/Agent0+总控与集成/2026-07-09_12-42_Agent0_status.json | legacy historical evidence
exclude | ?? | docs/Agent1+运维与发布稳定性/2026-06-19_18-42_Agent1_发布门禁复核与上线输入模板.md | legacy historical evidence
exclude | ?? | docs/Agent1+运维与发布稳定性/2026-06-21_18-11_Agent1_status.json | legacy historical evidence
exclude | ?? | docs/Agent1+运维与发布稳定性/2026-06-21_18-11_Agent1_推导网络迁移备份回滚发布门禁.md | legacy historical evidence
exclude | ?? | docs/Agent1+运维与发布稳定性/2026-07-07_16-53_Agent1_status.json | legacy historical evidence
exclude | ?? | docs/Agent1+运维与发布稳定性/2026-07-07_16-53_Agent1_裁决后迁移备份回滚门禁补齐.md | legacy historical evidence
exclude | ?? | docs/Agent101-Git/2026-06-19_18-21_Agent101_治理文件入库审计.md | legacy historical evidence
exclude | ?? | docs/Agent101-Git/2026-06-21_18-02_Agent101_status.json | legacy historical evidence
exclude | ?? | docs/Agent101-Git/2026-06-21_18-02_Agent101_推导网络治理与实现提交拆分审计.md | legacy historical evidence
exclude | ?? | docs/Agent101-Git/2026-07-07_16-25_Agent101_status.json | legacy historical evidence
exclude | ?? | docs/Agent101-Git/2026-07-07_16-25_Agent101_裁决后治理入库显式staging清单.md | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-19_18-24_Agent2_serverjs模块化二期设计.md | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-19_21-19_Agent2_child_agent_bootstrap_contract.json | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-19_21-19_Agent2_status.json | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-19_21-19_Agent2_子Agent2A2B2C任务包与接口契约.md | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-20_00-03_Agent2A_status.json | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-20_00-03_Agent2A_知识节点数据模型迁移接口设计.md | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-20_00-03_Agent2B_status.json | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-20_00-03_Agent2B_知识节点公开与管理API接口设计.md | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-20_00-04_Agent2C_status.json | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-20_00-04_Agent2C_运行数据安全上传审计边界.md | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-20_11-26_Agent2_status.json | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/2026-06-20_11-26_Agent2_子Agent结果复测与收敛汇总.md | legacy historical evidence
exclude | ?? | docs/Agent2+后端与数据模型/AGENT2_CHILD_UPDATE_INDEX.json | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-19_18-40_Agent20_最小回归模板与证据规范.md | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-19_21-18_Agent20_Agent20A20B分派与交接契约.md | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-19_21-18_Agent20_child_regression_contract.json | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-19_21-18_Agent20_status.json | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-20_11-25_Agent20A_status.json | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-20_11-25_Agent20A_浏览器视觉回归接口设计.md | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-20_11-26_Agent20B_API_CMS_迁移回归接口设计.md | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-20_11-26_Agent20B_status.json | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-20_11-29_Agent20_status.json | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-20_11-29_Agent20_子Agent结果复测与汇总.md | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-21_21-21_Agent20_status.json | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/2026-06-21_21-21_Agent20_裁决后分批回归矩阵.md | legacy historical evidence
exclude | ?? | docs/Agent20+体验测试与问题上报/AGENT20_UPDATE_INDEX.json | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-19_18-25_Agent3_CMS工作流拆分设计.md | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-19_21-17_Agent3_child_agent_bootstrap_contract.json | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-19_21-17_Agent3_status.json | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-19_21-17_Agent3_子Agent启动任务包与接口契约.md | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-20_00-04_Agent3A_status.json | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-20_00-04_Agent3A_推导节点编辑器表单接口设计.md | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-20_00-04_Agent3B_status.json | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-20_00-04_Agent3B_推导节点媒体MarkdownRevisionAudit接口设计.md | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-20_11-26_Agent3_status.json | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-20_11-26_Agent3_子Agent结果复测与汇总.md | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-21_18-10_Agent3C_status.json | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-21_18-10_Agent3C_聚焦模式CMS配置接口设计.md | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-21_20-13_Agent3_status.json | legacy historical evidence
exclude | ?? | docs/Agent3+管理端CMS与内容工作流/2026-06-21_20-13_Agent3_裁决后CMS子Agent收敛刷新.md | legacy historical evidence
exclude | ?? | docs/Agent4+访客端体验、视觉与前端架构/2026-06-19_18-28_Agent4_访客端边界与回归清单.md | legacy historical evidence
exclude | ?? | docs/Agent4+访客端体验、视觉与前端架构/2026-06-21_17-53_Agent4_status.json | legacy historical evidence
exclude | ?? | docs/Agent4+访客端体验、视觉与前端架构/2026-06-21_17-53_Agent4_推导页与聚焦模式前端接口设计.md | legacy historical evidence
exclude | ?? | docs/Agent5+内容、SEO与知识体系/2026-06-19_18-32_Agent5_内容事实来源与SEO字段契约.md | legacy historical evidence
exclude | ?? | docs/Agent5+内容、SEO与知识体系/2026-06-21_17-52_Agent5_status.json | legacy historical evidence
exclude | ?? | docs/Agent5+内容、SEO与知识体系/2026-06-21_17-52_Agent5_电力电子聚焦与推导节点内容语义.md | legacy historical evidence
exclude | ?? | docs/Agent6-miniapps/2026-06-19_18-33_Agent6_小程序职责边界与版本同步清单.md | legacy historical evidence
exclude | ?? | docs/Agent7+视觉品牌与样式设计/2026-06-19_18-35_Agent7_视觉资产治理与主题变更流程.md | legacy historical evidence
exclude | ?? | docs/Agent7+视觉品牌与样式设计/2026-06-21_17-51_Agent7_status.json | legacy historical evidence
exclude | ?? | docs/Agent7+视觉品牌与样式设计/2026-06-21_17-51_Agent7_公式变量高亮视觉token接口设计.md | legacy historical evidence
exclude | ?? | docs/Agent8+市场部设计/2026-06-19_18-36_Agent8_市场表达输入与转化路径建议.md | legacy historical evidence
exclude | ?? | docs/Agent8+市场部设计/2026-06-21_18-12_Agent8_status.json | legacy historical evidence
exclude | ?? | docs/Agent8+市场部设计/2026-06-21_18-12_Agent8_电力电子聚焦首页表达草案.md | legacy historical evidence
exclude | ?? | docs/Agent9+内容生成对接规范/2026-06-19_18-38_Agent9_Markdown与DOCX契约复核.md | legacy historical evidence
exclude | ?? | docs/Agent9+内容生成对接规范/2026-06-19_21-09_Agent9_status.json | legacy historical evidence
exclude | ?? | docs/Agent9+内容生成对接规范/2026-06-19_21-09_Agent9_推导变量Markdown短码接口设计.md | legacy historical evidence
exclude |  M | lib/seo.js | no content diff; worktree blob equals index; outside accepted scope
exclude |  M | styles/20-content.css | protected pre-existing dirty path
```

## S28 自身新增

以下三项不在写入前的 213 条快照中，写入后均归 `include`：

```text
include | ?? | docs/release-git-gate-20260728.md | S28
include | ?? | docs/git-staging-plan-20260728.md | S28
include | ?? | docs/codex-workline/slices/S28_release_git_gate_handoff.md | S28
```

## V2.5.2 版本升级新增

以下 12 项在 S28 快照时无内容差异，本次仅因版本号与静态资源缓存号同步而进入
`include`：

```text
include | M | 404.html | V2.5.2 version sync
include | M | category.html | V2.5.2 version sync
include | M | data/miniapps.js | V2.5.2 version sync
include | M | data/site-meta.js | V2.5.2 version sync
include | M | index.html | V2.5.2 version sync
include | M | miniapps.html | V2.5.2 version sync
include | M | post.html | V2.5.2 version sync
include | M | project.html | V2.5.2 version sync
include | M | projects.html | V2.5.2 version sync
include | M | tools/gokotta-elec.html | V2.5.2 version sync
include | M | tools/larkix-elec.html | V2.5.2 version sync
include | M | tools/md2doc.html | V2.5.2 version sync
```

## 未来显式暂存命令

仅在 A00/Owner 明确授权、重新核对 live status 与回归后运行：

```powershell
git add -- "admin/admin.css" "admin/admin.js" "admin/admin-dark.css" "admin/course-paths.html" "admin/index.html" "assets/vendor/cytoscape.LICENSE.txt" "assets/vendor/cytoscape.min.js" "category-page.js" "data/markdown-renderer.js" "data/media.js" "data/posts.js" "derive.html" "docs/batch-regression-evidence.md" "docs/calculation-book-authoring-guide.md" "docs/codex-workline/slices/S18_formula_publication_workflow_handoff.md" "docs/codex-workline/slices/S19_branching_derivation_graph_handoff.md" "docs/codex-workline/slices/S20_formula_authoring_drawer_handoff.md" "docs/codex-workline/slices/S21_legacy_formula_migration_safety_handoff.md" "docs/codex-workline/slices/S22_post_cover_coordinates_handoff.md" "docs/codex-workline/slices/S23_post_reading_minutes_handoff.md" "docs/codex-workline/slices/S24_inline_math_layout_handoff.md" "docs/codex-workline/slices/S25_focused_content_media_handoff.md" "docs/codex-workline/slices/S26_full_site_dark_theme_handoff.md" "docs/codex-workline/slices/S27_batch_regression_evidence_handoff.md" "docs/focused-content-media.md" "docs/full-site-dark-theme.md" "docs/inline-math-layout.md" "docs/legacy-formula-migration.md" "docs/post-cover-coordinates.md" "docs/post-reading-minutes.md" "formula-graph.js" "lib/content.js" "lib/legacy-formula-migration.js" "lib/validators.js" "main.js" "maker.html" "migrations/020_formula_publication_workflow.js" "migrations/021_branching_derivation_graph.js" "migrations/022_formula_revision_presentation_snapshot.js" "migrations/023_legacy_formula_migration_support.js" "migrations/024_post_cover_coordinates.js" "migrations/025_post_reading_minutes.js" "package.json" "post.js" "scripts/migrate-legacy-formulas.js" "scripts/run-batch-regression-evidence.js" "scripts/test-article-formula-authoring.js" "scripts/test-branching-derivation-graph.js" "scripts/test-focused-content-media.js" "scripts/test-formula-authoring-drawer.js" "scripts/test-formula-catalog.js" "scripts/test-formula-publication-workflow.js" "scripts/test-formula-reference-versioning.js" "scripts/test-full-site-dark-theme.js" "scripts/test-inline-math-layout.js" "scripts/test-legacy-formula-migration.js" "scripts/test-linear-derivation-graph.js" "scripts/test-post-cover-coordinates.js" "scripts/test-post-reading-minutes.js" "server.js" "styles.css" "styles/25-cover-crop.css" "styles/26-inline-math.css" "styles/27-focused-content-media.css" "styles/28-full-site-dark.css"
git add -- ".codex/agents/a24-formula-publishing-workflow.toml" ".codex/agents/a25-focused-content-media.toml" ".codex/agents/a26-branching-derivation-graph.toml" ".codex/agents/a27-formula-authoring-drawer.toml" ".codex/agents/a28-legacy-formula-migration-safety.toml" ".codex/agents/a29-post-cover-coordinates.toml" ".codex/agents/a30-post-reading-minutes.toml" ".codex/agents/a31-inline-math-layout.toml" ".codex/agents/a32-full-site-dark-theme.toml" ".codex/agents/a33-batch-regression-evidence.toml" ".codex/agents/a34-release-git-gate.toml" ".codex/larkix-governance.json" "AGENTS.md" "agents/A00_ProjectDirector/brief.md" "agents/A24_FormulaPublishingWorkflow/brief.md" "agents/A25_FocusedContentMedia/brief.md" "agents/A26_BranchingDerivationGraph/brief.md" "agents/A27_FormulaAuthoringDrawer/brief.md" "agents/A28_LegacyFormulaMigrationSafety/brief.md" "agents/A29_PostCoverCoordinates/brief.md" "agents/A30_PostReadingMinutes/brief.md" "agents/A31_InlineMathLayout/brief.md" "agents/A32_FullSiteDarkTheme/brief.md" "agents/A33_BatchRegressionEvidence/brief.md" "agents/A34_ReleaseGitGate/brief.md" "docs/codex-workline/A00_ProjectDirector_handoff.md" "docs/codex-workline/implementation_slices.json" "docs/codex-workline/requirements/active/REQ-20260728-001.json" "docs/codex-workline/requirements/active/REQ-20260728-002.json" "docs/codex-workline/requirements/active/REQ-20260728-003.json" "docs/codex-workline/requirements/active/REQ-20260728-004.json" "docs/codex-workline/requirements/active/REQ-20260728-005.json" "docs/codex-workline/requirements/active/REQ-20260728-006.json" "docs/codex-workline/requirements/active/REQ-20260728-007.json" "docs/codex-workline/requirements/active/REQ-20260728-008.json" "docs/codex-workline/requirements/active/REQ-20260728-009.json" "docs/codex-workline/requirements/dispatch/DISPATCH-20260728-001.json" "docs/codex-workline/task_registry.json" "docs/prompts/next_agents.md" "PROJECT_WINDOW.md" "scripts/codex-handoff.js"
git add -- "docs/release-git-gate-20260728.md" "docs/git-staging-plan-20260728.md" "docs/codex-workline/slices/S28_release_git_gate_handoff.md"
git add -- "404.html" "category.html" "data/miniapps.js" "data/site-meta.js" "index.html" "miniapps.html" "post.html" "project.html" "projects.html" "tools/gokotta-elec.html" "tools/larkix-elec.html" "tools/md2doc.html"
```

暂存后必须立即检查：

```powershell
git diff --cached --name-status
git diff --cached --check
```

预期 staged path 必须恰好等于 121 条 `include`，不得出现 `lib/seo.js`、
`styles/20-content.css`、任何 `docs/Agent*`、runtime data、数据库、uploads、日志、
凭据或临时产物。任何偏差都应停止，不得用 reset/checkout/clean/stash 自行修复。
