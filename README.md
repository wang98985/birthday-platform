# 🎂 生日代码 · 在线生成平台

把「旋转生日蛋糕 / 星空贺卡」这类生日代码做成一个可在线定制、可分享、可私有部署的 Web 平台。

- 选模板 → 填**人名 / 生日 / 祝福语 / 落款** → 实时预览
- 一键生成**分享链接**（即时链接，无需后端）或**短链**（存入服务器，长期有效）
- 一键生成**二维码**（纯前端，运行时不依赖外网）
- 一键下载**定制好的 Python 代码**（`turtle` 版，对方本地双击即可运行）
- **愿望信箱**：收到亲友留言，支持未读角标、一键已读、删除信箱
- 自包含：后端仅依赖 `Flask` + SQLite，无外部服务；前端无构建步骤

> 约定：每次推送到 GitHub 都会同步更新本 README（功能说明 + 更新日志），保持文档与代码一致。

## 功能一览

| 模块 | 能力 |
| --- | --- |
| 模板 | Canvas 动画模板（银河 / 星空 / 像素 / 爱心 / 烟花…）、iframe 完整页面模板（星河许愿、3D 蛋糕）、特效库（2048、烟花、烟雾等 20+） |
| 编辑 | 实时预览、背景音乐（内置曲库 / 上传）、模板库隐藏与恢复、自定义模板（Canvas / iframe / 特效） |
| 分享 | 即时链接 `/view#c=…`、短链 `/c/<slug>`、二维码（可下载成带标题的 PNG）、复制链接；内容不变时复用同一条短链原地更新 |
| 信箱 | `/inbox/<slug>#k=…` 主人专属页；未读徽标；**有新愿望时页面顶部浮出提示**（只查条数、不打断阅读）；一键已读；**分页加载（每页 20 条）**；**一键导出 TXT**；删除信箱；显示短链被打开次数 |
| 编辑已有卡片 | `/?edit=<slug>#k=<key>` 或信箱页「编辑这张卡片」，保存后原地更新 |
| 草稿 | 编辑器自动保存到 localStorage（7 天），下次进入可继续或放弃 |
| 运维 | 每日自动备份（保留 7 份）、错误日志（超 2MB 自动轮转）、gzip、静态资源 ETag/304、自定义 404 页、首页含分享卡片 og 标签 |

## 目录结构

```
birthday-platform/
├─ server.py            # Flask 后端（静态托管 + 卡片/愿望 API + 短链 + gzip + 备份）
├─ requirements.txt
├─ cards.db             # 运行后自动生成（SQLite）
├─ backups/             # 每日自动备份 cards-YYYYMMDD.db（保留 7 份）
├─ logs/error.log       # 未捕获异常日志
├─ admin_key.txt        # 可选：管理口令（已 gitignore，勿提交）
├─ README.md
└─ static/
   ├─ index.html        # 主页：模板库 + 定制表单 + 实时预览
   ├─ view.html         # 全屏观看页（链接 / 二维码打开的就是它）
   ├─ inbox.html        # 愿望信箱（主人侧）
   ├─ styles.css
   ├─ templates.js      # Canvas 动画模板
   ├─ templates-extra.js# 高级 Canvas 模板
   ├─ renderer.js       # 共享：配置编解码 + 渲染（DPR / 像素化）
   ├─ app.js            # 编辑器、分享、信箱、草稿逻辑
   ├─ cake_template.py  # 下载 Python 代码用的模板源
   ├─ og-cover.jpg      # 分享封面（微信 / QQ 卡片）
   ├─ favicon.svg       # 站点图标
   └─ vendor/           # 二维码、特效库等第三方静态资源
```

## 本地运行

```bash
pip install -r requirements.txt
python server.py
# 打开 http://127.0.0.1:5000
```

## 部署到你的服务器

### 方式一：直接运行（最快）

```bash
pip install -r requirements.txt
PORT=8000 python server.py     # 默认 5000，用 PORT 环境变量改端口
```

监听 `0.0.0.0`，服务器防火墙放行对应端口即可通过 `http://你的IP:端口` 访问。

### 方式二：gunicorn + systemd（生产推荐）

```bash
pip install gunicorn
```

`/etc/systemd/system/birthday.service`：

