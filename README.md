# GokottaMaker

GokottaMaker 是一个面向模拟电子、STM32、ESP32 和独立开源硬件项目的技术网站。当前版本包含访客端、Markdown 文章详情页、项目展示页、管理员登录、SQLite 内容保存和封面图片上传。

## 本地运行

```powershell
node --experimental-sqlite server.js
```

访问：

```text
http://localhost:4173
http://localhost:4173/admin/
```

## 管理端

默认管理员账号由环境变量控制：

```text
ADMIN_USERNAME=Gokotta
ADMIN_PASSWORD=change-this-before-public-deploy
```

数据库中保存的是密码哈希和盐，不保存明文密码。首次启动时会创建管理员账号；如果已经存在账号，默认不会覆盖密码。需要强制重置时，临时设置：

```text
ADMIN_RESET_PASSWORD_ON_START=true
```

重置成功后应改回 `false`。

## 生产数据

生产环境建议设置：

```text
DATA_DIR=/var/data
```

服务会把 SQLite 和上传图片保存到：

```text
/var/data/database/gokottamaker.sqlite
/var/data/uploads/
```

这两个目录必须放在持久磁盘中，并定期备份。

## 部署

项目已包含：

- `package.json`: Node 启动脚本和 Node 版本要求。
- `render.yaml`: Render Blueprint 示例，包含持久磁盘配置。
- `Dockerfile`: VPS、Docker 平台或容器平台部署入口。
- `.env.example`: 环境变量模板。

详细步骤见 [docs/deployment.md](docs/deployment.md)。
