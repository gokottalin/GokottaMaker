# S50 安全与回归证据交接

## status

`completed_and_accepted_by_A00`

## scope_completed

- 新增固定顺序、可重复执行的安全与公式回归运行器。
- 完成公开最小化、私有 CMS、公式权威/关系/生命周期/DAG、角标/图谱、Markdown 和项目契约矩阵。
- 增加 `768 x 900` 半宽真实浏览器像素门禁，并保留桌面与移动端验证。
- 完整矩阵最终为 `15 passed, 0 failed`，未发现产品失败。

## files_created_or_changed

- `scripts/run-security-formula-regression.js`
- `scripts/test-formula-map-flow-layout.js`
- `package.json`
- `docs/security-formula-regression-evidence.md`
- `docs/codex-workline/slices/S50_security_regression_evidence_handoff.md`

## tests_or_checks

- `node --check scripts/run-security-formula-regression.js`
- `npm.cmd run test:formula-map-flow-layout`
- `npm.cmd run test:security-formula-regression`
- 矩阵结果：`15 passed, 0 failed`
- 契约结果：`1089 passed, 0 warnings, 0 failures`

## protected_boundaries

- 当前数据库、上传资产、`.env`、版本 `2.5.3` 与 Git HEAD `50386e9` 保持不变。
- 未执行生产迁移、部署、服务重启、密钥写入、物理清理或 Git 写操作。

## release_gate

- 产品与本地验证可以验收。
- 生产部署前仍须在服务器执行 `sudo nginx -t`，并在服务器本地配置真实 `PRIVATE_CMS_PATH`。
