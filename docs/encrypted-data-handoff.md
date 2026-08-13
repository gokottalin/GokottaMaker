# 加密数据交接

这套流程用于在 Git 之外交接 LarkixMaker 的 SQLite 数据库和 uploads。Git 只保存脚本与说明，不保存备份正文、口令、恢复数据或测试样本。

## 安全模型

- 容器使用 `PBKDF2-HMAC-SHA256`（310000 次）派生独立的加密密钥和认证密钥。
- 正文使用 `AES-256-CBC` 加密，并以 `HMAC-SHA256` 对“容器头 + 密文”执行先验认证。恢复脚本必须先通过 HMAC，才会解密。
- 加密正文内含逐文件 SHA-256、字节数、文件总数和目录清单；恢复后再次核对完整文件集合。
- 输出和恢复目标必须位于仓库外。脚本拒绝软链接/重解析点、路径穿越、重复路径和未在清单中声明的文件。
- 恢复默认拒绝覆盖非空目录。校验在临时目录完成，目标卷内复核后才原子改名为目标目录。

此方案保护离线交接文件的机密性和完整性，但不能替代端点安全。取得“容器 + 口令”的人仍可读取数据。

## 导出前

1. 由数据负责人确定唯一的源路径和交接范围，不让脚本猜测当前目录。
2. 停止写入该 SQLite 数据库的应用，或先生成经过 SQLite 官方 backup API 的一致性快照。仅复制正在写入的数据库文件不能保证事务一致性。
3. 对数据库运行 `PRAGMA integrity_check`，确认结果为 `ok`；核对 uploads 是否完整。
4. 在仓库外创建交接目录。可使用 `$env:TEMP` 下的专用目录，或由管理员指定其他受控目录；不要使用项目目录、公共同步目录或 Git 工作树。
5. 用密码管理器生成至少 20 个随机字符的单次口令。脚本最低接受 16 个字符。

## 导出

完整 `DATA_DIR` 模式：

```powershell
$repoRoot = Read-Host "请输入本机仓库根目录"
$dataDir = Read-Host "请输入仓库外 DATA_DIR"
$handoffRoot = Join-Path $env:TEMP "LarkixHandoff"
$outputPath = Join-Path $handoffRoot "larkix-data-20260814.larkixhandoff"

Set-Location -LiteralPath $repoRoot
[System.IO.Directory]::CreateDirectory($handoffRoot) | Out-Null
$key = Read-Host "一次性交接口令" -AsSecureString
& .\scripts\export-encrypted-handoff.ps1 `
  -DataDir $dataDir `
  -OutputPath $outputPath `
  -Passphrase $key
Remove-Variable key
```

数据库与 uploads 分离模式：

```powershell
$repoRoot = Read-Host "请输入本机仓库根目录"
$databasePath = Read-Host "请输入仓库外 SQLite 数据库文件"
$uploadsPath = Read-Host "请输入仓库外 uploads 目录"
$handoffRoot = Join-Path $env:TEMP "LarkixHandoff"
$outputPath = Join-Path $handoffRoot "larkix-data-20260814.larkixhandoff"

Set-Location -LiteralPath $repoRoot
[System.IO.Directory]::CreateDirectory($handoffRoot) | Out-Null
$key = Read-Host "一次性交接口令" -AsSecureString
& .\scripts\export-encrypted-handoff.ps1 `
  -DatabasePath $databasePath `
  -UploadsPath $uploadsPath `
  -OutputPath $outputPath `
  -Passphrase $key
Remove-Variable key
```

不传 `-Passphrase` 时脚本会安全提示并要求再次确认。不要使用明文 `ConvertTo-SecureString '口令' -AsPlainText -Force` 作为日常命令，因为它会进入终端历史。默认拒绝覆盖已有容器；只有在确认旧文件已另行保留时才使用 `-Force`。

脚本返回容器路径、文件数、明文字节数、容器字节数和清单哈希，不打印口令、密钥、源文件名清单或数据正文。将这些非敏感计数记录在交接回执中。

## 密钥与文件交付

- 容器和口令必须使用两个独立通道。例如容器走受控对象存储，口令走端到端加密的密码管理器共享。
- 不把口令写入聊天记录、邮件正文、工单、文件名、脚本、`.env`、Git 或与容器同目录的文本文件。
- 接收人确认恢复成功后，发送方撤销共享并轮换口令。每个新容器都使用新随机口令，禁止跨批次复用。
- 数据负责人批准导出范围；发送方负责一致性快照和容器；接收方负责目标环境、恢复校验和删除临时副本；项目负责人确认最终回执。

## 恢复

先在仓库外准备目标父目录。目标目录可以不存在或为空，但不能包含任何文件：

```powershell
$repoRoot = Read-Host "请输入本机仓库根目录"
$handoffRoot = Join-Path $env:TEMP "LarkixHandoff"
$inputPath = Join-Path $handoffRoot "larkix-data-20260814.larkixhandoff"
$restoreRoot = Join-Path $env:TEMP "LarkixRestored"
$destinationPath = Join-Path $restoreRoot "data"

Set-Location -LiteralPath $repoRoot
[System.IO.Directory]::CreateDirectory($restoreRoot) | Out-Null
$key = Read-Host "一次性交接口令" -AsSecureString
& .\scripts\restore-encrypted-handoff.ps1 `
  -InputPath $inputPath `
  -DestinationPath $destinationPath `
  -Passphrase $key
Remove-Variable key
```

恢复顺序：

1. 保持目标应用停止，不把恢复目录直接覆盖到正在运行的实例。
2. 脚本验证容器 HMAC、解密归档、阻断危险路径，并核对逐文件哈希、总数和字节数。
3. `dataDir` 模式会恢复原 DATA_DIR 内部结构；`databaseAndUploads` 模式会生成 `database/<数据库文件名>` 与 `uploads/`。
4. 对恢复后的 SQLite 再运行 `PRAGMA integrity_check`，结果必须为 `ok`；核对脚本返回的文件数和字节数是否与导出回执一致。
5. 在隔离端口和恢复后的 `DATA_DIR` 上启动应用，验证 `/healthz`、CMS 登录、文章、公式和上传资源。
6. 验证通过后再切换正式配置，并保留旧数据的只读回滚副本。失败时不要合并目录，保留原目标并重新获取容器或口令。
7. 接收人签收后删除解密后的临时测试恢复目录；容器按双方保留策略转入受控归档或销毁。

错误口令、容器篡改、清单不一致、路径穿越或非空目标都会在提交目标目录前失败。脚本不会自动启动服务、修改 `.env`、迁移数据库或删除旧生产数据。

## 兼容性与边界

- 脚本按 Windows PowerShell 5.1 和当前 .NET Framework 可用的密码学接口设计；PowerShell 7 也可使用。
- 文件内容、相对路径和最后修改时间会保留；Windows ACL、Linux UID/GID、扩展属性、硬链接和软链接不会交接。
- 大型数据会产生临时 ZIP 和密文，因此导出端应预留约两倍源数据空间；恢复端也应预留相同量级空间。
- 临时明文位于操作系统临时目录，脚本会在成功或失败时清理。对高敏感数据仍应使用全盘加密的受控机器，并按组织策略清理磁盘残留。
