# LarkixMaker 部署说明

## 重要结论

LarkixMaker 不是纯静态网站。它包含管理员登录、SQLite 数据库和封面图片上传，所以不适合直接部署到 GitHub Pages。

推荐路线：

```text
GitHub 托管代码 -> Render / VPS / Docker 主机运行 Node 服务 -> 持久磁盘保存 SQLite 和上传图片
```

## 方案 A：Render Blueprint

1. 在 GitHub 创建 `LarkixMaker` 仓库，并把本项目推送上去。
2. 登录 Render。
3. 选择 New -> Blueprint。
4. 连接 GitHub 仓库。
5. Render 会读取仓库中的 `render.yaml`。
6. 设置环境变量：

```text
ADMIN_USERNAME=Larkix
ADMIN_PASSWORD=请换成新的强密码
```

7. 首次部署完成后访问 Render 给出的域名。

Render 配置要点：

- Node 版本：`22.11.0`
- 启动命令：`npm start`
- 持久磁盘：挂载到 `/var/data`
- `DATA_DIR=/var/data`

项目使用 Node 内置 SQLite，启动时需要 `--experimental-sqlite`。这个参数已经写入 `package.json` 的 `npm start`。

## 方案 B：VPS + Docker

服务器安装 Docker 后，在项目目录执行：

```bash
docker build -t gokottamaker .
docker run -d \
  --name gokottamaker \
  -p 4173:4173 \
  -v /srv/gokottamaker-data:/data \
  -e ADMIN_USERNAME=Larkix \
  -e ADMIN_PASSWORD='请换成新的强密码' \
  gokottamaker
```

然后用 Nginx 反向代理到：

```text
http://127.0.0.1:4173
```

## 方案 C：国内云 Node 直部署

如果 Docker Hub 拉取基础镜像超时，可以直接安装 Node 22，并使用实验 SQLite 参数启动：

```bash
DATA_DIR=/srv/gokottamaker-data \
ADMIN_USERNAME='Larkix' \
ADMIN_PASSWORD='请换成新的强密码' \
PORT=4173 \
/opt/node22/bin/node --experimental-sqlite server.js
```

### systemd 环境文件

推荐把生产配置放在：

```text
/etc/gokottamaker.env
```

模板见：

```text
scripts/gokottamaker.env.example
```

安装或更新 systemd：

```bash
sudo cp scripts/gokottamaker.env.example /etc/gokottamaker.env
sudo nano /etc/gokottamaker.env
sudo cp scripts/gokottamaker.service /etc/systemd/system/gokottamaker.service
sudo systemctl daemon-reload
sudo systemctl enable --now gokottamaker
```

### 一键更新

更新线上代码推荐执行：

```bash
cd /opt/GokottaMaker
bash scripts/deploy-update.sh
```

脚本会自动：

- `git fetch origin`
- 检查工作区是否干净
- 备份 `/srv/gokottamaker-data`
- `git merge --ff-only origin/main`
- 当显式提供内容包时，先通过同一门禁执行 dry-run；只有一次性 apply 意图、备份证据和校验和全部匹配时才导入
- 重启 `gokottamaker`
- 请求 `/healthz` 验证版本
- 输出部署前后 commit、版本号、健康检查和备份目录对比
- 失败时输出诊断命令、最近备份目录和推荐回滚命令

### 计算书内容包同步

`scripts/content-sync-cloud.sh` 只接受规范的
`larkix.calculation-book-package.v1`，并拒绝 `preview=true` 的预览包。每个
节点必须使用稳定 ASCII slug，且 `id` 必须与 `slug` 相同。同步按包内
明确列出的 slug 逐项比较：

- 相同 slug 与相同载荷重复导入时跳过，不新增修订；
- 载荷变化时只更新本包列出的节点，不扫描、删除或改写其他内容；
- 软删除状态不会被同步脚本自动恢复；
- 整包写入使用单一 SQLite 事务，部分失败不会留下已提交的前半包；
- 成功后在 `DATA_DIR/.content-sync/<bookId>.json` 写入包 SHA-256、来源摘要、
  稳定 slug 与本次 created / updated / unchanged 回执。

校验和应在内容包传输或发布前由验收方锁定，并从独立的验收记录带到目标
主机。不要在正式 apply 命令中临时计算一个新的期望值来绕过比对。Linux
可使用：

```bash
sha256sum content/calculation-books/<book>/generated/larkix-package.json
```

缺少 `sha256sum` 的校验环境可使用 Node 22 得到同一 SHA-256：

```bash
node -e 'const c=require("node:crypto"),f=require("node:fs");process.stdout.write(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex")+"\n")' \
  content/calculation-books/<book>/generated/larkix-package.json
```

默认命令是 dry-run。它只读取并校验包，不创建或打开 `DATA_DIR`，不运行
SSH、上传或云端写入：

