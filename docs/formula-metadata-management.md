# 公式元数据管理

## 分类契约

- 模块与分类为单选，标签为多选；选项始终由服务端 `formula_classifications` 返回。
- 分类只允许“大类”或“大类/小类”两级。`L1`、`L2`、`L3` 等相对推导深度由公式地图动态计算，不写入分类或标签。
- 新标签使用 `namespace:value`；选择既有标签会复用同一规范身份。

## 安全操作

`POST /api/admin/formula-metadata/operate` 统一处理 `preview`、`rename`、`merge`、`migrate`、`archive`、`restore` 和 `delete`。批量上限为 200 张卡；写操作在单一 SQLite 事务中执行并由 API 写入审计记录。

任何删除必须先运行 `preview`。响应包含草稿、已发布、已归档卡片数量，以及文章引用、公式依赖和当前/历史绑定。存在任一引用时，公式卡永久删除被阻止，安全路径是先迁移允许迁移的当前引用或归档卡片。

永久删除只接受零引用对象，并要求同时提交 `backupConfirmed: true` 与 `confirmText: "PERMANENTLY DELETE"`。生产数据迁移、备份和删除仍由独立生产门禁控制；本接口的验证只能使用隔离 `DATA_DIR`。

## 修订说明

修订说明不再预填或回退为 `manual-save`。作者文本按新修订保存，重新打开编辑器时回显当前修订说明，历史列表逐条显示各修订对应文本。
