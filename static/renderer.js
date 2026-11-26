/* 共享：配置编解码 + Canvas 渲染（含 DPR / 像素化后处理）
 * 编辑器预览与全屏观看页共用，保证效果一致。
 */
(function (g) {
  "use strict";

  function encodeConfig(c) {
    const json = JSON.stringify(c);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeConfig(s) {
    s = (s || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  }

  function renderTo(canvas, tpl, cfgObj, t) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    const pixel = !!cfgObj.pixel || !!tpl.forcePixel;
    if (pixel) {
      if (!canvas._off) canvas._off = document.createElement("canvas");
      const off = canvas._off;
      const pw = Math.max(2, Math.floor(W / 6));
      const ph = Math.max(2, Math.floor(H / 6));
      if (off.width !== pw * dpr) off.width = pw * dpr;
      if (off.height !== ph * dpr) off.height = ph * dpr;
      const octx = off.getContext("2d");
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tpl.draw(octx, cfgObj, t, pw, ph);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tpl.draw(ctx, cfgObj, t, W, H);
    }
  }

  // ---------- iframe 模板嵌入 ----------
  // 生成带配置的 iframe src（?c=<base64url>）
  // extra：额外的查询串（如编辑时跳过开场动画）
  // 模板自带原声时，若平台已开启背景音乐，附带 mute=1 避免两首同时播放
  function embedSrc(tpl, cfgObj, extra) {
    const parts = [];
    if (extra) parts.push(extra);
    const music = cfgObj && cfgObj.music;
    if (tpl.ownAudio && music && music.enabled && music.source && music.source !== "none") {
      parts.push("mute=1");
    }
    const q = parts.length ? parts.join("&") + "&" : "";
    return (tpl.embedUrl || "/") + "?" + q + "c=" + encodeConfig(cfgObj);
  }
  // 在 hostEl 内挂载/刷新一个预览 iframe，返回该 iframe
  function mountIframe(hostEl, tpl, cfgObj, extra) {
    let iframe = hostEl.querySelector("iframe.preview-iframe");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.className = "preview-iframe";
      iframe.setAttribute("allow", "autoplay; fullscreen");
      hostEl.appendChild(iframe);
    }
    iframe.src = embedSrc(tpl, cfgObj, extra);
    return iframe;
  }
  // 移除 hostEl 内的预览 iframe
  function removeIframe(hostEl) {
    const f = hostEl.querySelector("iframe.preview-iframe");
    if (f) f.parentNode.removeChild(f);
  }

  g.BirthdayRenderer = { encodeConfig, decodeConfig, renderTo, embedSrc, mountIframe, removeIframe };
})(window);
