# 文章封面坐标

## 数据合同

文章 DTO 的 `coverCrop` 为 `null` 或完整对象：

```json
{
  "x": 0,
  "y": 0.1,
  "width": 1,
  "height": 0.5625,
  "sourceWidth": 900,
  "sourceHeight": 900
}
```

`x/y/width/height` 是相对原图的归一化坐标。六个字段必须同时为空或同时有效；
坐标必须为有限值，矩形必须位于 `[0, 1]` 内，原图尺寸必须为 `1-100000` 的整数。

源像素区域满足：

```text
(width * sourceWidth) / (height * sourceHeight) = 16 / 9
```

为兼容浮点序列化和像素取整，允许的宽度误差为
`max(1 px, expectedWidth * 0.001)`。Migration 024 的 INSERT/UPDATE 触发器和
`validateCoverCrop` 使用相同边界。

## 持久化

Migration 024 只向 `posts` 增加六个 nullable 字段，不修改旧文章。`lib/content.js`
在文章列表、详情、保存、修订快照和版本恢复中统一组装或拆解 `coverCrop`。重置只把
六个字段写回 `NULL`，不改变 `cover` URL。

CMS 的本地草稿通过 `currentSnapshot`、`applySnapshotToForm`、
`applyItemToForm` 和 `buildPayload` 往返同一对象。选择新文件时，应用操作上传原始
`File` 的 data URL；不使用 canvas、不生成裁切 JPEG，也不覆盖或删除原图。重新打开
已有封面只调整坐标，不再次上传。

## CMS 几何

编辑器完整显示原图。底层图像使用灰度和高斯模糊，取景框内用同一原图的清晰彩色副本
回放。默认框取原图内可容纳的最大 16:9 区域。

- 拖动框体：在归一化边界内平移。
- 拖动四角：以对角为锚点缩放，源像素比例保持 16:9。
- Pointer Events 同时覆盖鼠标、触控笔和 touch。
- 框体方向键按源像素移动，`Shift` 为 10 像素步长。
- 四角方向键缩放；`Escape` 取消；弹窗关闭后恢复原焦点。

## 公共回放

`data/media.js` 是唯一回放实现。它保留已有 `<picture>`/WebP `srcset`，并根据容器尺寸
计算原图的等比缩放和偏移：

```text
scale = max(viewportWidth / cropPixelWidth, viewportHeight / cropPixelHeight)
```

16:9 容器精确显示保存区域；非 16:9 聚焦卡保持原容器尺寸，并在保存区域内部继续
`cover`，不会拉伸原图，也不会强制卡片改成 16:9。首页文章卡、课程/聚焦入口、首页
hero、分类页和文章 hero 均传入同一 `coverCrop`。无坐标文章继续使用原有图片输出。

## 验证

主命令：

```powershell
npm.cmd run test:post-cover-coordinates
```

专用测试覆盖 migration 列与触发器、旧文章 null、all-or-none、有限值、边界、源像素
16:9、保存往返、修订恢复、重置、禁止 canvas 导出、CMS 状态链、四角/pointer/touch/
keyboard/Escape 静态合同，以及横图、竖图、方图、超宽图在 1280x720、640x360、
360x240 容器中的共享回放几何。

最终浏览器手动验收仍应逐项操作四种图片的框体拖动、四角缩放、touch、键盘、重开、
取消和重置，并在桌面、半宽和移动端检查清晰/彩色内区、灰度/模糊外区、像素比例、
溢出、控制台和网络。
