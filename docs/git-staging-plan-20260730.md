# S42 Git 显式候选计划

本文件是 A51 注册后的最终 Git 候选集合。严禁替换为 `git add .`、`git add -A` 或目录级宽泛暂存。

## 口径

- 快照：`git -c core.quotepath=false status --porcelain=v1 --untracked-files=all`。
- 最终状态：314 条。
- 最终分类：`include=207`、`exclude=107`、`review-required=0`。
- 候选版本：`V2.5.3+20260807-0001`。
- `include`：已验收切片、版本同步、活动治理或 S42 允许输出。
- `exclude`：旧 `docs/Agent*` 历史证据和两个无内容差异的受保护元数据状态。

## 最终 314 条逐项清单

格式：`分类 | status | 路径 | 依据`。

```text
include | ?? | .codex/agents/a36-shared-math-rendering.toml | active governance
include | ?? | .codex/agents/a37-carousel-slot-authority.toml | active governance
include | ?? | .codex/agents/a38-focused-cover-reverification.toml | active governance
include | ?? | .codex/agents/a39-formula-binding-marker.toml | active governance
include | ?? | .codex/agents/a40-md2-file-renderer-parity.toml | active governance
include | ?? | .codex/agents/a41-article-formula-selection-create.toml | active governance
include | ?? | .codex/agents/a42-derivation-workflow-recovery.toml | active governance
include | ?? | .codex/agents/a43-formula-map-flow-layout.toml | active governance
include | ?? | .codex/agents/a44-cms-feedback-publish-dock.toml | active governance
include | ?? | .codex/agents/a45-md2-file-public-entry.toml | active governance
include | ?? | .codex/agents/a46-batch-regression-evidence.toml | active governance
include | ?? | .codex/agents/a47-release-git-gate.toml | active governance
include | ?? | .codex/agents/a48-api-verify-redirected-output.toml | active governance
include | ?? | .codex/agents/a49-release-version-sync.toml | active governance
include | ?? | .codex/agents/a50-release-git-gate-reverification.toml | active governance
include | ?? | .codex/agents/a51-git-publisher.toml | active governance
include |  M | .codex/larkix-governance.json | S00_batch1_open_dispatch
include |  M | 404.html | S41A_release_version_sync
include |  M | ACTIVE_AGENT_DISPATCH.json | active governance
include |  M | admin/admin-dark.css | S26_full_site_dark_theme,S38_cms_feedback_publish_dock
include |  M | admin/admin.css | S05_cms_knowledge_node_workflow,S07_cms_formula_authoring_examples,S09_formula_catalog_management,S13_article_formula_authoring,S14_formula_reference_versioning,S15_linear_derivation_graph,S16_focus_mode_scope_gate,S17_carousel_focus_buffer,S18_formula_publication_workflow,S19_branching_derivation_graph,S20_formula_authoring_drawer,S22_post_cover_coordinates,S23_post_reading_minutes,S31_carousel_slot_authority,S35_article_formula_selection_create,S36_derivation_workflow_recovery,S37_formula_map_flow_layout,S38_cms_feedback_publish_dock
include |  M | admin/admin.js | S05_cms_knowledge_node_workflow,S07_cms_formula_authoring_examples,S09_formula_catalog_management,S13_article_formula_authoring,S14_formula_reference_versioning,S15_linear_derivation_graph,S16_focus_mode_scope_gate,S17_carousel_focus_buffer,S18_formula_publication_workflow,S19_branching_derivation_graph,S20_formula_authoring_drawer,S22_post_cover_coordinates,S23_post_reading_minutes,S31_carousel_slot_authority,S35_article_formula_selection_create,S36_derivation_workflow_recovery,S38_cms_feedback_publish_dock
include |  M | admin/course-paths.html | S05_cms_knowledge_node_workflow,S26_full_site_dark_theme,S41A_release_version_sync
include |  M | admin/index.html | S05_cms_knowledge_node_workflow,S07_cms_formula_authoring_examples,S09_formula_catalog_management,S13_article_formula_authoring,S14_formula_reference_versioning,S15_linear_derivation_graph,S16_focus_mode_scope_gate,S17_carousel_focus_buffer,S18_formula_publication_workflow,S19_branching_derivation_graph,S20_formula_authoring_drawer,S22_post_cover_coordinates,S23_post_reading_minutes,S26_full_site_dark_theme,S31_carousel_slot_authority,S35_article_formula_selection_create,S36_derivation_workflow_recovery,S38_cms_feedback_publish_dock,S41A_release_version_sync
include |  M | agents/A00_ProjectDirector/brief.md | active governance
include | ?? | agents/A36_SharedMathRendering/brief.md | active governance
include | ?? | agents/A37_CarouselSlotAuthority/brief.md | active governance
include | ?? | agents/A38_FocusedCoverReverification/brief.md | active governance
include | ?? | agents/A39_FormulaBindingMarker/brief.md | active governance
include | ?? | agents/A40_MD2FileRendererParity/brief.md | active governance
include | ?? | agents/A41_ArticleFormulaSelectionCreate/brief.md | active governance
include | ?? | agents/A42_DerivationWorkflowRecovery/brief.md | active governance
include | ?? | agents/A43_FormulaMapFlowLayout/brief.md | active governance
include | ?? | agents/A44_CmsFeedbackPublishDock/brief.md | active governance
include | ?? | agents/A45_MD2FilePublicEntry/brief.md | active governance
include | ?? | agents/A46_BatchRegressionEvidence/brief.md | active governance
include | ?? | agents/A47_ReleaseGitGate/brief.md | active governance
include | ?? | agents/A48_ApiVerifyRedirectedOutput/brief.md | active governance
include | ?? | agents/A49_ReleaseVersionSync/brief.md | active governance
include | ?? | agents/A50_ReleaseGitGateReverification/brief.md | active governance
include | ?? | agents/A51_GitPublisher/brief.md | active governance
include | ?? | assets/vendor/katex/fonts/KaTeX_AMS-Regular.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_AMS-Regular.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_AMS-Regular.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Caligraphic-Bold.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Caligraphic-Regular.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Fraktur-Bold.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Fraktur-Bold.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Fraktur-Regular.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Fraktur-Regular.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-Bold.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-Bold.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-Bold.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-BoldItalic.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-BoldItalic.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-Italic.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-Italic.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-Italic.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-Regular.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-Regular.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Main-Regular.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Math-BoldItalic.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Math-BoldItalic.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Math-Italic.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Math-Italic.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Math-Italic.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_SansSerif-Bold.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_SansSerif-Bold.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_SansSerif-Italic.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_SansSerif-Italic.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_SansSerif-Regular.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_SansSerif-Regular.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Script-Regular.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Script-Regular.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Script-Regular.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size1-Regular.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size1-Regular.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size1-Regular.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size2-Regular.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size2-Regular.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size2-Regular.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size3-Regular.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size3-Regular.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size3-Regular.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size4-Regular.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size4-Regular.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Size4-Regular.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Typewriter-Regular.ttf | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Typewriter-Regular.woff | S30_shared_math_rendering
include | ?? | assets/vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2 | S30_shared_math_rendering
include | ?? | assets/vendor/katex/katex.min.css | S30_shared_math_rendering
include | ?? | assets/vendor/katex/katex.min.js | S30_shared_math_rendering
include | ?? | assets/vendor/katex/LICENSE.txt | S30_shared_math_rendering
include |  M | category.html | S41A_release_version_sync
include |  M | data/content-store.js | S16_focus_mode_scope_gate,S31_carousel_slot_authority
include |  M | data/markdown-renderer.js | S04_markdown_docx_derivation_links,S07_cms_formula_authoring_examples,S09_formula_catalog_management,S13_article_formula_authoring,S14_formula_reference_versioning,S15_linear_derivation_graph,S18_formula_publication_workflow,S19_branching_derivation_graph,S24_inline_math_layout,S30_shared_math_rendering,S33_formula_binding_marker
include | ?? | data/math-renderer.js | S30_shared_math_rendering
include |  M | data/miniapps.js | S39_md2file_public_entry,S41A_release_version_sync
include |  M | data/site-meta.js | S41A_release_version_sync
include |  M | derive.html | S06_public_derivation_and_focus_mode,S09_formula_catalog_management,S15_linear_derivation_graph,S16_focus_mode_scope_gate,S18_formula_publication_workflow,S19_branching_derivation_graph,S30_shared_math_rendering,S33_formula_binding_marker,S37_formula_map_flow_layout,S41A_release_version_sync
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
include | ?? | docs/article-formula-selection-create.md | S35_article_formula_selection_create
include |  M | docs/batch-regression-evidence.md | S27_batch_regression_evidence,S40_batch_regression_evidence
include | ?? | docs/carousel-slot-authority.md | S31_carousel_slot_authority
include | ?? | docs/cms-feedback-publish-dock.md | S38_cms_feedback_publish_dock
include |  M | docs/codex-workline/A00_ProjectDirector_handoff.md | active governance
include |  M | docs/codex-workline/implementation_slices.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-001.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-002.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-003.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-004.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-005.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-006.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-007.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-008.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-009.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-010.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-011.json | active governance
include | ?? | docs/codex-workline/requirements/active/REQ-20260730-012.json | active governance
include | ?? | docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json | active governance
include | ?? | docs/codex-workline/slices/S30_shared_math_rendering_handoff.md | S30_shared_math_rendering
include | ?? | docs/codex-workline/slices/S31_carousel_slot_authority_handoff.md | S31_carousel_slot_authority
include | ?? | docs/codex-workline/slices/S32_focused_cover_reverification_handoff.md | S32_focused_cover_reverification
include | ?? | docs/codex-workline/slices/S33_formula_binding_marker_handoff.md | S33_formula_binding_marker
include | ?? | docs/codex-workline/slices/S34_md2file_renderer_parity_handoff.md | S34_md2file_renderer_parity
include | ?? | docs/codex-workline/slices/S35_article_formula_selection_create_handoff.md | S35_article_formula_selection_create
include | ?? | docs/codex-workline/slices/S36_derivation_workflow_recovery_handoff.md | S36_derivation_workflow_recovery
include | ?? | docs/codex-workline/slices/S37_formula_map_flow_layout_handoff.md | S37_formula_map_flow_layout
include | ?? | docs/codex-workline/slices/S38_cms_feedback_publish_dock_handoff.md | S38_cms_feedback_publish_dock
include | ?? | docs/codex-workline/slices/S39_md2file_public_entry_handoff.md | S39_md2file_public_entry
include | ?? | docs/codex-workline/slices/S40_batch_regression_evidence_handoff.md | S40_batch_regression_evidence
include | ?? | docs/codex-workline/slices/S40A_api_verify_redirected_output_handoff.md | S40A_api_verify_redirected_output
include | ?? | docs/codex-workline/slices/S41_release_git_gate_handoff.md | S41_release_git_gate
include | ?? | docs/codex-workline/slices/S41A_release_version_sync_handoff.md | S41A_release_version_sync
include | ?? | docs/codex-workline/slices/S41B_release_git_gate_reverification_handoff.md | S41B_release_git_gate_reverification
include | ?? | docs/codex-workline/slices/S42_git_publish_handoff.md | S42_git_publish
include |  M | docs/codex-workline/task_registry.json | S00_batch1_open_dispatch
include | ?? | docs/formula-binding-marker.md | S33_formula_binding_marker
include | ?? | docs/formula-map-flow-layout.md | S37_formula_map_flow_layout
include | ?? | docs/git-staging-plan-20260730.md | S41_release_git_gate,S41B_release_git_gate_reverification,S42_git_publish
include |  M | docs/inline-math-layout.md | S24_inline_math_layout
include | ?? | docs/legacy-formula-relation-recovery.md | S36_derivation_workflow_recovery
include | ?? | docs/md2file-public-entry.md | S39_md2file_public_entry
include | ?? | docs/md2file-renderer-parity.md | S34_md2file_renderer_parity
include |  M | docs/prompts/next_agents.md | S00_batch1_open_dispatch
include | ?? | docs/release-git-gate-20260730.md | S41_release_git_gate,S41B_release_git_gate_reverification,S42_git_publish
include | ?? | docs/shared-math-rendering.md | S30_shared_math_rendering
include |  M | formula-graph.js | S19_branching_derivation_graph,S37_formula_map_flow_layout
include |  M | index.html | S39_md2file_public_entry,S41A_release_version_sync
include |  M | lib/content.js | S03_api_runtime_boundary,S09_formula_catalog_management,S13_article_formula_authoring,S14_formula_reference_versioning,S15_linear_derivation_graph,S16_focus_mode_scope_gate,S17_carousel_focus_buffer,S18_formula_publication_workflow,S19_branching_derivation_graph,S21_legacy_formula_migration_safety,S22_post_cover_coordinates,S23_post_reading_minutes,S31_carousel_slot_authority,S35_article_formula_selection_create,S36_derivation_workflow_recovery
include | ?? | lib/legacy-formula-relation-migration.js | S36_derivation_workflow_recovery
include |  M | lib/md2doc.js | S04_markdown_docx_derivation_links,S34_md2file_renderer_parity
exclude |  M | lib/seo.js | protected metadata-only status; worktree blob equals index blob
include |  M | lib/validators.js | S03_api_runtime_boundary,S09_formula_catalog_management,S13_article_formula_authoring,S14_formula_reference_versioning,S15_linear_derivation_graph,S16_focus_mode_scope_gate,S17_carousel_focus_buffer,S18_formula_publication_workflow,S19_branching_derivation_graph,S21_legacy_formula_migration_safety,S22_post_cover_coordinates,S23_post_reading_minutes,S31_carousel_slot_authority,S35_article_formula_selection_create,S36_derivation_workflow_recovery
include |  M | main.js | S06_public_derivation_and_focus_mode,S16_focus_mode_scope_gate,S17_carousel_focus_buffer,S22_post_cover_coordinates,S23_post_reading_minutes,S25_focused_content_media,S31_carousel_slot_authority,S32_focused_cover_reverification,S39_md2file_public_entry
include |  M | maker.html | S09_formula_catalog_management,S13_article_formula_authoring,S16_focus_mode_scope_gate,S23_post_reading_minutes,S31_carousel_slot_authority,S39_md2file_public_entry,S41A_release_version_sync
include | ?? | migrations/026_hero_carousel_slots.js | S31_carousel_slot_authority
include | ?? | migrations/027_formula_relation_repairs.js | S36_derivation_workflow_recovery
include |  M | miniapps.html | S39_md2file_public_entry,S41A_release_version_sync
include | ?? | package-lock.json | S30_shared_math_rendering,S41A_release_version_sync
include |  M | package.json | S08_calculation_book_engineering,S09_formula_catalog_management,S13_article_formula_authoring,S14_formula_reference_versioning,S15_linear_derivation_graph,S16_focus_mode_scope_gate,S17_carousel_focus_buffer,S18_formula_publication_workflow,S19_branching_derivation_graph,S20_formula_authoring_drawer,S21_legacy_formula_migration_safety,S22_post_cover_coordinates,S23_post_reading_minutes,S30_shared_math_rendering,S40_batch_regression_evidence,S41A_release_version_sync
include |  M | post.html | S16_focus_mode_scope_gate,S30_shared_math_rendering,S41A_release_version_sync
include |  M | post.js | S06_public_derivation_and_focus_mode,S07_cms_formula_authoring_examples,S09_formula_catalog_management,S13_article_formula_authoring,S14_formula_reference_versioning,S15_linear_derivation_graph,S16_focus_mode_scope_gate,S18_formula_publication_workflow,S19_branching_derivation_graph,S22_post_cover_coordinates,S23_post_reading_minutes,S33_formula_binding_marker,S36_derivation_workflow_recovery
include |  M | PROJECT_MAINTENANCE.json | active governance
include |  M | PROJECT_WINDOW.md | S00_batch1_open_dispatch
include |  M | project.html | S16_focus_mode_scope_gate,S30_shared_math_rendering,S41A_release_version_sync
include |  M | projects.html | S41A_release_version_sync
include |  M | README.md | S41A_release_version_sync
include | ?? | scripts/migrate-legacy-formula-relations.js | S36_derivation_workflow_recovery
include |  M | scripts/run-batch-regression-evidence.js | S27_batch_regression_evidence,S40_batch_regression_evidence
include | ?? | scripts/test-api-verify-redirected-output.js | S40A_api_verify_redirected_output
include |  M | scripts/test-article-formula-authoring.js | S13_article_formula_authoring,S18_formula_publication_workflow,S20_formula_authoring_drawer,S35_article_formula_selection_create
include | ?? | scripts/test-article-formula-selection-create.js | S35_article_formula_selection_create
include |  M | scripts/test-branching-derivation-graph.js | S19_branching_derivation_graph,S36_derivation_workflow_recovery
include |  M | scripts/test-carousel-focus-buffer.js | S17_carousel_focus_buffer,S31_carousel_slot_authority
include | ?? | scripts/test-cms-floating-feedback-publish-bar.js | S38_cms_feedback_publish_dock
include |  M | scripts/test-focus-mode.js | S16_focus_mode_scope_gate,S31_carousel_slot_authority,S39_md2file_public_entry
include |  M | scripts/test-formula-authoring-drawer.js | S20_formula_authoring_drawer,S35_article_formula_selection_create,S38_cms_feedback_publish_dock
include | ?? | scripts/test-formula-binding-marker.js | S33_formula_binding_marker
include | ?? | scripts/test-formula-map-flow-layout.js | S37_formula_map_flow_layout
include |  M | scripts/test-full-site-dark-theme.js | S26_full_site_dark_theme,S38_cms_feedback_publish_dock
include | ?? | scripts/test-hero-carousel-authority.js | S31_carousel_slot_authority
include |  M | scripts/test-inline-math-layout.js | S24_inline_math_layout,S30_shared_math_rendering
include |  M | scripts/test-legacy-formula-migration.js | S21_legacy_formula_migration_safety,S36_derivation_workflow_recovery
include | ?? | scripts/test-legacy-formula-relation-migration.js | S36_derivation_workflow_recovery
include |  M | scripts/test-markdown-renderer.js | S04_markdown_docx_derivation_links,S07_cms_formula_authoring_examples,S30_shared_math_rendering,S33_formula_binding_marker
include | ?? | scripts/test-math-rendering.js | S30_shared_math_rendering
include | ?? | scripts/test-md2file-docx-semantics.js | S34_md2file_renderer_parity
include | ?? | scripts/test-md2file-public-entry.js | S39_md2file_public_entry
include |  M | scripts/verify-api.ps1 | S03_api_runtime_boundary,S16_focus_mode_scope_gate,S34_md2file_renderer_parity,S40A_api_verify_redirected_output
include |  M | server.js | S03_api_runtime_boundary,S09_formula_catalog_management,S13_article_formula_authoring,S14_formula_reference_versioning,S15_linear_derivation_graph,S16_focus_mode_scope_gate,S17_carousel_focus_buffer,S18_formula_publication_workflow,S19_branching_derivation_graph,S21_legacy_formula_migration_safety,S31_carousel_slot_authority,S34_md2file_renderer_parity,S35_article_formula_selection_create,S36_derivation_workflow_recovery,S39_md2file_public_entry,S41A_release_version_sync
include |  M | site-layout.js | S06_public_derivation_and_focus_mode,S39_md2file_public_entry
exclude |  M | styles/20-content.css | protected metadata-only status; worktree blob equals index blob
include |  M | styles/26-inline-math.css | S24_inline_math_layout,S30_shared_math_rendering,S33_formula_binding_marker
include |  M | styles/md2doc.css | S34_md2file_renderer_parity
include |  M | tools/gokotta-elec.html | S41A_release_version_sync
include |  M | tools/larkix-elec.html | S41A_release_version_sync
include |  M | tools/md2doc.html | S34_md2file_renderer_parity,S41A_release_version_sync
include |  M | tools/md2doc.js | S04_markdown_docx_derivation_links,S34_md2file_renderer_parity
```

