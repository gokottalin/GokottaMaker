# GokottaElec Design System

Agent6 视觉基准：以已选软件图标候选 5 为主视觉，保持成熟蓝色层次、清晰电路线条和简洁平面设计。

## Brand Mark

- 桌面图标：`launcher/GokottaElec.ico`
- 桌面页头预览图：`launcher/GokottaElec.png`
- 网页小程序图标：`web-miniapp/assets/gokotta-elec-icon.png`

图标特征：

- 圆角方形蓝色底。
- 深蓝到亮蓝的层次。
- 白色粗电路走线与圆形节点。
- 局部青蓝走线作为辅助层，不使用红、绿、橙、紫作为主色。

## Color Tokens

```text
Shell blue:      #EDF7FD
Panel soft:      #F6FBFF
Surface:         #FFFFFF
Border blue:     #B7D8EE
Brand navy:      #0D4885
Brand blue:      #137CD6
Circuit cyan:    #4DBEF1
Text blue:       #123657
Muted blue:      #526F85
```

## Interface Rules

- 主背景使用浅蓝工作区，不使用深色大面积背景。
- 工具面板使用白色或极浅蓝表面，边框统一为浅蓝。
- 主要操作按钮使用 `#137CD6`，普通按钮使用白底蓝灰边框。
- 空状态、预览状态、日志区域都应保留电路网格或节点感，但不得影响内容阅读。
- SVG 预览区域优先保证电路图本身清晰，装饰只放在容器背景层。

## State Treatment

- 初始空状态：显示图标风格的电路标记与短提示。
- 正在生成：主按钮禁用，日志区显示当前 API 或本地构建动作。
- 成功预览：白色预览画布，浅蓝边框。
- 解析失败 / ERC 错误：文本状态提示即可，避免破坏蓝色主视觉。
- 后端未接入：保持蓝色空状态，不使用强烈警示色占据主界面。
