/* 生日代码平台 · 共享音乐管理器
 * 编辑器预览与全屏观看页共用，保证音乐行为一致。
 *
 * 配置结构 cfg.music = { enabled, source, trackId, url, volume }
 *   source: 'none' | 'builtin' | 'upload' | 'synth'
 *   builtin 用 trackId 选内置曲目；upload 用 url；synth 用 WebAudio 合成八音盒
 *
 * 浏览器自动播放限制：play() 必须在用户手势中调用，否则会被拒绝。
 * 观看页通过「点击进入」遮罩提供手势；编辑器通过浮动按钮提供手势。
 */
(function (g) {
  "use strict";

  // ---------- 内置曲目 ----------
  var BUILTIN = [
    { id: "bg", name: "生日快乐 · 温馨钢琴", url: "/music/bg.mp3" },
    { id: "cake", name: "星河蛋糕 · 原声", url: "/music/cake.m4a" },
    { id: "intro", name: "便签开场 · 原声", url: "/music/intro.m4a" },
    { id: "synth", name: "八音盒 · 生日快乐（合成）", synth: true }
  ];

  function findBuiltin(id) {
    for (var i = 0; i < BUILTIN.length; i++) {
      if (BUILTIN[i].id === id) return BUILTIN[i];
    }
    return BUILTIN[0];
  }

  // ---------- WebAudio 合成：Happy Birthday 八音盒循环 ----------
  var NOTE = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, Bb4: 466.16, C5: 523.25
  };
  var MELODY = [
    [NOTE.C4, 0.75], [NOTE.C4, 0.25], [NOTE.D4, 1], [NOTE.C4, 1], [NOTE.F4, 1], [NOTE.E4, 2],
    [NOTE.C4, 0.75], [NOTE.C4, 0.25], [NOTE.D4, 1], [NOTE.C4, 1], [NOTE.G4, 1], [NOTE.F4, 2],
    [NOTE.C4, 0.75], [NOTE.C4, 0.25], [NOTE.C5, 1], [NOTE.A4, 1], [NOTE.F4, 1], [NOTE.E4, 1], [NOTE.D4, 2],
    [NOTE.Bb4, 0.75], [NOTE.Bb4, 0.25], [NOTE.A4, 1], [NOTE.F4, 1], [NOTE.G4, 1], [NOTE.F4, 2]
  ];
  var BEAT = 0.42; // 秒/拍

  function startSynth(volume) {
    var AC = g.AudioContext || g.webkitAudioContext;
    if (!AC) return null;
    var ctx = new AC();
    var master = ctx.createGain();
    master.gain.value = (typeof volume === "number" ? volume : 0.6) * 0.22;
    master.connect(ctx.destination);

    var total = 0;
    for (var i = 0; i < MELODY.length; i++) total += MELODY[i][1];
    total *= BEAT;

    function schedule(start) {
      var t = start;
      for (var i = 0; i < MELODY.length; i++) {
        var n = MELODY[i];
        var osc = ctx.createOscillator();
        var gn = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = n[0];
        var dur = n[1] * BEAT;
        gn.gain.setValueAtTime(0.0001, t);
        gn.gain.linearRampToValueAtTime(0.9, t + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
        osc.connect(gn); gn.connect(master);
        osc.start(t); osc.stop(t + dur + 0.05);
        t += dur;
      }
    }
    schedule(ctx.currentTime + 0.06);
    var timer = setInterval(function () {
      schedule(ctx.currentTime + 0.06);
    }, total * 1000);

    return {
      ctx: ctx, gain: master, timer: timer,
      setVolume: function (v) { master.gain.value = v * 0.22; },
      stop: function () {
        clearInterval(timer);
        try { ctx.close(); } catch (e) {}
      }
    };
  }

  // ---------- 播放器 ----------
  function MusicPlayer() {
    this.audio = new Audio();
    this.audio.loop = true;
    this.audio.preload = "auto";
    this._cfg = { enabled: false, source: "none", trackId: "", url: "", volume: 0.6 };
    this._synth = null;
    this._playing = false;
  }

  MusicPlayer.prototype = {
    setConfig: function (cfg) {
      cfg = cfg || {};
      this._cfg = {
        enabled: !!cfg.enabled,
        source: (cfg.source === "builtin" || cfg.source === "upload" || cfg.source === "synth") ? cfg.source : "none",
        trackId: cfg.trackId || "",
        url: cfg.url || "",
        volume: typeof cfg.volume === "number" ? Math.max(0, Math.min(1, cfg.volume)) : 0.6
      };
      this.audio.volume = this._cfg.volume;
      this._applySource();
      if (this._playing) {
        var self = this;
        this.play().catch(function () {});
      }
    },
    getConfig: function () { return this._cfg; },

    _applySource: function () {
      var c = this._cfg;
      this._stopSynth();
      if (!c.enabled || c.source === "none" || c.source === "synth") {
        if (this.audio.src) { this.audio.removeAttribute("src"); this.audio.load(); }
        return;
      }
      var url = "";
      if (c.source === "builtin") {
        var t = findBuiltin(c.trackId);
        url = (t && t.url) ? t.url : "";
      } else if (c.source === "upload") {
        url = c.url || "";
      }
      if (url) {
        var abs;
        try { abs = new URL(url, location.href).href; } catch (e) { abs = url; }
        if (this.audio.src !== abs) this.audio.src = url;
      } else if (this.audio.src) {
        this.audio.removeAttribute("src"); this.audio.load();
      }
    },

    play: function () {
      var c = this._cfg;
      if (!c.enabled || c.source === "none") { this.pause(); return Promise.resolve(); }
      this._playing = true;
      if (c.source === "synth") {
        if (!this._synth) this._synth = startSynth(c.volume);
        if (this._synth && this._synth.ctx.state === "suspended") {
          return this._synth.ctx.resume().catch(function () {});
        }
        return Promise.resolve();
      }
      if (!this.audio.src) return Promise.resolve();
      this.audio.volume = c.volume;
      var p = this.audio.play();
      return (p && p.catch) ? p : Promise.resolve();
    },

    pause: function () {
      this._playing = false;
      try { this.audio.pause(); } catch (e) {}
      this._stopSynth();
    },

    toggle: function () {
      if (this._playing) { this.pause(); return false; }
      var self = this;
      return this.play().then(function () { return true; }).catch(function () { return false; });
    },

    isPlaying: function () { return this._playing; },

    setVolume: function (v) {
      v = Math.max(0, Math.min(1, v));
      this._cfg.volume = v;
      this.audio.volume = v;
      if (this._synth) this._synth.setVolume(v);
    },

    _stopSynth: function () {
      if (this._synth) { this._synth.stop(); this._synth = null; }
    }
  };

  // ---------- 浮动控制按钮 ----------
  // 在预览容器 hostEl 内注入一个播放/静音按钮，点击切换播放状态。
  function attachControls(player, hostEl, opts) {
    opts = opts || {};
    if (!hostEl) return null;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "music-fab";
    btn.setAttribute("aria-label", "背景音乐");
    btn.textContent = "🔇";
    if (getComputedStyle(hostEl).position === "static") hostEl.style.position = "relative";
    hostEl.appendChild(btn);

    function refresh() {
      var c = player.getConfig();
      if (!c.enabled || c.source === "none") {
        btn.style.display = "none";
      } else {
        btn.style.display = "";
        btn.textContent = player.isPlaying() ? "🔊" : "🔈";
        btn.title = player.isPlaying() ? "关闭音乐" : "播放音乐";
      }
    }
    btn.addEventListener("click", function () {
      player.toggle();
      // 给浏览器一点时间更新状态
      setTimeout(refresh, 60);
    });
    refresh();
    return { el: btn, refresh: refresh };
  }

  g.BirthdayMusic = {
    BUILTIN: BUILTIN,
    findBuiltin: findBuiltin,
    MusicPlayer: MusicPlayer,
    attachControls: attachControls
  };
})(window);
