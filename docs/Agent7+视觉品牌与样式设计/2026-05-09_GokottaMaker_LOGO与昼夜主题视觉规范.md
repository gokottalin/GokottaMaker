# LarkixMaker LOGO 与昼夜主题视觉规范

负责人：Agent7
日期：2026-05-09

## 已确定 LOGO

正式方向：`assets/logo/options/gokottamaker-logo-option-15.svg`

视觉关键词：

- 模块化六边形核心
- 纯色蓝色分面
- 开源硬件分支节点
- 现代、开创、开源

## 已确定项目风格

白天主题：05 创客产品展示

- 页面气质：明亮、开放、项目展示感强
- 适用场景：首页、项目列表、文章阅读、项目成果展示
- 主色建议：`#0F4EA8`
- 强调色建议：`#F2A316`
- 页面底色建议：`#F4F7FB`
- 正文色建议：`#0B1220`
- 次级文字建议：`#52657A`
- 卡片/面板建议：`#FFFFFF` 或 `#E6F1FB`

夜晚主题：02 深色工程控制台

- 页面气质：专业、工程、工具台、开发者控制台
- 适用场景：深色模式、小程序工具页、复杂参数/电路工具、夜间浏览
- 主背景建议：`#0B1220`
- 面板背景建议：`#111C32`
- 主高亮建议：`#38BDF8`
- 辅助蓝建议：`#0D6FD3`
- 正文色建议：`#FFFFFF`
- 弱化文字建议：`#A8B6C8`

## 推荐 CSS Token

```css
:root {
  --brand-logo: url("../assets/logo/options/gokottamaker-logo-option-15.svg");
  --brand-ink: #0b1220;
  --brand-blue: #0f4ea8;
  --brand-blue-2: #0d6fd3;
  --brand-cyan: #38bdf8;
  --brand-amber: #f2a316;

  --theme-bg: #f4f7fb;
  --theme-surface: #ffffff;
  --theme-surface-2: #e6f1fb;
  --theme-text: #0b1220;
  --theme-muted: #52657a;
  --theme-accent: #f2a316;
}

[data-theme="dark"] {
  --theme-bg: #0b1220;
  --theme-surface: #111c32;
  --theme-surface-2: #17243a;
  --theme-text: #ffffff;
  --theme-muted: #a8b6c8;
  --theme-accent: #38bdf8;
}
```

## 落地建议

- 默认使用白天主题 05，深色模式使用夜晚主题 02。
- 导航栏 LOGO 直接替换为 15 号 SVG，建议保留当前 `LarkixMaker` 文字标。
- 白天模式可用琥珀色作为 CTA、精选项目、重点标签的少量强调色，不建议大面积使用。
- 夜晚模式控制面板、工具区、代码块优先用深色面板，不使用渐变背景。
- 图标系统应保持纯色或双色，不再使用渐变。
