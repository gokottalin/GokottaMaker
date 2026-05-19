# Agent101-Git 更新记录：Markdown 公式渲染与 DOCX 导出增强发布

## 基本信息

- 更新时间：2026-05-17 19:04
- 项目：LarkixMaker
- 版本：V2.4.9+20260517-003
- 分支：main
- 发布方式：推送到 GitHub origin/main，供线上环境按既有 Render/VPS 流程拉取发布

## 主要更新内容

- 增强 Markdown 渲染器的公式识别与渲染能力：
  - 支持无花括号上下标，如 `x_i^2`。
  - 支持常见工程变量自动下标显示，如 `VIN`、`VREF`、`R1`。
  - 支持顶层斜杠公式分数显示，如 `VIN / VREF`。
  - 支持将公式型行内代码和 `text` 代码块识别为数学公式。
  - 保留 ASCII 电路图等非公式代码块的原始 `<pre>` 展示。

- 增强 MD2File DOCX 导出能力：
  - 将行内公式、显示公式导出为 Word OMML 数学结构。
  - 支持 DOCX 中的上下标、分式、根式、希腊字母和常用数学符号。
  - 表格、列表、段落中的行内公式保留为数学对象。
  - Markdown 分割线导出为 Word 段落边框。

- 补充 Markdown/DOCX 回归测试：
  - 覆盖行内公式上下标渲染。
  - 覆盖公式型行内代码与文本代码块识别。
  - 覆盖 DOCX 数学结构与分割线边框输出。

## 发布前验证

- `npm run test:markdown`：通过
- `npm run check:version`：通过，版本为 `V2.4.9+20260517-003`

## 影响范围

- 访客端文章 Markdown 公式展示。
- MD2File 小程序/工具导出的 DOCX 文档公式表现。
- 不涉及数据库结构变更。
- 不涉及运行时环境变量变更。

## 回滚建议

如线上公式渲染或 DOCX 导出出现异常，可回滚本次 Git 提交，或按既有发布文档执行 `scripts/rollback.sh <commit>`。
