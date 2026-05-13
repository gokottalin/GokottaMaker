# Agent9 Markdown 解析器回归测试记录

更新时间：2026-05-13

## 本轮任务

依据 `docs/Agent0+总控与集成/2026-05-13_第2次测试问题处理与Agent分工.md` 中 Agent9 分工，本轮聚焦 Markdown 解析器契约：

- 覆盖公式、上下标、根号、希腊字母、代码块、标题层级解析测试。
- 确认长文标题 AST 输出稳定，避免 TOC 缺级或 id 冲突。
- 如修改解析器，说明兼容影响。

## 变更内容

新增测试脚本：

- `scripts/test-markdown-renderer.js`
- `package.json` 增加 `test:markdown`

解析器小修：

- `data/markdown-renderer.js` 支持 `~~~lang` 代码围栏，与现有 ```lang 围栏兼容。
- 修正 `mathToText()` 中向量、hat、bar、dot、ddot 的文本降级输出，避免组合重音被异常转成 `?`。

## 覆盖范围

`scripts/test-markdown-renderer.js` 当前覆盖：

- Ampere-Maxwell 形式公式中的 `\nabla`、`\times`、`\mu_0`、`\partial`。
- `\sqrt{}`、`\frac{}{}`、`\oint`、`\int`、希腊字母、上下标。
- `\vec{}`、`\hat{}`、`\bar{}`、`\dot{}`、`\ddot{}` 的文本降级输出。
- 行内公式 `$...$` 与块级公式 `$$...$$`、`\[...\]`。
- 反引号与波浪线代码围栏，且代码块内 `$...$` 不被误解析为公式。
- H2/H3/H4 heading AST 层级保留、H1 跳过、重复标题 id 自动去重。
- 120 个长文标题的 AST 数量、层级集合与 id 唯一性。

## 验证命令

已通过：

```text
node --check data\markdown-renderer.js
node --check scripts\test-markdown-renderer.js
node --check tools\md2doc.js
node --check post.js
node --check lib\md2doc.js
node --check server.js
npm.cmd run test:markdown
node scripts\test-markdown-renderer.js
```

说明：PowerShell 当前执行策略会拦截 `npm.ps1`，因此使用 `npm.cmd run test:markdown` 验证 npm 脚本。

## 兼容性说明

- 既有 Markdown 输出结构保持不变：`render()` 仍返回 `{ html, headings }`。
- 新增 `~~~` 代码围栏只扩展兼容面，不改变原有 ``` 围栏行为。
- Heading AST 仍以 H2/H3/H4 为 TOC 数据源，重复标题继续按 `id`, `id-2`, `id-3` 递增。
- 公式文本降级更稳定，主要影响 Word 导出和纯文本读取，不改变公式 HTML class 名称。
