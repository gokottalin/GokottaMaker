# 聚焦内容卡片媒体契约

## 目标

首页 `#homeRecommended` 内的文章封面由当前卡片媒体宿主决定视口尺寸。图片保持原始宽高比并覆盖宿主，
不继承 Hero 比例，也不把卡片固定为 16:9。S22 已保存坐标继续作为构图焦点，容器变化时自动重放。

## 选择器

- 通用宿主：`#homeRecommended .focused-card-media[data-focused-card-media]`
- 主推荐：`.focused-card-media--feature`
- 推荐列表：`.focused-card-media--row`
- 无主推荐布局的文章卡：`.focused-card-media--article`
- 图片：`.focused-card-media__image`

`main.js` 在每次推荐内容重渲染后调用 `LarkixMedia.hydrateFocusedMedia`。该函数监听媒体宿主尺寸，
并让 S22 的 `cropLayout` 以宿主当前 `clientWidth/clientHeight` 重新计算原图位置。

## 尺寸与裁切

- 主推荐媒体使用绝对定位填满 `.lesson-feature`，视口随卡片高度变化。
- 推荐列表在桌面和半宽布局使用卡片既有的 `96px` 媒体行；移动端使用既有的 `210px` 媒体行。
- 普通图片使用 `object-fit: cover` 和居中策略。
- 有 S22 坐标的图片按原图宽高等比缩放，在已保存区域内部继续 cover；内联尺寸不改变原图比例。
- 宿主统一 `overflow: hidden`，因此极端源比例不会形成空白带或横向页面溢出。
- 图片解码失败时宿主进入 `data-focused-media-state="failed"`，图片透明但宿主尺寸和背景不塌陷。

`styles/27-focused-content-media.css` 只包含 `#homeRecommended` 范围内的规则，不含 Hero 选择器、
`aspect-ratio` 或 16:9 尺寸表达式。该文件在 `styles/40-responsive.css` 后导入，以覆盖旧的全局图片高度，
但不修改 `styles/20-content.css`。

## 确定性验证

`node scripts/test-focused-content-media.js` 覆盖：

- feature、row、article 三类 opt-in；
- 新样式导入顺序、容器所有权、`object-fit: cover`、失败状态和 Hero 选择器隔离；
- 横图、竖图、方图、超宽图；
- 桌面主卡/列表、半宽主卡/列表、移动主卡/列表共 6 组视口；
- S22 坐标在每组视口内覆盖四边，同时保持原图宽高比；
- 禁止固定 16:9、Hero 选择器和 Hero opt-in。

## 隔离浏览器证据

使用专项脚本的本地静态夹具测试 `1280x900`、`800x900`、`360x800`：

| 视口 | 主推荐媒体 | 列表媒体 | S22 竖图实际图像 | Hero |
| --- | --- | --- | --- | --- |
| 1280 | `569.73 x 748.41` | `278.13 x 96` | `278 x 494.21` | `1224.80 x 660` |
| 800 | `743.20 x 278.40` | `334.80 x 96` | `335 x 595.55` | `744.80 x 660` |
| 360 | `325.20 x 278.40` | `297.20 x 210` | `373.33 x 663.70` | `326.80 x 450` |

三档均得到：

- 普通图片 `object-fit: cover`，crop 图片按 `540:960` 保持自然比例并覆盖宿主四边；
- 方图、竖图、横图、超宽图均无空白带；
- 失败图片状态为 `failed`，宿主分别保持 `96px` 或 `210px` 高；
- `pageOverflow=false`；
- Hero `focusedOptIn=false`、`object-fit=cover`，尺寸仍由 Hero 自身响应式规则决定；
- 页面 console `warn/error=[]`。

浏览器会话已停止，截图未作为仓库持久化基线。A00 应按 S25 handoff 独立复测上述矩阵。

## 回归边界

通过封面坐标、阅读分钟、Markdown、公式发布、分支推导图、JavaScript 语法和 Codex 合同检查。
未修改文章数据、保存坐标、Hero 行为、`styles/20-content.css`、current/production 数据或任何云端状态。
