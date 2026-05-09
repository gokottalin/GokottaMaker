# 当前 Agent 总控交接入口

更新时间：2026-05-09 13:46
当前有效版本：V2.3.0+20260509-1346

当前 6 个 Agent 的最新阶段成果、疏漏复核、责任边界和发布步骤，以此文件和下方总控文档为准：

```text
docs/2026-05-09_五Agent阶段成果复核与发布计划.md
docs/Agent6-miniapps/2026-05-09_Agent6_GokottaElec小程序接入交接.md
```

## 本轮结论

Agent6/Leo 的小程序中心与 GokottaElec 在线预览方向合理，已作为独立访客功能域接入，不混入文章、项目、CMS 数据模型。本轮总控补齐了发布前遗漏：SVG 预览改为 Blob 图片渲染，新增小程序页面进入 sitemap，运行时 `.tmp/` 加入忽略列表，并将版本提升到 V2.3.0。

云端 `http://81.71.156.122:4173/healthz` 当前返回 502，说明发布前必须先在服务器侧确认 `gokottamaker` 服务状态、日志和反向代理/端口状态。由于本地没有服务器 SSH 私钥，本轮只能完成代码发布和服务器执行指令输出，云端更新需要管理员在 Ubuntu 上执行命令。

## Agent 接入顺序

1. Agent1 先执行发布和健康检查，确认云端版本、服务、数据库、上传目录。
2. Agent2 再执行轮播数据库巡检，必要时清理重复槽位和越界排序。
3. Agent3 接手管理端 CMS 交互，确保轮播最多 4 个固定槽位且排序仅为 0-3。
4. Agent4 做访客端首页和移动端视觉验收，重点检查轮播图片、卡片阅读性和响应式。
5. Agent5 做内容选择和 SEO 复核，确保轮播内容覆盖四个方向且文案可维护。
6. Agent6 负责小程序中心、工具页和 `/api/elec/*` 接口，后续新增小工具统一登记在 `data/miniapps.js`。

## 服务器侧推荐命令

```bash
cd /opt/GokottaMaker
sudo systemctl status gokottamaker --no-pager
sudo journalctl -u gokottamaker -n 120 --no-pager
sudo bash scripts/deploy-update.sh
curl -fsS http://127.0.0.1:4173/healthz
bash scripts/check-carousel-cloud.sh
```

如果健康检查仍然是 502：

```bash
sudo systemctl restart gokottamaker
sudo journalctl -u gokottamaker -n 120 --no-pager
curl -fsS http://127.0.0.1:4173/healthz
```
