/* 1.html 同款星愿开场：星河、流星、玻璃质感与 3D 祝福卡。
 * 所有模板可复用，自动结束，也可点击“开启祝福”立即进入原模板。
 */
(function (g) {
  "use strict";
  let current = null;

  const CSS = `
.wish-intro{position:fixed;inset:0;z-index:35;overflow:hidden;color:#f6f2ff;
font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",Arial,sans-serif;
background:radial-gradient(1200px 800px at 18% 8%,rgba(96,64,190,.42),transparent 62%),
radial-gradient(900px 700px at 86% 82%,rgba(206,80,142,.28),transparent 62%),
linear-gradient(160deg,#070714 0%,#0d0b24 46%,#120a1f 100%);
animation:wiIn .45s ease both;}
.wish-intro.local{position:absolute;z-index:20;}
.wish-intro.is-leaving{animation:wiOut .5s cubic-bezier(.4,0,.2,1) both;pointer-events:none;}
.wish-intro canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.wi-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
justify-content:center;padding:26px 18px;text-align:center;}
.wi-card{width:min(440px,88vw);height:230px;perspective:1100px;cursor:pointer;}
.wi-card-inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;
transition:transform .8s cubic-bezier(.2,.75,.25,1);}
.wi-card.flipped .wi-card-inner{transform:rotateY(180deg);}
.wi-face{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
justify-content:center;padding:26px 28px;border-radius:22px;border:1px solid rgba(255,225,170,.28);
background:linear-gradient(150deg,rgba(255,255,255,.12),rgba(255,255,255,.035));
box-shadow:0 26px 70px rgba(0,0,0,.42),0 0 40px rgba(255,210,122,.08);
-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);
backface-visibility:hidden;-webkit-backface-visibility:hidden;}
.wi-back{transform:rotateY(180deg);background:linear-gradient(150deg,rgba(255,210,122,.16),rgba(24,20,44,.82));}
.wi-eyebrow{margin:0 0 14px;font-size:10px;letter-spacing:.36em;text-indent:.36em;
color:rgba(255,210,122,.76);text-transform:uppercase;}
.wi-title{margin:0;font-size:clamp(25px,5vw,38px);line-height:1.35;letter-spacing:.05em;
background:linear-gradient(180deg,#fffaf0 0%,#ffe4b0 55%,#f2b45c 100%);
-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
filter:drop-shadow(0 6px 24px rgba(255,190,110,.3));}
.wi-star{margin-bottom:10px;color:#ffd27a;font-size:24px;text-shadow:0 0 24px rgba(255,210,122,.65);}
.wi-hint{margin:18px 0 0;font-size:11px;letter-spacing:.16em;color:rgba(255,255,255,.42);}
.wi-wish{margin:0;max-height:108px;overflow:hidden;white-space:pre-line;font-size:15px;line-height:1.9;
letter-spacing:.04em;color:#fff3df;}
.wi-sign{margin:12px 0 0;font-size:12px;color:rgba(255,210,122,.78);letter-spacing:.08em;}
.wi-enter{margin-top:24px;padding:11px 28px;border:0;border-radius:999px;cursor:pointer;
font:600 14px/1.2 inherit;letter-spacing:.08em;color:#241a06;
background:linear-gradient(135deg,#ffe6b0,#ffd27a 45%,#f6b74b);
box-shadow:0 10px 26px rgba(255,190,90,.3);transition:transform .25s,box-shadow .25s;}
.wi-enter:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(255,190,90,.42);}
.wi-template{margin:14px 0 0;font-size:10px;letter-spacing:.16em;color:rgba(255,255,255,.3);}
@keyframes wiIn{from{opacity:0}to{opacity:1}}
@keyframes wiOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.035)}}
@media(max-width:520px){.wi-card{height:210px}.wi-face{padding:22px 20px}.wi-wish{font-size:14px}}
@media(prefers-reduced-motion:reduce){.wi-card-inner{transition-duration:.01ms}.wish-intro{animation-duration:.01ms}}
`;

  function ensureCSS() {
    if (document.getElementById("wish-intro-css")) return;
    const style = document.createElement("style");
    style.id = "wish-intro-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function close(immediate) {
    if (!current) return;
    const item = current;
    current = null;
    clearTimeout(item.flipTimer);
    clearTimeout(item.closeTimer);
    cancelAnimationFrame(item.raf);
    window.removeEventListener("resize", item.resize);
    if (immediate) {
      item.root.remove();
      if (item.onDone) item.onDone();
      return;
    }
    item.root.classList.add("is-leaving");
    setTimeout(function () {
      item.root.remove();
      if (item.onDone) item.onDone();
    }, 500);
  }

  function play(options) {
    options = options || {};
    close(true);
    ensureCSS();

    const cfg = options.cfg || {};
    const host = options.container || document.body;
    const local = host !== document.body;
    const name = String(cfg.name || "亲爱的你").trim() || "亲爱的你";
    const wish = String(cfg.wish || "愿新的一岁 闪闪发光\n平安喜乐 万事胜意").trim();
    const signoff = String(cfg.signoff || "—— 藏在代码里的浪漫").trim();
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const root = document.createElement("div");
    root.className = "wish-intro" + (local ? " local" : "");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "生日祝福开场");
    root.innerHTML =
      '<canvas aria-hidden="true"></canvas>' +
      '<div class="wi-center">' +
        '<div class="wi-card" tabindex="0">' +
          '<div class="wi-card-inner">' +
            '<div class="wi-face wi-front">' +
              '<p class="wi-eyebrow">A LITTLE WISH FOR YOU</p>' +
              '<div class="wi-star">✦</div>' +
              '<h2 class="wi-title"></h2>' +
              '<p class="wi-hint">轻触卡片，翻开你的祝福</p>' +
            '</div>' +
            '<div class="wi-face wi-back">' +
              '<div class="wi-star">✦</div>' +
              '<p class="wi-wish"></p>' +
              '<p class="wi-sign"></p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="wi-enter">开启祝福</button>' +
        (options.templateName ? '<p class="wi-template"></p>' : '') +
      '</div>';
    root.querySelector(".wi-title").textContent = name + "，生日快乐";
    root.querySelector(".wi-wish").textContent = wish;
    root.querySelector(".wi-sign").textContent = signoff;
    if (options.templateName) root.querySelector(".wi-template").textContent = "即将进入 · " + options.templateName;
    host.appendChild(root);

    const card = root.querySelector(".wi-card");
    function flip() { card.classList.toggle("flipped"); }
    card.addEventListener("click", flip);
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); }
    });
    root.querySelector(".wi-enter").addEventListener("click", function () { close(false); });

    const canvas = root.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, stars = [], meteors = [], lastMeteor = 0;
    function resize() {
      const rect = local ? host.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, rect.width); H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(180, Math.max(55, Math.floor(W * H / 8500)));
      stars = [];
      for (let i = 0; i < count; i++) {
        stars.push({ x: Math.random() * W, y: Math.random() * H, r: .35 + Math.random() * 1.35,
          a: .2 + Math.random() * .8, da: (Math.random() * .018 + .005) * (Math.random() < .5 ? -1 : 1),
          gold: Math.random() < .24 });
      }
    }
    function frame(now) {
      if (!current || current.root !== root) return;
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        s.a += s.da;
        if (s.a > 1 || s.a < .12) { s.da *= -1; s.a = Math.max(.12, Math.min(1, s.a)); }
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.gold ? "rgba(255,210,122," + s.a + ")" : "rgba(228,234,255," + s.a * .9 + ")";
        ctx.fill();
      }
      if (now - lastMeteor > 2300 && meteors.length < 2) {
        lastMeteor = now;
        meteors.push({ x: W * (.12 + Math.random() * .65), y: Math.random() * H * .32,
          vx: 3.8 + Math.random() * 2, vy: 1.6 + Math.random(), life: 1 });
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]; m.x += m.vx; m.y += m.vy; m.life -= .018;
        if (m.life <= 0 || m.x > W + 100 || m.y > H + 100) { meteors.splice(i, 1); continue; }
        const tx = m.x - m.vx * 32, ty = m.y - m.vy * 32;
        const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
        grad.addColorStop(0, "rgba(255,255,255," + m.life + ")"); grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = grad; ctx.lineWidth = 1.8; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      }
      current.raf = requestAnimationFrame(frame);
    }

    current = { root: root, raf: 0, resize: resize, flipTimer: null, closeTimer: null,
      onDone: typeof options.onDone === "function" ? options.onDone : null };
    resize();
    window.addEventListener("resize", resize, { passive: true });
    current.raf = requestAnimationFrame(frame);
    current.flipTimer = setTimeout(function () { card.classList.add("flipped"); }, reduced ? 100 : 750);
    current.closeTimer = setTimeout(function () { close(false); }, reduced ? 1800 : (options.duration || 4800));
    return close;
  }

  function shouldPlay(tpl) {
    if (!tpl) return false;
    const id = String(tpl.id || "");
    const embedUrl = String(tpl.embedUrl || "");
    return id !== "starwish" && id !== "hb-story" && id !== "hbcake" &&
      id.indexOf("fx-") !== 0 && embedUrl.indexOf("/fx/") !== 0;
  }

  g.BirthdayWishIntro = { play: play, close: close, shouldPlay: shouldPlay };
})(window);