```bash
bash scripts/content-sync-cloud.sh \
  --package content/calculation-books/<book>/generated/larkix-package.json \
  --checksum '<已验收的 64 位 SHA-256>' \
  --data-dir /srv/gokottamaker-data
```

正式 apply 必须同时满足以下全部门禁：

1. 显式 `--apply`；
2. 显式 `--confirm APPLY_CONTENT_SYNC`；
3. `--checksum` 与包字节完全匹配；
4. `--backup-evidence` 指向本次 `backup-linux.sh` 生成的 `manifest.txt`；
5. 备份的 `source_dir` 与目标 `DATA_DIR` 完全相同；
6. 备份时间未超过 `CONTENT_SYNC_MAX_BACKUP_AGE_HOURS`，默认 2 小时；
7. 备份的 `manifest.sha256` 存在且每一项校验通过。

手工维护时先取得 `backup-linux.sh` 输出的 `Manifest:` 路径，再执行：

```bash
sudo env \
  APP_DIR=/opt/GokottaMaker \
  NODE_BIN=/opt/node22/bin/node \
  DATA_DIR=/srv/gokottamaker-data \
  CONTENT_SYNC_MAX_BACKUP_AGE_HOURS=2 \
  bash /opt/GokottaMaker/scripts/content-sync-cloud.sh \
    --apply \
    --confirm APPLY_CONTENT_SYNC \
    --package /opt/GokottaMaker/content/calculation-books/<book>/generated/larkix-package.json \
    --checksum '<已验收的 64 位 SHA-256>' \
    --backup-evidence /srv/gokottamaker-backups/<本次时间戳>/manifest.txt \
    --data-dir /srv/gokottamaker-data
```

`deploy-update.sh` 复用同一门禁。只提供包与校验和时，部署流程仅做内容包
dry-run：

```bash
CONTENT_SYNC_PACKAGE='content/calculation-books/<book>/generated/larkix-package.json' \
CONTENT_SYNC_CHECKSUM='<已验收的 64 位 SHA-256>' \
bash scripts/deploy-update.sh
```

只有维护窗口内的一次性命令才同时传入 apply 意图。不要把
`CONTENT_SYNC_CONFIRM=APPLY_CONTENT_SYNC` 长期写入 `/etc/gokottamaker.env`：

```bash
CONTENT_SYNC_PACKAGE='content/calculation-books/<book>/generated/larkix-package.json' \
CONTENT_SYNC_CHECKSUM='<已验收的 64 位 SHA-256>' \
CONTENT_SYNC_APPLY=true \
CONTENT_SYNC_CONFIRM=APPLY_CONTENT_SYNC \
bash scripts/deploy-update.sh
```

部署脚本仍先备份，再 fast-forward 代码，然后执行内容包 dry-run/apply，
最后重启服务并检查 `/healthz`；内容同步不能绕过既有备份或健康检查。

本地无网络回归使用操作系统临时目录，结束后自动清理：

```bash
bash scripts/content-sync-cloud.sh --self-test
```

矩阵覆盖 dry-run 零写、校验和不匹配、缺少备份证据、首次导入、相同包重复
导入、单节点载荷更新、事务中途失败与 rollback 提示。测试在 `PATH` 前置
网络命令守卫；若调用 `curl`、`wget`、`ssh`、`scp`、`rsync` 或 `rclone`
即失败。

内容同步失败时脚本会打印最后安全检查点、已验证备份与以下两阶段恢复命令，
但不会自动替换数据：

```bash
bash scripts/restore-linux.sh --dry-run <backup-dir> <DATA_DIR>
sudo bash scripts/restore-linux.sh <backup-dir> <DATA_DIR>
```

内容事务失败时前半包会回滚。需要注意，打开 SQLite 时可能先运行当前代码
中的加法迁移；若要求数据库整体回到导入前状态，必须在确认停机与恢复范围后
使用已校验备份。

### 健康检查

公开健康检查：

```text
http://服务器地址:4173/healthz
```

管理员详细健康检查：

```text
http://服务器地址:4173/api/admin/health
```

健康检查字段说明：

- `/healthz` 会返回版本、build、git commit、Node 版本、启动时间、服务时间，以及 `data.databaseBytes`、`data.uploadsBytes`、`data.uploadsFiles`。
- `/api/admin/health` 会额外返回数据库文件、WAL/SHM 文件大小、uploads 目录统计、最近备份目录、manifest 和 checksum 是否存在。

### 回滚

如果部署后健康检查失败、服务无法启动，或页面出现明显异常，先查看脚本失败提示中的 `Pre-deploy commit` 和 `Latest backup`。

回滚到上一次部署前记录的 commit：

```bash
cd /opt/GokottaMaker
bash scripts/rollback.sh
```

回滚到指定 commit：

```bash
cd /opt/GokottaMaker
bash scripts/rollback.sh 9263f08
```

