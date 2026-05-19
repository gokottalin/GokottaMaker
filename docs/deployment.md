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
cd /opt/LarkixMaker
bash scripts/deploy-update.sh
```

脚本会自动：

- `git fetch origin`
- 检查工作区是否干净
- 备份 `/srv/gokottamaker-data`
- `git pull --ff-only origin main`
- 重启 `gokottamaker`
- 请求 `/healthz` 验证版本
- 输出部署前后 commit、版本号、健康检查和备份目录对比
- 失败时输出诊断命令、最近备份目录和推荐回滚命令

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
cd /opt/LarkixMaker
bash scripts/rollback.sh
```

回滚到指定 commit：

```bash
cd /opt/LarkixMaker
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
cd /opt/LarkixMaker
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

## 不推荐 GitHub Pages 的原因

GitHub Pages 只能托管静态文件，无法运行 `server.js`，也无法稳定写入 SQLite 数据库和上传图片。强行静态化会导致管理端真实保存功能失效。
