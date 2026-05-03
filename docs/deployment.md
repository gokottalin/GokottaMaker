# GokottaMaker 部署说明

## 重要结论

GokottaMaker 不是纯静态网站。它包含管理员登录、SQLite 数据库和封面图片上传，所以不适合直接部署到 GitHub Pages。

推荐路线：

```text
GitHub 托管代码 -> Render / VPS / Docker 主机运行 Node 服务 -> 持久磁盘保存 SQLite 和上传图片
```

## 方案 A：Render Blueprint

1. 在 GitHub 创建 `GokottaMaker` 仓库，并把本项目推送上去。
2. 登录 Render。
3. 选择 New -> Blueprint。
4. 连接 GitHub 仓库。
5. Render 会读取仓库中的 `render.yaml`。
6. 设置环境变量：

```text
ADMIN_USERNAME=Gokotta
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
  -e ADMIN_USERNAME=Gokotta \
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
ADMIN_USERNAME='Gokotta' \
ADMIN_PASSWORD='请换成新的强密码' \
PORT=4173 \
/opt/node22/bin/node --experimental-sqlite server.js
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