```ini
[Unit]
Description=Birthday Code Platform
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/birthday-platform
Environment="PORT=8000"
ExecStart=/usr/bin/python3 -m gunicorn -w 2 -b 0.0.0.0:8000 server:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now birthday
```

### 方式三：Nginx 反向代理（套域名 / HTTPS）

```nginx
server {
    listen 80;
    server_name cake.example.com;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

> 即时分享链接用的是 `location.origin`，短链用的是 `request.host_url`，反代后只要 Host 头正确，链接域名就会是你的域名。

## 链接与二维码说明

- **即时链接**：`/view#c=<base64>` —— 配置直接编码在 URL 里，不写库，立刻可用（只要静态页还在）。
- **短链**：`/c/<slug>` —— 配置存入 `cards.db`，链接更短更美观，长期有效。单 IP 每 60 秒最多创建 40 次（`RATE_MAX`）。
- **二维码**：浏览器本地生成，不调用任何外部接口；可下载成带标题的 PNG。
- **打开次数**：短链页每被打开一次 +1（同一 IP 30 分钟内只计一次），仅主人能在信箱里看到。
- **信箱链接**：`/inbox/<slug>#k=<ownerKey>` —— 凭证放在 URL hash 里，不会出现在服务端访问日志中；拿到链接即视为主人。

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/cards` | 新建卡片，返回 `slug` / `ownerKey` / 短链 / 信箱链接 |
| GET | `/api/cards/<slug>` | 读取卡片配置（公开） |
| PUT | `/api/cards/<slug>` | 原地更新（需 `ownerKey`） |
| DELETE | `/api/cards/<slug>?key=` | 删除卡片与愿望（需 `ownerKey`） |
| GET | `/api/wishes?slug=&key=` | 查看愿望并推进已读进度（含 `views` 打开次数） |
| GET | `/api/wishes?slug=&key=&count=1` | **只取条数**，不标记已读（信箱轮询用） |
| POST | `/api/wishes` | 访客许愿（每 IP 每分钟 12 条、单卡上限 200 条） |
| DELETE | `/api/wishes/<id>?slug=&key=` | 删除单条愿望 |
| POST | `/api/wishes/read-all` | 一键已读 |
| GET | `/api/inboxes` | 列出全部信箱（仅本机，或带 `X-Admin-Key`） |

隐私相关接口（愿望、信箱列表、数据库导出）统一返回 `Cache-Control: no-store`，避免被浏览器或代理缓存。

## 安全与限额

- 管理接口需 `X-Admin-Key`，口令来自 `ADMIN_KEY` 环境变量或 `admin_key.txt`；未配置时管理接口只对本机可用。
- 自定义模板 iframe 使用 sandbox 隔离，不能读取主站数据。
- 音乐上传有单文件大小与总量配额；愿望接口有 IP 限流和单卡条数上限。
- 卡片与愿望仅存于你自己的 `cards.db`，不上传任何第三方。

## 数据、备份与排查

- 每天第一次有请求时自动在线备份数据库到 `backups/`，保留最近 7 份（SQLite 在线备份，不会复制出半截文件）。
- 未捕获异常写入 `logs/error.log`，同时向上返回 `{"error":"server_error"}`；日志超过 2MB 自动轮转为 `error.log.1`（只保留一份旧日志），长期运行不会无限增长。
- 文本响应开启 gzip；`js/css` 走 ETag + 304；图片/音频等长缓存 7 天。
- 访问不存在的页面会返回站点风格的 404（`/api/*` 仍返回 JSON）。

## 扩展模板

在 `static/templates.js` 的 `registry` 里新增一项：

```js
my_tpl: {
  id: "my_tpl", name: "我的模板", desc: "…",
  draw(ctx, cfg, t, W, H) { /* 在 ctx 上画，cfg 含 name/birthday/wish/signoff/accent */ }
}
```

后端 `ALLOWED_TEMPLATES` 白名单同步加上该 id 即可。完整页面模板走 `IFRAME_TEMPLATES`，特效走 `EFFECTS`。

## 部署到公网（GitHub + Render）

> GitHub Pages 只能托管静态文件，跑不了 Flask 接口，短链与愿望信箱都会失效。
> 这里用 GitHub 存代码、Render 拉取代码运行 Flask，得到可公网访问的完整站点。

1. 在 GitHub 新建空仓库（例如 `birthday-platform`），不要勾选初始化 README。
2. 在 `birthday-platform` 目录里初始化并推送：

```bash
git init -b main
git add -A
git commit -m "feat: 生日祝福代码平台"
git remote add origin https://github.com/<你的账号>/birthday-platform.git
git push -u origin main
```

3. Render → New → Blueprint → 选这个仓库，按仓库里的 `render.yaml` 一键创建服务。
4. 部署完访问 Render 分配的域名即可；之后每次 `git push` 都会自动重新部署。

数据持久化与注意点：

- 仓库里的 `render.yaml` 默认用**免费 plan**：能直接上线，但没有磁盘，重新部署或实例重启后 `cards.db` 会清空，卡片与愿望随之丢失（适合演示）。
- 想长期保留：把 `render.yaml` 的 `plan` 改成 `starter`（含 1GB 磁盘），并加上 `DATABASE_PATH=/var/data/cards.db` 与 `disk: {name: data, mountPath: /var/data, sizeGB: 1}`，重新部署即可。
- 也可以直接用仓库里的 `Dockerfile` 部署到 Railway / Fly.io / 自建服务器，只要把卷挂到 `/data`。
- `static/uploads/` 里上传的音乐与自定义模板属于容器内文件，重新部署会丢失（卡片与愿望不受影响）。
- `/api/inboxes` 与 `/api/db/export` 只对本机开放，公网访问会返回 403；主人查看愿望请用生成分享链接时保存的 `/inbox/<slug>#k=…`。

