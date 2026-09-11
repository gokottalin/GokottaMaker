# Agent 68 Formula Detail Page（公式独立页：统一详情与推导入口）

## Mission

在 A00 接受 S56、S57、S58 后执行 `S59_formula_detail_page`。为每张可公开公式建立稳定独立详情页，并统一文章角标、图谱节点、上下游列表和旧链接入口。

## May Edit

- `server.js`
- `lib/content.js`
- `lib/seo.js`
- `formula.html`
- `formula.js`
- `formula-graph.js`
- `post.js`
- `derive.html`
- `derive.js`
- `styles/20-content.css`
- `styles/40-formula.css`
- `scripts/test-formula-detail-page.js`
- `docs/codex-workline/slices/S59_formula_detail_page_handoff.md`

## Contract

- 规范公开 URL 采用稳定 slug；旧 `derive.html?formula=...` 受控兼容并指向唯一 canonical。
- 页面显示名称、完整公式、用途、两级分类、标签、Markdown 推导、上下游关系和唯一地图契约。
- 游客仅能看到已发布公式的已发布修订；草稿、归档、非法和不存在 slug 返回不泄露内部状态的 404。
- 文章节点仍进入文章页，公式节点和紫色角标进入公式独立页。
- 复用共享 Markdown、数学渲染和 S57 高度规则，不复制第二份图谱关系源。
- 实现 S56 记录的截断继续加载缺口：`truncated=true` 时返回并校验不透明 continuation cursor，不接受客户端伪造遍历状态。
- 禁止生产部署、当前数据和 Git 写入。
