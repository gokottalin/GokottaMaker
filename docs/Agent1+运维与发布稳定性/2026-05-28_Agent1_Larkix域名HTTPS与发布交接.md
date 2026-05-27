# Agent1 Larkix 域名、HTTPS 与发布稳定性交接

交接日期：2026-05-28
交接来源：Agent0
接手对象：Agent1 - 网页运维与发布稳定性
生产域名：`www.larkix.com`、`larkix.com`
服务器公网 IP：`81.71.156.122`
当前目标：让 `http://www.larkix.com` / `https://www.larkix.com` 稳定访问 Larkix / LarkixMaker，并建立可重复发布、回滚、排障流程。

## 1. 当前结论

1. 生产服务是 Node 站点，不是纯静态站点。它包含 CMS、SQLite、上传文件、管理端登录和健康检查。
2. Node 应由 `systemd` 管理，内部端口使用 `4173`；公网入口由 Nginx 监听 `80/443` 并反向代理到 `127.0.0.1:4173`。
3. 用户已经完成域名 A 记录绑定：`www.larkix.com -> 81.71.156.122`。
4. 用户侧曾出现浏览器 502，但 `curl -4` 正常，最终判断大概率与 Clash / Windows 系统代理有关。Agent1 后续遇到“某台电脑不通、另一台电脑正常”时，优先检查代理和浏览器缓存。
5. 浏览器提示“不安全”是因为还在使用 HTTP，最快解决是 Certbot 为 Nginx 配置 HTTPS 证书并强制跳转。
6. `/` 当前是 Larkix 品牌入口页，完整内容站入口是 `/maker.html`。如果用户要求根域名直接显示完整网站，优先采用 Nginx 或应用层重定向到 `/maker.html`。

## 2. 当前 Git 状态风险

Agent1 接手前必须先看本地 Git 状态：

```powershell
git status --short --branch
git log --oneline --decorate -5
```

交接时本地状态为：

```text
## main...origin/main [ahead 1]
```

本地有 1 个已提交但未推送的提交：

```text
04ccdba fix: bind production app to loopback
```

该提交主要让生产服务支持：

```text
HOST=127.0.0.1
server.listen(port, host || undefined, ...)
```

注意：

- 该提交尚未确认推送到 GitHub；此前 HTTPS 推送 GitHub 多次超时或连接重置。
- 生产服务器如果执行 `git pull origin main`，不会拿到未推送提交。
- 本地还有大量未提交的视觉和页面改动，属于用户/前端批注迭代范围。Agent1 不应擅自全部发布，除非 Agent0 或用户明确确认发布范围。

## 3. 生产服务器目标结构

建议保持以下路径约定：

```text
/opt/LarkixMaker                         # 应用代码目录
/etc/gokottamaker.env                    # systemd 环境变量
/etc/systemd/system/gokottamaker.service # systemd 服务
/srv/gokottamaker-data                   # SQLite 与 uploads 运行数据
/srv/gokottamaker-backups                # 发布前备份与手动备份
/etc/nginx/sites-available/larkix.com    # Nginx 站点配置
/etc/nginx/sites-enabled/larkix.com      # Nginx 启用链接
```

Node 版本目标：

```text
Node v22.x
npm start = node --experimental-sqlite server.js
```

生产环境变量建议：

```text
DATA_DIR=/srv/gokottamaker-data
BACKUP_ROOT=/srv/gokottamaker-backups
PORT=4173
HOST=127.0.0.1
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
GIT_COMMIT=<当前发布 commit 短 SHA>
```

## 4. Nginx HTTP 反代基线

如果 Nginx 站点丢失，先恢复 HTTP 反代：

```nginx
server {
  listen 80;
  server_name www.larkix.com larkix.com;

  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:4173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
  }
}
```

启用与验证：

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I http://127.0.0.1:4173/healthz
curl -I http://www.larkix.com/healthz
```

## 5. HTTPS 最快处理方案

浏览器显示“不安全”时，优先执行：

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d www.larkix.com -d larkix.com
```

Certbot 询问是否重定向时，选择自动 HTTP -> HTTPS 跳转。

