# S40A API 重定向输出验证修复交接

## status

`ready_for_a00_acceptance`

## scope_completed

- 已修复 Windows PowerShell 在 Node.js 重定向捕获原生 `curl.exe` 输出时的 UTF-8 解码不一致问题。
- `Invoke-CurlJson` 现将响应体写入临时文件，并以严格 UTF-8 显式读取；标准输出只承载 HTTP 状态码。
- 已新增真实重定向场景测试，通过 Node.js `spawnSync` 启动完整 API 验证脚本。
- 已验证测试数据目录与请求、响应临时文件均能在成功或异常路径中清理。

## files_created_or_changed

- `scripts/verify-api.ps1`
- `scripts/test-api-verify-redirected-output.js`
- `docs/codex-workline/slices/S40A_api_verify_redirected_output_handoff.md`

## decisions

- 保留 `verify-api.ps1` 原有 58 个 API 断言及业务覆盖范围，仅调整 `Invoke-CurlJson` 的传输与解码实现。
- 请求体使用无 BOM UTF-8 写入临时文件；响应体使用启用无效字节异常的 UTF-8 解码器读取。
- 不依赖 PowerShell 对原生进程标准输出的隐式编码判断，避免交互终端与重定向运行出现不同结果。
- 新测试使用随机隔离数据目录、随机管理密码和动态空闲端口，不读取当前项目数据。

## risks

- 测试依赖系统可用的 `curl.exe` 与 Windows PowerShell；非 Windows 环境使用 `pwsh` 时仍需具备同等命令依赖。
- 本切片只修复验证工具链，不改变服务 API、数据库或公开页面行为。

## tests_or_checks

- `node --check scripts/test-api-verify-redirected-output.js`
- `node scripts/test-api-verify-redirected-output.js`
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-api.ps1 -Port 1979 -AdminUsername Larkix -AdminPassword temporary-direct-verification-only`
- `verify-api.ps1` 保留 `58` 个 `API verify failed:` 断言。
- `.verify-api-data` 验证后不存在。
- `git diff --check -- scripts/verify-api.ps1 scripts/test-api-verify-redirected-output.js docs/codex-workline/slices/S40A_api_verify_redirected_output_handoff.md`
- `npm.cmd run codex:contract`：`939 passed / 0 warnings / 0 failures`。

## next_handoff

返回 `A00_ProjectDirector` 独立验收；通过后恢复 `A46_BatchRegressionEvidence / S40_batch_regression_evidence`。