回滚脚本会自动：

- 检查工作区是否干净。
- 在回滚代码前备份 `/srv/gokottamaker-data`。
- `git reset --hard` 到目标 commit。
- 重启 `gokottamaker`。
- 请求 `/healthz` 验证回滚后的服务。

注意：回滚脚本只回滚代码，不删除或替换 SQLite 与 uploads 运行数据。若需要恢复数据，应使用恢复脚本。

### 备份校验

手动创建备份：

```bash
sudo bash scripts/backup-linux.sh
```

备份默认写入：

```text
/srv/gokottamaker-backups/YYYY-MM-DD_HH-MM-SS
```

每份备份会包含：

- `database/`
- `uploads/`
- `manifest.txt`
- `manifest.sha256`，当服务器存在 `sha256sum` 时生成

如果服务器存在 `sqlite3`，备份脚本会使用 SQLite `.backup` 创建数据库快照，并执行：

```sql
PRAGMA integrity_check;
```

如果服务器暂时没有 `sqlite3`，脚本会降级为文件复制，并在 manifest 中记录 `skipped-sqlite3-missing`。

生产环境推荐在 `/etc/gokottamaker.env` 中设置备份根目录，供管理员健康检查展示最近备份：

```text
BACKUP_ROOT=/srv/gokottamaker-backups
```

### 恢复数据

恢复前建议先 dry-run：

```bash
DRY_RUN=true sudo bash scripts/restore-linux.sh /srv/gokottamaker-backups/YYYY-MM-DD_HH-MM-SS
```

正式恢复：

```bash
sudo bash scripts/restore-linux.sh /srv/gokottamaker-backups/YYYY-MM-DD_HH-MM-SS
```

恢复脚本会自动：

- 校验备份目录结构。
- 如果有 `manifest.sha256`，执行 checksum 校验。
- 如果有 `sqlite3`，执行 SQLite 完整性校验。
- 停止 `gokottamaker`。
- 给当前数据目录创建安全副本：`/srv/gokottamaker-data.before-restore-YYYY-MM-DD_HH-MM`。
- 替换 `database/` 与 `uploads/`。
- 启动 `gokottamaker`。

### 部署失败诊断

如果 `deploy-update.sh` 失败，优先执行：

```bash
sudo journalctl -u gokottamaker -n 120 --no-pager
sudo systemctl status gokottamaker --no-pager
curl -fsS http://127.0.0.1:4173/healthz
```

如果确认需要回滚，使用脚本输出的推荐命令，例如：

```bash
cd /opt/GokottaMaker
bash scripts/rollback.sh <Pre-deploy commit>
```

## 必须备份

```text
database/
uploads/
```

如果设置了 `DATA_DIR=/var/data`，实际需要备份：

```text
/var/data/database/
/var/data/uploads/
```

## 私有 CMS 入口

生产 CMS 入口由 `/etc/gokottamaker.env` 中的 `PRIVATE_CMS_PATH` 控制。它是附加门禁，不能替代管理员密码、会话、CSRF、登录限速或审计。

在服务器终端生成一个 URL-safe 随机值，不要把输出发到聊天、提交到 Git 或写入 Nginx 配置：

```bash
CMS_PATH="$(openssl rand -base64 48 | tr -d '=+/\n' | cut -c1-64)_A9"
sudoedit /etc/gokottamaker.env
```

在受保护环境文件中设置：

```text
PRIVATE_CMS_PATH=<在服务器本地生成的 48-128 位高熵值>
ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK=false
```

确认 `/etc/gokottamaker.env` 仅 root 可读，然后重启并验证：

```bash
sudo chown root:root /etc/gokottamaker.env
sudo chmod 600 /etc/gokottamaker.env
sudo systemctl restart gokottamaker
curl -fsS http://127.0.0.1:4173/healthz
```

浏览器只访问 `https://larkix.com/<私有值>/admin/index.html`。标准 `/admin/`、`/api/login`、`/api/session` 和管理 API 始终为 404。私有入口页面与 API 禁止缓存和 Referer，上线前仍须执行 `sudo nginx -t && sudo systemctl reload nginx`。

轮换时先备份环境文件，在服务器本地生成新值，替换 `PRIVATE_CMS_PATH` 并重启服务。旧入口和旧入口作用域的会话 Cookie 会立即失效；Owner 账户与 CMS 数据不需要迁移。确认新入口可登录后，安全删除旧值记录。不要在 URL 分析、访问日志、截图或工单中记录入口。

`ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK=true` 只供绑定到 `127.0.0.1` 的隔离自动化测试使用，生产必须保持 `false`。

## 不推荐 GitHub Pages 的原因

GitHub Pages 只能托管静态文件，无法运行 `server.js`，也无法稳定写入 SQLite 数据库和上传图片。强行静态化会导致管理端真实保存功能失效。
