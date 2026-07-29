# 文章建议阅读时间

## 数据契约

- 文章 DTO 使用 `readingMinutes: positive integer | null`，取值范围为 `1-9999`。
- 迁移 `025_post_reading_minutes` 只新增 `posts.reading_minutes`，不回填迁移前文章。
- 空值保存为 `null`；零、负数、小数、布尔值、数组、对象、带单位文本和越界值均拒绝。
- revision snapshot、恢复、管理端导出和公开 DTO 保留同一个 nullable integer。

## 兼容边界

`data/posts.js` 的 intentional seed 值已改为 `readingMinutes` 数字。为兼容未开放编辑的 `server.js` seed 读取路径，seed 对象提供不可枚举的 `readTime` 数字 getter；迁移后的 insert trigger 仅转换新插入的严格数字或历史 `"N 分钟阅读"`，随即清空 legacy `read_time`。该 trigger 不扫描或回填迁移前数据。

## CMS 与访客端

CMS 仅在文章类型显示选填输入和分钟单位，本地草稿、编辑回填、清空与保存均保留原值。文章详情、首页 Hero、首页文章卡片、课程卡片和分类页仅在值有效时生成阅读时间节点；无值时不生成 placeholder、separator 或空 span。项目与推导节点的既有元数据保持不变。

## 验证

主验证命令：

```powershell
npm.cmd run test:post-reading-minutes
```

测试使用系统临时目录作为隔离 `DATA_DIR`，覆盖 migration additivity、旧文章 null、fresh seed compatibility、validator bounds、SQLite trigger、set/update/clear、revision/restore、admin/public/export DTO 和真实 HTTP API。