## 路径显式暂存命令

以下 14 条命令覆盖 207 个 include 路径，每个路径恰好一次。

```powershell
git add -- '.codex/agents/a36-shared-math-rendering.toml' '.codex/agents/a37-carousel-slot-authority.toml' '.codex/agents/a38-focused-cover-reverification.toml' '.codex/agents/a39-formula-binding-marker.toml' '.codex/agents/a40-md2-file-renderer-parity.toml' '.codex/agents/a41-article-formula-selection-create.toml' '.codex/agents/a42-derivation-workflow-recovery.toml' '.codex/agents/a43-formula-map-flow-layout.toml' '.codex/agents/a44-cms-feedback-publish-dock.toml' '.codex/agents/a45-md2-file-public-entry.toml' '.codex/agents/a46-batch-regression-evidence.toml' '.codex/agents/a47-release-git-gate.toml' '.codex/agents/a48-api-verify-redirected-output.toml' '.codex/agents/a49-release-version-sync.toml' '.codex/agents/a50-release-git-gate-reverification.toml'
git add -- '.codex/agents/a51-git-publisher.toml' '.codex/larkix-governance.json' '404.html' 'ACTIVE_AGENT_DISPATCH.json' 'admin/admin-dark.css' 'admin/admin.css' 'admin/admin.js' 'admin/course-paths.html' 'admin/index.html' 'agents/A00_ProjectDirector/brief.md' 'agents/A36_SharedMathRendering/brief.md' 'agents/A37_CarouselSlotAuthority/brief.md' 'agents/A38_FocusedCoverReverification/brief.md' 'agents/A39_FormulaBindingMarker/brief.md' 'agents/A40_MD2FileRendererParity/brief.md'
git add -- 'agents/A41_ArticleFormulaSelectionCreate/brief.md' 'agents/A42_DerivationWorkflowRecovery/brief.md' 'agents/A43_FormulaMapFlowLayout/brief.md' 'agents/A44_CmsFeedbackPublishDock/brief.md' 'agents/A45_MD2FilePublicEntry/brief.md' 'agents/A46_BatchRegressionEvidence/brief.md' 'agents/A47_ReleaseGitGate/brief.md' 'agents/A48_ApiVerifyRedirectedOutput/brief.md' 'agents/A49_ReleaseVersionSync/brief.md' 'agents/A50_ReleaseGitGateReverification/brief.md' 'agents/A51_GitPublisher/brief.md' 'assets/vendor/katex/fonts/KaTeX_AMS-Regular.ttf' 'assets/vendor/katex/fonts/KaTeX_AMS-Regular.woff' 'assets/vendor/katex/fonts/KaTeX_AMS-Regular.woff2' 'assets/vendor/katex/fonts/KaTeX_Caligraphic-Bold.ttf'
git add -- 'assets/vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff' 'assets/vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2' 'assets/vendor/katex/fonts/KaTeX_Caligraphic-Regular.ttf' 'assets/vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff' 'assets/vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2' 'assets/vendor/katex/fonts/KaTeX_Fraktur-Bold.ttf' 'assets/vendor/katex/fonts/KaTeX_Fraktur-Bold.woff' 'assets/vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2' 'assets/vendor/katex/fonts/KaTeX_Fraktur-Regular.ttf' 'assets/vendor/katex/fonts/KaTeX_Fraktur-Regular.woff' 'assets/vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2' 'assets/vendor/katex/fonts/KaTeX_Main-Bold.ttf' 'assets/vendor/katex/fonts/KaTeX_Main-Bold.woff' 'assets/vendor/katex/fonts/KaTeX_Main-Bold.woff2' 'assets/vendor/katex/fonts/KaTeX_Main-BoldItalic.ttf'
git add -- 'assets/vendor/katex/fonts/KaTeX_Main-BoldItalic.woff' 'assets/vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2' 'assets/vendor/katex/fonts/KaTeX_Main-Italic.ttf' 'assets/vendor/katex/fonts/KaTeX_Main-Italic.woff' 'assets/vendor/katex/fonts/KaTeX_Main-Italic.woff2' 'assets/vendor/katex/fonts/KaTeX_Main-Regular.ttf' 'assets/vendor/katex/fonts/KaTeX_Main-Regular.woff' 'assets/vendor/katex/fonts/KaTeX_Main-Regular.woff2' 'assets/vendor/katex/fonts/KaTeX_Math-BoldItalic.ttf' 'assets/vendor/katex/fonts/KaTeX_Math-BoldItalic.woff' 'assets/vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2' 'assets/vendor/katex/fonts/KaTeX_Math-Italic.ttf' 'assets/vendor/katex/fonts/KaTeX_Math-Italic.woff' 'assets/vendor/katex/fonts/KaTeX_Math-Italic.woff2' 'assets/vendor/katex/fonts/KaTeX_SansSerif-Bold.ttf'
git add -- 'assets/vendor/katex/fonts/KaTeX_SansSerif-Bold.woff' 'assets/vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2' 'assets/vendor/katex/fonts/KaTeX_SansSerif-Italic.ttf' 'assets/vendor/katex/fonts/KaTeX_SansSerif-Italic.woff' 'assets/vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2' 'assets/vendor/katex/fonts/KaTeX_SansSerif-Regular.ttf' 'assets/vendor/katex/fonts/KaTeX_SansSerif-Regular.woff' 'assets/vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2' 'assets/vendor/katex/fonts/KaTeX_Script-Regular.ttf' 'assets/vendor/katex/fonts/KaTeX_Script-Regular.woff' 'assets/vendor/katex/fonts/KaTeX_Script-Regular.woff2' 'assets/vendor/katex/fonts/KaTeX_Size1-Regular.ttf' 'assets/vendor/katex/fonts/KaTeX_Size1-Regular.woff' 'assets/vendor/katex/fonts/KaTeX_Size1-Regular.woff2' 'assets/vendor/katex/fonts/KaTeX_Size2-Regular.ttf'
git add -- 'assets/vendor/katex/fonts/KaTeX_Size2-Regular.woff' 'assets/vendor/katex/fonts/KaTeX_Size2-Regular.woff2' 'assets/vendor/katex/fonts/KaTeX_Size3-Regular.ttf' 'assets/vendor/katex/fonts/KaTeX_Size3-Regular.woff' 'assets/vendor/katex/fonts/KaTeX_Size3-Regular.woff2' 'assets/vendor/katex/fonts/KaTeX_Size4-Regular.ttf' 'assets/vendor/katex/fonts/KaTeX_Size4-Regular.woff' 'assets/vendor/katex/fonts/KaTeX_Size4-Regular.woff2' 'assets/vendor/katex/fonts/KaTeX_Typewriter-Regular.ttf' 'assets/vendor/katex/fonts/KaTeX_Typewriter-Regular.woff' 'assets/vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2' 'assets/vendor/katex/katex.min.css' 'assets/vendor/katex/katex.min.js' 'assets/vendor/katex/LICENSE.txt' 'category.html'
git add -- 'data/content-store.js' 'data/markdown-renderer.js' 'data/math-renderer.js' 'data/miniapps.js' 'data/site-meta.js' 'derive.html' 'docs/article-formula-selection-create.md' 'docs/batch-regression-evidence.md' 'docs/carousel-slot-authority.md' 'docs/cms-feedback-publish-dock.md' 'docs/codex-workline/A00_ProjectDirector_handoff.md' 'docs/codex-workline/implementation_slices.json' 'docs/codex-workline/requirements/active/REQ-20260730-001.json' 'docs/codex-workline/requirements/active/REQ-20260730-002.json' 'docs/codex-workline/requirements/active/REQ-20260730-003.json'
git add -- 'docs/codex-workline/requirements/active/REQ-20260730-004.json' 'docs/codex-workline/requirements/active/REQ-20260730-005.json' 'docs/codex-workline/requirements/active/REQ-20260730-006.json' 'docs/codex-workline/requirements/active/REQ-20260730-007.json' 'docs/codex-workline/requirements/active/REQ-20260730-008.json' 'docs/codex-workline/requirements/active/REQ-20260730-009.json' 'docs/codex-workline/requirements/active/REQ-20260730-010.json' 'docs/codex-workline/requirements/active/REQ-20260730-011.json' 'docs/codex-workline/requirements/active/REQ-20260730-012.json' 'docs/codex-workline/requirements/dispatch/DISPATCH-20260730-001.json' 'docs/codex-workline/slices/S30_shared_math_rendering_handoff.md' 'docs/codex-workline/slices/S31_carousel_slot_authority_handoff.md' 'docs/codex-workline/slices/S32_focused_cover_reverification_handoff.md' 'docs/codex-workline/slices/S33_formula_binding_marker_handoff.md' 'docs/codex-workline/slices/S34_md2file_renderer_parity_handoff.md'
git add -- 'docs/codex-workline/slices/S35_article_formula_selection_create_handoff.md' 'docs/codex-workline/slices/S36_derivation_workflow_recovery_handoff.md' 'docs/codex-workline/slices/S37_formula_map_flow_layout_handoff.md' 'docs/codex-workline/slices/S38_cms_feedback_publish_dock_handoff.md' 'docs/codex-workline/slices/S39_md2file_public_entry_handoff.md' 'docs/codex-workline/slices/S40_batch_regression_evidence_handoff.md' 'docs/codex-workline/slices/S40A_api_verify_redirected_output_handoff.md' 'docs/codex-workline/slices/S41_release_git_gate_handoff.md' 'docs/codex-workline/slices/S41A_release_version_sync_handoff.md' 'docs/codex-workline/slices/S41B_release_git_gate_reverification_handoff.md' 'docs/codex-workline/slices/S42_git_publish_handoff.md' 'docs/codex-workline/task_registry.json' 'docs/formula-binding-marker.md' 'docs/formula-map-flow-layout.md' 'docs/git-staging-plan-20260730.md'
git add -- 'docs/inline-math-layout.md' 'docs/legacy-formula-relation-recovery.md' 'docs/md2file-public-entry.md' 'docs/md2file-renderer-parity.md' 'docs/prompts/next_agents.md' 'docs/release-git-gate-20260730.md' 'docs/shared-math-rendering.md' 'formula-graph.js' 'index.html' 'lib/content.js' 'lib/legacy-formula-relation-migration.js' 'lib/md2doc.js' 'lib/validators.js' 'main.js' 'maker.html'
git add -- 'migrations/026_hero_carousel_slots.js' 'migrations/027_formula_relation_repairs.js' 'miniapps.html' 'package-lock.json' 'package.json' 'post.html' 'post.js' 'PROJECT_MAINTENANCE.json' 'PROJECT_WINDOW.md' 'project.html' 'projects.html' 'README.md' 'scripts/migrate-legacy-formula-relations.js' 'scripts/run-batch-regression-evidence.js' 'scripts/test-api-verify-redirected-output.js'
git add -- 'scripts/test-article-formula-authoring.js' 'scripts/test-article-formula-selection-create.js' 'scripts/test-branching-derivation-graph.js' 'scripts/test-carousel-focus-buffer.js' 'scripts/test-cms-floating-feedback-publish-bar.js' 'scripts/test-focus-mode.js' 'scripts/test-formula-authoring-drawer.js' 'scripts/test-formula-binding-marker.js' 'scripts/test-formula-map-flow-layout.js' 'scripts/test-full-site-dark-theme.js' 'scripts/test-hero-carousel-authority.js' 'scripts/test-inline-math-layout.js' 'scripts/test-legacy-formula-migration.js' 'scripts/test-legacy-formula-relation-migration.js' 'scripts/test-markdown-renderer.js'
git add -- 'scripts/test-math-rendering.js' 'scripts/test-md2file-docx-semantics.js' 'scripts/test-md2file-public-entry.js' 'scripts/verify-api.ps1' 'server.js' 'site-layout.js' 'styles/26-inline-math.css' 'styles/md2doc.css' 'tools/gokotta-elec.html' 'tools/larkix-elec.html' 'tools/md2doc.html' 'tools/md2doc.js'
```

## 暂存后必须立即验证

```powershell
git diff --cached --name-only
git diff --cached --stat
git diff --cached --check
npm.cmd run check:version
npm.cmd run test:batch-regression
npm.cmd run codex:contract
```

staged 路径集合必须与 207 个 include 路径精确相等；exclude、review、数据库、uploads、环境文件和运行时数据必须为 0。