完成后验证：

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I https://www.larkix.com/
curl -I http://www.larkix.com/
sudo certbot renew --dry-run
```

预期结果：

```text
https://www.larkix.com/ 返回 200
http://www.larkix.com/ 返回 301/308 并跳转到 HTTPS
certbot renew --dry-run 成功
```

腾讯云安全组必须开放：

```text
80/tcp
443/tcp
22/tcp
```

生产服务内网端口 `4173` 不建议公网开放。若安全组或防火墙允许过 `4173/tcp`，HTTPS 配好后应关闭公网访问，只保留 Nginx -> `127.0.0.1:4173`。

## 6. 根域名入口策略

当前信息：

- `http://www.larkix.com/`：Larkix 品牌门户页。
- `http://www.larkix.com/maker.html`：完整 LarkixMaker 内容站。

如果用户认为首页“显示不完全”，Agent1 先确认用户访问的是 `/` 还是 `/maker.html`。这是页面入口设计差异，不一定是服务异常。

最快改法：让根域名临时跳转到完整内容站。

```nginx
location = / {
  return 302 /maker.html;
}
```

验证稳定后再考虑改为永久跳转：

```nginx
location = / {
  return 301 /maker.html;
}
```

如果用户希望保留品牌门户，则由 Agent4 / Agent7 继续扩充 `index.html` 的产品入口和视觉内容，Agent1 只负责发布稳定性。

## 7. Clash / 本机代理排障记录

历史现象：

- `curl -4 -I http://www.larkix.com/` 返回 200。
- `curl -I http://81.71.156.122/ -H "Host: www.larkix.com"` 返回 200。
- 浏览器仍显示 502。

判断：浏览器流量可能走了 Clash / 系统代理，而命令行直连正常。

Clash bypass 建议加入：

```yaml
bypass:
  - localhost
  - 127.*
  - 10.*
  - 172.16.*
  - 172.17.*
  - 172.18.*
  - 172.19.*
  - 172.20.*
  - 172.21.*
  - 172.22.*
  - 172.23.*
  - 172.24.*
  - 172.25.*
  - 172.26.*
  - 172.27.*
  - 172.28.*
  - 172.29.*
  - 172.30.*
  - 172.31.*
  - 192.168.*
  - <local>
  - '*.larkix.com'
  - 'www.larkix.com'
  - 'larkix.com'
  - '81.71.156.122'
```

Windows 客户端快速验证：

```powershell
ipconfig /flushdns
curl.exe -4 -I http://www.larkix.com/
curl.exe -I http://81.71.156.122/ -H "Host: www.larkix.com"
```

若命令行正常但浏览器异常：

1. 临时关闭 Clash 系统代理。
2. 浏览器无痕窗口访问。
3. DevTools Network 勾选 Disable cache，强刷。
4. 检查浏览器是否安装了单独代理插件。

## 8. 标准发布 SOP

### 8.1 本地发布前

```powershell
npm.cmd run check:version
npm.cmd run test:markdown
node --check server.js
powershell -ExecutionPolicy Bypass -File scripts\verify-api.ps1
git diff --check
git status --short --branch
```

确认：

- 只包含本次要发布的文件。
- 未混入用户未确认的视觉实验目录。
- 版本号、`data/site-meta.js`、`/healthz` 预期一致。

### 8.2 推送 GitHub

```powershell
git add <本次确认发布的文件>
git commit -m "release: <发布说明>"
git push origin main
```

如果 HTTPS 推送失败，先不要在生产服务器手工改代码。优先修复 GitHub 网络或改用 SSH key，确保生产仍能通过 `git pull` 拿到可审计代码。

### 8.3 生产服务器发布

```bash
cd /opt/LarkixMaker
git status -sb
git fetch origin
git rev-parse --short HEAD
git rev-parse --short origin/main
sudo bash scripts/deploy-update.sh
curl -fsS http://127.0.0.1:4173/healthz
curl -fsS https://www.larkix.com/healthz
sudo systemctl status gokottamaker --no-pager
```

发布完成后记录：

```text
versionLabel
gitCommit
databaseBytes
uploadsBytes
uploadsFiles
backup path
service active since
```

## 9. 回滚 SOP

代码发布异常：

```bash
cd /opt/LarkixMaker
sudo bash scripts/rollback.sh
curl -fsS http://127.0.0.1:4173/healthz
sudo systemctl status gokottamaker --no-pager
```

指定 commit 回滚：

```bash
cd /opt/LarkixMaker
sudo bash scripts/rollback.sh <commit>
```

