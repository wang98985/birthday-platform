# 🎂 生日代码 · 在线生成平台

把「旋转生日蛋糕 / 星空贺卡」这类生日代码做成一个可在线定制、可分享、可私有部署的 Web 平台。

- 选模板 → 填**人名 / 生日 / 祝福语 / 落款** → 实时预览
- 一键生成**分享链接**（即时链接，无需后端）或**短链**（存入服务器，长期有效）
- 一键生成**二维码**（纯前端，运行时不依赖外网）
- 一键下载**定制好的 Python 代码**（`turtle` 版，对方本地双击即可运行）
- 自包含：后端仅依赖 `Flask` + SQLite，无外部服务；前端无构建步骤

## 目录结构

```
birthday-platform/
├─ server.py            # Flask 后端（静态托管 + 卡片存取 API + 短链）
├─ requirements.txt
├─ cards.db             # 运行后自动生成（SQLite）
├─ README.md
└─ static/
   ├─ index.html        # 主页：模板库 + 定制表单 + 实时预览
   ├─ view.html         # 全屏观看页（链接 / 二维码打开的就是它）
   ├─ styles.css
   ├─ templates.js      # Canvas 动画模板（旋转银河蛋糕 / 像素风 / 星空贺卡）
   ├─ renderer.js       # 共享：配置编解码 + 渲染（DPR / 像素化）
   ├─ app.js            # 编辑器与分享逻辑
   ├─ cake_template.py  # 下载 Python 代码用的模板源
   └─ vendor/qrcode.min.js
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

- **即时链接**：`/view#c=<base64>` —— 配置直接编码在 URL 里，不写库，立刻可用，关掉服务器也能打开（只要静态页还在）。
- **短链**：`/c/<slug>` —— 配置存入 `cards.db`，链接更短更美观，长期有效。单 IP 每 60 秒最多创建 40 次（防滥用，可在 `server.py` 调整 `RATE_MAX`）。
- **二维码**：浏览器本地生成，不调用任何外部接口。

## 扩展模板

在 `static/templates.js` 的 `registry` 里新增一项：

```js
my_tpl: {
  id: "my_tpl", name: "我的模板", desc: "…",
  draw(ctx, cfg, t, W, H) { /* 在 ctx 上画，cfg 含 name/birthday/wish/signoff/accent */ }
}
```

后端 `ALLOWED_TEMPLATES` 白名单同步加上该 id 即可。

## 数据与隐私

所有卡片配置只存在你自己服务器的 `cards.db`（SQLite）里，不上传任何第三方。即时链接的配置在用户自己的浏览器 URL 中。

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

- `render.yaml` 已把 `DATABASE_PATH` 设为 `/var/data/cards.db` 并挂 1GB 磁盘（starter 套餐）。免费 plan 不支持磁盘，重新部署会清空卡片与愿望。
- 也可以直接用仓库里的 `Dockerfile` 部署到 Railway / Fly.io / 自建服务器，只要把卷挂到 `/data`。
- `static/uploads/` 里上传的音乐与自定义模板属于容器内文件，重新部署会丢失（卡片与愿望不受影响）。
- `/api/inboxes` 与 `/api/db/export` 只对本机开放，公网访问会返回 403；主人查看愿望请用生分享链接时保存的 `/inbox/<slug>#k=…`。