## 更新日志

### 2026-11-26

- 愿望信箱新增「导出」：一键把全部愿望（时间 / 署名 / 正文）导出为 TXT，方便打印留存。
- 愿望信箱列表分页：默认渲染 20 条，其余点「加载更多（还有 N 条）」，愿望多时首屏更快。
- 首页也注入分享卡片 og 标签（标题 / 描述 / 绝对地址封面），首页链接分享到微信、QQ 也有预览。
- 错误日志超过 2MB 自动轮转（`error.log.1`），避免长期运行日志无限变大。
- 首页缩略图离屏 / 后台暂停渲染，降低手机耗电与发热。
- 分享弹窗支持「下载二维码图片」（2 倍分辨率的带标题 PNG）。
- 短链新增打开次数统计（同 IP 30 分钟去重），信箱页与信箱列表显示「打开 N 次」。
- 主站移动端适配：≤720px 导航收窄可横滑、隐藏副标题，模板卡片双列，编辑器预览与弹窗高度适配；≤420px 按钮整行显示。
- 站点图标 `favicon.svg`；新增主题色、页面描述等 meta。
- 锚点跳转补偿吸顶导航高度（`scroll-margin-top`），支持平滑滚动与 `prefers-reduced-motion`。
- 观看页适配刘海屏安全区，底部提示单行省略；信箱页小屏内边距与按钮尺寸紧凑化。
- 卡片被删除后，短链不再显示默认贺卡，改为「这份祝福不在了」提示页。
- 许愿失败提示更准确：区分「链接已失效」「信箱已满」「许愿太频繁」。
- 观看页支持 Esc 关闭许愿框 / 二维码；复制链接在旧浏览器自动降级。
- 主站弹窗支持 Esc 关闭（模板库 / 愿望信箱 / 分享）。
- 新增安全响应头 `X-Content-Type-Options: nosniff`、`Referrer-Policy`；404 页不再被缓存。
- 信箱页轮询「收到 N 条新愿望」提示：只查条数、不打断阅读、不误标已读。
- 愿望信箱支持一键已读、删除信箱（连同愿望与分享链接一起失效）。
- 本地信箱记录自动清理：卡片已在别处删除时，列表标记「链接已失效」并移除，避免反复 404。
- 编辑器草稿自动保存 / 恢复（7 天），弹窗按钮窄屏自动换行。
- 隐私接口统一 `Cache-Control: no-store`；新增站点风格 404 页（`/api/*` 仍为 JSON）。
- 静态 js/css 启用 gzip 与 ETag；每日自动备份数据库；文本响应统一 gzip。

### 更早

- 分享封面 `og:image`、编辑已有卡片并原地更新、短链复用（PUT）、卡片删除。
- 安全加固：管理接口鉴权、音乐上传配额、自定义模板沙箱、限流。
- 愿望信箱 `/inbox/<slug>`、未读徽标、链接与二维码生成。
