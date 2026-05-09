# Agent4 Agent7 品牌主题落地与 Hero 玻璃卡片调整

时间：2026-05-09 18:25
版本：V2.3.0+20260509-1825
依据：`docs/Agent7+视觉品牌与样式设计/2026-05-09_GokottaMaker_LOGO与昼夜主题视觉规范.md`

## 目标

根据 Agent7 输出，将网站视觉收敛到：

- 白天主题：创客产品展示，明亮、开放、项目展示感。
- 夜晚主题：深色工程控制台，专业、工程、工具台感。
- LOGO：使用 `assets/logo/options/gokottamaker-logo-option-15.svg`。
- Hero 玻璃卡片：随主题变化，保留高级模糊感，移除复杂线条和曲线。

## 本轮调整

- `styles/00-base.css`
  - 新增 Agent7 品牌 token：`--brand-blue`、`--brand-cyan`、`--brand-amber` 等。
  - 默认白天主题使用 `#F4F7FB`、`#FFFFFF`、`#0B1220`、`#52657A`。
  - 深色主题支持 `[data-theme="dark"]` 与系统 `prefers-color-scheme: dark`。
  - 导航 LOGO 改为 15 号 SVG 的横向品牌标。

- `styles/10-hero.css`
  - Hero 卡片改为简洁磨砂玻璃：`backdrop-filter: blur(24px) saturate(150%)`。
  - 白天主题使用琥珀色强调，夜晚主题使用青色强调。
  - 移除复杂曲线视觉：隐藏旧 `flow-map`、`glass-caustic`，并用简洁线性高光替代。

- `main.js`
  - 不再为 Hero 卡片注入 SVG 曲线路径。

- `server.js`
  - 增加 `.svg` MIME：`image/svg+xml; charset=utf-8`。
  - 将 `.svg` 纳入图片缓存类型，解决 `nosniff` 下 LOGO 破图问题。

- HTML 与版本
  - 访客端、管理端、工具页 LOGO 路径替换为 15 号 SVG。
  - 资源版本同步到 `20260509-1825`。

## 验收结果

| 场景 | LOGO | Hero 卡片 | 曲线残留 | 横向溢出 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 1366x768 light | 正常 | `blur(24px)`，琥珀强调 | 0 | 无 | 通过 |
| 1366x768 dark | 正常 | `blur(24px)`，青色强调 | 0 | 无 | 通过 |
| 390x844 light | 正常 | 移动端稳定 | 0 | 无 | 通过 |
| 390x844 dark | 正常 | 移动端稳定 | 0 | 无 | 通过 |

## 验证命令

```text
node --check main.js
node --check post.js
node --check admin/admin.js
node --experimental-sqlite --check server.js
node scripts/check-version.js
git diff --check
```

Browser/IAB：

- `http://127.0.0.1:4177/`
- 页面标题正常。
- 首屏非空。
- 控制台无 error/warn。
- LOGO 正常渲染。

Playwright 矩阵：

- `desktop-light`
- `desktop-dark`
- `mobile-light`
- `mobile-dark`

关键指标：

```text
logoComplete: true
flowMapCount: 0
glassCausticCount: 0
cardCount: 4
activeCardCount: 1
horizontalOverflow: false
cardBackdrop: blur(24px) saturate(1.5)
```

## 产物

- `docs/Agent4+访客端体验、视觉与前端架构/brand-theme-20260509/desktop-light.png`
- `docs/Agent4+访客端体验、视觉与前端架构/brand-theme-20260509/desktop-dark.png`
- `docs/Agent4+访客端体验、视觉与前端架构/brand-theme-20260509/mobile-light.png`
- `docs/Agent4+访客端体验、视觉与前端架构/brand-theme-20260509/mobile-dark.png`
- `docs/Agent4+访客端体验、视觉与前端架构/brand-theme-20260509/brand-theme-results.json`

## 备注

- 本轮没有使用 Image Gen 生成新概念图，因为 Agent7 文档已经是明确视觉规范，且用户要求直接按该输出落地。
- 当前工作区同时存在 Agent6 小程序相关改动，本轮未回退、未改写其业务逻辑。
