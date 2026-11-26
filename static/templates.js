/* 生日代码平台 · Canvas 动画模板
 * 每个模板暴露 draw(ctx, cfg, t, W, H)
 * ctx 已按 devicePixelRatio 缩放，W/H 为逻辑像素
 * cfg = { template, name, birthday, wish, signoff, accent, pixel }
 */
(function (global) {
  "use strict";

  // ---------- 通用工具 ----------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function shade(hex, delta) {
    let h = (hex || "#ffffff").replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    let r = parseInt(h.slice(0, 2), 16);
    let g = parseInt(h.slice(2, 4), 16);
    let b = parseInt(h.slice(4, 6), 16);
    r = clamp(r + delta, 0, 255);
    g = clamp(g + delta, 0, 255);
    b = clamp(b + delta, 0, 255);
    return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
  }

  // 3D 投影
  const FOCAL = 620;
  function rotateY(x, y, z, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [x * c + z * s, y, -x * s + z * c];
  }
  function project(p, cx, cy) {
    let [x, y, z] = p;
    let d = FOCAL + z;
    if (d < 1) d = 1;
    const s = FOCAL / d;
    return [cx + x * s, cy - y * s, d];
  }
  function ellipsePts(radius, yc, a, cx, cy, n) {
    n = n || 44;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const phi = 2 * Math.PI * i / n;
      pts.push(project(rotateY(radius * Math.cos(phi), yc, radius * Math.sin(phi), a), cx, cy));
    }
    return pts;
  }
  function fillPoly(ctx, pts, fill, stroke) {
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  // 星空（确定性种子，保证同一画布稳定）
  function makeStars(W, H, count, seed) {
    let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const colors = ["#ffffff", "#ffe9a8", "#a8d8ff", "#ffc4e1", "#c4ffe9"];
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rnd() * W, y: rnd() * H,
        r: 0.6 + rnd() * 2.2,
        color: colors[(rnd() * colors.length) | 0],
        phase: rnd() * Math.PI * 2,
        spd: 1.5 + rnd() * 2
      });
    }
    return stars;
  }
  function drawStars(ctx, stars, t) {
    for (const st of stars) {
      const b = 0.35 + 0.65 * Math.abs(Math.sin(t * st.spd + st.phase));
      ctx.globalAlpha = b;
      ctx.fillStyle = st.color;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r * (0.7 + 0.5 * b), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function multilineText(ctx, text, x, y, lineHeight, maxWidth) {
    const lines = (text || "").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (maxWidth && ctx.measureText(line).width > maxWidth) {
        // 简单按字符截断
        let out = "";
        for (const ch of line) {
          if (ctx.measureText(out + ch).width > maxWidth) break;
          out += ch;
        }
        line = out;
      }
      ctx.fillText(line, x, y + i * lineHeight);
    }
  }

  // ---------- 背景渐变 ----------
  function paintBg(ctx, W, H, top, bottom) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ============================================================
  // 模板一：旋转银河蛋糕（平滑）—— 移植自 turtle 版
  // ============================================================
  const GALAXY_LAYERS = [
    { r: 158, h: 72, yc: -58, side: "#c98a8a", top: "#f3d9de" },
    { r: 116, h: 60, yc: 8,   side: "#9fb3c8", top: "#d9e4f0" },
    { r: 78,  h: 52, yc: 66,  side: "#e3c39a", top: "#f8e9d4" }
  ];
  const GALAXY_PLATE = { r: 184, h: 14, yc: -102, side: "#b8b8c0", top: "#e6e6ec" };
  const CANDLE_COLORS = ["#ff6b6b", "#ffd166", "#06d6a0", "#4dabf7", "#f783ac", "#ffa94d"];

  function drawGalaxyCake(ctx, cfg, t, W, H, stars) {
    const accent = cfg.accent || "#ffe9a8";
    const scale = clamp(Math.min(W, H) / 720, 0.4, 1.6);
    const cx = W / 2;
    const cy = H * 0.52;
    const ang = t * 1.0; // 旋转角速度

    // 蛋糕整体按 scale 缩放：投影时乘 scale
    const S = scale;
    function proj(p) {
      const [x, y, d] = project([p[0] * S, p[1] * S, p[2] * S], cx, cy);
      return [x, y, d];
    }
    function ell(radius, yc, a, n) {
      const pts = [];
      n = n || 44;
      for (let i = 0; i < n; i++) {
        const phi = 2 * Math.PI * i / n;
        pts.push(proj(rotateY(radius * Math.cos(phi), yc, radius * Math.sin(phi), a)));
      }
      return pts;
    }

    // 盘子
    const P = GALAXY_PLATE;
    let top = ell(P.r, P.yc + P.h / 2, ang, 48);
    let bot = ell(P.r, P.yc - P.h / 2, ang, 48);
    fillPoly(ctx, bot.concat(top.slice().reverse()), P.side);
    fillPoly(ctx, top, P.top, shade(P.top, -20));

    // 蛋糕层（下→上）
    for (const L of GALAXY_LAYERS) {
      const lt = ell(L.r, L.yc + L.h / 2, ang);
      const lb = ell(L.r, L.yc - L.h / 2, ang);
      fillPoly(ctx, lb.concat(lt.slice().reverse()), L.side);
      fillPoly(ctx, lt, L.top, shade(L.top, -18));
      // 顶面高光
      const hi = ell(L.r * 0.62, L.yc + L.h / 2 + 0.5, ang, 30);
      fillPoly(ctx, hi, shade(L.top, 14));
    }

    // 蜡烛（按深度从远到近）
    const topLayer = GALAXY_LAYERS[GALAXY_LAYERS.length - 1];
    const topY = topLayer.yc + topLayer.h / 2;
    const candleR = 58;
    const candleH = 46;
    const candles = [];
    const N = 6;
    for (let i = 0; i < N; i++) {
      const phi = 2 * Math.PI * i / N;
      const base = rotateY(candleR * Math.cos(phi), topY, candleR * Math.sin(phi), ang);
      const [, , d] = proj(base);
      candles.push({ phi, base, d, i });
    }
    candles.sort((a, b) => b.d - a.d);
    for (const c of candles) {
      const [bx, by] = proj(c.base);
      const [tx, ty] = proj([c.base[0], c.base[1] + candleH, c.base[2]]);
      const dScale = clamp(FOCAL / c.d, 0.3, 2);
      const w = 9 * S * dScale;
      // 烛身
      const col = CANDLE_COLORS[c.i % CANDLE_COLORS.length];
      ctx.fillStyle = col;
      ctx.strokeStyle = shade(col, -40);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(bx - w / 2, ty, w, by - ty);
      ctx.fill(); ctx.stroke();
      // 烛芯
      ctx.strokeStyle = "#3a2a1a";
      ctx.beginPath(); ctx.moveTo(bx, ty); ctx.lineTo(bx, ty - 4 * dScale); ctx.stroke();
      // 火焰（闪烁）
      const flick = 1 + 0.28 * Math.sin(t * 13 + c.i * 1.7) + 0.12 * Math.sin(t * 29 + c.i);
      const fy = ty - 6 * dScale;
      ctx.fillStyle = "#fff1b8"; ctx.beginPath(); ctx.arc(bx, fy + 3, 16 * dScale * flick * 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(bx, fy, 11 * dScale * flick * 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#ff7a00"; ctx.beginPath(); ctx.arc(bx, fy + 1, 6.5 * dScale * flick * 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff8dc"; ctx.beginPath(); ctx.arc(bx, fy + 1.5, 3 * dScale * flick * 0.5, 0, 7); ctx.fill();
    }

    // 文字
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const titleFont = Math.round(40 * S) + "px 'Curlz MT','Segoe Script','Comic Sans MS',cursive";
    ctx.font = titleFont;
    ctx.fillStyle = accent;
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 8;
    ctx.fillText("Happy Birthday", cx, H * 0.13);
    ctx.shadowBlur = 0;

    const nameText = (cfg.name ? cfg.name + "，" : "") + "生日快乐";
    ctx.font = "bold " + Math.round(22 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
    ctx.fillStyle = accent;
    ctx.fillText(nameText, cx, H * 0.82);

    ctx.font = Math.round(15 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
    ctx.fillStyle = "#cfe3ff";
    multilineText(ctx, cfg.wish || "", cx, H * 0.88, Math.round(22 * S), W * 0.8);

    if (cfg.signoff) {
      ctx.font = "italic " + Math.round(12 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
      ctx.fillStyle = "#ffc4e1";
      ctx.fillText(cfg.signoff, cx, H * 0.96);
    }
  }

  function drawGalaxy(ctx, cfg, t, W, H) {
    paintBg(ctx, W, H, "#0b1026", "#1a1140");
    const stars = makeStars(W, H, 180, 1337);
    drawStars(ctx, stars, t);
    drawGalaxyCake(ctx, cfg, t, W, H);
  }

  // ============================================================
  // 模板二：星空贺卡（正面 2D 蛋糕 + 浪漫排版）
  // ============================================================
  function drawStarry(ctx, cfg, t, W, H) {
    paintBg(ctx, W, H, "#0b1026", "#241042");
    const stars = makeStars(W, H, 220, 2024);
    drawStars(ctx, stars, t);
    const accent = cfg.accent || "#ffe9a8";
    const S = clamp(Math.min(W, H) / 720, 0.4, 1.6);
    const cx = W / 2;

    // 飘动粒子
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 18; i++) {
      const px = (Math.sin(t * 0.5 + i) * 0.5 + 0.5) * W;
      const py = ((t * 30 + i * 80) % H);
      ctx.fillStyle = i % 2 ? "#ffc4e1" : "#a8d8ff";
      ctx.beginPath(); ctx.arc(px, H - py, 1.8, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 2D 蛋糕（正面）
    const baseY = H * 0.62;
    const layers = [
      { w: 300, h: 70, col: "#c98a8a", top: "#f3d9de" },
      { w: 230, h: 60, col: "#9fb3c8", top: "#d9e4f0" },
      { w: 160, h: 52, col: "#e3c39a", top: "#f8e9d4" }
    ];
    let y = baseY;
    for (const L of layers) {
      const w = L.w * S, h = L.h * S;
      ctx.fillStyle = L.col;
      ctx.fillRect(cx - w / 2, y - h, w, h);
      // 顶（椭圆）
      ctx.fillStyle = L.top;
      ctx.beginPath();
      ctx.ellipse(cx, y - h, w / 2, h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      y -= h;
    }
    // 盘子
    ctx.fillStyle = "#b8b8c0";
    ctx.beginPath();
    ctx.ellipse(cx, baseY, 190 * S, 16 * S, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e6e6ec";
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 4 * S, 190 * S, 12 * S, 0, 0, Math.PI * 2);
    ctx.fill();
    // 蜡烛
    const candleY = y;
    for (let i = 0; i < 5; i++) {
      const cxi = cx + (i - 2) * 26 * S;
      ctx.fillStyle = CANDLE_COLORS[i % CANDLE_COLORS.length];
      ctx.fillRect(cxi - 3 * S, candleY - 40 * S, 6 * S, 40 * S);
      const flick = 1 + 0.3 * Math.sin(t * 12 + i);
      ctx.fillStyle = "#ffd166";
      ctx.beginPath(); ctx.arc(cxi, candleY - 44 * S, 5 * S * flick, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff8dc";
      ctx.beginPath(); ctx.arc(cxi, candleY - 44 * S, 2.2 * S * flick, 0, 7); ctx.fill();
    }

    // 文字
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 10;
    ctx.font = "bold " + Math.round(30 * S) + "px 'Curlz MT','Segoe Script',cursive";
    ctx.fillStyle = accent;
    ctx.fillText("Happy Birthday", cx, H * 0.2);

    ctx.font = "bold " + Math.round(24 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
    ctx.fillStyle = accent;
    ctx.fillText((cfg.name ? cfg.name + "，" : "") + "生日快乐", cx, H * 0.27);

    ctx.font = Math.round(15 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
    ctx.fillStyle = "#e8d9ff";
    multilineText(ctx, cfg.wish || "", cx, H * 0.33, Math.round(23 * S), W * 0.8);
    ctx.shadowBlur = 0;

    if (cfg.signoff) {
      ctx.font = "italic " + Math.round(12 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
      ctx.fillStyle = "#ffc4e1";
      ctx.fillText(cfg.signoff, cx, H * 0.95);
    }
  }

  // ---------- 确定性伪随机（按索引，保证逐帧稳定不闪烁） ----------
  function hashRand(i, salt) {
    const x = Math.sin((i + 1) * 127.1 + (salt || 0) * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // 爱心参数曲线（经典心形），返回相对 (cx,cy) 的点
  function heartPt(theta, cx, cy, scale) {
    const x = 16 * Math.pow(Math.sin(theta), 3);
    const y = -(13 * Math.cos(theta) - 5 * Math.cos(2 * theta) -
                2 * Math.cos(3 * theta) - Math.cos(4 * theta));
    return [cx + x * scale, cy + y * scale];
  }
  function heartPath(ctx, cx, cy, scale) {
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const th = i / 200 * Math.PI * 2;
      const p = heartPt(th, cx, cy, scale);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
  }

  function drawBalloon(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.85, r, 0, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.22, r * 0.32, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // 绳
    ctx.strokeStyle = "rgba(80,60,50,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r);
    ctx.quadraticCurveTo(cx + r * 0.4, cy + r * 2.2, cx, cy + r * 3);
    ctx.stroke();
    ctx.restore();
  }

  // ============================================================
  // 模板：跳动爱心
  // ============================================================
  function drawHeart(ctx, cfg, t, W, H) {
    paintBg(ctx, W, H, "#1a0b1f", "#2d0a1e");
    const accent = cfg.accent || "#ff8fb1";
    const S = clamp(Math.min(W, H) / 720, 0.4, 1.6);
    const cx = W / 2, cy = H * 0.52;

    // 飘浮小爱心
    for (let i = 0; i < 22; i++) {
      const px = hashRand(i, 1) * W;
      const spd = 24 + hashRand(i, 2) * 36;
      const py = (((t * spd + i * 50) % (H + 60)) + H + 60) % (H + 60) - 30;
      const sc = (0.35 + hashRand(i, 3) * 0.5) * S;
      const a = 0.35 + 0.4 * hashRand(i, 4);
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 3 === 0 ? accent : "#ffc4e1";
      heartPath(ctx, px, py, sc);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 主爱心（跳动）
    const beat = 1 + 0.09 * Math.sin(t * 2.2) + 0.045 * Math.sin(t * 4.4);
    const scale = S * 13 * beat;
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 42 * S;
    heartPath(ctx, cx, cy, scale);
    const grad = ctx.createRadialGradient(cx, cy - 18 * S, 2, cx, cy, 120 * S);
    grad.addColorStop(0, "#ffe3ec");
    grad.addColorStop(0.55, accent);
    grad.addColorStop(1, shade(accent, -45));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // 文字
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 8;
    ctx.font = "bold " + Math.round(30 * S) + "px 'Curlz MT','Segoe Script',cursive";
    ctx.fillStyle = accent;
    ctx.fillText("Happy Birthday", cx, H * 0.14);

    ctx.font = "bold " + Math.round(22 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
    ctx.fillStyle = "#ffe9f0";
    ctx.fillText((cfg.name ? cfg.name + "，" : "") + "生日快乐", cx, H * 0.82);

    ctx.font = Math.round(14 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
    ctx.fillStyle = "#ffd6e6";
    multilineText(ctx, cfg.wish || "", cx, H * 0.88, Math.round(21 * S), W * 0.8);
    ctx.shadowBlur = 0;

    if (cfg.signoff) {
      ctx.font = "italic " + Math.round(12 * S) + "px '微软雅黑',sans-serif";
      ctx.fillStyle = "#ffc4e1";
      ctx.fillText(cfg.signoff, cx, H * 0.96);
    }
  }

  // ============================================================
  // 模板：烟花夜空
  // ============================================================
  function drawFireworks(ctx, cfg, t, W, H) {
    paintBg(ctx, W, H, "#05060f", "#0a0f24");
    drawStars(ctx, makeStars(W, H, 170, 7), t);
    const accent = cfg.accent || "#ffd166";
    const S = clamp(Math.min(W, H) / 720, 0.4, 1.6);
    const CYCLE = 2.6;
    const palette = ["#ff6b6b", "#ffd166", "#06d6a0", "#4dabf7", "#f783ac", "#ffa94d", "#ffe9a8"];
    const bursts = [
      { x: 0.28, y: 0.34, seed: 11, delay: 0 },
      { x: 0.74, y: 0.30, seed: 23, delay: 0.7 },
      { x: 0.50, y: 0.24, seed: 37, delay: 1.4 },
      { x: 0.40, y: 0.42, seed: 51, delay: 2.0 }
    ];
    for (const b of bursts) {
      const age = ((t - b.delay) % CYCLE + CYCLE) % CYCLE;
      if (age > 1.9) continue;
      const cx = b.x * W, cy = b.y * H;
      const col = palette[b.seed % palette.length];
      const P = 72;
      for (let i = 0; i < P; i++) {
        const ang = (i / P) * Math.PI * 2 + hashRand(i, b.seed) * 0.25;
        const spd = (55 + hashRand(i, b.seed + 1) * 130) * S;
        const px = cx + Math.cos(ang) * spd * age;
        const py = cy + Math.sin(ang) * spd * age + 0.5 * 130 * S * age * age;
        const a = Math.max(0, 1 - age / 1.9);
        ctx.globalAlpha = a;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, 2.1 * S, 0, 7);
        ctx.fill();
      }
      // 中心闪光
      if (age < 0.25) {
        ctx.globalAlpha = 1 - age / 0.25;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(cx, cy, 6 * S * (1 - age / 0.25), 0, 7);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 文字
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 10;
    ctx.font = "bold " + Math.round(32 * S) + "px 'Curlz MT','Segoe Script',cursive";
    ctx.fillStyle = accent;
    ctx.fillText("Happy Birthday", W / 2, H * 0.13);
    ctx.font = "bold " + Math.round(22 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
    ctx.fillStyle = "#fff6d8";
    ctx.fillText((cfg.name ? cfg.name + "，" : "") + "生日快乐", W / 2, H * 0.78);
    ctx.font = Math.round(14 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
    ctx.fillStyle = "#ffe9a8";
    multilineText(ctx, cfg.wish || "", W / 2, H * 0.84, Math.round(21 * S), W * 0.8);
    ctx.shadowBlur = 0;
    if (cfg.signoff) {
      ctx.font = "italic " + Math.round(12 * S) + "px '微软雅黑',sans-serif";
      ctx.fillStyle = "#ffc4e1";
      ctx.fillText(cfg.signoff, W / 2, H * 0.95);
    }
  }

  // ============================================================
  // 模板：彩纸气球
  // ============================================================
  function drawConfetti(ctx, cfg, t, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#fff8f0");
    g.addColorStop(1, "#ffe6ef");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const S = clamp(Math.min(W, H) / 720, 0.4, 1.6);
    const colors = ["#ff6b6b", "#ffd166", "#06d6a0", "#4dabf7", "#f783ac", "#a78bfa", "#fb923c"];

    // 飘落彩纸
    for (let i = 0; i < 80; i++) {
      const x = hashRand(i, 3) * W;
      const baseY = hashRand(i, 4) * H;
      const spd = 40 + hashRand(i, 5) * 70;
      const y = ((baseY + t * spd) % (H + 40) + H + 40) % (H + 40) - 20;
      const rot = t * (1 + hashRand(i, 6) * 2.2) + i;
      const w = (5 + hashRand(i, 7) * 8) * S, h = (9 + hashRand(i, 8) * 11) * S;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // 气球
    for (let i = 0; i < 4; i++) {
      const bx = (0.16 + i * 0.23) * W + Math.sin(t * 0.8 + i) * 10 * S;
      const by = H * 0.72 + Math.sin(t * 0.6 + i * 1.3) * 14 * S;
      drawBalloon(ctx, bx, by, 20 * S, colors[(i * 2) % colors.length]);
    }

    // 中央卡片
    const cardW = Math.min(W * 0.78, 460 * S), cardH = 200 * S;
    const cx = W / 2, cy = H * 0.34;
    ctx.save();
    ctx.shadowColor = "rgba(120,60,40,0.18)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "rgba(255,253,248,0.92)";
    roundRect(ctx, cx - cardW / 2, cy - cardH / 2, cardW, cardH, 18 * S);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e85d75";
    ctx.font = "bold " + Math.round(30 * S) + "px 'Curlz MT','Segoe Script',cursive";
    ctx.fillText("Happy Birthday", cx, cy - 42 * S);
    ctx.fillStyle = "#2b2722";
    ctx.font = "bold " + Math.round(22 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
    ctx.fillText((cfg.name ? cfg.name + "，" : "") + "生日快乐", cx, cy - 6 * S);
    ctx.fillStyle = "#6b6358";
    ctx.font = Math.round(13 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
    ctx.textBaseline = "alphabetic";
    multilineText(ctx, cfg.wish || "", cx, cy + 26 * S, Math.round(19 * S), cardW * 0.86);
    if (cfg.signoff) {
      ctx.font = "italic " + Math.round(12 * S) + "px '微软雅黑',sans-serif";
      ctx.fillStyle = "#a89b8a";
      ctx.fillText(cfg.signoff, cx, cy + cardH / 2 - 18 * S);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 给 iframe 模板画静态缩略海报
  function drawPoster(ctx, W, H, label, accent) {
    accent = accent || "#ffe9a8";
    paintBg(ctx, W, H, "#0b1026", "#241042");
    drawStars(ctx, makeStars(W, H, 90, 99), 1.3);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = accent;
    ctx.font = "bold " + Math.round(Math.min(W, H) * 0.13) + "px '微软雅黑','Microsoft YaHei',sans-serif";
    ctx.fillText(label, W / 2, H / 2);
  }

  // ---------- 注册 ----------
  const registry = {
    galaxy: {
      id: "galaxy",
      name: "旋转银河蛋糕",
      desc: "3D 旋转蛋糕 + 星空，平滑渲染",
      draw: drawGalaxy
    },
    pixel: {
      id: "pixel",
      name: "像素风旋转蛋糕",
      desc: "致敬 Galaxy Cake Pixel Player，像素化复古风",
      forcePixel: true,
      draw: drawGalaxy
    },
    starry: {
      id: "starry",
      name: "星空贺卡",
      desc: "正面蛋糕 + 浪漫星空排版",
      draw: drawStarry
    },
    heart: {
      id: "heart",
      name: "跳动爱心",
      desc: "浪漫爱心跳动 + 飘浮小爱心",
      draw: drawHeart
    },
    fireworks: {
      id: "fireworks",
      name: "烟花夜空",
      desc: "夜空烟花绽放 + 生日祝福",
      draw: drawFireworks
    },
    confetti: {
      id: "confetti",
      name: "彩纸气球",
      desc: "飘落彩纸 + 气球 + 祝福卡片",
      draw: drawConfetti
    },
    "hb-story": {
      id: "hb-story",
      name: "生日故事页",
      kind: "iframe",
      desc: "romance-main · 聊天式生日故事，可定制人名与祝福",
      embedUrl: "/embed/hb-story"
    },
    "snow-heart": {
      id: "snow-heart",
      name: "雪花爱心",
      kind: "iframe",
      desc: "romance-main · 爱心飘落与破碎动画",
      embedUrl: "/embed/snow-heart"
    },
    "starwish": {
      id: "starwish",
      name: "星河许愿",
      kind: "iframe",
      desc: "星河开场 + 3D 祝福便签 + 吹蜡烛许愿 + 打字机信件",
      embedUrl: "/embed/starwish",
      letters: true,
      notes: true
    },
    "hbcake": {
      id: "hbcake",
      name: "星河蛋糕",
      kind: "iframe",
      desc: "便签开场 + 3D 星河蛋糕 + 吹蜡烛许愿 + 一封信，带原声",
      embedUrl: "/embed/hbcake",
      letters: true,
      ownAudio: true
    }
  };

  global.BirthdayTemplates = { registry, shade, makeStars, drawStars, drawPoster };
})(window);
