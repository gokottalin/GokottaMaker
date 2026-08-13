# S53 加密数据交接

## status

`completed`

## scope_completed

- 提供 Git 外的加密导出与恢复脚本，支持完整 `DATA_DIR` 或显式数据库文件加 uploads 两种输入。
- 使用 PBKDF2-HMAC-SHA256、AES-256-CBC 与 HMAC-SHA256 Encrypt-then-MAC；恢复必须先认证后解密。
- 加密正文包含逐文件 SHA-256、字节数、文件数与目录清单；恢复执行路径安全和完整集合复核。
- 输出与恢复目标强制位于仓库外；恢复拒绝非空目标，并采用临时校验、目标卷复核和最终原子改名。
- 文档明确一致性快照、口令交付、轮换、恢复顺序、失败行为与责任边界。

## files_created_or_changed

- `scripts/export-encrypted-handoff.ps1`
- `scripts/restore-encrypted-handoff.ps1`
- `docs/encrypted-data-handoff.md`
- `docs/codex-workline/slices/S53_encrypted_data_handoff.md`

## decisions

- 为兼容 Windows PowerShell 5.1，不依赖 `AesGcm` 或外部 OpenSSL；采用具有独立密钥的 AES-CBC + HMAC Encrypt-then-MAC。
- 口令仅接受 `SecureString` 或安全交互提示，不提供普通字符串参数，也不写入口令文件。
- 不尝试在线复制活动 SQLite；管理员必须先停止写入或生成一致性快照并执行 SQLite 完整性检查。

## risks

- 临时 ZIP 和解密正文会短暂落在操作系统临时目录；高敏感数据必须在全盘加密的受控终端处理。
- ACL、UID/GID、扩展属性与链接不在交接范围内。
- 本任务不会实际读取、导出、恢复或迁移当前/生产数据。

## tests_or_checks

- PowerShell 5.1 AST 解析：两个脚本均为 `PARSE_OK`。
- 仓库外隔离样本（仅新建测试 SQLite 与 uploads）：导出 `3` 个文件、`12318` 字节，容器 `5700` 字节。
- 错误口令：认证失败，未创建恢复目标。
- 密文篡改：认证失败，未创建恢复目标。
- 正确恢复：`3/3` 文件 SHA-256 全部一致，恢复字节数 `12318/12318`，空 uploads 目录保留，恢复后 SQLite `PRAGMA integrity_check=ok`。
- 非空目标：拒绝覆盖并保留原文件。
- 完整 `DATA_DIR` 模式：`2/2` 文件恢复成功且哈希一致。
- 仓库内输出、仓库内恢复和源目录内嵌套输出：均按预期拒绝。
- 所有测试样本、容器、明文临时目录和恢复目录均位于操作系统 TEMP 下并已删除；`testRootRemoved=True`。
- 最终清理复核：A62 临时目录/文件 `tempCount=0`，导出/恢复残留进程 `residualProcessCount=0`。
- `npm.cmd run codex:contract`：`1159 passed / 0 warnings / 0 failures`。
- Git 边界：`HEAD=50386e9`，index 变更路径 `0`；未执行 stage、commit、push。本任务只新增本交接所列四个允许文件，未还原或改写其他工作者内容。
- current-data 边界：验证只创建并读取操作系统 TEMP 下的新隔离样本；未读取或修改现有 `.env`、`database/`、`runtime-data/`、`uploads/`，对应受保护路径未出现 A62 写入。

## next_handoff

直接返回 `A00_ProjectDirector` 验收；A00 应与并行 S52 一并验收后再开放 S54。
