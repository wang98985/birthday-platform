/* 生日代码平台 · 高级炫酷模板（10 个）
 * 依赖 templates.js 暴露的 window.BirthdayTemplates.registry
 * 每个 draw(ctx, cfg, t, W, H) 都支持任意画布尺寸；
 * 使用确定性伪随机（rnd），保证逐帧稳定不抖动。
 */
(function (global) {
  "use strict";
  var BT = global.BirthdayTemplates;
  if (!BT || !BT.registry) return;
  var registry = BT.registry;
  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // 稳定伪随机：同一 (i,s) 永远得到同一值
  function rnd(i, s) {
    var x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  function paintBg(ctx, W, H, top, bottom) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function scl(W, H) { return clamp(Math.min(W, H) / 720, 0.42, 1.55); }

  // 生成稳定星点
  function stars(W, H, count, seed) {
    var colors = ["#ffffff", "#ffe9a8", "#a8d8ff", "#ffc4e1", "#c6fff0"];
    var out = [];
    for (var i = 0; i < count; i++) {
      out.push({
        x: rnd(i + seed, 1) * W,
        y: rnd(i + seed, 2) * H,
        r: 0.5 + rnd(i + seed, 3) * 1.9,
        c: colors[(rnd(i + seed, 4) * colors.length) | 0],
        p: rnd(i + seed, 5) * TAU,
        s: 1.2 + rnd(i + seed, 6) * 2.4
      });
    }
    return out;
  }
  function drawStarField(ctx, list, t) {
    ctx.save();
    for (var i = 0; i < list.length; i++) {
      var st = list[i];
      var b = 0.3 + 0.7 * Math.abs(Math.sin(t * st.s + st.p));
      ctx.globalAlpha = b;
      ctx.fillStyle = st.c;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r * (0.7 + 0.6 * b), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function glowText(ctx, text, x, y, font, color, blur, align, baseline) {
    ctx.save();
    ctx.textAlign = align || "center";
    ctx.textBaseline = baseline || "alphabetic";
    ctx.font = font;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur == null ? 16 : blur;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = Math.max(0, (blur || 16) * 0.35);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function multiline(ctx, text, x, y, lh, maxW) {
    var lines = String(text || "").split(/\r?\n/);
    var n = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (maxW && ctx.measureText(line).width > maxW) {
        var acc = "";
        for (var ci = 0; ci < line.length; ci++) {
          var ch = line[ci];
          if (ctx.measureText(acc + ch).width > maxW) break;
          acc += ch;
        }
        line = acc;
      }
      ctx.fillText(line, x, y + i * lh);
      n++;
    }
    return n;
  }

  // 统一的祝福文字块（姓名 + 祝福 + 落款），带光晕
  function wishBlock(ctx, cfg, W, H, accent, opt) {
    opt = opt || {};
    var S = opt.S || scl(W, H);
    var cx = opt.cx == null ? W / 2 : opt.cx;
    var y = opt.y == null ? H * 0.84 : opt.y;
    var nameText = (cfg.name ? cfg.name + "，" : "") + "生日快乐";
    glowText(ctx, nameText, cx, y,
      "bold " + Math.round(25 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif",
      accent, 18);
    y += Math.round(30 * S);
    if (cfg.wish) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = opt.wishColor || "rgba(255,255,255,0.86)";
      ctx.font = Math.round(15 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif";
      var n = multiline(ctx, cfg.wish, cx, y, Math.round(22 * S), Math.min(W * 0.84, 560 * S));
      ctx.restore();
      y += n * Math.round(22 * S);
    }
    if (cfg.signoff) {
      glowText(ctx, cfg.signoff, cx, Math.min(y + Math.round(6 * S), H - 8 * S),
        "italic " + Math.round(12 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif",
        opt.signColor || "rgba(255,220,240,0.92)", 8);
    }
  }

  // ============================================================
  // 1. warp · 星际跃迁（超空间星线拖尾）
  // ============================================================
  function drawWarp(ctx, cfg, t, W, H) {
    var accent = cfg.accent || "#ffe9a8";
    paintBg(ctx, W, H, "#03040e", "#070b22");
    var cx = W / 2, cy = H * 0.47;
    var maxR = Math.hypot(W, H) * 0.62;
    var N = Math.round(clamp(W * H / 8000, 80, 300));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < N; i++) {
      var a = rnd(i, 1) * TAU;
      var spd = 0.10 + rnd(i, 2) * 0.26;
      var ph = (t * spd + rnd(i, 3)) % 1;
      var r2 = ph * ph;
      var r1 = Math.max(0, r2 - (0.03 + ph * 0.05));
      var rr1 = r1 * maxR, rr2 = r2 * maxR;
      var h = rnd(i, 4);
      var col = h < 0.55 ? "255,255,255" : (h < 0.8 ? "150,215,255" : "255,196,235");
      var alpha = Math.min(1, ph * 2.4) * 0.9;
      ctx.strokeStyle = "rgba(" + col + "," + alpha.toFixed(3) + ")";
      ctx.lineWidth = clamp(0.35 + ph * 3.4, 0.35, 3.4);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rr1, cy + Math.sin(a) * rr1 * 0.78);
      ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2 * 0.78);
      ctx.stroke();
    }
    // 中心光核
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.2);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.18, "rgba(180,220,255,0.6)");
    g.addColorStop(1, "rgba(80,120,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(W, H) * 0.2, 0, TAU);
    ctx.fill();
    ctx.restore();

    var S = scl(W, H);
    glowText(ctx, "HAPPY BIRTHDAY", cx, H * 0.135,
      "bold " + Math.round(26 * S) + "px 'Segoe Script','Curlz MT','微软雅黑',sans-serif",
      "#eaf4ff", 22);
    wishBlock(ctx, cfg, W, H, accent, { y: H * 0.82, wishColor: "rgba(220,235,255,0.88)" });
  }

  // ============================================================
  // 2. aurora · 极光雪夜
  // ============================================================
  function drawAurora(ctx, cfg, t, W, H) {
    var accent = cfg.accent || "#ffe9a8";
    paintBg(ctx, W, H, "#040a18", "#0a2b34");
    drawStarField(ctx, stars(W, H, Math.round(clamp(W * H / 6000, 60, 220)), 11), t);

    // 极光帷幕（多条发光波形，叠加提亮）
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var bands = [
      { y: 0.20, amp: 0.045, col: "rgba(90,255,205,0.16)", glow: "rgba(60,255,190,0.55)", lw: 0.075, spd: 0.45, ph: 0 },
      { y: 0.28, amp: 0.055, col: "rgba(120,200,255,0.14)", glow: "rgba(90,180,255,0.5)", lw: 0.06, spd: 0.32, ph: 2 },
      { y: 0.36, amp: 0.04, col: "rgba(210,140,255,0.12)", glow: "rgba(190,120,255,0.45)", lw: 0.05, spd: 0.6, ph: 4 },
      { y: 0.24, amp: 0.03, col: "rgba(160,255,230,0.12)", glow: "rgba(120,255,220,0.4)", lw: 0.03, spd: 0.85, ph: 1 }
    ];
    for (var b = 0; b < bands.length; b++) {
      var bd = bands[b];
      ctx.beginPath();
      for (var x = -20; x <= W + 20; x += W / 36) {
        var yy = H * bd.y
          + Math.sin((x / W) * 6.2 + t * bd.spd + bd.ph) * H * bd.amp
          + Math.sin((x / W) * 14 - t * 0.9 + bd.ph * 2) * H * bd.amp * 0.36;
        if (x <= -19) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = bd.col;
      ctx.lineWidth = H * bd.lw;
      ctx.lineCap = "round";
      ctx.shadowColor = bd.glow;
      ctx.shadowBlur = 46;
      ctx.stroke();
    }
    ctx.restore();

    // 远山剪影（两层）
    function mountain(baseY, amp, color, seed) {
      var g2 = ctx.createLinearGradient(0, baseY - amp * 1.6, 0, H);
      g2.addColorStop(0, color);
      g2.addColorStop(1, "#020409");
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(0, H);
      var steps = 14;
      for (var i = 0; i <= steps; i++) {
        var px = (i / steps) * W;
        var peak = baseY - amp * (0.35 + rnd(i + seed, 3) * 0.9)
          - Math.sin(i * 1.7 + seed) * amp * 0.25;
        ctx.lineTo(px, peak);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }
    mountain(H * 0.78, H * 0.16, "#0a1a22", 3);
    mountain(H * 0.9, H * 0.12, "#050c10", 8);

    // 飘雪
    var flakes = Math.round(clamp(W * H / 5500, 50, 170));
    ctx.save();
    for (var i = 0; i < flakes; i++) {
      var fx = (rnd(i, 21) * W + Math.sin(t * 0.6 + i) * 26 + W) % W;
      var fy = (rnd(i, 22) * H + t * (18 + rnd(i, 23) * 42)) % H;
      var fr = 0.8 + rnd(i, 24) * 2.1;
      ctx.globalAlpha = 0.35 + rnd(i, 25) * 0.5;
      ctx.fillStyle = "#eaf7ff";
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    wishBlock(ctx, cfg, W, H, accent, { y: H * 0.85, wishColor: "rgba(230,245,255,0.9)" });
  }

  // ============================================================
  // 3. neon · 霓虹雨夜
  // ============================================================
  function drawNeon(ctx, cfg, t, W, H) {
    var accent = cfg.accent || "#ffe9a8";
    paintBg(ctx, W, H, "#08000f", "#14082a");

    // 雨丝
    var drops = Math.round(clamp(W * H / 4200, 90, 320));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < drops; i++) {
      var dx = rnd(i, 31) * W + Math.sin(t * 0.4 + i) * 8;
      var len = 10 + rnd(i, 32) * 42;
      var spd = 420 + rnd(i, 33) * 620;
      var dy = ((rnd(i, 34) * (H + 200) + t * spd) % (H + 260)) - 130;
      var hue = rnd(i, 35);
      var col = hue < 0.6 ? "130,220,255" : (hue < 0.85 ? "255,120,220" : "180,255,235");
      ctx.strokeStyle = "rgba(" + col + ",0.32)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - 4, dy + len);
      ctx.stroke();
    }
    ctx.restore();

    // 地面湿润反光
    var rg = ctx.createLinearGradient(0, H * 0.7, 0, H);
    rg.addColorStop(0, "rgba(90,40,160,0)");
    rg.addColorStop(1, "rgba(130,60,200,0.28)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, H * 0.7, W, H * 0.3);

    var S = scl(W, H);
    var cx = W / 2;
    // 霓虹灯牌
    var flick = 0.82 + 0.18 * Math.sin(t * 15) + 0.06 * Math.sin(t * 47);
    if (Math.sin(t * 2.3) > -0.94) flick = 1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = clamp(flick, 0, 1);
    glowText(ctx, "生日快乐", cx, H * 0.3,
      "bold " + Math.round(56 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif",
      "#ff4fd8", 42);
    glowText(ctx, "生日快乐", cx, H * 0.3,
      "bold " + Math.round(56 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif",
      "#8ef2ff", 22);
    glowText(ctx, "生日快乐", cx, H * 0.3,
      "bold " + Math.round(56 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif",
      "#ffffff", 6);
    ctx.restore();

    // 灯牌外框
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(120,240,255,0.5)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(120,240,255,0.9)";
    ctx.shadowBlur = 18;
    var bw = Math.min(W * 0.84, 520 * S), bh = Math.round(96 * S);
    var bx = cx - bw / 2, by = H * 0.3 - bh * 0.72;
    var rr = 14 * S;
    ctx.beginPath();
    ctx.moveTo(bx + rr, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, rr);
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, rr);
    ctx.arcTo(bx, by + bh, bx, by, rr);
    ctx.arcTo(bx, by, bx + bw, by, rr);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    wishBlock(ctx, cfg, W, H, accent, { y: H * 0.73, wishColor: "rgba(220,235,255,0.9)" });
  }

  // ============================================================
  // 4. particlecake · 3D 粒子旋转蛋糕
  // ============================================================
  var FOCAL = 720;
  var cakeCache = null;
  function buildCake() {
    var layers = [
      { r: 148, h: 66, yc: -46, col: [255, 170, 190] },
      { r: 110, h: 58, yc: 34, col: [170, 205, 240] },
      { r: 72, h: 50, yc: 108, col: [250, 220, 160] }
    ];
    var pts = [];
    for (var li = 0; li < layers.length; li++) {
      var L = layers[li];
      var cnt = 280;
      for (var j = 0; j < cnt; j++) {
        var isTop = j % 3 === 0;
        var phi = TAU * (j / cnt) + rnd(j + li * 97, 6) * 0.18;
        var x, y, z, dk;
        if (isTop) {
          var rr = Math.sqrt(rnd(j + li * 97, 7)) * L.r;
          x = rr * Math.cos(phi);
          z = rr * Math.sin(phi);
          y = L.yc + L.h / 2;
          dk = 1.15;
        } else {
          x = L.r * Math.cos(phi);
          z = L.r * Math.sin(phi);
          y = L.yc - L.h / 2 + rnd(j + li * 97, 8) * L.h;
          dk = 0.7 + rnd(j + li * 97, 9) * 0.5;
        }
        pts.push({ x: x, y: y, z: z, c: L.col, dk: dk });
      }
    }
    // 盘子
    for (var p = 0; p < 200; p++) {
      var pa = TAU * (p / 200);
      pts.push({
        x: 176 * Math.cos(pa), y: -92, z: 176 * Math.sin(pa),
        c: [215, 220, 235], dk: 0.9
      });
    }
    return pts;
  }

  function drawParticleCake(ctx, cfg, t, W, H) {
    var accent = cfg.accent || "#ffe9a8";
    paintBg(ctx, W, H, "#0a0616", "#1a0e33");
    drawStarField(ctx, stars(W, H, 120, 77), t);

    if (!cakeCache) cakeCache = buildCake();
    var S = scl(W, H);
    var cx = W / 2, cy = H * 0.52;
    var ang = t * 0.55;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var out = [];

    for (var i = 0; i < cakeCache.length; i++) {
      var p = cakeCache[i];
      var xr = p.x * ca + p.z * sa;
      var zr = -p.x * sa + p.z * ca;
      var d = FOCAL + zr * S;
      if (d < 60) d = 60;
      var k = FOCAL / d;
      out.push({
        sx: cx + xr * S * k * 0.62,
        sy: cy - p.y * S * k * 0.62,
        d: zr,
        r: clamp(k * 2.3 * S, 0.7, 4.2),
        c: p.c,
        dk: p.dk
      });
    }
    out.sort(function (a, b) { return a.d - b.d; });

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var n = 0; n < out.length; n++) {
      var q = out[n];
      var a = clamp(0.25 + (q.d + 200) / 420, 0.12, 0.95) * q.dk;
      ctx.fillStyle = "rgba(" + q.c[0] + "," + q.c[1] + "," + q.c[2] + "," + a.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(q.sx, q.sy, q.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // 蜡烛火光
    var flameY = cy - 190 * S;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var flick = 1 + 0.22 * Math.sin(t * 11) + 0.1 * Math.sin(t * 27);
    var fg = ctx.createRadialGradient(cx, flameY, 0, cx, flameY, 60 * S * flick);
    fg.addColorStop(0, "rgba(255,246,200,0.95)");
    fg.addColorStop(0.4, "rgba(255,190,90,0.55)");
    fg.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(cx, flameY, 60 * S * flick, 0, TAU);
    ctx.fill();
    ctx.restore();

    var S2 = scl(W, H);
    glowText(ctx, "Happy Birthday", cx, H * 0.13,
      "bold " + Math.round(36 * S2) + "px 'Segoe Script','Curlz MT','微软雅黑',sans-serif",
      accent, 20);
    wishBlock(ctx, cfg, W, H, accent, { y: H * 0.8, wishColor: "rgba(230,225,255,0.88)" });
  }

  // ============================================================
  // 5. heartstorm · 3D 心形粒子风暴
  // ============================================================
  function heartPoint(u) {
    var x = 16 * Math.pow(Math.sin(u), 3);
    var y = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);
    return [x / 17, -y / 17];
  }

  function drawHeartStorm(ctx, cfg, t, W, H) {
    var accent = cfg.accent || "#ffe9a8";
    paintBg(ctx, W, H, "#0d0410", "#240a1e");
    drawStarField(ctx, stars(W, H, 110, 33), t);

    var S = scl(W, H);
    var cx = W / 2, cy = H * 0.44;
    var R = Math.min(W, H) * 0.31;
    var N = Math.round(clamp(W * H / 3400, 120, 420));
    var ang = t * 0.8;

    var pts = [];
    for (var i = 0; i < N; i++) {
      var u = TAU * (i / N);
      var hp = heartPoint(u);
      var thick = (rnd(i, 41) - 0.5) * 0.55;
      var jitter = 1 + (rnd(i, 42) - 0.5) * 0.14;
      var hx = hp[0] * jitter, hy = hp[1] * jitter;
      var rot = ang + (rnd(i, 43) - 0.5) * 0.35;
      var xr = hx * Math.cos(rot) + thick * Math.sin(rot);
      var zr = -hx * Math.sin(rot) + thick * Math.cos(rot);
      var k = 1 / (1 + zr * 0.35);
      pts.push({
        x: cx + xr * R * k,
        y: cy + hy * R * k,
        d: zr,
        r: clamp(2.4 * S * k, 0.8, 3.6),
        hue: rnd(i, 44)
      });
    }
    pts.sort(function (a, b) { return b.d - a.d; });

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var j = 0; j < pts.length; j++) {
      var p = pts[j];
      var a = 0.35 + 0.55 * (1 - clamp((p.d + 1) / 2, 0, 1));
      var col = p.hue < 0.5 ? "255,90,140" : (p.hue < 0.8 ? "255,150,190" : "255,220,150");
      ctx.fillStyle = "rgba(" + col + "," + a.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    // 外围心形光环
    ctx.strokeStyle = "rgba(255,120,170,0.35)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255,90,150,0.8)";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    for (var m = 0; m <= 120; m++) {
      var uu = TAU * (m / 120);
      var hq = heartPoint(uu);
      var px = cx + hq[0] * R * 1.12;
      var py = cy + hq[1] * R * 1.12;
      if (m === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    var title = (cfg.name ? cfg.name : "") + " · 心动预警";
    glowText(ctx, title, cx, H * 0.72,
      "bold " + Math.round(22 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif",
      "#ffd9e6", 16);
    wishBlock(ctx, cfg, W, H, accent, { y: H * 0.81, wishColor: "rgba(255,225,235,0.9)" });
  }

  // ============================================================
  // 6. bokeh · 梦幻散景光斑
  // ============================================================
  var bokehSprite = null;
  function getBokehSprite() {
    if (bokehSprite) return bokehSprite;
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var g = c.getContext("2d");
    var grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,0.85)");
    grd.addColorStop(0.55, "rgba(255,255,255,0.28)");
    grd.addColorStop(0.86, "rgba(255,255,255,0.12)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(64, 64, 63, 0, TAU);
    g.fill();
    bokehSprite = c;
    return c;
  }

  function drawBokeh(ctx, cfg, t, W, H) {
    var accent = cfg.accent || "#ffe9a8";
    paintBg(ctx, W, H, "#120a1c", "#2a1230");
    // 底部暖光
    var bg = ctx.createRadialGradient(W * 0.5, H * 0.92, 0, W * 0.5, H * 0.92, Math.max(W, H) * 0.7);
    bg.addColorStop(0, "rgba(255,170,120,0.22)");
    bg.addColorStop(1, "rgba(255,170,120,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    var sp = getBokehSprite();
    var N = Math.round(clamp(W * H / 7000, 30, 90));
    var palette = [
      "rgba(255,214,140,0.55)",
      "rgba(255,170,200,0.5)",
      "rgba(180,200,255,0.45)",
      "rgba(200,150,255,0.42)",
      "rgba(150,255,220,0.4)"
    ];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < N; i++) {
      var size = (0.06 + rnd(i, 51) * 0.18) * Math.min(W, H);
      var spd = 8 + rnd(i, 52) * 26;
      var yy = H + size - ((rnd(i, 53) * (H + size * 2) + t * spd) % (H + size * 2));
      var xx = (rnd(i, 54) * W + Math.sin(t * 0.35 + i) * 30 + W) % W;
      var al = 0.5 + 0.5 * Math.sin(t * (0.5 + rnd(i, 55)) + i);
      ctx.globalAlpha = 0.35 + al * 0.5;
      ctx.fillStyle = palette[(rnd(i, 56) * palette.length) | 0];
      ctx.drawImage(sp, xx - size / 2, yy - size / 2, size, size);
    }
    ctx.restore();

    var S = scl(W, H);
    glowText(ctx, "Happy Birthday", W / 2, H * 0.34,
      "bold " + Math.round(38 * S) + "px 'Segoe Script','Curlz MT','微软雅黑',sans-serif",
      accent, 26);
    wishBlock(ctx, cfg, W, H, accent, { y: H * 0.7, wishColor: "rgba(255,240,225,0.9)" });
  }

  // ============================================================
  // 7. ribbon · 流光丝带
  // ============================================================
  function ribbonY(x, W, H, k, t) {
    var nx = x / W;
    return H * (0.34 + k * 0.1)
      + Math.sin(nx * 5.6 + t * (0.55 + k * 0.12) + k * 1.7) * H * 0.11
      + Math.sin(nx * 12.5 - t * 1.1 + k * 2.4) * H * 0.035;
  }

  function drawRibbon(ctx, cfg, t, W, H) {
    var accent = cfg.accent || "#ffe9a8";
    paintBg(ctx, W, H, "#070512", "#120a26");
    drawStarField(ctx, stars(W, H, 110, 55), t);

    var cols = ["#4de2ff", "#7c9bff", "#c86bff", "#ff6bd6", "#ffc46b"];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var k = 0; k < 5; k++) {
      var g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.2, cols[k]);
      g.addColorStop(0.5, cols[(k + 2) % cols.length]);
      g.addColorStop(0.8, cols[k]);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.4 + k * 1.1;
      ctx.globalAlpha = 0.5 + 0.25 * Math.sin(t * 0.8 + k);
      ctx.shadowColor = cols[k];
      ctx.shadowBlur = 18;
      ctx.beginPath();
      for (var x = -20; x <= W + 20; x += W / 60) {
        var y = ribbonY(x, W, H, k, t);
        if (x <= -19) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 沿线流动光点
    for (var s = 0; s < 40; s++) {
      var kk = s % 5;
      var prog = ((rnd(s, 61) + t * (0.05 + rnd(s, 62) * 0.08)) % 1);
      var sx = prog * W;
      var sy = ribbonY(sx, W, H, kk, t);
      var tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + s));
      ctx.globalAlpha = tw;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2 + tw * 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    var S = scl(W, H);
    glowText(ctx, "Happy Birthday", W / 2, H * 0.15,
      "bold " + Math.round(32 * S) + "px 'Segoe Script','Curlz MT','微软雅黑',sans-serif",
      accent, 20);
    wishBlock(ctx, cfg, W, H, accent, { y: H * 0.78, wishColor: "rgba(225,235,255,0.9)" });
  }

  // ============================================================
  // 8. candle · 烛光暖夜
  // ============================================================
  function drawCandle(ctx, cfg, t, W, H) {
    var accent = cfg.accent || "#ffe9a8";
    // 暖色径向背景
    var bg = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.85);
    bg.addColorStop(0, "#2b1a12");
    bg.addColorStop(0.5, "#140a10");
    bg.addColorStop(1, "#050308");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 暖色散景
    var sp = getBokehSprite();
    var N = Math.round(clamp(W * H / 12000, 18, 46));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < N; i++) {
      var size = (0.05 + rnd(i, 71) * 0.12) * Math.min(W, H);
      var yy = H + size - ((rnd(i, 72) * (H + size * 2) + t * (10 + rnd(i, 73) * 20)) % (H + size * 2));
      var xx = (rnd(i, 74) * W + Math.sin(t * 0.3 + i) * 20 + W) % W;
      ctx.globalAlpha = 0.18 + 0.22 * Math.abs(Math.sin(t * 0.7 + i));
      ctx.fillStyle = "rgba(255,196,120,0.75)";
      ctx.drawImage(sp, xx - size / 2, yy - size / 2, size, size);
    }
    ctx.restore();

    var S = scl(W, H);
    var cx = W / 2;
    var cw = Math.max(26 * S, W * 0.045);
    var ch = H * 0.2;
    var bottom = H * 0.66;
    var topY = bottom - ch;

    // 烛身
    var bodyG = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
    bodyG.addColorStop(0, "#b8895e");
    bodyG.addColorStop(0.35, "#ffe9c9");
    bodyG.addColorStop(0.62, "#f2d3a8");
    bodyG.addColorStop(1, "#8a6240");
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(cx - cw / 2, bottom);
    ctx.lineTo(cx - cw / 2, topY + cw * 0.25);
    ctx.quadraticCurveTo(cx - cw / 2, topY, cx - cw * 0.2, topY);
    ctx.quadraticCurveTo(cx + cw * 0.1, topY + cw * 0.06, cx + cw / 2, topY + cw * 0.2);
    ctx.lineTo(cx + cw / 2, bottom);
    ctx.closePath();
    ctx.fill();

    // 顶部融蜡
    ctx.fillStyle = "rgba(255,241,214,0.9)";
    ctx.beginPath();
    ctx.ellipse(cx, topY + cw * 0.14, cw * 0.5, cw * 0.17, 0, 0, TAU);
    ctx.fill();
    // 蜡泪
    ctx.fillStyle = "rgba(250,228,196,0.85)";
    ctx.beginPath();
    ctx.ellipse(cx - cw * 0.44, topY + ch * 0.12, cw * 0.1, ch * 0.12, 0, 0, TAU);
    ctx.fill();

    // 烛芯
    ctx.strokeStyle = "#3a2414";
    ctx.lineWidth = Math.max(1.4, 2 * S);
    ctx.beginPath();
    ctx.moveTo(cx, topY + cw * 0.1);
    ctx.lineTo(cx + 1 * S, topY - 8 * S);
    ctx.stroke();

    // 火焰（多层 + 光晕）
    var flick = 1 + 0.16 * Math.sin(t * 12) + 0.08 * Math.sin(t * 29 + 1.7);
    var fy = topY - 18 * S;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var halo = ctx.createRadialGradient(cx, fy, 0, cx, fy, 120 * S * flick);
    halo.addColorStop(0, "rgba(255,220,150,0.55)");
    halo.addColorStop(0.35, "rgba(255,160,60,0.25)");
    halo.addColorStop(1, "rgba(255,120,30,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, fy, 120 * S * flick, 0, TAU);
    ctx.fill();

    function flame(w, h, col, oy) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx, fy - h + oy);
      ctx.bezierCurveTo(cx + w, fy - h * 0.4 + oy, cx + w * 0.9, fy + oy, cx, fy + oy);
      ctx.bezierCurveTo(cx - w * 0.9, fy + oy, cx - w, fy - h * 0.4 + oy, cx, fy - h + oy);
      ctx.fill();
    }
    flame(16 * S * flick, 34 * S * flick, "rgba(255,150,50,0.75)", 6 * S);
    flame(10 * S * flick, 26 * S * flick, "rgba(255,205,110,0.9)", 4 * S);
    flame(4.5 * S * flick, 15 * S * flick, "rgba(255,252,230,1)", 2 * S);
    ctx.restore();

    // 桌面反光
    var rg = ctx.createRadialGradient(cx, bottom, 0, cx, bottom, Math.max(W, H) * 0.5);
    rg.addColorStop(0, "rgba(255,170,90,0.2)");
    rg.addColorStop(1, "rgba(255,170,90,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, bottom - 10, W, H - bottom + 10);

    glowText(ctx, "生日快乐", cx, H * 0.15,
      "bold " + Math.round(30 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif",
      accent, 20);
    wishBlock(ctx, cfg, W, H, accent, { y: H * 0.79, wishColor: "rgba(255,238,215,0.92)" });
  }

  // ============================================================
  // 9. matrixcode · 代码雨
  // ============================================================
  function drawMatrix(ctx, cfg, t, W, H) {
    var accent = cfg.accent || "#ffe9a8";
    ctx.fillStyle = "#020604";
    ctx.fillRect(0, 0, W, H);

    var chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789生日快乐愿你所求皆如愿";
    var S = scl(W, H);
    var colW = Math.max(14, 20 * S);
    var cols = Math.ceil(W / colW) + 1;
    var fontPx = Math.round(clamp(colW * 0.92, 10, 22));

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "bold " + fontPx + "px 'Courier New','Consolas',monospace";
    for (var c = 0; c < cols; c++) {
      var spd = 26 + rnd(c, 81) * 62;         // px/s
      var off = rnd(c, 82) * (H + 260);
      var headY = ((t * spd + off) % (H + 260)) - 160;
      var x = c * colW + colW / 2;
      var trail = 14;
      for (var k = 0; k < trail; k++) {
        var y = headY - k * fontPx * 1.15;
        if (y < -fontPx || y > H + fontPx) continue;
        var alpha = Math.pow(1 - k / trail, 1.9);
        var idx = Math.floor(rnd(c * 131 + k, Math.floor(t * 4 + c)) * chars.length);
        if (k === 0) {
          ctx.fillStyle = "rgba(220,255,230," + (0.9 * alpha + 0.1).toFixed(3) + ")";
          ctx.shadowColor = "rgba(90,255,160,0.9)";
          ctx.shadowBlur = 12;
        } else {
          ctx.fillStyle = "rgba(60,255,130," + (0.62 * alpha).toFixed(3) + ")";
          ctx.shadowBlur = 0;
        }
        ctx.fillText(chars.charAt(idx), x, y);
      }
    }
    ctx.restore();

    // 暗角，突出中央文字
    var vg = ctx.createRadialGradient(W / 2, H * 0.58, Math.min(W, H) * 0.12, W / 2, H * 0.58, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(2,10,6,0.55)");
    vg.addColorStop(1, "rgba(0,4,2,0.9)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    var nameText = (cfg.name ? cfg.name + "，" : "") + "生日快乐";
    glowText(ctx, nameText, W / 2, H * 0.56,
      "bold " + Math.round(30 * S) + "px '微软雅黑','Microsoft YaHei',sans-serif",
      "#b6ffcf", 26);
    wishBlock(ctx, cfg, W, H, accent, { y: H * 0.72, wishColor: "rgba(180,255,210,0.88)" });
  }

  // ============================================================
  // 10. vortex · 银河漩涡
  // ============================================================
  function drawVortex(ctx, cfg, t, W, H) {
    var accent = cfg.accent || "#ffe9a8";
    paintBg(ctx, W, H, "#04030e", "#0c0722");
    drawStarField(ctx, stars(W, H, 150, 91), t);

    var cx = W / 2, cy = H * 0.44;
    var maxR = Math.hypot(W, H) * 0.42;
    var N = Math.round(clamp(W * H / 2600, 220, 700));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < N; i++) {
      var arm = i % 3;
      var rf = Math.pow(rnd(i, 101), 0.65);
      var a0 = arm * (TAU / 3) + rf * 5.6 + rnd(i, 102) * 0.55;
      var ang = a0 + t * (0.5 - rf * 0.28);
      var r = rf * maxR;
      var px = cx + Math.cos(ang) * r;
      var py = cy + Math.sin(ang) * r * 0.44;
      var size = (1.9 - rf * 1.4) * scl(W, H) + 0.5;
      var mix = rf; // 内金外蓝
      var cr = Math.round(255 - mix * 140);
      var cg = Math.round(220 - mix * 60);
      var cb = Math.round(150 + mix * 105);
      var a = 0.18 + (1 - rf) * 0.6;
      ctx.fillStyle = "rgba(" + cr + "," + cg + "," + cb + "," + a.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(px, py, size, 0, TAU);
      ctx.fill();
    }
    // 核心光球
    var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.22);
    core.addColorStop(0, "rgba(255,255,245,0.95)");
    core.addColorStop(0.25, "rgba(255,225,170,0.6)");
    core.addColorStop(0.6, "rgba(255,160,120,0.18)");
    core.addColorStop(1, "rgba(120,80,255,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(W, H) * 0.22, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 流星
    var shoot = (t * 0.12) % 1;
    if (shoot < 0.55) {
      var sx = W * (0.15 + shoot * 0.9);
      var sy = H * (0.12 + shoot * 0.28);
      var lg = ctx.createLinearGradient(sx, sy, sx - W * 0.12, sy - H * 0.06);
      lg.addColorStop(0, "rgba(255,255,255,0.9)");
      lg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = lg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - W * 0.12, sy - H * 0.06);
      ctx.stroke();
    }

    var S = scl(W, H);
    glowText(ctx, "Happy Birthday", W / 2, H * 0.13,
      "bold " + Math.round(34 * S) + "px 'Segoe Script','Curlz MT','微软雅黑',sans-serif",
      accent, 22);
    wishBlock(ctx, cfg, W, H, accent, { y: H * 0.8, wishColor: "rgba(215,225,255,0.9)" });
  }

  // ---------- 注册 10 个新模板 ----------
  var extra = {
    warp: {
      id: "warp", name: "星际跃迁", draw: drawWarp,
      desc: "超空间星线拖尾 + 光核跃迁，强烈穿越感"
    },
    aurora: {
      id: "aurora", name: "极光雪夜", draw: drawAurora,
      desc: "多层极光帷幕 + 雪山剪影 + 飘雪"
    },
    neon: {
      id: "neon", name: "霓虹雨夜", draw: drawNeon,
      desc: "赛博霓虹灯牌 + 雨丝 + 湿地面反光"
    },
    particlecake: {
      id: "particlecake", name: "粒子旋转蛋糕", draw: drawParticleCake,
      desc: "上千粒子组成的 3D 旋转蛋糕 + 烛光"
    },
    heartstorm: {
      id: "heartstorm", name: "心形粒子风暴", draw: drawHeartStorm,
      desc: "3D 心形粒子旋转 + 发光轮廓"
    },
    bokeh: {
      id: "bokeh", name: "梦幻散景", draw: drawBokeh,
      desc: "漂浮光斑散景 + 柔焦梦幻氛围"
    },
    ribbon: {
      id: "ribbon", name: "流光丝带", draw: drawRibbon,
      desc: "多条流光丝带交织 + 沿线星点"
    },
    candle: {
      id: "candle", name: "烛光暖夜", draw: drawCandle,
      desc: "写实烛焰呼吸 + 暖色光晕散景"
    },
    matrixcode: {
      id: "matrixcode", name: "代码雨", draw: drawMatrix,
      desc: "绿字代码雨 + 居中发光祝福"
    },
    vortex: {
      id: "vortex", name: "银河漩涡", draw: drawVortex,
      desc: "旋臂银河 + 核心光球 + 流星"
    }
  };

  for (var key in extra) {
    if (Object.prototype.hasOwnProperty.call(extra, key)) registry[key] = extra[key];
  }
})(window);
