# S67 Discovery Experience Regression Evidence

## Verdict candidate

`accepted`

A00 独立复跑结果：`12 passed, 0 failed, protected-boundary passed`，耗时约 `209.6 s`；S60 digest 精确一致，runner 自有 DATA_DIR cleanup complete。

本证据由 A77 在 `E:\Project\2607-LarkixWeb` 直接执行生成。S67 仅新增可重复 runner 与证据，不修改产品、既有测试或治理文件。

## Batch result

- 命令：`node scripts/run-discovery-experience-regression.js`
- 结果：`12 passed, 0 failed, protected-boundary passed`
- 总耗时：约 `227.2 s`
- 隔离：runner 使用系统 TEMP 下 `larkix-s67-runner-*` 独立 `DATA_DIR`；API 与浏览器夹具继续使用各自独立临时数据库和浏览器 profile。
- S60 digest：`sha256:9574b01464d7f2b0ddbc861e0783d1e77173313664082585c256dca7c86794c3`

| ID | 权威命令 | 状态 | 耗时 |
| --- | --- | --- | ---: |
| s66-static | `node scripts/test-public-card-theme-footer-version.js` | PASS | 186 ms |
| s66-browser | `node --experimental-sqlite scripts/run-public-card-theme-footer-browser-fixture.js` | PASS | 8,782 ms |
| s65-static | `node scripts/test-public-search-home-composition.js` | PASS | 154 ms |
| s65-browser | `node --experimental-sqlite scripts/run-public-search-home-browser-fixture.js` | PASS | 9,433 ms |
| s64-static | `node scripts/test-cms-draft-operations-controls.js` | PASS | 171 ms |
| s64-browser | `node --experimental-sqlite scripts/run-cms-draft-operations-browser-fixture.js --verify` | PASS | 14,396 ms |
| s63-migration | `node --experimental-sqlite scripts/test-cross-content-discovery-migration.js` | PASS | 2,260 ms |
| s63-authority | `node --experimental-sqlite scripts/test-cross-content-discovery-authority.js` | PASS | 38,527 ms |
| s62-consolidated | `node --experimental-sqlite scripts/test-formula-cms-consolidated.js` | PASS | 1,515 ms |
| s60-regression | `node scripts/run-formula-workline-regression.js` | PASS | 108,749 ms |
| s50-regression | `node scripts/run-security-formula-regression.js` | PASS | 39,950 ms |
| contract | `npm.cmd run codex:contract` | PASS（1319 passed / 0 warnings / 0 failures） | 928 ms |

## Real-browser coverage

- S66：强制系统暗色环境下验证 unset/invalid 首帧固定 light、保存 dark 的冷加载和跨页持久化、公开备案/CMS 排除，以及 390×844 卡片和页脚无横向溢出。
- S65：验证五类型公开搜索的 URL/DOM/隐私边界、390px 公式结果、首页最新 8 个公式与 large/small-1/small-2 三个互异权威槽位。
- S64：验证文章/公式多草稿身份隔离、同编辑器冲突安全恢复、跨编辑器保留、刷新 picker、六类等级、三槽位与移动端无溢出。

以上均调用既有真实 Edge/Chrome 夹具；未以静态 DOM 或空数据页面替代浏览器验收。

## Boundary and cleanup proof

- runner 结束时：`protected-path diff: empty`，覆盖 `.env`、`database`、`runtime-data`、`uploads`。
- runner 结束时：`cached diff: empty`，A77 未 staging/commit/push。
- 相对启动基线新增 `larkix-s64-*`、`larkix-s65-*`、`larkix-s66-*`、`larkix-s67-*`、`larkix-discovery-*`、`larkix-formula-cms-*`、`larkix-s60-*` 临时目录：`0`。
- 相关 Node/Edge/Chrome 残留进程：`0`。
- S67 runner 自有 `DATA_DIR`：`cleanup complete`。
- 未访问或修改当前/生产数据，未执行迁移、部署、云、秘密、版本或 Git 写入。

## Reproduction

```powershell
Set-Location -LiteralPath 'E:\Project\2607-LarkixWeb'
node scripts/run-discovery-experience-regression.js
npm.cmd run codex:contract
node --check scripts/run-discovery-experience-regression.js
git diff --check
```

证据与 handoff 落盘后的独立最终门禁：`npm.cmd run codex:contract` 为 `1319 passed, 0 warnings, 0 failures`；`node --check` 与 `git diff --check` 均通过（仅既有 LF/CRLF 提示）。

任何子项失败、S60 digest 偏离或保护边界失败，runner 均以非零状态退出并保留该项的裁剪错误输出；不会把瞬时红灯静默记绿。