数据恢复必须更谨慎，先 dry-run：

```bash
DRY_RUN=true sudo bash scripts/restore-linux.sh /srv/gokottamaker-backups/YYYY-MM-DD_HH-MM-SS
sudo bash scripts/restore-linux.sh /srv/gokottamaker-backups/YYYY-MM-DD_HH-MM-SS
```

注意：代码回滚不等于数据库回滚。CMS 数据异常时，需要单独确认 SQLite 和 uploads 的备份恢复点。

## 10. 常见故障树

### A. 浏览器显示不安全

优先级 P0。

检查：

```bash
curl -I http://www.larkix.com/
curl -I https://www.larkix.com/
sudo certbot certificates
sudo nginx -t
```

处理：执行第 5 节 Certbot HTTPS 流程。

### B. 访问 502

检查：

```bash
sudo systemctl status gokottamaker --no-pager
sudo journalctl -u gokottamaker -n 120 --no-pager
sudo ss -lntp | grep -E ':80|:443|:4173'
curl -i http://127.0.0.1:4173/healthz
sudo tail -n 120 /var/log/nginx/error.log
```

判断：

- `127.0.0.1:4173/healthz` 不通：Node / systemd 问题。
- 本机 healthz 通、域名 502：Nginx proxy_pass 或 upstream 问题。
- curl 正常、浏览器 502：本机代理 / Clash / 浏览器缓存问题。

### C. 访问 Welcome to nginx

说明命中了 Nginx default site。

处理：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/larkix.com /etc/nginx/sites-enabled/larkix.com
sudo nginx -t
sudo systemctl reload nginx
```

### D. 页面显示不完整

先区分：

1. 是否访问了 `/`，而用户期待 `/maker.html`。
2. DevTools Network 是否有 404/500。
3. `/api/content` 是否正常。
4. uploads 文件是否存在。

命令：

```bash
curl -I https://www.larkix.com/
curl -I https://www.larkix.com/maker.html
curl -fsS https://www.larkix.com/api/content | head
sudo ls -lah /srv/gokottamaker-data/uploads
sudo tail -n 120 /var/log/nginx/access.log | grep ' 404 '
```

### E. `/healthz` 的 `gitCommit` 不对

服务会优先读取环境变量 `GIT_COMMIT`。如果显示旧 commit，检查：

```bash
grep GIT_COMMIT /etc/gokottamaker.env
cd /opt/LarkixMaker && git rev-parse --short HEAD
sudo systemctl restart gokottamaker
curl -fsS http://127.0.0.1:4173/healthz
```

## 11. Agent1 优先任务

P0：

1. 确认 HTTPS 是否已完成；未完成则执行 Certbot。
2. 确认 Nginx `80/443 -> 127.0.0.1:4173` 稳定。
3. 确认腾讯云安全组开放 `80/443`，关闭公网 `4173`。
4. 明确根域名入口策略：保留 Larkix 门户，或跳转 `/maker.html`。
5. 确认本地未推送 commit `04ccdba` 是否需要推送并部署。

P1：

1. 建立每次发布记录模板，记录版本、commit、健康检查、备份路径、回滚点。
2. 补充 HTTPS 自动续期巡检：`sudo certbot renew --dry-run`。
3. 建立 Nginx 与 systemd 故障日志收集清单。
4. 将 Clash / 代理排障写入用户侧 FAQ。

P2：

1. 增加发布后自动检查脚本：根页、`maker.html`、静态资源、`api/content`、`healthz`。
2. 增加站点资源 404 扫描，避免 uploads 或 cover 丢失。
3. 增加异地备份同步巡检。

## 12. 交接边界

Agent1 负责：

- 域名、Nginx、HTTPS、systemd、Node 进程、端口、安全组。
- 发布、备份、回滚、健康检查、线上故障排查。
- 判断问题属于运维、代理、缓存、资源缺失还是前端代码。

Agent1 不直接负责：

- 首页视觉高级感、Logo 风格、紫色主题微调。
- CMS 产品功能设计。
- 多平台内容分发功能架构。
- 文章内容质量、SEO 文案。

这些应分别交给 Agent4 / Agent7 / Agent3 / Agent5 / Agent9，但 Agent1 需要提供稳定发布窗口和回滚保障。
