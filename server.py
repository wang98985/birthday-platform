# -*- coding: utf-8 -*-
"""
生日代码 · 在线生成平台 —— 后端
纯 Flask + SQLite，零外部服务依赖，可直接部署到任意服务器。

运行：  python server.py
端口：  默认 5000，可通过环境变量 PORT 覆盖
依赖：  pip install flask
"""
import os
import json
import time
import shutil
import base64
import html as html_mod
import random
import secrets
import hmac
import string
import sqlite3
import traceback
from threading import Lock

from flask import (
    Flask, request, jsonify, send_from_directory, send_file, abort, Response
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
# 数据文件位置：本地默认在项目目录；云上通过 DATABASE_PATH 指向持久磁盘
DB_PATH = os.environ.get("DATABASE_PATH") or os.path.join(BASE_DIR, "cards.db")
DB_BACKUP_DIR = os.path.join(os.path.dirname(DB_PATH), "backups")
BACKUP_KEEP = 7
UPLOAD_MUSIC_DIR = os.path.join(STATIC_DIR, "uploads", "music")
LOG_DIR = os.path.join(BASE_DIR, "logs")


def _load_admin_key():
    """管理口令：优先环境变量 ADMIN_KEY，其次项目根目录 admin_key.txt（已被 .gitignore 忽略）。"""
    key = os.environ.get("ADMIN_KEY", "").strip()
    if key:
        return key
    try:
        with open(os.path.join(BASE_DIR, "admin_key.txt"), "r", encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


ADMIN_KEY = _load_admin_key()

SLUG_CHARS = string.ascii_letters + string.digits
SLUG_LEN = 6

# 允许的模板 id（白名单，防滥用）
ALLOWED_TEMPLATES = {
    "galaxy", "starry", "pixel",            # 已有 Canvas 模板
    "heart", "fireworks", "confetti",       # 新增 Canvas 模板
    # 高级炫酷 Canvas 模板（templates-extra.js）
    "warp", "aurora", "neon", "particlecake", "heartstorm",
    "bokeh", "ribbon", "candle", "matrixcode", "vortex",
    "hb-story", "snow-heart",               # romance-main iframe 模板
    "starwish",                              # 1.html 星河许愿完整流程
    "hbcake",                                # 星河便签开场 + 3D 蛋糕 + 信
}

# iframe 模板 → 实际 HTML 路径（相对 static/）
IFRAME_TEMPLATES = {
    "hb-story": {
        "html": "templates/hb/index3.html",
        "base": "/templates/hb/",
        "config": "templates/hb/config.json",
    },
    "snow-heart": {
        "html": "templates/snow/index.html",
        "base": None,
        "config": None,
    },
    "starwish": {
        "html": "templates/starwish/index.html",
        "base": None,
        "config": None,
    },
    "hbcake": {
        "html": "templates/hbcake/index.html",
        "base": None,
        "config": None,
        "builder": "hbcake",
    },
}

# 特效库（来自 https://github.com/rover95/effect）
# id → 静态文件（相对 static/vendor/effects/）+ 展示信息
EFFECTS = {
    "game2048":        {"file": "game2048.html",        "name": "3D 版 2048", "desc": "Three.js 立体 2048，方向键可玩"},
    "fallingtime":     {"file": "fallingtime.html",     "name": "下落时间",   "desc": "数字与光点下坠，时间流逝感"},
    "loader":          {"file": "loader.html",          "name": "加载圈",     "desc": "极简旋转加载动画，利落干净"},
    "crtscreen":       {"file": "crtscreen.html",       "name": "复古屏幕",   "desc": "CRT 扫描线与色差，复古电视质感"},
    "charmatrix":      {"file": "charmatrix.html",      "name": "字符矩阵",   "desc": "字符流涌动，赛博代码感"},
    "colortext":       {"file": "colortext.html",       "name": "彩色文字",   "desc": "彩色粒子描出流动字形"},
    "glitchword":      {"file": "glitchword.html",      "name": "故障词",     "desc": "故障艺术文字抖动闪烁"},
    "swirl":           {"file": "swirl.html",           "name": "旋涡",       "desc": "彩色粒子旋涡，视觉冲击强"},
    "starfield":       {"file": "starfield.html",       "name": "星空",       "desc": "深空星海缓缓流动"},
    "gradientwave":    {"file": "gradientwave.html",    "name": "渐变波浪",   "desc": "渐变波浪起伏，柔和呼吸感"},
    "swim":            {"file": "swim.html",            "name": "游动",       "desc": "流体般游动的彩色轨迹"},
    "fireball":        {"file": "fireball.html",        "name": "火球射击",   "desc": "火球射出爆炸，力量感十足"},
    "oillight":        {"file": "oillight.html",        "name": "炫彩油光",   "desc": "油膜虹彩流动，高级质感"},
    "fireworks":       {"file": "fireworks.html",       "name": "烟花",       "desc": "点击放烟花，夜空绽放"},
    "fireworkshooter": {"file": "fireworkshooter.html", "name": "烟花射击",   "desc": "自动升空连放，烟花秀不停"},
    "smoke":           {"file": "smoke.html",           "name": "烟雾",       "desc": "Three.js 体积烟雾与光字"},
    "effectbtn":       {"file": "effectbtn.html",       "name": "特效按钮",   "desc": "光效按钮，互动感强"},
    "particles":       {"file": "particles.html",       "name": "粒子",       "desc": "轻盈粒子漂浮聚散"},
    "particlematrix":  {"file": "particlematrix.html",  "name": "粒子矩阵",   "desc": "粒子矩阵排列与重组"},
    "particlemotion":  {"file": "particlemotion.html",  "name": "粒子运动",   "desc": "粒子轨迹运动，动感流畅"},
    "mazering":        {"file": "mazering.html",        "name": "迷宫环绕",   "desc": "线条迷宫环绕旋转"},
    "randomparticles": {"file": "randomparticles.html", "name": "随机粒子",   "desc": "随机粒子碰撞与连接"},
    "monochrome":      {"file": "monochrome.html",      "name": "黑白旋转",   "desc": "黑白几何旋转，极简艺术"},
    # 星河蛋糕模板内置特效（复用 3D 蛋糕场景）
    "cake-galaxy":     {"file": "cake-galaxy.html",     "name": "星河漫游",   "desc": "3D 蛋糕 + 环绕星河"},
    "cake-snow":       {"file": "cake-snow.html",       "name": "落雪蛋糕",   "desc": "3D 蛋糕 + 细雪飘落"},
    "cake-meteor":     {"file": "cake-meteor.html",     "name": "流星许愿",   "desc": "3D 蛋糕 + 流星雨划过"},
    "cake-halo":       {"file": "cake-halo.html",       "name": "奇幻光环",   "desc": "3D 蛋糕 + 光环旋绕"},
}

# 音乐上传限制
MUSIC_EXTS = {".mp3", ".wav", ".m4a", ".ogg", ".aac"}
MUSIC_MAX_BYTES = 15 * 1024 * 1024  # 单文件 15MB
MUSIC_QUOTA_FILES = 100             # 全站最多保留 100 个音乐文件
MUSIC_QUOTA_BYTES = 150 * 1024 * 1024  # 全站音乐总量 150MB

# ---------------- 自定义模板存储 ----------------
TEMPLATES_STORE = os.path.join(BASE_DIR, "templates_store.json")
UPLOAD_TPL_DIR = os.path.join(STATIC_DIR, "uploads", "templates")
_tpl_lock = Lock()
TPL_MAX = 50                       # 自定义模板上限
TPL_HTML_MAX = 2 * 1024 * 1024     # 单文件 HTML 上限 2MB
# 可作为 Canvas 变体基础的内置动画模板
CANVAS_BASES = {
    "galaxy", "pixel", "starry", "heart", "fireworks", "confetti",
    "warp", "aurora", "neon", "particlecake", "heartstorm",
    "bokeh", "ribbon", "candle", "matrixcode", "vortex",
}


def load_tpl_store():
    """读取模板存储：{custom: [...], hidden: [内置模板 id...]}"""
    with _tpl_lock:
        try:
            with open(TEMPLATES_STORE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError("bad store")
            if not isinstance(data.get("custom"), list):
                data["custom"] = []
            if not isinstance(data.get("hidden"), list):
                data["hidden"] = []
            return data
        except (OSError, ValueError):
            return {"custom": [], "hidden": []}


def save_tpl_store(data):
    tmp = TEMPLATES_STORE + ".tmp"
    with _tpl_lock:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, TEMPLATES_STORE)


def allowed_template_ids():
    """白名单 = 内置 + 自定义 + 已隐藏的内置（保证老卡片仍可打开）"""
    ids = set(ALLOWED_TEMPLATES)
    store = load_tpl_store()
    for t in store["custom"]:
        if t.get("id"):
            ids.add(t["id"])
    ids.update(h for h in store["hidden"] if isinstance(h, str))
    return ids

# 字段长度上限
LIMITS = {
    "name": 30,
    "birthday": 16,
    "wish": 300,
    "signoff": 40,
    "accent": 16,
    "letter": 1000,
    "notes": 600,
}

app = Flask(__name__, static_folder=None)  # 手动控制静态路由
# 上传音乐上限 15MB，这里留出 multipart 余量，避免超大请求占满内存
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024
_db_lock = Lock()

# 简易内存级 IP 限流：{ip: [timestamps]}
_rate = {}
_rate_lock = Lock()
RATE_WINDOW = 60       # 秒
RATE_MAX = 40          # 每窗口最多创建次数


# ---------------- DB ----------------
def get_db():
    # timeout：并发写入时等锁，避免直接抛 database is locked
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def backup_db():
    """启动时按天备份 cards.db：换机器、误删时都还能找回（保留最近 7 份）。"""
    if not os.path.isfile(DB_PATH):
        return None
    try:
        os.makedirs(DB_BACKUP_DIR, exist_ok=True)
        dst = os.path.join(DB_BACKUP_DIR, "cards-" + time.strftime("%Y%m%d") + ".db")
        if not os.path.exists(dst):
            shutil.copy2(DB_PATH, dst)
        files = sorted(f for f in os.listdir(DB_BACKUP_DIR)
                       if f.startswith("cards-") and f.endswith(".db"))
        for old in files[:-BACKUP_KEEP]:
            try:
                os.remove(os.path.join(DB_BACKUP_DIR, old))
            except OSError:
                pass
        return dst
    except OSError:
        return None


def init_db():
    db_dir = os.path.dirname(os.path.abspath(DB_PATH))
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    os.makedirs(UPLOAD_MUSIC_DIR, exist_ok=True)
    os.makedirs(UPLOAD_TPL_DIR, exist_ok=True)
    backup_db()
    with _db_lock:
        conn = get_db()
        conn.execute(
            "CREATE TABLE IF NOT EXISTS cards ("
            "  slug TEXT PRIMARY KEY,"
            "  config TEXT NOT NULL,"
            "  created_at INTEGER NOT NULL"
            ")"
        )
        # 老库补列：愿望信箱的主人凭证 / 已读进度
        cols = [r[1] for r in conn.execute("PRAGMA table_info(cards)").fetchall()]
        if "owner_key" not in cols:
            conn.execute("ALTER TABLE cards ADD COLUMN owner_key TEXT")
        if "last_read_id" not in cols:
            conn.execute("ALTER TABLE cards ADD COLUMN last_read_id INTEGER DEFAULT 0")
        conn.execute(
            "CREATE TABLE IF NOT EXISTS wishes ("
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "  slug TEXT NOT NULL,"
            "  content TEXT NOT NULL,"
            "  created_at INTEGER NOT NULL"
            ")"
        )
        # 老库补列：许愿人署名
        wcols = [r[1] for r in conn.execute("PRAGMA table_info(wishes)").fetchall()]
        if "sender" not in wcols:
            conn.execute("ALTER TABLE wishes ADD COLUMN sender TEXT")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_wishes_slug ON wishes(slug)")
        # 元信息表：记录 schema 版本，后续加字段/迁移时据此判断
        conn.execute("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)")
        conn.execute("INSERT OR IGNORE INTO meta(k, v) VALUES('schema_version', '2')")
        # WAL：读写并发更好，静态资源与 API 同时访问时不易互相阻塞
        try:
            conn.execute("PRAGMA journal_mode=WAL")
        except sqlite3.DatabaseError:
            pass
        # 本次功能上线前生成的短链没有主人凭证：自动补发，并在控制台给出信箱链接
        legacy = conn.execute(
            "SELECT slug FROM cards WHERE owner_key IS NULL OR owner_key=''"
        ).fetchall()
        for r in legacy:
            k = gen_owner_key()
            conn.execute("UPDATE cards SET owner_key=? WHERE slug=?", (k, r["slug"]))
            print("[inbox] 已补发凭证 /inbox/%s#k=%s" % (r["slug"], k))
        conn.commit()
        conn.close()


def gen_slug():
    return "".join(random.choices(SLUG_CHARS, k=SLUG_LEN))


def log_error(text):
    """把未捕获异常写入 logs/error.log，便于线上排查（写失败不影响请求）。"""
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        with open(os.path.join(LOG_DIR, "error.log"), "a", encoding="utf-8") as f:
            f.write("[%s] %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), text))
    except OSError:
        pass


@app.errorhandler(Exception)
def handle_uncaught(exc):
    from werkzeug.exceptions import HTTPException
    if isinstance(exc, HTTPException):
        return exc
    log_error(traceback.format_exc())
    return jsonify({"error": "server_error"}), 500


def gen_owner_key():
    return secrets.token_urlsafe(18)


def valid_slug(slug):
    return isinstance(slug, str) and 4 <= len(slug) <= 12 and all(c in SLUG_CHARS for c in slug)


# ---------------- 限流 ----------------
def rate_ok(ip):
    return _bucket_ok(ip, RATE_MAX)


WISH_RATE_MAX = 12      # 每 IP 每分钟最多许愿次数
WISH_MAX_PER_CARD = 200  # 单张卡片最多收纳的愿望数


def wish_rate_ok(ip):
    """许愿接口单独限流，避免刷屏。"""
    return _bucket_ok("wish:" + ip, WISH_RATE_MAX)


def _bucket_ok(key, limit):
    now = time.time()
    with _rate_lock:
        # 定期清理过期 IP，避免长期运行后字典无限增长
        if len(_rate) > 4000:
            stale = [k for k, ts in _rate.items()
                     if not ts or now - ts[-1] >= RATE_WINDOW]
            for k in stale:
                _rate.pop(k, None)
        bucket = [t for t in _rate.get(key, []) if now - t < RATE_WINDOW]
        if len(bucket) >= limit:
            _rate[key] = bucket
            return False
        bucket.append(now)
        _rate[key] = bucket
        return True


def _safe_str(val, limit):
    if not isinstance(val, str):
        val = "" if val is None else str(val)
    return val[:limit]


def sanitize_music(raw):
    """校验并清洗音乐配置：{enabled, source, trackId, url, volume}"""
    if not isinstance(raw, dict):
        raw = {}
    out = {}
    out["enabled"] = bool(raw.get("enabled", False))
    source = str(raw.get("source", "none"))
    if source not in ("none", "builtin", "upload", "synth"):
        source = "none"
    out["source"] = source
    out["trackId"] = _safe_str(raw.get("trackId", ""), 32)
    url = _safe_str(raw.get("url", ""), 256)
    # 只允许站内相对路径或同源上传，防外链注入
    if url and not (url.startswith("/") or url.startswith("uploads/")):
        url = ""
    out["url"] = url
    try:
        vol = float(raw.get("volume", 0.6))
    except (TypeError, ValueError):
        vol = 0.6
    out["volume"] = max(0.0, min(1.0, vol))
    return out


# ---------------- 校验 ----------------
def sanitize_config(raw):
    if not isinstance(raw, dict):
        abort(400, "config must be an object")
    cfg = {}
    template = str(raw.get("template", "galaxy"))
    if template not in allowed_template_ids():
        template = "galaxy"
    cfg["template"] = template
    for key, limit in LIMITS.items():
        cfg[key] = _safe_str(raw.get(key, ""), limit)
    cfg["pixel"] = bool(raw.get("pixel", False))
    cfg["music"] = sanitize_music(raw.get("music"))
    return cfg


# ---------------- 静态 HTML 缓存 ----------------
_html_cache = {}
_html_cache_lock = Lock()


def read_html_cached(path):
    """进程内缓存静态 HTML（按 mtime 失效），避免大模板每次请求都读盘。"""
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None
    with _html_cache_lock:
        item = _html_cache.get(path)
        if item and item[0] == mtime:
            return item[1]
    try:
        with open(path, "r", encoding="utf-8") as f:
            html = f.read()
    except OSError:
        return None
    with _html_cache_lock:
        _html_cache[path] = (mtime, html)
    return html


# ---------------- 路由 ----------------
@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/view")
def view_page():
    return send_from_directory(STATIC_DIR, "view.html")


@app.route("/c/<slug>")
def card_short(slug):
    # 短链入口：服务端注入 og 信息（微信/QQ 等分享卡片有标题和描述），页面仍由前端拉取配置
    page = read_html_cached(os.path.join(STATIC_DIR, "view.html"))
    if not page:
        return send_from_directory(STATIC_DIR, "view.html")
    if not valid_slug(slug):
        return Response(page, mimetype="text/html; charset=utf-8")
    conn = get_db()
    row = conn.execute("SELECT config FROM cards WHERE slug=?", (slug,)).fetchone()
    conn.close()
    if not row:
        return Response(page, mimetype="text/html; charset=utf-8")
    try:
        cfg = json.loads(row["config"]) or {}
    except (ValueError, TypeError):
        cfg = {}
    name = str(cfg.get("name") or "").strip()
    title = (name + "，生日快乐") if name else "生日快乐"
    desc = " ".join(str(cfg.get("wish") or "").split())[:90] or "一份藏在代码里的生日祝福，点开看看"
    tags = (
        '<meta property="og:title" content="%s" />'
        '<meta property="og:description" content="%s" />'
        '<meta property="og:type" content="website" />'
        '<meta property="og:url" content="%s" />'
        '<meta name="description" content="%s" />'
    ) % (
        html_mod.escape(title), html_mod.escape(desc),
        html_mod.escape(request.url), html_mod.escape(desc),
    )
    page = page.replace("<title>生日快乐</title>",
                        "<title>%s</title>" % html_mod.escape(title), 1)
    return Response(inject_head(page, tags), mimetype="text/html; charset=utf-8")


@app.route("/api/health")
def health():
    return jsonify({"ok": True, "time": int(time.time())})


@app.route("/api/cards", methods=["POST"])
def create_card():
    ip = _client_ip()
    if not rate_ok(ip):
        return jsonify({"error": "rate_limited",
                        "retry_after": RATE_WINDOW}), 429
    raw = request.get_json(silent=True) or {}
    cfg = sanitize_config(raw)
    slug = gen_slug()
    owner_key = gen_owner_key()
    created = int(time.time())
    with _db_lock:
        conn = get_db()
        # 极小概率 slug 冲突，重试
        for _ in range(5):
            try:
                conn.execute(
                    "INSERT INTO cards(slug, config, created_at, owner_key) VALUES(?,?,?,?)",
                    (slug, json.dumps(cfg, ensure_ascii=False), created, owner_key),
                )
                conn.commit()
                break
            except sqlite3.IntegrityError:
                slug = gen_slug()
        conn.close()
    base = request.host_url.rstrip("/")
    return jsonify({
        "slug": slug,
        "url": f"{base}/c/{slug}",
        "ownerKey": owner_key,
        "inboxUrl": f"{base}/inbox/{slug}#k={owner_key}",
        "config": cfg,
    }), 201


@app.route("/api/cards/<slug>")
def get_card(slug):
    if not valid_slug(slug):
        abort(404)
    conn = get_db()
    row = conn.execute(
        "SELECT config FROM cards WHERE slug=?", (slug,)
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not_found"}), 404
    return Response(row["config"], mimetype="application/json")


@app.route("/api/cards/<slug>", methods=["PUT"])
def update_card(slug):
    """更新已有短链的配置（需主人凭证），避免每次分享都新建一个链接。"""
    if not valid_slug(slug):
        abort(404)
    raw = request.get_json(silent=True) or {}
    key = str(raw.get("ownerKey") or request.headers.get("X-Owner-Key") or "")
    body = raw.get("config") if isinstance(raw.get("config"), dict) else raw
    cfg = sanitize_config(body)
    with _db_lock:
        conn = get_db()
        row = conn.execute("SELECT owner_key FROM cards WHERE slug=?", (slug,)).fetchone()
        if not row:
            conn.close()
            return jsonify({"error": "not_found"}), 404
        if not _owner_ok(row["owner_key"], key):
            conn.close()
            return jsonify({"error": "forbidden"}), 403
        owner = row["owner_key"]
        conn.execute("UPDATE cards SET config=? WHERE slug=?",
                     (json.dumps(cfg, ensure_ascii=False), slug))
        conn.commit()
        conn.close()
    base = request.host_url.rstrip("/")
    return jsonify({
        "slug": slug,
        "url": f"{base}/c/{slug}",
        "ownerKey": owner,
        "inboxUrl": f"{base}/inbox/{slug}#k={owner}",
        "config": cfg,
    })


@app.route("/api/cards/<slug>", methods=["DELETE"])
def delete_card(slug):
    """删除卡片（需主人凭证）：链接失效，收到的愿望一并清除。"""
    if not valid_slug(slug):
        abort(404)
    key = request.args.get("key") or request.headers.get("X-Owner-Key") or ""
    with _db_lock:
        conn = get_db()
        row = conn.execute("SELECT owner_key FROM cards WHERE slug=?", (slug,)).fetchone()
        if not row:
            conn.close()
            return jsonify({"error": "not_found"}), 404
        if not _owner_ok(row["owner_key"], key):
            conn.close()
            return jsonify({"error": "forbidden"}), 403
        conn.execute("DELETE FROM wishes WHERE slug=?", (slug,))
        conn.execute("DELETE FROM cards WHERE slug=?", (slug,))
        conn.commit()
        conn.close()
    return jsonify({"ok": True})


@app.route("/inbox/<slug>")
def inbox_page(slug):
    # 主人专属信箱页面，凭证在 URL hash 里（#k=...），不会出现在服务端日志
    return send_from_directory(STATIC_DIR, "inbox.html")


def _is_loopback(ip):
    return ip in ("127.0.0.1", "::1", "localhost")


def _client_ip():
    """真实客户端 IP。

    只有直连来自本机反代（remote_addr 为回环地址）时才参考
    X-Forwarded-For；否则一律使用 remote_addr。避免公网访客自带该头
    冒充本机、绕过限流。
    """
    remote = request.remote_addr or "unknown"
    if _is_loopback(remote):
        xff = request.headers.get("X-Forwarded-For", "")
        if xff:
            return xff.split(",")[0].strip() or remote
    return remote


@app.route("/api/wishes", methods=["POST"])
def add_wish():
    """访客许愿：只能提交，不能查看别人写了什么。"""
    if not wish_rate_ok(_client_ip()):
        return jsonify({"error": "rate_limited", "retry_after": RATE_WINDOW}), 429
    raw = request.get_json(silent=True) or {}
    slug = str(raw.get("slug", ""))
    if not valid_slug(slug):
        return jsonify({"error": "bad_slug"}), 400
    content = _safe_str(raw.get("content", ""), 200).strip()
    if not content:
        return jsonify({"error": "empty"}), 400
    sender = _safe_str(raw.get("sender", ""), 20).strip()
    with _db_lock:
        conn = get_db()
        if not conn.execute("SELECT 1 FROM cards WHERE slug=?", (slug,)).fetchone():
            conn.close()
            return jsonify({"error": "not_found"}), 404
        cnt = conn.execute("SELECT COUNT(*) AS c FROM wishes WHERE slug=?",
                           (slug,)).fetchone()["c"]
        if cnt >= WISH_MAX_PER_CARD:
            conn.close()
            return jsonify({"error": "full"}), 429
        conn.execute("INSERT INTO wishes(slug, content, sender, created_at) VALUES(?,?,?,?)",
                     (slug, content, sender, int(time.time())))
        conn.commit()
        conn.close()
    return jsonify({"ok": True, "count": cnt + 1}), 201


@app.route("/api/wishes")
def list_wishes():
    """主人查看愿望：必须同时提供 slug 与 owner key。

    count=1 只返回条数与未读数（不标记已读），用于信箱列表轮询；
    不带 count 时返回完整列表，并把已读进度推进到最新一条。
    """
    slug = request.args.get("slug", "")
    key = request.args.get("key", "")
    count_only = request.args.get("count") == "1"
    if not valid_slug(slug):
        return jsonify({"error": "bad_slug"}), 400
    with _db_lock:
        conn = get_db()
        row = conn.execute("SELECT config, owner_key, last_read_id FROM cards WHERE slug=?",
                           (slug,)).fetchone()
        if not row:
            conn.close()
            return jsonify({"error": "not_found"}), 404
        if not row["owner_key"] or not hmac.compare_digest(str(row["owner_key"]), str(key)):
            conn.close()
            return jsonify({"error": "forbidden"}), 403
        last_read = row["last_read_id"] or 0
        total = conn.execute("SELECT COUNT(*) AS c FROM wishes WHERE slug=?",
                             (slug,)).fetchone()["c"]
        unread = conn.execute("SELECT COUNT(*) AS c FROM wishes WHERE slug=? AND id>?",
                              (slug, last_read)).fetchone()["c"]
        if count_only:
            conn.close()
            return jsonify({"slug": slug, "count": total, "unread": unread})
        rows = conn.execute(
            "SELECT id, content, sender, created_at FROM wishes WHERE slug=? ORDER BY id DESC",
            (slug,)
        ).fetchall()
        max_id = rows[0]["id"] if rows else last_read
        conn.execute("UPDATE cards SET last_read_id=? WHERE slug=?", (max_id, slug))
        conn.commit()
        conn.close()
    name = ""
    try:
        name = (json.loads(row["config"]) or {}).get("name", "")
    except (ValueError, TypeError):
        pass
    return jsonify({
        "slug": slug,
        "name": name,
        "count": len(rows),
        "unread": unread,
        "lastReadId": last_read,
        "wishes": [{"id": r["id"], "content": r["content"], "sender": r["sender"] or "",
                    "createdAt": r["created_at"]}
                   for r in rows],
    })


@app.route("/api/wishes/<int:wid>", methods=["DELETE"])
def delete_wish(wid):
    """主人删除单条愿望：需 slug + 主人凭证。"""
    slug = request.args.get("slug", "")
    key = request.args.get("key", "")
    if not valid_slug(slug):
        return jsonify({"error": "bad_slug"}), 400
    with _db_lock:
        conn = get_db()
        row = conn.execute("SELECT owner_key FROM cards WHERE slug=?", (slug,)).fetchone()
        if not row:
            conn.close()
            return jsonify({"error": "not_found"}), 404
        if not _owner_ok(row["owner_key"], key):
            conn.close()
            return jsonify({"error": "forbidden"}), 403
        conn.execute("DELETE FROM wishes WHERE id=? AND slug=?", (wid, slug))
        conn.commit()
        conn.close()
    return jsonify({"ok": True})


def _is_local():
    """请求是否来自本机（主人自己开的浏览器）。

    不能只看 X-Forwarded-For——公网请求同样可以自带该头。必须保证
    remote_addr 本身就是回环地址，且代理链首跳也不是外部 IP。
    """
    remote = request.remote_addr or ""
    if not _is_loopback(remote):
        return False
    xff = request.headers.get("X-Forwarded-For", "")
    if not xff:
        return True
    return _is_loopback(xff.split(",")[0].strip())


def _key_matches(supplied):
    if not supplied:
        return False
    try:
        return hmac.compare_digest(str(supplied), ADMIN_KEY)
    except TypeError:
        return False


def admin_blocked():
    """管理操作鉴权。

    未配置 ADMIN_KEY：保持老行为，仅本机可操作；
    配置后：必须带 X-Admin-Key 头（或 ?key= 参数）。
    返回 None 表示放行，否则返回错误响应。
    """
    if not ADMIN_KEY:
        if _is_local():
            return None
        return jsonify({"error": "admin_disabled"}), 403
    supplied = request.headers.get("X-Admin-Key") or request.args.get("key", "")
    if _key_matches(supplied):
        return None
    return jsonify({"error": "admin_required"}), 401


def _owner_ok(stored, supplied):
    """卡片主人凭证校验（恒定时间比较）。"""
    if not stored or not supplied:
        return False
    try:
        return hmac.compare_digest(str(stored), str(supplied))
    except TypeError:
        return False


@app.route("/api/inboxes")
def list_inboxes():
    """管理接口：列出全部信箱（含本次升级前旧短链补发的凭证），便于找回。"""
    denied = admin_blocked()
    if denied:
        return denied
    with _db_lock:
        conn = get_db()
        # 一条 SQL 取齐：避免对每张卡单独查两次愿望数（N+1）
        rows = conn.execute(
            "SELECT c.slug, c.config, c.owner_key, c.last_read_id,"
            " (SELECT COUNT(*) FROM wishes w WHERE w.slug=c.slug) AS cnt,"
            " (SELECT COUNT(*) FROM wishes w WHERE w.slug=c.slug AND w.id > COALESCE(c.last_read_id,0)) AS unread"
            " FROM cards c WHERE c.owner_key IS NOT NULL AND c.owner_key != ''"
            " ORDER BY c.created_at DESC"
        ).fetchall()
        out = []
        base = request.host_url.rstrip("/")
        for r in rows:
            name = ""
            try:
                name = (json.loads(r["config"]) or {}).get("name", "")
            except (ValueError, TypeError):
                pass
            out.append({
                "slug": r["slug"],
                "name": name,
                "url": "%s/c/%s" % (base, r["slug"]),
                "inboxUrl": "%s/inbox/%s#k=%s" % (base, r["slug"], r["owner_key"]),
                "count": r["cnt"],
                "unread": r["unread"],
            })
        conn.close()
    return jsonify({"inboxes": out})


@app.route("/api/db/export")
def export_db():
    """管理接口：下载整个 cards.db，换机器时跟项目一起带走即可。"""
    denied = admin_blocked()
    if denied:
        return denied
    if not os.path.isfile(DB_PATH):
        abort(404)
    return send_file(DB_PATH, as_attachment=True, download_name="cards.db")


# ---------------- iframe 模板嵌入 ----------------
def b64url_decode(s):
    s = (s or "").replace("-", "+").replace("_", "/")
    s += "=" * (-len(s) % 4)
    try:
        return base64.b64decode(s)
    except Exception:
        return b""


def load_default_hb():
    path = os.path.join(STATIC_DIR, "templates", "hb", "config.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def merge_hb_config(platform_cfg, default_cfg):
    """平台字段 → hb 模板 config.json 字段映射。"""
    merged = dict(default_cfg or {})
    name = (platform_cfg.get("name") or "").strip() or merged.get("name", "")
    if name:
        merged["name"] = name
        merged["wishHeading"] = "祝愿" + name + "："
    if platform_cfg.get("wish"):
        merged["wishText"] = platform_cfg["wish"]
    if platform_cfg.get("signoff"):
        merged["outroText"] = platform_cfg["signoff"]
    # 强制过去日期，避免 index3.js 跳转到倒计时页
    merged["date"] = "2000-01-01 00:00:00"
    merged["expressUrl"] = ""
    return merged


# hb-story 视觉增强：动态星空/极光背景 + 深色底下的浅色文字与发光按钮
HB_ENHANCE = """<style>
html,body{margin:0;background:radial-gradient(120% 90% at 50% 12%,#241a52 0%,#12102c 45%,#05060f 100%) !important;color:#eef6ff !important;}
#hb-bg{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;}
.container{position:relative;z-index:1;}
.container p,.container h1,.container h3,.container h5,.container span,.container strong{color:#eef6ff !important;text-shadow:0 0 16px rgba(120,190,255,.30);}
.idea-3 strong{background:linear-gradient(90deg,#5b7cff,#a35bff) !important;color:#fff !important;border-radius:6px;}
.fake-btn{background:linear-gradient(90deg,#2bd6a5,#1aa6ff) !important;color:#fff !important;}
.six img{border-radius:50%;box-shadow:0 0 46px rgba(255,170,220,.45);}
.wish-hbd{color:#ffe9a8 !important;text-shadow:0 0 26px rgba(255,200,120,.6) !important;}
.nine p{color:#ffd9ec !important;letter-spacing:1px;text-shadow:0 0 22px rgba(255,140,200,.65),0 0 48px rgba(120,170,255,.4) !important;}
.last-smile{color:#ffe9a8 !important;font-size:2.8rem !important;text-shadow:0 0 26px rgba(255,210,130,.85) !important;}
#replay{color:#fff !important;letter-spacing:1px;font-weight:600;box-shadow:0 0 26px rgba(120,120,255,.55),0 0 64px rgba(240,80,200,.4);animation:animate 8s linear infinite;}
#replay:hover{box-shadow:0 0 40px rgba(160,140,255,.9),0 0 96px rgba(255,80,200,.65);}
</style>
<script>(function(){
  function rr(i,s){var x=Math.sin(i*127.1+s*311.7)*43758.5453;return x-Math.floor(x);}
  function boot(){
    var c=document.createElement('canvas');c.id='hb-bg';
    document.body.insertBefore(c,document.body.firstChild);
    var ctx=c.getContext('2d'),W=0,H=0,stars=[],flakes=[];
    function resize(){
      var dpr=Math.min(window.devicePixelRatio||1,2);
      W=c.clientWidth||window.innerWidth;H=c.clientHeight||window.innerHeight;
      c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      stars=[];
      var n=Math.round(Math.max(90,Math.min(230,W*H/8000)));
      for(var i=0;i<n;i++){stars.push({x:rr(i,1)*W,y:rr(i,2)*H,r:0.5+rr(i,3)*1.8,p:rr(i,4)*6.283,s:1.2+rr(i,5)*2.2,c:rr(i,6)});}
      flakes=[];
      for(var j=0;j<70;j++){flakes.push({x:rr(j,11)*W,y:rr(j,12)*H,r:0.8+rr(j,13)*2.1,sp:16+rr(j,14)*42,ph:rr(j,15)*6.283});}
    }
    function frame(ts){
      var t=ts/1000;
      var g=ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#0a0d24');g.addColorStop(0.6,'#120f2e');g.addColorStop(1,'#1b0f2b');
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      for(var i=0;i<stars.length;i++){
        var st=stars[i],b=0.25+0.75*Math.abs(Math.sin(t*st.s+st.p));
        ctx.globalAlpha=b;
        ctx.fillStyle=st.c<0.5?'#ffffff':(st.c<0.8?'#ffe9a8':'#a8d8ff');
        ctx.beginPath();ctx.arc(st.x,st.y,st.r*(0.7+0.5*b),0,6.283);ctx.fill();
      }
      ctx.globalAlpha=1;
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
      var bands=[[0.22,'rgba(80,255,200,0.10)','rgba(60,255,190,0.5)',0.055,0.5,0],
                 [0.30,'rgba(110,180,255,0.09)','rgba(90,170,255,0.45)',0.045,0.35,2],
                 [0.38,'rgba(200,130,255,0.08)','rgba(190,120,255,0.4)',0.038,0.62,4]];
      for(var bi=0;bi<bands.length;bi++){
        var bd=bands[bi];ctx.beginPath();
        for(var x=-20;x<=W+20;x+=W/34){
          var yy=H*bd[0]+Math.sin((x/W)*6.2+t*bd[4]+bd[5])*H*0.05+Math.sin((x/W)*13-t*0.9+bd[5]*2)*H*0.018;
          if(x<=-19)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);
        }
        ctx.strokeStyle=bd[1];ctx.lineWidth=H*bd[3];ctx.shadowColor=bd[2];ctx.shadowBlur=46;ctx.stroke();
      }
      ctx.restore();
      for(var k=0;k<flakes.length;k++){
        var f=flakes[k];
        var fx=(f.x+Math.sin(t*0.6+f.ph)*24+W)%W;
        var fy=(f.y+t*f.sp)%H;
        ctx.globalAlpha=0.3+0.45*Math.abs(Math.sin(t*0.8+f.ph));
        ctx.fillStyle='#e8f6ff';ctx.beginPath();ctx.arc(fx,fy,f.r,0,6.283);ctx.fill();
      }
      ctx.globalAlpha=1;
      var sp=(t*0.11)%1;
      if(sp<0.5){
        var sx=W*(0.1+sp*0.95),sy=H*(0.08+sp*0.3);
        var lg=ctx.createLinearGradient(sx,sy,sx-W*0.14,sy-H*0.07);
        lg.addColorStop(0,'rgba(255,255,255,0.9)');lg.addColorStop(1,'rgba(255,255,255,0)');
        ctx.strokeStyle=lg;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx-W*0.14,sy-H*0.07);ctx.stroke();
      }
      requestAnimationFrame(frame);
    }
    window.addEventListener('resize',resize);
    resize();requestAnimationFrame(frame);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();</script>
"""


def json_for_script(obj):
    """序列化后注入 <script>：转义 </ 防止配置里的内容提前闭合标签（XSS）。"""
    return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")


def build_shim(template_name, platform_cfg, merged_cfg):
    """注入到 iframe <head> 的垫片脚本：
       - 暴露 window.__CFG__ 给模板 fetch('config.json')
       - 静默模板内所有 <audio>，避免与平台音乐叠音
       - 覆盖标题 / snow 模板的中心标题
    """
    cfg_json = json_for_script(merged_cfg if merged_cfg else platform_cfg)
    title = ((platform_cfg.get("name") or "").strip() + "，生日快乐") or "生日快乐"
    title_json = json_for_script(title)
    is_snow = "true" if template_name == "snow-heart" else "false"
    snow_title = (platform_cfg.get("name") or "").strip()
    if not snow_title:
        first_line = (platform_cfg.get("wish") or "").split("\n", 1)[0].strip()
        snow_title = first_line or "生日快乐"
    snow_title = snow_title[:20]
    snow_title_json = json_for_script(snow_title + " ♥")

    prefix = HB_ENHANCE if template_name == "hb-story" else ""

    return prefix + (
        "<script>(function(){"
        "var CFG=" + cfg_json + ";"
        "window.__CFG__=CFG;"
        "var _f=window.fetch;"
        "window.fetch=function(u,o){u=String(u);"
        "if(u.indexOf('config.json')!==-1){"
        "return new Promise(function(res){function fire(){res(new Response(JSON.stringify(CFG),{status:200,headers:{'Content-Type':'application/json'}}));}"
        "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fire);else setTimeout(fire,0);});"
        "}return _f.apply(this,arguments);};"
        "function mute(el){try{el.muted=true;el.pause();el.volume=0;el.play=function(){return Promise.resolve();};el.load=function(){};}catch(e){}}"
        "var _A=window.Audio;"
        "function Audio(){var a=arguments.length?new _A(arguments[0]):new _A();mute(a);return a;}"
        "Audio.prototype=_A.prototype;window.Audio=Audio;"
        "var mo=new MutationObserver(function(ms){ms.forEach(function(m){"
        "if(m.addedNodes)m.addedNodes.forEach(function(n){"
        "if(n.nodeType===1){if(n.tagName==='AUDIO')mute(n);"
        "var as=n.querySelectorAll&&n.querySelectorAll('audio');if(as)as.forEach(mute);}});});});"
        "function go(){if(!document.body)return;"
        "mo.observe(document.body,{childList:true,subtree:true});"
        "document.querySelectorAll('audio').forEach(mute);}"
        "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();"
        "document.title=" + title_json + ";"
        "if(" + is_snow + "){function st(){var t=document.getElementById('title');if(t)t.textContent=" + snow_title_json + ";}"
        "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',st);else st();}"
        "})();</script>"
    )


def parse_platform_cfg(name):
    """从 ?c=<base64url> 解码平台配置，失败则用默认值。"""
    cfg = {
        "template": name, "name": "", "birthday": "",
        "wish": "", "signoff": "", "accent": "#ffe9a8", "pixel": False,
        "letter": "",
    }
    raw_c = request.args.get("c", "")
    if raw_c:
        try:
            decoded = json.loads(b64url_decode(raw_c).decode("utf-8"))
            if isinstance(decoded, dict):
                cfg.update(decoded)
        except Exception:
            pass
    return cfg


# 星河蛋糕模板：把平台配置写进页面（页面文案是硬编码的，需在运行时替换）
HBCAKE_APPLY = """<script>(function(){
  var CFG = window.__CFG__ || {};
  var qs = new URLSearchParams(location.search);
  // 平台已开启背景音乐时静音模板原声，避免两首同时播放
  if (qs.get("mute") === "1") {
    try {
      if (typeof window.setMusic === "function") window.setMusic(false);
      else window.userOff = true;
    } catch (e) {}
  }
  function s(v){ return v == null ? "" : String(v).trim(); }
  var name = s(CFG.name), wish = s(CFG.wish), letter = s(CFG.letter);
  var signoff = s(CFG.signoff).replace(/^[-\\u2014\\s]+/, "");
  function one(sel){ return document.querySelector(sel); }
  function setText(el, txt){ if (el && txt) el.textContent = txt; }
  // 页面自带的 <title> 会覆盖头部注入的值，这里再设一次
  document.title = name ? (name + "，生日快乐") : "生日快乐";
  // 主面板与便签开场的文案
  if (name) setText(one(".panel .name"), name + "，生日快乐");
  if (wish) {
    var lines = wish.split(/\\n+/).map(s).filter(Boolean);
    if (lines.length) {
      setText(one(".panel .sub"), lines[0]);
      setText(one("#iCenter small"), lines[0]);
    }
  }
  // 信件内容：按行拆成段落，替换模板自带的示例信
  (function () {
    var paper = one("#modal .paper");
    if (!paper) return;
    var h2 = paper.querySelector("h2"), sign = paper.querySelector("p.sign");
    if (letter) {
      var ps = letter.split(/\\n+/).map(s).filter(Boolean);
      if (ps.length) {
        if (h2) h2.textContent = name ? ("致" + name + "：") : "致特别的你：";
        Array.prototype.slice.call(paper.querySelectorAll("p:not(.sign)")).forEach(function (p) { p.remove(); });
        ps.forEach(function (txt) {
          var p = document.createElement("p");
          p.textContent = txt;
          if (sign) paper.insertBefore(p, sign); else paper.appendChild(p);
        });
      }
    }
    if (signoff && sign) sign.textContent = signoff;
  })();
  // 特效库模式：收音（隐藏面板与特效按钮），并自动点亮指定特效
  if (qs.get("bare") === "1") {
    [".panel", "#musicBtn", "#hint", ".bottom"].forEach(function (sel) {
      var el = one(sel); if (el) el.style.display = "none";
    });
  }
  var fx = qs.get("fx");
  if (fx) {
    var tries = 0;
    (function clickFx() {
      var b = document.querySelector('.bar button[data-fx="' + fx + '"]');
      if (b) { b.click(); return; }
      if (++tries < 40) setTimeout(clickFx, 250);
    })();
  }
})();</script>"""


def build_hbcake_page(platform_cfg, html_path):
    """星河蛋糕模板：注入配置 + 运行时文案替换脚本。"""
    name = (platform_cfg.get("name") or "").strip()
    title = (name + "，生日快乐") if name else "生日快乐"
    cfg_json = json_for_script(platform_cfg)
    head = ("<script>window.__CFG__=" + cfg_json +
            ";document.title=" + json_for_script(title) + ";</script>")
    html = read_html_cached(html_path)
    if html is None:
        abort(404)
    html = inject_head(html, head)
    html = inject_body_end(html, HBCAKE_APPLY)
    return Response(html, mimetype="text/html; charset=utf-8")


def inject_head(html, inject):
    """把注入内容放到 <head> 起始处（先于模板原有 link/script）。"""
    lower = html.lower()
    idx = lower.find("<head")
    if idx != -1:
        gt = html.find(">", idx)
        if gt != -1:
            return html[:gt + 1] + inject + html[gt + 1:]
        return inject + html
    idx = lower.find("<html")
    if idx != -1:
        gt = html.find(">", idx)
        if gt != -1:
            return html[:gt + 1] + inject + html[gt + 1:]
    return inject + html


def inject_body_end(html, inject):
    """把注入内容放到 </body> 之前。"""
    idx = html.lower().rfind("</body>")
    if idx != -1:
        return html[:idx] + inject + html[idx:]
    return html + inject


# 特效页祝福覆盖层（不拦截鼠标，保证特效本身仍可交互）
FX_OVERLAY = """<style>
#fx-wish-layer{position:fixed;left:0;right:0;bottom:0;z-index:999999;display:flex;
justify-content:center;padding:0 16px calc(18px + env(safe-area-inset-bottom));
pointer-events:none;font-family:"PingFang SC","Microsoft YaHei",Arial,sans-serif;
animation:fxWishIn 1s cubic-bezier(.2,.75,.25,1) both;}
#fx-wish-card{max-width:min(720px,92vw);text-align:center;padding:13px 26px 15px;
border-radius:18px;border:1px solid rgba(255,255,255,.18);
background:linear-gradient(180deg,rgba(10,12,24,.26),rgba(10,12,24,.66));
box-shadow:0 18px 50px rgba(0,0,0,.42);
-webkit-backdrop-filter:blur(10px) saturate(120%);backdrop-filter:blur(10px) saturate(120%);}
#fx-wish-card .fx-name{font-size:clamp(18px,3vw,26px);font-weight:700;color:#fff;
letter-spacing:1px;text-shadow:0 0 20px rgba(255,222,150,.6),0 2px 10px rgba(0,0,0,.5);}
#fx-wish-card .fx-text{margin-top:6px;font-size:clamp(12px,1.6vw,15px);line-height:1.7;
color:rgba(255,255,255,.92);white-space:pre-line;text-shadow:0 1px 8px rgba(0,0,0,.5);}
#fx-wish-card .fx-sign{margin-top:6px;font-size:clamp(11px,1.4vw,13px);
color:rgba(255,255,255,.62);letter-spacing:.6px;}
@keyframes fxWishIn{from{opacity:0;transform:translateY(28px) scale(.96);}
to{opacity:1;transform:none;}}
@media (max-width:520px){#fx-wish-card{padding:10px 16px 12px;border-radius:14px;}}
</style>"""


def build_fx_page(fid, platform_cfg):
    """渲染特效页：注入 <base> + 祝福文字覆盖层。"""
    meta = EFFECTS.get(fid)
    if not meta:
        abort(404)
    path = os.path.join(STATIC_DIR, "vendor", "effects", meta["file"])
    if not os.path.isfile(path):
        abort(404)
    name = (platform_cfg.get("name") or "").strip()
    wish = (platform_cfg.get("wish") or "").strip()
    signoff = (platform_cfg.get("signoff") or "").strip()
    overlay = ""
    if name or wish or signoff:
        heading = html_mod.escape((name + "，生日快乐") if name else "生日快乐")
        parts = ['<div id="fx-wish-layer"><div id="fx-wish-card">',
                 '<div class="fx-name">' + heading + '</div>']
        if wish:
            parts.append('<div class="fx-text">' + html_mod.escape(wish) + '</div>')
        if signoff:
            parts.append('<div class="fx-sign">' + html_mod.escape(signoff) + '</div>')
        parts.append('</div></div>')
        overlay = FX_OVERLAY + "".join(parts)
    with open(path, "r", encoding="utf-8") as f:
        page = f.read()
    page = inject_head(page, '<base href="/vendor/effects/">')
    page = inject_body_end(page, overlay)
    return Response(page, mimetype="text/html; charset=utf-8")


@app.route("/fx/<fid>")
def fx_page(fid):
    if fid not in EFFECTS:
        abort(404)
    return build_fx_page(fid, parse_platform_cfg(fid))


@app.route("/embed/<name>")
def embed_template(name):
    platform_cfg = parse_platform_cfg(name)
    meta = IFRAME_TEMPLATES.get(name)

    if meta:
        html_path = os.path.join(STATIC_DIR, meta["html"])
        if not os.path.isfile(html_path):
            abort(404)
        if meta.get("builder") == "hbcake":
            return build_hbcake_page(platform_cfg, html_path)
        # 合并模板默认配置（仅 hb-story 有 config.json）
        merged_cfg = {}
        if meta["config"]:
            merged_cfg = merge_hb_config(platform_cfg, load_default_hb())
        shim = build_shim(name, platform_cfg, merged_cfg)
        base_tag = ('<base href="' + meta["base"] + '">') if meta["base"] else ""
        html = read_html_cached(html_path)
        if html is None:
            abort(404)
        return Response(inject_head(html, base_tag + shim),
                        mimetype="text/html; charset=utf-8")

    # 自定义 iframe 模板
    store = load_tpl_store()
    tpl = next((t for t in store["custom"] if t.get("id") == name), None)
    if not tpl or tpl.get("kind") != "iframe" or not tpl.get("htmlFile"):
        abort(404)
    html_path = os.path.join(UPLOAD_TPL_DIR, os.path.basename(tpl["htmlFile"]))
    if not os.path.isfile(html_path):
        abort(404)
    # 轻量 shim：只暴露 __CFG__ 与标题，供自定义 HTML 读取；不改写其音频行为
    title = ((platform_cfg.get("name") or "").strip() + "，生日快乐") or "生日快乐"
    inject = (
        "<script>window.__CFG__=" + json_for_script(platform_cfg) +
        ";document.title=" + json_for_script(title) + ";</script>"
    )
    html = read_html_cached(html_path)
    if html is None:
        abort(404)
    return Response(inject_head(html, inject),
                    mimetype="text/html; charset=utf-8")


# ---------------- 模板管理 ----------------
@app.route("/api/templates", methods=["GET"])
def list_templates():
    store = load_tpl_store()
    custom = []
    for t in store["custom"]:
        custom.append({
            "id": t.get("id"),
            "name": t.get("name", ""),
            "desc": t.get("desc", ""),
            "kind": t.get("kind", "canvas"),
            "base": t.get("base", ""),
            "effect": t.get("effect", ""),
            "accent": t.get("accent", ""),
            "music": t.get("music") or {},
            "builtin": False,
        })
    return jsonify({"custom": custom, "hidden": store["hidden"]})


@app.route("/api/templates", methods=["POST"])
def create_template():
    denied = admin_blocked()
    if denied:
        return denied
    ip = _client_ip()
    if not rate_ok(ip):
        return jsonify({"error": "rate_limited", "retry_after": RATE_WINDOW}), 429

    store = load_tpl_store()
    if len(store["custom"]) >= TPL_MAX:
        return jsonify({"error": "too_many", "max": TPL_MAX}), 400

    name = _safe_str(request.form.get("name", ""), 30).strip()
    desc = _safe_str(request.form.get("desc", ""), 80).strip()
    accent = _safe_str(request.form.get("accent", "#ffe9a8"), 16).strip() or "#ffe9a8"
    kind = request.form.get("kind", "canvas")
    if not name:
        return jsonify({"error": "no_name"}), 400

    tid = "c" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9))
    tpl = {
        "id": tid, "name": name, "desc": desc, "accent": accent,
        "kind": "canvas", "createdAt": int(time.time()),
    }

    if kind == "iframe":
        if "html" not in request.files:
            return jsonify({"error": "no_file"}), 400
        f = request.files["html"]
        fname = (f.filename or "").lower()
        if not (fname.endswith(".html") or fname.endswith(".htm")):
            return jsonify({"error": "bad_ext", "allowed": [".html", ".htm"]}), 400
        data = f.read(TPL_HTML_MAX + 1)
        if len(data) > TPL_HTML_MAX:
            return jsonify({"error": "too_large", "max_mb": 2}), 400
        if b"<" not in data:
            return jsonify({"error": "not_html"}), 400
        os.makedirs(UPLOAD_TPL_DIR, exist_ok=True)
        out_name = tid + ".html"
        with open(os.path.join(UPLOAD_TPL_DIR, out_name), "wb") as out:
            out.write(data)
        tpl["kind"] = "iframe"
        tpl["htmlFile"] = out_name
    elif kind == "effect":
        effect = request.form.get("effect", "")
        if effect not in EFFECTS:
            return jsonify({"error": "bad_effect"}), 400
        tpl["kind"] = "effect"
        tpl["effect"] = effect
    else:
        base = request.form.get("base", "galaxy")
        if base not in CANVAS_BASES:
            base = "galaxy"
        tpl["base"] = base

    # 模板默认背景音乐（可选）：开关 + 来源 + 音量，可内嵌上传文件
    music = sanitize_music({
        "enabled": request.form.get("music_enabled") in ("1", "true", "on"),
        "source": request.form.get("music_source", "none"),
        "trackId": request.form.get("music_track", ""),
        "url": request.form.get("music_url", ""),
        "volume": request.form.get("music_volume", 0.6),
    })
    if "music_file" in request.files and request.files["music_file"].filename:
        info, err = save_music_file(request.files["music_file"])
        if err == "bad_ext":
            return jsonify({"error": "music_bad_ext",
                            "allowed": sorted(MUSIC_EXTS)}), 400
        if err == "too_large":
            return jsonify({"error": "music_too_large", "max_mb": 15}), 400
        if err == "quota":
            return jsonify({"error": "music_quota", "max_files": MUSIC_QUOTA_FILES,
                            "max_mb": 150}), 400
        if info:
            music["url"] = info["url"]
            music["source"] = "upload"
    tpl["music"] = music

    store["custom"].append(tpl)
    save_tpl_store(store)
    return jsonify(tpl), 201


@app.route("/api/templates/<tid>", methods=["DELETE"])
def delete_template(tid):
    denied = admin_blocked()
    if denied:
        return denied
    store = load_tpl_store()
    custom = next((t for t in store["custom"] if t.get("id") == tid), None)
    if custom:
        store["custom"] = [t for t in store["custom"] if t.get("id") != tid]
        save_tpl_store(store)
        if custom.get("htmlFile"):
            p = os.path.join(UPLOAD_TPL_DIR, os.path.basename(custom["htmlFile"]))
            try:
                os.remove(p)
            except OSError:
                pass
        return jsonify({"ok": True, "removed": "custom"})
    # 内置模板：仅从模板库隐藏（老卡片仍可访问）
    if tid in ALLOWED_TEMPLATES:
        if tid not in store["hidden"]:
            store["hidden"].append(tid)
            save_tpl_store(store)
        return jsonify({"ok": True, "removed": "hidden"})
    abort(404)


@app.route("/api/templates/restore", methods=["POST"])
def restore_templates():
    denied = admin_blocked()
    if denied:
        return denied
    store = load_tpl_store()
    store["hidden"] = []
    save_tpl_store(store)
    return jsonify({"ok": True})


# ---------------- 音乐上传 ----------------
def music_usage():
    """已上传音乐的文件数与总字节数，用于全站配额。"""
    count = 0
    total = 0
    try:
        for name in os.listdir(UPLOAD_MUSIC_DIR):
            p = os.path.join(UPLOAD_MUSIC_DIR, name)
            if os.path.isfile(p):
                count += 1
                total += os.path.getsize(p)
    except OSError:
        pass
    return count, total


def save_music_file(f):
    """校验并保存上传的音乐文件，返回 (info, error)。"""
    if not f or not f.filename:
        return None, "empty_file"
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in MUSIC_EXTS:
        return None, "bad_ext"
    data = f.read(MUSIC_MAX_BYTES + 1)
    if len(data) > MUSIC_MAX_BYTES:
        return None, "too_large"
    count, total = music_usage()
    if count >= MUSIC_QUOTA_FILES or total + len(data) > MUSIC_QUOTA_BYTES:
        return None, "quota"
    os.makedirs(UPLOAD_MUSIC_DIR, exist_ok=True)
    fname = gen_slug() + gen_slug() + ext  # 12 位随机名，防猜测
    with open(os.path.join(UPLOAD_MUSIC_DIR, fname), "wb") as out:
        out.write(data)
    return {"url": "/uploads/music/" + fname, "name": f.filename}, None


@app.route("/api/upload/music", methods=["POST"])
def upload_music():
    denied = admin_blocked()
    if denied:
        return denied
    ip = _client_ip()
    if not rate_ok(ip):
        return jsonify({"error": "rate_limited",
                        "retry_after": RATE_WINDOW}), 429
    if "file" not in request.files:
        return jsonify({"error": "no_file"}), 400
    info, err = save_music_file(request.files["file"])
    if err == "empty_file":
        return jsonify({"error": "empty_file"}), 400
    if err == "bad_ext":
        return jsonify({"error": "bad_ext", "allowed": sorted(MUSIC_EXTS)}), 400
    if err == "too_large":
        return jsonify({"error": "too_large", "max_mb": 15}), 400
    if err == "quota":
        return jsonify({"error": "quota", "max_files": MUSIC_QUOTA_FILES,
                        "max_mb": 150}), 400
    return jsonify(info), 201


# 静态资源（js/css/图片等）
# 静态资源缓存策略：媒体长期缓存，js/css 短缓存，HTML 不缓存
CACHE_LONG_EXTS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".png", ".jpg", ".jpeg",
                   ".gif", ".webp", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".otf"}
CACHE_SHORT_EXTS = {".js", ".css"}


@app.route("/<path:filename>")
def static_files(filename):
    # 安全：只允许 static 目录内的文件（用 commonpath 防 ../ 越界）
    static_root = os.path.normpath(STATIC_DIR)
    full = os.path.normpath(os.path.join(static_root, filename))
    try:
        inside = os.path.commonpath([static_root, full]) == static_root
    except ValueError:
        inside = False
    if inside and os.path.isfile(full):
        resp = send_from_directory(STATIC_DIR, filename, conditional=True)
        ext = os.path.splitext(filename)[1].lower()
        if ext in CACHE_LONG_EXTS:
            resp.headers["Cache-Control"] = "public, max-age=604800"
        elif ext in CACHE_SHORT_EXTS:
            resp.headers["Cache-Control"] = "public, max-age=600"
        else:
            resp.headers["Cache-Control"] = "no-cache"
        return resp
    abort(404)


# WSGI（gunicorn / PythonAnywhere）直接导入 app 时不会执行 __main__，
# 因此模块加载阶段就建表、补列、建目录，避免首次调用接口时报 500。
# 初始化失败不应让整个站点起不来，记录日志后继续。
try:
    init_db()
except Exception as exc:  # noqa: BLE001
    print("[init] 数据库初始化失败：%s" % exc)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
