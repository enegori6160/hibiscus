(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.premiumFx = factory();
})(this, function () {
  const defaultConfig = {
    durationMs: 3200,
    palette: { bg: '#000', primary: '#e40913', secondary: '#ffd166', accent: '#ffffff' },
    audio: { enabled: true, volume: 1 },
    quality: { dprCap: 2 },
    accessibility: { reduceMotion: false, safeFlash: false, maxLuminance: 1 },
    telemetry: { onStart: null, onEnd: null, onError: null },
    anchor: { mode: 'selector', selector: '#reel1' }
  };

  const state = {
    root: null,
    container: null,
    canvas: null,
    ctx: null,
    mounted: false,
    playing: false,
    rafId: 0,
    startTime: 0,
    config: defaultConfig,
    cracks: [],
    shards: [],
    audioCtx: null,
    gain: null,
    resolve: null,
    reject: null,
    anchor: { x: 0, y: 0 },
    dpr: 1
  };

  function mount(rootEl) {
    state.root = rootEl || document.body;
    state.mounted = true;
  }

  function ensureOverlay() {
    if (state.container) return;
    const cont = document.createElement('div');
    cont.className = 'fx-overlay';
    Object.assign(cont.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '9999',
      overflow: 'hidden'
    });
    const cvs = document.createElement('canvas');
    cont.appendChild(cvs);
    document.body.appendChild(cont); // always under body
    state.container = cont;
    state.canvas = cvs;
    state.ctx = cvs.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    if (!state.canvas) return;
    const rect = state.container.getBoundingClientRect();
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      (state.config.quality && state.config.quality.dprCap) || 2
    );
    state.dpr = dpr;
    state.canvas.width = rect.width * dpr;
    state.canvas.height = rect.height * dpr;
    state.canvas.style.width = '100%';
    state.canvas.style.height = '100%';
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeAnchor();
  }

  function computeAnchor() {
    const anc = state.config.anchor || defaultConfig.anchor;
    let x, y;
    if (anc.mode === 'coords') {
      x = anc.x || 0;
      y = anc.y || 0;
    } else if (anc.mode === 'selector') {
      const el = document.querySelector(anc.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      } else {
        x = window.innerWidth / 2;
        y = window.innerHeight / 2;
      }
    } else {
      x = window.innerWidth / 2;
      y = window.innerHeight / 2;
    }
    state.anchor.x = x * state.dpr;
    state.anchor.y = y * state.dpr;
  }

  function mergeConfig(cfg) {
    const d = defaultConfig;
    return {
      durationMs: clamp((cfg && cfg.durationMs) || d.durationMs, 2000, 4500),
      palette: Object.assign({}, d.palette, cfg && cfg.palette),
      audio: Object.assign({}, d.audio, cfg && cfg.audio),
      quality: Object.assign({}, d.quality, cfg && cfg.quality),
      accessibility: Object.assign({}, d.accessibility, cfg && cfg.accessibility),
      telemetry: Object.assign({}, d.telemetry, cfg && cfg.telemetry),
      anchor: Object.assign({}, d.anchor, cfg && cfg.anchor)
    };
  }

  function play(config) {
    ensureOverlay();
    state.config = mergeConfig(config);
    resizeCanvas();
    state.cracks = [];
    state.shards = [];
    state.startTime = performance.now();
    state.playing = true;
    const cfg = state.config;
    if (cfg.telemetry && typeof cfg.telemetry.onStart === 'function') {
      try { cfg.telemetry.onStart(); } catch (e) {}
    }
    startAudio(cfg);
    return new Promise((res, rej) => {
      state.resolve = res;
      state.reject = rej;
      try {
        state.rafId = requestAnimationFrame(frame);
      } catch (e) {
        handleError(e);
        rej(e);
      }
    });
  }

  function frame(now) {
    const cfg = state.config;
    const ctx = state.ctx;
    if (!ctx) return;
    const t = now - state.startTime;
    const w = state.canvas.width;
    const h = state.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // background
    let alpha = 1;
    if (t < 500) alpha = t / 500;
    else if (t > cfg.durationMs - 300)
      alpha = Math.max(0, 1 - (t - (cfg.durationMs - 300)) / 300);
    ctx.fillStyle = cfg.palette.bg || '#000';
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    drawNoise(ctx, w, h, 0.05);

    const rm = cfg.accessibility && cfg.accessibility.reduceMotion;
    if (!rm) {
      if (t >= 500 && state.cracks.length === 0) generateCracks();
      if (t >= 500 && state.shards.length === 0) generateShards();
      drawCracks(ctx, t);
      updateAndDrawShards(ctx, t);
    }

    if (t >= 2700) {
      const prog = Math.min(1, (t - 2700) / 500);
      drawRing(
        ctx,
        w,
        h,
        cfg.palette.primary || '#e40913',
        prog,
        cfg.accessibility && cfg.accessibility.safeFlash
      );
    }

    if (t < cfg.durationMs && state.playing) state.rafId = requestAnimationFrame(frame);
    else finish();
  }

  function drawNoise(ctx, w, h, a) {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = a * 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function generateCracks() {
    const lines = 20;
    for (let i = 0; i < lines; i++) {
      const ang = (Math.PI * 2 / lines) * i + (Math.random() * 0.2 - 0.1);
      state.cracks.push({ ang });
    }
  }

  function drawCracks(ctx, t) {
    if (state.cracks.length === 0) return;
    const { x: cx, y: cy } = state.anchor;
    const len = Math.max(state.canvas.width, state.canvas.height);
    const prog = Math.min(1, (t - 500) / 2200);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = state.config.palette.secondary || '#ffd166';
    ctx.lineWidth = 2;
    ctx.globalAlpha = prog;
    state.cracks.forEach(c => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(c.ang) * len, Math.sin(c.ang) * len);
      ctx.stroke();
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function generateShards() {
    const count = 40;
    const { x: cx, y: cy } = state.anchor;
    for (let i = 0; i < count; i++) {
      const deg = Math.random() * 200 - 100; // bias upward
      const ang = -Math.PI / 2 + deg * Math.PI / 180;
      const sp = Math.random() * 3 + 1;
      let vx = Math.cos(ang) * sp;
      let vy = Math.sin(ang) * sp;
      vy = Math.min(vy, -Math.abs(vx) * 0.35);
      const size = Math.random() * 40 + 20;
      state.shards.push({ x: cx, y: cy, vx, vy, rot: Math.random() * Math.PI, vr: (Math.random() * 0.1 - 0.05), size, bounced: false });
    }
  }

  function updateAndDrawShards(ctx, t) {
    ctx.fillStyle = state.config.palette.primary || '#e40913';
    ctx.globalAlpha = 0.9;
    const h = state.canvas.height;
    state.shards.forEach(s => {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.012; // reduced gravity
      s.rot += s.vr;
      if (!s.bounced && s.y > h * 1.02) {
        s.y = h * 1.02;
        s.vy *= -0.45;
        s.vx *= 0.9;
        s.bounced = true;
      }
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.beginPath();
      ctx.moveTo(-s.size / 2, -s.size / 2);
      ctx.lineTo(s.size / 2, -s.size / 4);
      ctx.lineTo(s.size / 3, s.size / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  function drawRing(ctx, w, h, color, prog, safe) {
    const { x: cx, y: cy } = state.anchor;
    const maxR = Math.max(w, h) * 0.7;
    const r = prog * maxR;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    const freq = safe ? 3 : 6;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(prog * Math.PI * freq);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function startAudio(cfg) {
    if (!cfg.audio || cfg.audio.enabled === false) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = cfg.audio.volume != null ? cfg.audio.volume : 1;
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.5);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.connect(gain);
    noise.start(now + 0.5);
    noise.stop(now + 0.7);
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      const t0 = now + 0.8 + i * 0.15;
      o.frequency.setValueAtTime(600, t0);
      o.frequency.exponentialRampToValueAtTime(1200, t0 + 0.15);
      o.connect(gain);
      o.start(t0);
      o.stop(t0 + 0.15);
    }
    state.audioCtx = ctx;
    state.gain = gain;
  }

  function finish() {
    if (!state.playing) return;
    cancelAnimationFrame(state.rafId);
    state.playing = false;
    if (state.resolve) state.resolve();
    if (state.config.telemetry && typeof state.config.telemetry.onEnd === 'function') {
      try { state.config.telemetry.onEnd(); } catch (e) {}
    }
    cleanup();
  }

  function stop() {
    if (!state.playing) {
      cleanup();
      return;
    }
    cancelAnimationFrame(state.rafId);
    state.playing = false;
    if (state.resolve) state.resolve();
    if (state.config.telemetry && typeof state.config.telemetry.onEnd === 'function') {
      try { state.config.telemetry.onEnd(); } catch (e) {}
    }
    cleanup();
  }

  function cleanup() {
    if (state.audioCtx) {
      try { state.audioCtx.close(); } catch (e) {}
      state.audioCtx = null;
    }
    if (state.ctx) {
      state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    }
    if (state.container) {
      window.removeEventListener('resize', resizeCanvas);
      state.container.remove();
      state.container = null;
      state.canvas = null;
      state.ctx = null;
    }
  }

  function isPlaying() {
    return state.playing;
  }

  function handleError(e) {
    if (state.config.telemetry && typeof state.config.telemetry.onError === 'function') {
      try { state.config.telemetry.onError(e); } catch (_) {}
    }
    stop();
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  return { mount, play, stop, isPlaying };
});

