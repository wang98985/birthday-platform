/* 生日代码平台 · 前端主逻辑 */
(function () {
  "use strict";

  const T = window.BirthdayTemplates;
  const BR = window.BirthdayRenderer;
  const BM = window.BirthdayMusic;
  const registry = T.registry;
  const BUILTIN_IDS = Object.keys(registry);
  const BASE_TITLE = document.title;
  let tplStore = { custom: [], hidden: [] };

  const defaultCfg = {
    template: "galaxy",
    name: "亲爱的你",
    birthday: "",
    wish: "愿新的一岁 闪闪发光\n平安喜乐 万事胜意",
    signoff: "—— 藏在代码里的浪漫",
    letter: "",
    notes: "",
    accent: "#ffe9a8",
    pixel: false,
    music: { enabled: false, source: "none", trackId: "", url: "", volume: 0.6 }
  };
  let cfg = Object.assign({}, defaultCfg);
  cfg.music = Object.assign({}, defaultCfg.music);
  let currentLink = "";

  const encodeConfig = BR.encodeConfig;
  // 即时链接：配置走 hash，若该配置已生成过短链，则附带 ?s=<slug>，这样也能收愿望
  function instantLink(c) {
    const s = rememberedShareFor(c);
    return location.origin + "/view" + (s ? "?s=" + s.slug : "") +
      "#c=" + encodeConfig(c);
  }

  // ---------- 渲染循环（仅 canvas 模板） ----------
  const active = []; // {canvas, tpl, cfg}
  let pvActive = null; // 预览弹窗内的 canvas
  const renderTo = BR.renderTo;
  function loop(now) {
    const t = now / 1000;
    for (const a of active) renderTo(a.canvas, a.tpl, a.cfg, t);
    if (pvActive) renderTo(pvActive.canvas, pvActive.tpl, pvActive.cfg, t);
    requestAnimationFrame(loop);
  }

  // ---------- 转场 ----------
  const TRANSITIONS = ["fade", "zoom", "flip", "wipe", "iris", "slide"];
  const TR_LABEL = { fade: "淡入", zoom: "缩放", flip: "翻转", wipe: "划入", iris: "光圈", slide: "上滑" };
  function transitionFor(id) {
    let h = 0;
    const s = String(id || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return TRANSITIONS[h % TRANSITIONS.length];
  }
  function playTransition(el, type) {
    if (!el) return;
    const cls = "tr-" + (type || "fade");
    el.classList.remove("tr-fade", "tr-zoom", "tr-flip", "tr-wipe", "tr-iris", "tr-slide");
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 950);
  }

  // ---------- 特效库清单 ----------
  const FX = Array.isArray(window.BirthdayEffects) ? window.BirthdayEffects : [];
  function fxTpl(fx) {
    return {
      id: "fx-" + fx.id, name: fx.name, desc: fx.desc,
      kind: "iframe", embedUrl: "/fx/" + fx.id, accent: fx.accent
    };
  }

  // ---------- 音乐 ----------
  const player = new BM.MusicPlayer();
  let musicCtrl = null;
  let iframeTimer = null;

  function cfgChanged() {
    if (musicCtrl) musicCtrl.refresh();
    queueDraftSave();
    // iframe 模板：配置变更后防抖刷新 iframe src
    const tpl = registry[cfg.template];
    if (tpl && tpl.kind === "iframe") {
      if (iframeTimer) clearTimeout(iframeTimer);
      iframeTimer = setTimeout(function () {
        BR.mountIframe(document.getElementById("preview").parentElement, tpl, cfg, editorEmbedQuery(tpl));
      }, 500);
    }
  }

  // 编辑器内预览跳过模板自带开场，避免每次改文案都重播
  function editorEmbedQuery(tpl) {
    if (!tpl) return "";
    if (tpl.id === "hbcake" || tpl.id === "starwish") return "nointro=1";
    return "";
  }

  // ---------- 模板库 ----------
  function visibleIds() {
    const out = [];
    BUILTIN_IDS.forEach(function (id) {
      if (tplStore.hidden.indexOf(id) === -1) out.push(id);
    });
    tplStore.custom.forEach(function (c) {
      if (c && c.id && registry[c.id]) out.push(c.id);
    });
    return out;
  }

  async function loadTemplates() {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      tplStore.custom = Array.isArray(data.custom) ? data.custom : [];
      tplStore.hidden = Array.isArray(data.hidden) ? data.hidden : [];
    } catch (e) {
      tplStore = { custom: [], hidden: [] };
    }
    // 把自定义模板合并进 registry，使其可被编辑器 / 预览直接使用
    tplStore.custom.forEach(function (c) {
      if (!c || !c.id) return;
      if (c.kind === "iframe") {
        registry[c.id] = {
          id: c.id, name: c.name || "自定义模板",
          desc: c.desc || "自定义 HTML 模板", kind: "iframe",
          embedUrl: "/embed/" + c.id, custom: true, sandbox: true,
          defaultMusic: c.music || null
        };
      } else if (c.kind === "effect" && c.effect) {
        registry[c.id] = {
          id: c.id, name: c.name || "自定义模板",
          desc: c.desc || "特效库特效", kind: "iframe",
          embedUrl: "/fx/" + c.effect, custom: true,
          accent: c.accent || "", defaultMusic: c.music || null
        };
      } else {
        const base = registry[c.base] || registry.galaxy;
        registry[c.id] = {
          id: c.id, name: c.name || "自定义模板",
          desc: c.desc || "Canvas 风格变体", kind: "canvas",
          draw: base.draw, forcePixel: !!base.forcePixel,
          custom: true, accent: c.accent || "",
          defaultMusic: c.music || null
        };
      }
    });
  }

  function refreshTools() {
    const btn = document.getElementById("btn-restore-tpl");
    if (btn) btn.style.display = tplStore.hidden.length ? "" : "none";
  }

  function buildGallery() {
    const wrap = document.getElementById("gallery");
    wrap.innerHTML = "";
    active.length = 0;

    visibleIds().forEach(function (id, idx) {
      const tpl = registry[id];
      if (!tpl) return;
      const card = document.createElement("div");
      card.className = "tpl-card";
      card.style.animationDelay = Math.min(idx * 26, 420) + "ms";

      const inner = document.createElement("div");
      inner.className = "card-inner";

      // 正面：缩略图 + 名称
      const front = document.createElement("div");
      front.className = "card-face front";
      const thumbWrap = document.createElement("div");
      thumbWrap.className = "thumb-wrap";
      const badge = document.createElement("span");
      badge.className = "badge" + (tpl.kind === "iframe" ? " iframe" : "");
      badge.textContent = tpl.kind === "iframe" ? "网页" : (tpl.forcePixel ? "像素" : "动画");
      const canvas = document.createElement("canvas");
      canvas.className = "thumb";
      thumbWrap.appendChild(badge);
      if (tpl.defaultMusic && tpl.defaultMusic.enabled) {
        const mBadge = document.createElement("span");
        mBadge.className = "badge music";
        mBadge.textContent = "♪ 音乐";
        thumbWrap.appendChild(mBadge);
      }
      thumbWrap.appendChild(canvas);
      const body = document.createElement("div");
      body.className = "body";
      body.innerHTML = "<h3></h3><p></p>";
      body.querySelector("h3").textContent = tpl.name;
      body.querySelector("p").textContent = tpl.desc;
      front.appendChild(thumbWrap);
      front.appendChild(body);

      // 背面：描述 + 预览 / 使用
      const trType = transitionFor(id);
      const back = document.createElement("div");
      back.className = "card-face back";
      back.innerHTML = '<h3></h3><span class="tr-chip"></span><p></p>' +
        '<div class="back-actions">' +
        '<button type="button" class="btn" data-act="preview">预览</button>' +
        '<button type="button" class="btn primary" data-act="use">使用此模板</button>' +
        '</div>';
      back.querySelector("h3").textContent = tpl.name;
      back.querySelector(".tr-chip").textContent = "转场 · " + (TR_LABEL[trType] || "淡入");
      back.querySelector("p").textContent = tpl.desc;

      front.addEventListener("click", function () { openPreview(id); });
      back.querySelector('[data-act="preview"]').addEventListener("click", function (ev) {
        ev.stopPropagation(); openPreview(id);
      });
      back.querySelector('[data-act="use"]').addEventListener("click", function (ev) {
        ev.stopPropagation(); closePreview(); openEditor(id);
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "tpl-del";
      del.title = "删除模板";
      del.textContent = "×";
      del.addEventListener("click", function (ev) {
        ev.stopPropagation();
        removeTemplate(id);
      });

      inner.appendChild(front);
      inner.appendChild(back);
      card.appendChild(inner);
      card.appendChild(del);
      wrap.appendChild(card);

      const demoCfg = {
        template: id, name: "亲爱的你", birthday: "",
        wish: "愿新的一岁闪闪发光\n平安喜乐",
        signoff: "—— 藏在代码里的浪漫",
        accent: tpl.accent || "#ffe9a8", pixel: !!tpl.forcePixel
      };
      if (tpl.kind === "iframe") {
        // iframe 模板：画一张静态海报当缩略图
        (function (cv, name, accent) {
          requestAnimationFrame(function () {
            const W = cv.clientWidth, H = cv.clientHeight;
            if (!W || !H) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
            const ctx = cv.getContext("2d");
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            T.drawPoster(ctx, W, H, name, accent || "#ffe9a8");
          });
        })(canvas, tpl.name, tpl.accent);
      } else {
        active.push({ canvas: canvas, tpl: tpl, cfg: demoCfg });
      }
    });

    // 末尾「添加自定义模板」卡片
    const addCard = document.createElement("div");
    addCard.className = "tpl-card add-card";
    addCard.innerHTML = '<div class="plus">+</div><span class="txt">添加自定义模板</span>';
    addCard.addEventListener("click", openAddTemplate);
    wrap.appendChild(addCard);

    refreshTools();
  }

  // ---------- 特效库 ----------
  function buildFxGallery() {
    const wrap = document.getElementById("fx-gallery");
    if (!wrap) return;
    wrap.innerHTML = "";
    FX.forEach(function (fx, idx) {
      const tpl = fxTpl(fx);
      const trType = transitionFor(tpl.id);
      const card = document.createElement("div");
      card.className = "fx-card";
      card.style.setProperty("--fx", fx.accent || "#8fb8ff");
      card.style.animationDelay = Math.min(idx * 24, 420) + "ms";

      const inner = document.createElement("div");
      inner.className = "card-inner";

      const front = document.createElement("div");
      front.className = "card-face fx-face front";
      front.innerHTML = '<span class="fx-tag">EFFECT</span>' +
        '<span class="fx-name"></span><span class="fx-hint">点击预览</span>';
      front.querySelector(".fx-name").textContent = fx.name;

      const back = document.createElement("div");
      back.className = "card-face back fx-face back";
      back.innerHTML = '<span class="fx-accent"></span><h3></h3><p></p>' +
        '<div class="back-actions">' +
        '<button type="button" class="btn" data-act="preview">预览</button>' +
        '<button type="button" class="btn primary" data-act="use">用作模板</button>' +
        '</div>';
      back.querySelector("h3").textContent = fx.name;
      back.querySelector("p").textContent = fx.desc + " · 转场：" + (TR_LABEL[trType] || "淡入");

      front.addEventListener("click", function () { openFxPreview(fx); });
      back.querySelector('[data-act="preview"]').addEventListener("click", function (ev) {
        ev.stopPropagation(); openFxPreview(fx);
      });
      back.querySelector('[data-act="use"]').addEventListener("click", function (ev) {
        ev.stopPropagation(); closePreview(); useEffectAsTemplate(fx);
      });

      inner.appendChild(front);
      inner.appendChild(back);
      card.appendChild(inner);
      wrap.appendChild(card);
    });
  }

  // ---------- 预览弹窗 ----------
  let pvTpl = null;
  let pvFx = null;

  function previewCfgFor(tpl) {
    const c = Object.assign({}, cfg);
    c.template = tpl.id;
    c.accent = tpl.accent || cfg.accent;
    return c;
  }

  function showPreview(tpl, fx) {
    if (window.BirthdayWishIntro) window.BirthdayWishIntro.close(true);
    pvTpl = tpl;
    pvFx = fx || null;
    document.getElementById("pv-title").textContent = tpl.name;
    document.getElementById("pv-desc").textContent = tpl.desc || "";
    const stage = document.getElementById("pv-stage");
    const canvas = document.getElementById("pv-canvas");
    pvActive = null;
    BR.removeIframe(stage);
    if (tpl.kind === "iframe") {
      canvas.classList.add("hidden");
      BR.mountIframe(stage, tpl, previewCfgFor(tpl));
    } else {
      canvas.classList.remove("hidden");
      pvActive = { canvas: canvas, tpl: tpl, cfg: previewCfgFor(tpl) };
    }
    document.getElementById("preview-modal").classList.add("active");
    playTransition(stage, transitionFor(tpl.id));
    if (window.BirthdayWishIntro && window.BirthdayWishIntro.shouldPlay(tpl)) {
      window.BirthdayWishIntro.play({
        container: stage, cfg: previewCfgFor(tpl), templateName: tpl.name
      });
    }
  }

  function openPreview(id) {
    const tpl = registry[id];
    if (tpl) showPreview(tpl, null);
  }

  function openFxPreview(fx) {
    showPreview(fxTpl(fx), fx);
  }

  function closePreview() {
    const modal = document.getElementById("preview-modal");
    if (!modal || !modal.classList.contains("active")) return;
    modal.classList.remove("active");
    pvActive = null;
    if (window.BirthdayWishIntro) window.BirthdayWishIntro.close(true);
    BR.removeIframe(document.getElementById("pv-stage"));
  }

  function useEffectAsTemplate(fx) {
    openAddTemplate();
    $("t-name").value = fx.name + " · 生日";
    $("t-desc").value = fx.desc || "";
    $("t-kind").value = "effect";
    $("t-effect").value = fx.id;
    toggleAddKind();
  }

  async function removeTemplate(id) {
    const tpl = registry[id];
    if (!tpl) return;
    const isCustom = !!tpl.custom;
    const msg = isCustom
      ? "确定删除自定义模板「" + tpl.name + "」？此操作不可恢复。"
      : "确定从模板库移除「" + tpl.name + "」？内置模板可一键恢复，已生成的链接不受影响。";
    if (!window.confirm(msg)) return;
    try {
      const res = await adminFetch("/api/templates/" + encodeURIComponent(id), { method: "DELETE" });
      // 404 表示已被删除（如其他标签页操作），视为成功
      if (!res.ok && res.status !== 404) { toast("删除失败"); return; }
      if (isCustom) {
        delete registry[id];
        tplStore.custom = tplStore.custom.filter(function (c) { return c.id !== id; });
      } else if (tplStore.hidden.indexOf(id) === -1) {
        tplStore.hidden.push(id);
      }
      buildGallery();
      toast("已删除");
    } catch (e) {
      toast("删除失败：" + e.message);
    }
  }

  // ---------- 添加模板 ----------
  function openAddTemplate() {
    $("t-name").value = "";
    $("t-desc").value = "";
    $("t-kind").value = "canvas";
    $("t-base").value = "galaxy";
    $("t-accent").value = "#ffe9a8";
    $("t-html").value = "";
    $("t-error").textContent = "";
    if (FX.length && !$("t-effect").options.length) fillEffectOptions();
    if (FX.length) $("t-effect").value = FX[0].id;
    // 默认音乐区重置
    $("t-music-enabled").checked = false;
    $("t-music-config").classList.remove("show");
    $("t-music-source").value = "builtin";
    $("t-music-file").value = "";
    $("t-music-volume").value = 0.6;
    toggleTplMusic();
    toggleAddKind();
    $("tpl-modal").classList.add("active");
  }

  function fillEffectOptions() {
    const sel = $("t-effect");
    sel.innerHTML = "";
    FX.forEach(function (fx) {
      const o = document.createElement("option");
      o.value = fx.id;
      o.textContent = fx.name + " · " + fx.desc;
      sel.appendChild(o);
    });
  }

  function toggleAddKind() {
    const kind = $("t-kind").value;
    $("t-base-wrap").style.display = kind === "canvas" ? "" : "none";
    $("t-html-wrap").style.display = kind === "iframe" ? "" : "none";
    $("t-effect-wrap").style.display = kind === "effect" ? "" : "none";
  }

  function toggleTplMusic() {
    $("t-music-config").classList.toggle("show", $("t-music-enabled").checked);
    syncTplMusicSource();
  }

  function syncTplMusicSource() {
    const src = $("t-music-source").value;
    $("t-music-builtin-wrap").style.display = (src === "builtin") ? "" : "none";
    $("t-music-upload-wrap").style.display = (src === "upload") ? "" : "none";
  }

  async function submitAddTemplate() {
    const errEl = $("t-error");
    errEl.textContent = "";
    const name = $("t-name").value.trim();
    const kind = $("t-kind").value;
    if (!name) { errEl.textContent = "请填写模板名称"; return; }
    if (kind === "iframe") {
      const file = $("t-html").files && $("t-html").files[0];
      if (!file) { errEl.textContent = "请选择 HTML 文件"; return; }
      if (file.size > 2 * 1024 * 1024) { errEl.textContent = "文件超过 2MB"; return; }
    }
    if (kind === "effect" && !$("t-effect").value) {
      errEl.textContent = "请选择要使用的特效";
      return;
    }
    const fd = new FormData();
    fd.append("name", name);
    fd.append("desc", $("t-desc").value.trim());
    fd.append("kind", kind);
    fd.append("accent", $("t-accent").value);
    if (kind === "iframe") fd.append("html", $("t-html").files[0]);
    else if (kind === "effect") fd.append("effect", $("t-effect").value);
    else fd.append("base", $("t-base").value);

    // 模板默认背景音乐
    const musicOn = $("t-music-enabled").checked;
    fd.append("music_enabled", musicOn ? "1" : "0");
    if (musicOn) {
      const mSrc = $("t-music-source").value;
      fd.append("music_source", mSrc);
      fd.append("music_track", $("t-music-track").value);
      fd.append("music_volume", $("t-music-volume").value);
      if (mSrc === "upload") {
        const mf = $("t-music-file").files && $("t-music-file").files[0];
        if (!mf) { errEl.textContent = "请选择要上传的音乐文件"; return; }
        fd.append("music_file", mf);
      }
    }

    const btn = $("t-submit");
    btn.disabled = true; btn.textContent = "添加中…";
    try {
      const res = await adminFetch("/api/templates", { method: "POST", body: fd });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        errEl.textContent = "添加失败：" + (data && data.error ? data.error : "未知错误");
        return;
      }
      $("tpl-modal").classList.remove("active");
      await loadTemplates();
      buildGallery();
      toast("模板已添加");
    } catch (e) {
      errEl.textContent = "添加失败：" + e.message;
    } finally {
      btn.disabled = false; btn.textContent = "添加";
    }
  }


  // ---------- 编辑器 ----------
  const $ = (id) => document.getElementById(id);

  function openEditor(id) {
    cfg.template = id;
    const tpl = registry[id];
    draftArmed = false;
    const draftBar = $("draft-bar");
    if (draftBar) draftBar.style.display = "none";
    document.getElementById("gallery-view").style.display = "none";
    document.getElementById("editor-view").classList.add("active");
    document.getElementById("tpl-name").textContent = tpl.name;
    $("preview-tag").textContent = tpl.name + (tpl.forcePixel ? " · 像素" : (tpl.kind === "iframe" ? " · 网页" : ""));

    // 表单回填（自定义模板可带默认主题色）
    if (tpl.accent) cfg.accent = tpl.accent;
    $("f-name").value = cfg.name;
    $("f-birthday").value = cfg.birthday;
    $("f-wish").value = cfg.wish;
    $("f-signoff").value = cfg.signoff;
    $("f-accent").value = cfg.accent;
    $("f-pixel").checked = !!cfg.pixel;
    // 信件内容仅对带信件的模板开放
    $("f-letter").value = cfg.letter || "";
    $("letter-field").style.display = tpl.letters ? "" : "none";
    // 翻牌背面寄语仅对带翻牌卡片的模板开放
    $("f-notes").value = cfg.notes || "";
    $("notes-field").style.display = tpl.notes ? "" : "none";
    // 像素开关仅对 canvas 模板有意义
    $("f-pixel").parentElement.style.display = (tpl.kind === "iframe") ? "none" : "";

    // 音乐表单回填（自定义模板可带默认音乐，自动套用）
    const dm = tpl.defaultMusic;
    if (dm && dm.enabled) {
      cfg.music = {
        enabled: true,
        source: dm.source || "none",
        trackId: dm.trackId || "",
        url: dm.url || "",
        volume: typeof dm.volume === "number" ? dm.volume : 0.6
      };
    }
    $("f-music-enabled").checked = !!cfg.music.enabled;
    $("music-config").classList.toggle("show", !!cfg.music.enabled);
    $("f-music-source").value = cfg.music.source || "none";
    $("f-music-volume").value = cfg.music.volume;
    syncMusicSourceUI();
    if (cfg.music.url) {
      $("music-upload-name").textContent = "已上传：" + (cfg.music.url.split("/").pop() || "音乐");
    } else {
      $("music-upload-name").textContent = "未上传";
    }

    // 模板下拉
    const tplSel = $("f-template");
    tplSel.innerHTML = "";
    for (const k in registry) {
      const o = document.createElement("option");
      o.value = k; o.textContent = registry[k].name;
      if (k === id) o.selected = true;
      tplSel.appendChild(o);
    }

    // 预览接管：canvas / iframe 二选一
    const previewWrap = $("preview").parentElement;
    const canvas = $("preview");
    active.length = 0;
    if (tpl.kind === "iframe") {
      canvas.classList.add("hidden");
      BR.mountIframe(previewWrap, tpl, cfg, editorEmbedQuery(tpl));
    } else {
      canvas.classList.remove("hidden");
      BR.removeIframe(previewWrap);
      active.push({ canvas: canvas, tpl: tpl, cfg: cfg });
    }
    playTransition(previewWrap, transitionFor(id));
    if (window.BirthdayWishIntro) {
      window.BirthdayWishIntro.close(true);
      if (window.BirthdayWishIntro.shouldPlay(tpl)) {
        window.BirthdayWishIntro.play({ container: previewWrap, cfg: cfg, templateName: tpl.name });
      }
    }

    // 同步音乐播放器
    player.setConfig(cfg.music);
    cfgChanged();
  }

  function closeEditor() {
    player.pause();
    if (window.BirthdayWishIntro) window.BirthdayWishIntro.close(true);
    document.getElementById("editor-view").classList.remove("active");
    document.getElementById("gallery-view").style.display = "block";
    buildGallery();
  }

  function syncMusicSourceUI() {
    const src = $("f-music-source").value;
    $("music-builtin-wrap").style.display = (src === "builtin") ? "" : "none";
    $("music-upload-wrap").style.display = (src === "upload") ? "" : "none";
  }

  // 翻牌背面寄语：随机生成 12 句，生成后仍可手动修改
  const NOTE_POOL = [
    "愿这份祝福，陪你走过闪闪发光的新一岁",
    "愿你所求皆如愿，所行皆坦途",
    "愿你眼里有光，心中有爱，脚下有路",
    "愿每一岁都奔走在自己的热爱里",
    "愿你被这个世界温柔以待",
    "愿你今后的每一天都有好心情",
    "愿所有美好都如期而至",
    "愿你永远有说走就走的勇气",
    "愿你所有的努力都不被辜负",
    "愿你平安喜乐，万事胜意",
    "愿你笑起来像星星一样亮",
    "愿你日子清透，抬头遇见的都是温柔",
    "愿你新的一岁，有酒有肉有朋友",
    "愿你每一天都被幸福轻轻拥抱",
    "愿时光温柔，愿你事事顺心",
    "愿你想要的都拥有，得不到的都释怀",
    "愿你不慌不忙，心之所向，素履以往",
    "愿你今年的愿望，明年都实现",
    "愿你永远保持热爱，奔赴山海",
    "愿你的世界永远晴朗，没有阴霾",
    "愿你岁岁平安，年年有今朝",
    "愿你三餐四季，温柔有趣",
    "愿你往后的日子，处处是惊喜",
    "愿你自在如风，明亮如星",
    "愿有人懂你的奇奇怪怪，陪你可可爱爱",
    "愿你被爱包围，被幸福追随"
  ];

  function randomNotes() {
    const pool = NOTE_POOL.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    cfg.notes = pool.slice(0, 12).join("\n");
    $("f-notes").value = cfg.notes;
    draftArmed = true;
    cfgChanged();
    toast("已随机生成 12 句，可继续修改");
  }

  function bindForm() {
    $("f-name").addEventListener("input", function (e) { cfg.name = e.target.value.slice(0, 30); cfgChanged(); });
    $("f-birthday").addEventListener("input", function (e) { cfg.birthday = e.target.value; cfgChanged(); });
    $("f-wish").addEventListener("input", function (e) { cfg.wish = e.target.value.slice(0, 300); cfgChanged(); });
    $("f-signoff").addEventListener("input", function (e) { cfg.signoff = e.target.value.slice(0, 40); cfgChanged(); });
    $("f-letter").addEventListener("input", function (e) { cfg.letter = e.target.value.slice(0, 1000); cfgChanged(); });
    $("f-notes").addEventListener("input", function (e) { cfg.notes = e.target.value.slice(0, 600); cfgChanged(); });
    $("btn-notes-random").addEventListener("click", randomNotes);
    $("f-accent").addEventListener("input", function (e) { cfg.accent = e.target.value; queueDraftSave(); });
    $("f-pixel").addEventListener("change", function (e) { cfg.pixel = e.target.checked; queueDraftSave(); });
    $("f-template").addEventListener("change", function (e) { openEditor(e.target.value); });
    $("btn-back").addEventListener("click", closeEditor);

    // 填充内置曲目下拉
    const trackSel = $("f-music-track");
    trackSel.innerHTML = "";
    BM.BUILTIN.forEach(function (t) {
      const o = document.createElement("option");
      o.value = t.id; o.textContent = t.name;
      trackSel.appendChild(o);
    });
    if (cfg.music.trackId) trackSel.value = cfg.music.trackId;
    if (!trackSel.value && BM.BUILTIN[0]) trackSel.value = BM.BUILTIN[0].id;

    $("f-music-enabled").addEventListener("change", function (e) {
      cfg.music.enabled = e.target.checked;
      $("music-config").classList.toggle("show", cfg.music.enabled);
      if (!cfg.music.enabled) player.pause();
      player.setConfig(cfg.music);
      cfgChanged();
    });
    $("f-music-source").addEventListener("change", function (e) {
      cfg.music.source = e.target.value;
      syncMusicSourceUI();
      player.setConfig(cfg.music);
      cfgChanged();
    });
    $("f-music-track").addEventListener("change", function (e) {
      cfg.music.trackId = e.target.value;
      player.setConfig(cfg.music);
      cfgChanged();
    });
    $("f-music-volume").addEventListener("input", function (e) {
      const v = parseFloat(e.target.value);
      cfg.music.volume = v;
      player.setVolume(v);
      queueDraftSave();
    });
    $("f-music-file").addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      if (file) uploadMusic(file);
    });
  }

  async function uploadMusic(file) {
    const nameEl = $("music-upload-name");
    nameEl.textContent = "上传中…";
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await adminFetch("/api/upload/music", { method: "POST", body: fd });
      if (res.status === 429) { toast("上传过于频繁，请稍后再试"); nameEl.textContent = "未上传"; return; }
      const data = await res.json();
      if (data && data.url) {
        cfg.music.url = data.url;
        cfg.music.source = "upload";
        $("f-music-source").value = "upload";
        syncMusicSourceUI();
        nameEl.textContent = "已上传：" + (data.name || data.url.split("/").pop());
        player.setConfig(cfg.music);
        draftArmed = true;
        cfgChanged();
        toast("音乐上传成功");
      } else {
        nameEl.textContent = "未上传";
        toast(data && data.error === "quota" ? "音乐空间已满，暂时无法上传" :
          ("上传失败：" + (data && data.error ? data.error : "未知错误")));
      }
    } catch (err) {
      nameEl.textContent = "未上传";
      toast("上传失败：" + err.message);
    }
  }

  // ---------- 愿望信箱（主人侧） ----------
  const INBOX_STORE = "bday_inboxes";
  let inboxCache = [];
  const SHARE_STORE = "bday_last_share";
  const ADMIN_STORE = "bday_admin_key";
  const DRAFT_STORE = "bday_draft";
  let draftTimer = null;
  let draftArmed = false;   // 只有真正编辑过才覆盖草稿，避免误点模板把旧草稿冲掉

  // ---------- 草稿自动保存 ----------
  function saveDraftNow() {
    if (!draftArmed) return;
    try {
      localStorage.setItem(DRAFT_STORE, JSON.stringify({ ts: Date.now(), cfg: cfg }));
    } catch (e) {}
  }
  function queueDraftSave() {
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraftNow, 600);
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_STORE) || "null");
      if (!d || !d.cfg || typeof d.cfg !== "object") return null;
      if (d.ts && Date.now() - d.ts > 7 * 24 * 3600 * 1000) return null;
      return d;
    } catch (e) {
      return null;
    }
  }
  function setupDraftBar() {
    const bar = $("draft-bar");
    const d = loadDraft();
    if (!bar || !d) return;
    bar.style.display = "";
    const when = d.ts ? new Date(d.ts).toLocaleString() : "";
    $("draft-info").textContent = "有未完成的草稿" + (when ? "（" + when + "）" : "");
    $("btn-draft-resume").onclick = function () {
      cfg = Object.assign({}, defaultCfg, d.cfg);
      cfg.music = Object.assign({}, defaultCfg.music, d.cfg.music || {});
      if (!registry[cfg.template]) cfg.template = "galaxy";
      draftArmed = true;
      bar.style.display = "none";
      openEditor(cfg.template);
      toast("已恢复草稿");
    };
    $("btn-draft-discard").onclick = function () {
      draftArmed = false;
      try { localStorage.removeItem(DRAFT_STORE); } catch (e) {}
      bar.style.display = "none";
      toast("已放弃草稿");
    };
  }

  // ---------- 管理口令 ----------
  function getAdminKey() {
    try { return localStorage.getItem(ADMIN_STORE) || ""; } catch (e) { return ""; }
  }
  function setAdminKey(k) {
    try {
      if (k) localStorage.setItem(ADMIN_STORE, k);
      else localStorage.removeItem(ADMIN_STORE);
    } catch (e) {}
  }
  function askAdminKey() {
    const v = window.prompt("请输入管理口令（服务端 ADMIN_KEY）");
    return v ? v.trim() : "";
  }
  // 管理接口统一请求：自动附带口令；401 时按需提示输入并重试一次
  async function adminFetch(url, opts, allowPrompt) {
    opts = opts || {};
    const send = function (key) {
      const o = Object.assign({}, opts);
      o.headers = Object.assign({}, opts.headers || {});
      if (key) o.headers["X-Admin-Key"] = key;
      return fetch(url, o);
    };
    let res = await send(getAdminKey());
    if (res.status === 403) {
      if (allowPrompt !== false) toast("该管理功能未开启（需在服务端设置 ADMIN_KEY）");
      return res;
    }
    if (res.status === 401 && allowPrompt !== false) {
      const input = askAdminKey();
      if (!input) return res;
      setAdminKey(input);
      res = await send(input);
      if (res.status === 401) toast("管理口令不正确");
    }
    return res;
  }

  function loadInboxes() {
    try {
      const arr = JSON.parse(localStorage.getItem(INBOX_STORE) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveInbox(entry) {
    const list = loadInboxes().filter(function (x) { return x.slug !== entry.slug; });
    list.unshift(entry);
    try { localStorage.setItem(INBOX_STORE, JSON.stringify(list.slice(0, 30))); } catch (e) {}
  }

  function rememberShare(entry) {
    try { localStorage.setItem(SHARE_STORE, JSON.stringify(entry)); } catch (e) {}
  }

  // 上一次生成的短链（不看内容是否变化），用于原地更新 / 删除
  function lastShareMeta() {
    try {
      const s = JSON.parse(localStorage.getItem(SHARE_STORE) || "null");
      if (s && s.slug && s.url && s.inboxUrl) return s;
    } catch (e) {}
    return null;
  }

  // 内容没变就复用同一个短链，避免每次分享都新开一个信箱
  function rememberedShareFor(c) {
    const s = lastShareMeta();
    if (s && s.fp === JSON.stringify(c)) return s;
    return null;
  }

  function rememberedShare() {
    return rememberedShareFor(cfg);
  }

  function showInbox(data) {
    if (!data || !data.inboxUrl) return;
    $("inbox-block").style.display = "";
    $("inbox-input").value = data.inboxUrl;
    $("btn-open-inbox").onclick = function () { window.open(data.inboxUrl, "_blank"); };
    saveInbox({
      slug: data.slug,
      name: cfg.name || "",
      inboxUrl: data.inboxUrl,
      ts: Date.now()
    });
  }

  // 从信箱链接里拆出 slug 与凭证：/inbox/<slug>#k=<key>
  function parseInboxUrl(raw) {
    const m = String(raw).trim().match(/\/inbox\/([A-Za-z0-9]{4,12})(?:[^#]*)#k=([A-Za-z0-9_-]+)/);
    return m ? { slug: m[1], key: m[2] } : null;
  }

  function forgetInbox(slug) {
    try {
      const left = loadInboxes().filter(function (x) { return x.slug !== slug; });
      localStorage.setItem(INBOX_STORE, JSON.stringify(left));
    } catch (e) {}
  }

  function fillInboxCount(row, url) {
    const parsed = parseInboxUrl(url);
    const line = row.querySelector(".inbox-date");
    if (!parsed || !line) return;
    // count=1 只取未读数，不会把新愿望标记成已读
    fetch("/api/wishes?count=1&slug=" + encodeURIComponent(parsed.slug) +
          "&key=" + encodeURIComponent(parsed.key))
      .then(function (r) {
        if (r.status === 404) {
          // 卡片已在别处删除：清掉本地记录，避免每次打开列表都 404
          forgetInbox(parsed.slug);
          row.classList.add("inbox-dead");
          line.textContent += " · 链接已失效（卡片已删除）";
          row.querySelectorAll("a.btn, button.btn").forEach(function (el) {
            el.classList.add("disabled");
            el.setAttribute("aria-disabled", "true");
            if (el.tagName === "A") el.removeAttribute("href");
            el.addEventListener("click", function (ev) { ev.preventDefault(); });
          });
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then(function (d) {
        if (!d) return;
        if (d.unread) line.textContent += " · " + d.unread + " 条新愿望";
        else line.textContent += d.count ? " · 暂无新愿望" : " · 暂无愿望";
      })
      .catch(function () {});
  }

  // 导航「愿望信箱」的未读角标（本机访问时可汇总全部信箱）
  async function refreshInboxBadge() {
    const badge = $("nav-inbox-badge");
    if (!badge) return;
    try {
      const res = await adminFetch("/api/inboxes", {}, false);
      if (!res.ok) return;
      const data = await res.json();
      const unread = (data.inboxes || []).reduce(function (n, x) {
        return n + (x.unread || 0);
      }, 0);
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.hidden = !unread;
      badge.title = unread ? unread + " 条新愿望" : "";
      // 标签页标题带未读数：切到别的标签时也能看到有新愿望
      document.title = unread ? "(" + unread + ") " + BASE_TITLE : BASE_TITLE;
    } catch (e) {}
  }

  async function openInboxList() {
    let list = loadInboxes();
    // 本机访问时并入服务端全部信箱：本次升级前的旧短链也能找回（远程访问会 403）
    try {
      const res = await adminFetch("/api/inboxes", {}, true);
      if (res.ok) {
        const data = await res.json();
        (data.inboxes || []).forEach(function (x) {
          const hit = list.find(function (y) { return y.slug === x.slug; });
          if (!hit) list.push({ slug: x.slug, name: x.name || "", inboxUrl: x.inboxUrl, ts: 0 });
          else if (!hit.name && x.name) hit.name = x.name;
        });
      } else if (res.status === 403 || res.status === 401) {
        // 公网部署时管理接口不可用：隐藏同样受限的导出按钮
        const box = $("db-export-block");
        if (box) box.style.display = "none";
      }
    } catch (e) {}
    const box = $("inbox-list");
    box.innerHTML = "";
    inboxCache = list;
    if (!list.length) {
      box.innerHTML = '<div class="inbox-empty">还没有愿望信箱。<br>生成分享链接时会自动创建，并在这里汇总。</div>';
    } else {
      list.forEach(function (item, idx) {
        const row = document.createElement("div");
        row.className = "inbox-item";
        const info = document.createElement("div");
        info.className = "inbox-info";
        const name = document.createElement("div");
        name.className = "inbox-name";
        name.textContent = item.name || "未命名祝福";
        const date = document.createElement("div");
        date.className = "inbox-date";
        date.textContent = new Date(item.ts).toLocaleString() + " · " + item.slug;
        info.appendChild(name);
        info.appendChild(date);
        const a = document.createElement("a");
        a.className = "btn small";
        a.href = item.inboxUrl;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "打开信箱";
        const acts = document.createElement("div");
        acts.className = "inbox-acts";
        const parsed = parseInboxUrl(item.inboxUrl);
        if (parsed) {
          const edit = document.createElement("a");
          edit.className = "btn small";
          edit.href = "/?edit=" + encodeURIComponent(item.slug) +
            "#k=" + encodeURIComponent(parsed.key);
          edit.textContent = "编辑";
          acts.appendChild(edit);
        }
        acts.appendChild(a);
        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn small";
        del.textContent = "删除";
        del.addEventListener("click", function () { deleteInbox(item); });
        acts.appendChild(del);
        row.appendChild(info);
        row.appendChild(acts);
        box.appendChild(row);
        if (idx < 10) fillInboxCount(row, item.inboxUrl);
      });
    }
    $("inbox-modal").classList.add("active");
  }

  // 一键已读：把列表里所有信箱的未读清零
  async function markAllInboxesRead() {
    const list = inboxCache.length ? inboxCache : loadInboxes();
    const jobs = [];
    list.forEach(function (item) {
      const p = parseInboxUrl(item.inboxUrl);
      if (!p) return;
      jobs.push(fetch("/api/wishes/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: p.slug, key: p.key })
      }).catch(function () {}));
    });
    if (!jobs.length) { toast("还没有可标记的信箱"); return; }
    await Promise.all(jobs);
    toast("已全部标为已读");
    refreshInboxBadge();
    openInboxList();
  }

  // 删除信箱：链接、愿望一并删除
  function deleteInbox(item) {
    const p = parseInboxUrl(item.inboxUrl);
    if (!p) { toast("缺少凭证，无法删除"); return; }
    const label = item.name || item.slug;
    if (!window.confirm("删除「" + label + "」这个信箱？\n分享链接会失效，收到的愿望也会一并删除。")) return;
    fetch("/api/cards/" + encodeURIComponent(item.slug) + "?key=" + encodeURIComponent(p.key),
      { method: "DELETE" })
      .then(function (res) {
        if (!res.ok && res.status !== 404) throw new Error("HTTP " + res.status);
        try {
          const saved = loadInboxes().filter(function (x) { return x.slug !== item.slug; });
          localStorage.setItem(INBOX_STORE, JSON.stringify(saved));
        } catch (e) {}
        try {
          const s = JSON.parse(localStorage.getItem(SHARE_STORE) || "null");
          if (s && s.slug === item.slug) localStorage.removeItem(SHARE_STORE);
        } catch (e) {}
        toast(res.status === 404 ? "该信箱已不存在，已从列表移除" : "信箱已删除");
        refreshInboxBadge();
        openInboxList();
      })
      .catch(function (e) { toast("删除失败：" + e.message); });
  }

  // ---------- 分享 / 二维码 ----------
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1800);
  }

  function renderQR(text) {
    const box = $("qrcode");
    box.innerHTML = "";
    if (!text) return;
    try {
      new QRCode(box, {
        text, width: 180, height: 180,
        colorDark: "#2b2722", colorLight: "#fffdf8",
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      box.textContent = "二维码生成失败：" + e.message;
    }
  }

  function applyShared(data, reused) {
    currentLink = data.url;
    $("link-input").value = data.url;
    $("short-note").textContent = (reused ? "沿用已生成的短链：" : "已保存为短链：") +
      data.slug + "（长期有效，可收愿望）";
    renderQR(data.url);
    showInbox(data);
    const del = $("btn-delete-card");
    if (del) del.style.display = data.ownerKey ? "" : "none";
    rememberShare({ fp: JSON.stringify(cfg), slug: data.slug, url: data.url,
                    inboxUrl: data.inboxUrl, ownerKey: data.ownerKey || "" });
  }

  function openShare() {
    $("inbox-block").style.display = "none";
    const del = $("btn-delete-card");
    if (del) del.style.display = "none";
    currentLink = instantLink(cfg);
    $("link-input").value = currentLink;
    renderQR(currentLink);
    $("modal").classList.add("active");
    // 只有短链页面才能收到 Ta 的愿望
    const cached = rememberedShare();
    if (cached) {
      applyShared(cached, true);
      return;
    }
    $("short-note").textContent = "正在生成可收愿望的链接…";
    saveShortLink();
  }

  // 优先沿用上一次的短链（原地更新内容），失败再新建，避免每次分享都生成新链接
  async function saveShortLink() {
    const btn = $("btn-save-short");
    btn.disabled = true; btn.textContent = "保存中…";
    try {
      const prev = lastShareMeta();
      if (prev && prev.ownerKey) {
        try {
          const up = await fetch("/api/cards/" + encodeURIComponent(prev.slug), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerKey: prev.ownerKey, config: cfg })
          });
          if (up.ok) {
            const data = await up.json();
            applyShared(data, true);
            toast("已更新到原链接");
            return;
          }
        } catch (e) { /* 更新失败则继续新建 */ }
      }
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg)
      });
      if (res.status === 429) {
        $("short-note").textContent = "请求过于频繁，当前仅为即时链接（收不到愿望）";
        toast("请求过于频繁，请稍后再试");
        return;
      }
      const data = await res.json();
      if (data.url) {
        applyShared(data, false);
        toast("链接已生成");
      }
    } catch (e) {
      $("short-note").textContent = "当前仅为即时链接（收不到愿望）";
      toast("保存失败：" + e.message);
    } finally {
      btn.disabled = false; btn.textContent = "保存 / 更新链接";
    }
  }

  // 从 /?edit=<slug>#k=<ownerKey> 载入已有卡片继续编辑，分享时原地更新
  async function tryLoadEditCard() {
    const params = new URLSearchParams(location.search);
    const slug = params.get("edit");
    if (!slug || !/^[A-Za-z0-9]{4,12}$/.test(slug)) return;
    let key = "";
    const m = location.hash.match(/^#k=(.+)$/);
    if (m) key = decodeURIComponent(m[1]);
    if (!key) {
      const prev = lastShareMeta();
      if (prev && prev.slug === slug && prev.ownerKey) key = prev.ownerKey;
    }
    try {
      const res = await fetch("/api/cards/" + encodeURIComponent(slug));
      if (!res.ok) { toast("这张卡片不存在或已被删除"); return; }
      const data = await res.json();
      if (!data || typeof data !== "object") return;
      cfg = Object.assign({}, defaultCfg, data);
      cfg.music = Object.assign({}, defaultCfg.music, data.music || {});
      const base = location.origin;
      rememberShare({
        fp: JSON.stringify(cfg), slug: slug,
        url: base + "/c/" + slug,
        inboxUrl: key ? base + "/inbox/" + slug + "#k=" + encodeURIComponent(key) : "",
        ownerKey: key
      });
      // 地址栏不留主人凭证，避免误复制整条地址把钥匙发出去
      try { history.replaceState(null, "", "/?edit=" + encodeURIComponent(slug)); } catch (e) {}
      openEditor(cfg.template || "galaxy");
      toast(key ? "已载入卡片，改完点生成分享链接即可更新" : "缺少主人凭证，分享时会新建链接");
    } catch (e) {
      toast("载入卡片失败：" + e.message);
    }
  }


  // 删除当前分享的卡片：链接失效，收到的愿望一并删除
  async function deleteCurrentCard() {
    const prev = lastShareMeta();
    if (!prev || !prev.ownerKey) { toast("没有可删除的短链"); return; }
    if (!window.confirm("确定删除这张卡片？链接将失效，收到的愿望也会一并删除。")) return;
    try {
      const res = await fetch("/api/cards/" + encodeURIComponent(prev.slug) +
        "?key=" + encodeURIComponent(prev.ownerKey), { method: "DELETE" });
      if (!res.ok && res.status !== 404) { toast("删除失败"); return; }
      try { localStorage.removeItem(SHARE_STORE); } catch (e) {}
      try {
        const list = loadInboxes().filter(function (x) { return x.slug !== prev.slug; });
        localStorage.setItem(INBOX_STORE, JSON.stringify(list));
      } catch (e) {}
      $("btn-delete-card").style.display = "none";
      $("inbox-block").style.display = "none";
      $("short-note").textContent = "卡片已删除，当前链接仅作即时预览。";
      toast("卡片已删除");
    } catch (e) {
      toast("删除失败：" + e.message);
    }
  }

  function copyLink() {
    const v = $("link-input").value;
    navigator.clipboard.writeText(v).then(() => toast("链接已复制")).catch(() => {
      $("link-input").select(); document.execCommand("copy"); toast("链接已复制");
    });
  }

  function fullPreview() {
    window.open(instantLink(cfg), "_blank");
  }

  // ---------- 下载 Python 代码 ----------
  function pyEscape(s) {
    return (s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      .replace(/\n/g, "\\n").replace(/\r/g, "");
  }
  async function downloadPython() {
    try {
      const tpl = await fetch("/cake_template.py").then(r => r.text());
      const code = tpl
        .replace("__NAME__", pyEscape(cfg.name))
        .replace("__BIRTHDAY__", pyEscape(cfg.birthday))
        .replace("__WISH__", pyEscape(cfg.wish))
        .replace("__SUB__", pyEscape(cfg.signoff));
      const blob = new Blob([code], { type: "text/x-python;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = ((cfg.name || "birthday").replace(/[\\/:*?"<>|]/g, "_")) + "_cake.py";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Python 代码已下载");
    } catch (e) {
      toast("下载失败：" + e.message);
    }
  }

  // ---------- 启动 ----------
  async function init() {
    await loadTemplates();
    buildGallery();
    buildFxGallery();
    bindForm();
    // 在编辑器里真正输入过，才开始覆盖草稿
    const editorEl = $("editor-view");
    if (editorEl) {
      ["input", "change"].forEach(function (evt) {
        editorEl.addEventListener(evt, function () { draftArmed = true; }, true);
      });
    }
    setupDraftBar();
    await tryLoadEditCard();
    // 音乐浮动按钮挂到预览容器
    const previewWrap = $("preview").parentElement;
    musicCtrl = BM.attachControls(player, previewWrap);
    player.setConfig(cfg.music);

    $("btn-share").addEventListener("click", openShare);
    $("btn-save-short").addEventListener("click", saveShortLink);
    $("btn-copy").addEventListener("click", copyLink);
    $("btn-full").addEventListener("click", fullPreview);
    $("btn-download-py").addEventListener("click", downloadPython);
    $("modal-close").addEventListener("click", () => $("modal").classList.remove("active"));
    $("modal").addEventListener("click", e => {
      if (e.target.id === "modal") $("modal").classList.remove("active");
    });
    $("btn-copy-inbox").addEventListener("click", function () {
      const v = $("inbox-input").value;
      navigator.clipboard.writeText(v).then(() => toast("信箱链接已复制")).catch(() => {
        $("inbox-input").select(); document.execCommand("copy"); toast("信箱链接已复制");
      });
    });
    $("nav-inbox").addEventListener("click", function (e) {
      e.preventDefault();
      openInboxList();
    });
    $("inbox-close").addEventListener("click", () => $("inbox-modal").classList.remove("active"));
    $("btn-read-all-inboxes").addEventListener("click", markAllInboxesRead);
    $("btn-inbox-manual").addEventListener("click", function () {
      const raw = $("inbox-manual").value.trim();
      const parsed = parseInboxUrl(raw);
      if (!parsed) { toast("链接格式不对，应形如 /inbox/xxx#k=…"); return; }
      let url = raw;
      if (url.indexOf("http") !== 0) url = location.origin + (raw.charAt(0) === "/" ? raw : "/" + raw);
      saveInbox({ slug: parsed.slug, name: "手动添加", inboxUrl: url, ts: Date.now() });
      $("inbox-manual").value = "";
      $("inbox-modal").classList.remove("active");
      window.open(url, "_blank");
    });
    $("inbox-modal").addEventListener("click", e => {
      if (e.target.id === "inbox-modal") $("inbox-modal").classList.remove("active");
    });
    $("btn-db-export").addEventListener("click", async function () {
      try {
        const res = await adminFetch("/api/db/export", {}, true);
        if (!res.ok) { toast("导出失败：需要管理口令"); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "cards.db";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        toast("已导出 cards.db");
      } catch (e) {
        toast("导出失败：" + e.message);
      }
    });
    $("btn-delete-card").addEventListener("click", deleteCurrentCard);
    $("btn-new-card").addEventListener("click", function () {
      if (!window.confirm("为当前内容新建一条短链？原来的卡片和愿望都会保留。")) return;
      try { localStorage.removeItem(SHARE_STORE); } catch (e) {}
      $("inbox-block").style.display = "none";
      $("btn-delete-card").style.display = "none";
      $("short-note").textContent = "正在生成新的短链…";
      saveShortLink();
    });

    // 模板添加 / 删除 / 恢复
    $("btn-add-tpl").addEventListener("click", openAddTemplate);
    $("t-kind").addEventListener("change", toggleAddKind);
    fillEffectOptions();
    $("t-music-enabled").addEventListener("change", toggleTplMusic);
    $("t-music-source").addEventListener("change", syncTplMusicSource);
    // 模板弹窗的内置曲目下拉
    const tTrack = $("t-music-track");
    tTrack.innerHTML = "";
    BM.BUILTIN.forEach(function (t) {
      const o = document.createElement("option");
      o.value = t.id; o.textContent = t.name;
      tTrack.appendChild(o);
    });
    $("t-cancel").addEventListener("click", () => $("tpl-modal").classList.remove("active"));
    $("t-submit").addEventListener("click", submitAddTemplate);
    $("tpl-modal").addEventListener("click", e => {
      if (e.target.id === "tpl-modal") $("tpl-modal").classList.remove("active");
    });

    // 预览弹窗
    $("pv-close").addEventListener("click", closePreview);
    $("preview-modal").addEventListener("click", e => {
      if (e.target.id === "preview-modal") closePreview();
    });
    $("pv-use").addEventListener("click", function () {
      const tpl = pvTpl, fx = pvFx;
      closePreview();
      if (!tpl) return;
      if (fx) useEffectAsTemplate(fx);
      else openEditor(tpl.id);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePreview();
    });
    $("btn-restore-tpl").addEventListener("click", async function () {
      try {
        const res = await adminFetch("/api/templates/restore", { method: "POST" });
        if (!res.ok) { toast("恢复失败"); return; }
        await loadTemplates();
        buildGallery();
        toast("已恢复内置模板");
      } catch (e) {
        toast("恢复失败：" + e.message);
      }
    });

    requestAnimationFrame(loop);
    refreshInboxBadge();
    // 从别的标签切回来时刷新未读数
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshInboxBadge();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
