// Symbols and config
// Mobile UX tweaks: prevent elastic scroll bounce and add viewport height fix
try {
  // Avoid iOS rubber-band scrolling causing accidental refresh while playing
  document.addEventListener('touchmove', (e) => {
    const el = e.target.closest('.reel, .cabinet-panel, button');
    if (el) e.preventDefault();
  }, { passive: false });
  // Set CSS var --vh to actual viewport height to handle mobile URL bar
  const setVH = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  setVH();
  window.addEventListener('resize', setVH);
} catch {}
const symbols = ["🍒", "⭐", "🍉", "🔔", "7️⃣"]; // legacy (UI用): ぶどう→🍉
// Manual mode symbols (BAR入り) ぶどう→🍉、リプレイ⭐を追加
const symbolsManual = ['7', 'BAR', '🔔', '🍉', '🍒', '⭐'];
const spinDuration = 600;
const costPerSpin = 3;
const enableUndo = false; // Undo feature disabled; button hidden

let coinBalance = 100;
let isSpinning = false;
let lastState = null;
let soundEnabled = true;
let audioCtx;
let hibiscusTimer = null;
// Manual mode states
let betCount = 0;
const maxBet = 3;
const reelSpinning = [false, false, false];
const reelStopped = [true, true, true];
let manualModeActive = true; // use lever + stop buttons
let pendingBonus = null; // 'big' | 'reg' | null
let hibiscusPattern = null; // current premium pattern id
let hibiscusMute = false; // pattern2: mute at lever-on
let nextGameForceNormal = false; // pattern9 behavior
let freezeActive = false; // running premium freeze sequence
function setLeverEngaged(on) {
  try {
    const leverBtn = document.getElementById('lever');
    if (leverBtn) leverBtn.classList.toggle('engaged', !!on);
  } catch {}
}
// 設定（1〜6）の確率テーブルと配当
const SETTINGS = {
  1: { big: 292, reg: 489, freeze: 8192 },
  2: { big: 280, reg: 452, freeze: 8192 },
  3: { big: 268, reg: 420, freeze: 8192 },
  4: { big: 257, reg: 390, freeze: 8192 },
  5: { big: 244, reg: 360, freeze: 8192 },
  6: { big: 2,   reg: 5,  freeze: 10 }, // デモ用高設定
};
const PAYOUT = { big: 350, reg: 120, freeze: 2000 };
let currentSetting = 1;

// Utilities: persistence
const storage = {
  save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  load(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
};

function ensureAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx && audioCtx.state === 'suspended') {
      // resume on user gesture
      audioCtx.resume && audioCtx.resume();
    }
  } catch {}
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    ensureAudio();
    // test hook
    try { if (typeof window !== 'undefined' && window._onPlaySound) window._onPlaySound(type); } catch {}
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    const freq = type === "win" ? 880 : type === "error" ? 220 : type === 'coin' ? 1200 : 440;
    osc.type = type === 'coin' ? 'square' : 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const dur = type === 'coin' ? 0.1 : 0.25;
    const amp = type === 'coin' ? 0.12 : 0.12;
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.start(now);
    osc.stop(now + dur);
  } catch (e) {
    console.warn("Web Audio not supported", e);
  }
}

// Pachislo-like "kyuin" multi-chirp for bonus
function playKyuin() {
  if (!soundEnabled) return;
  try {
    ensureAudio();
    const now = audioCtx.currentTime;

    const chirp = (startF, endF, dur, delay, type = "sawtooth", peak = 0.22) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(startF, now + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(50, endF), now + delay + dur);
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.linearRampToValueAtTime(peak, now + delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.01);
    };

    // Three short upward chirps for "キュイン×3"
    chirp(650, 2400, 0.18, 0.00, "sawtooth", 0.25);
    chirp(700, 2600, 0.18, 0.08, "sawtooth", 0.25);
    chirp(800, 2800, 0.18, 0.16, "triangle", 0.22);

    // Add a short bell-like ping on top
    const bell = audioCtx.createOscillator();
    const bellGain = audioCtx.createGain();
    bell.type = "sine";
    bell.frequency.setValueAtTime(1500, now + 0.04);
    bell.frequency.exponentialRampToValueAtTime(2400, now + 0.16);
    bellGain.gain.setValueAtTime(0.0001, now + 0.04);
    bellGain.gain.linearRampToValueAtTime(0.18, now + 0.08);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    bell.connect(bellGain);
    bellGain.connect(audioCtx.destination);
    bell.start(now + 0.04);
    bell.stop(now + 0.4);
  } catch (e) {
    console.warn("Web Audio not supported", e);
  }
}

// Freeze SFX: low rumble -> kyuin
function playFreezeFX() {
  try {
    ensureAudio();
    const now = audioCtx.currentTime;
    // low rumble noise
    const noise = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate*0.9, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<data.length;i++) { data[i] = (Math.random()*2-1) * Math.exp(-i/(data.length*0.9)); }
    noise.buffer = buffer;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    noise.connect(g); g.connect(audioCtx.destination); noise.start(now);
    // then kyuin
    setTimeout(() => playKyuin(), 650);
  } catch {}
}

// Simulate payout sound burst without per-coin crediting
function playPayoutBurst(amount) {
  if (!soundEnabled) return;
  try {
    // number of coin ticks proportional to amount but capped
    const ticks = Math.min(40, Math.max(8, Math.floor(amount / 10)));
    let i = 0;
    const iv = setInterval(() => {
      playSound('coin');
      i += 1;
      if (i >= ticks) clearInterval(iv);
    }, 30);
  } catch {}
}

function setMessage(text, isError = false) {
  const msg = document.getElementById("message");
  msg.innerText = text;
  msg.classList.toggle("error", isError);
  msg.classList.remove("show");
  void msg.offsetWidth; // restart animation
  msg.classList.add("show");
}

function reflectSoundButtons() {
  const btns = [document.getElementById("soundToggle"), document.getElementById("soundToggle2")].filter(Boolean);
  btns.forEach((btn) => {
    btn.setAttribute("aria-pressed", soundEnabled);
    btn.textContent = soundEnabled ? "🔊" : "🔇";
  });
}

function reflectThemeButtons() {
  const isDark = document.body.classList.contains("dark");
  const btns = [document.getElementById("themeToggle"), document.getElementById("themeToggle2")].filter(Boolean);
  btns.forEach((btn) => {
    btn.setAttribute("aria-pressed", isDark);
    btn.textContent = isDark ? "🌞" : "🌙";
  });
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  reflectThemeButtons();
  storage.save("theme", document.body.classList.contains("dark") ? "dark" : "light");
  playSound("click");
}

function toggleSound() {
  ensureAudio();
  if (soundEnabled) playSound("click");
  soundEnabled = !soundEnabled;
  reflectSoundButtons();
  storage.save("soundEnabled", soundEnabled);
}

// Mobile nav
function toggleNav() {
  const nav = document.getElementById("siteNav");
  const btn = document.getElementById("navToggle");
  const open = !nav.classList.contains("open");
  nav.classList.toggle("open", open);
  btn.setAttribute("aria-expanded", String(open));
}

// Legacy auto-spin weights（UI用）
const SYMBOL_WEIGHTS = { '🍒': 2, '⭐': 4, '🍉': 2, '🔔': 2, '7': 1 };
const SYMBOL_LIST = Object.keys(SYMBOL_WEIGHTS);
const SYMBOL_TOTAL = SYMBOL_LIST.reduce((s, k) => s + SYMBOL_WEIGHTS[k], 0);
function randomSymbol() {
  const r = Math.random() * SYMBOL_TOTAL;
  let acc = 0;
  for (const k of SYMBOL_LIST) {
    acc += SYMBOL_WEIGHTS[k];
    if (r < acc) return k;
  }
  return SYMBOL_LIST[SYMBOL_LIST.length - 1];
}

// Manual mode random symbol with probabilities tuned to target per‑spin rates
// Targets (per spin, 5ライン合算):
// 🔔 1/7.97, 🍒 1/61.8, 🍉 1/170.1, ⭐ 1/7.3
// Per-cell probability p solves: Pspin = 1 - (1 - p^3)^5 ⇒ p = ((1-(1-P)^(1/5)))^(1/3)
function perCellFromSpinProb(P) {
  const fifth = Math.pow(1 - P, 1/5);
  const inner = 1 - fifth;
  return Math.pow(Math.max(inner, 0), 1/3);
}
const Pspin = {
  '🔔': 1/7.97,
  '🍒': 1/61.8,
  '🍉': 1/170.1,
  '⭐': 1/7.3,
};
const Pcell = {
  '🔔': perCellFromSpinProb(Pspin['🔔']),
  '🍒': perCellFromSpinProb(Pspin['🍒']),
  '🍉': perCellFromSpinProb(Pspin['🍉']),
  '⭐': perCellFromSpinProb(Pspin['⭐']),
};
// Distribute remaining mass to 7/BAR（7は控えめ）
let mass = 1 - (Pcell['🔔'] + Pcell['🍒'] + Pcell['🍉'] + Pcell['⭐']);
mass = Math.max(0, Math.min(1, mass));
const Pcell7 = Math.min(0.02, mass * 0.2);
const PcellBAR = Math.max(0, mass - Pcell7);
const MANUAL_PROBS = { '7': Pcell7, 'BAR': PcellBAR, '🔔': Pcell['🔔'], '🍉': Pcell['🍉'], '🍒': Pcell['🍒'], '⭐': Pcell['⭐'] };
const MANUAL_ORDER = Object.keys(MANUAL_PROBS);
const MANUAL_ACC = (() => { let a=0; return MANUAL_ORDER.map(k => (a += MANUAL_PROBS[k])); })();
function randomSymbolManual() {
  const r = Math.random();
  for (let i=0;i<MANUAL_ORDER.length;i++) { if (r < MANUAL_ACC[i]) return MANUAL_ORDER[i]; }
  return MANUAL_ORDER[MANUAL_ORDER.length-1];
}

// Reel logic
function spinReels(isBonus = false) {
  const reels = document.querySelectorAll(".reel");

  reels.forEach((reel, index) => {
    const reelContent = document.createElement("div");
    reelContent.classList.add("reel-content");

    for (let i = 0; i < 10; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const span = document.createElement("span");
      span.textContent = symbol;
      reelContent.appendChild(span);
    }

    reel.innerHTML = "";
    reel.appendChild(reelContent);
    // Normalize any keycap sevens in the scrolling filler
    normalizeSevens(reelContent);
    reelContent.style.animation = "spin 0.2s linear infinite";

    setTimeout(() => {
      reelContent.style.animation = "none";
      const finalContent = document.createElement("div");
      finalContent.classList.add("reel-content");

      for (let i = 0; i < 3; i++) {
        const span = document.createElement("span");

        if (isBonus) {
          // force diagonal 7 on bonus
          if ((index === 0 && i === 0) || (index === 1 && i === 1) || (index === 2 && i === 2)) {
            span.textContent = "7️⃣";
            span.classList.add("seven");
          } else {
            span.textContent = symbols[Math.floor(Math.random() * symbols.length)];
          }
        } else {
          span.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        }

        finalContent.appendChild(span);
      }

      reel.innerHTML = "";
      reel.appendChild(finalContent);
      // Normalize 7 display and reweight non-7 symbols using randomSymbol()
      normalizeSevens(finalContent);
      try {
        finalContent.querySelectorAll('span').forEach((el) => {
          const t = el.textContent || '';
          if (!t.includes('7')) {
            const sym = randomSymbol();
            if (sym.includes('7')) { el.textContent = '7'; el.classList.add('seven'); }
            else { el.textContent = sym; }
          }
        });
      } catch {}
    }, spinDuration);
  });
}

// 絵文字のバリアント差などを吸収して判定用に正規化
function canonicalSymbol(t) {
  if (!t) return '';
  if (t.includes('7')) return '7';
  if (t.includes('BAR')) return 'BAR';
  if (t.includes('⭐')) return '⭐'; // ⭐と⭐️を統一
  if (t.includes('🔔')) return '🔔';
  if (t.includes('🍉')) return '🍉';
  if (t.includes('🍋')) return '🍋';
  if (t.includes('🍒')) return '🍒';
  return t.trim();
}

// Any-line evaluation helpers
function getAllLineSymbols() {
  const reels = Array.from(document.querySelectorAll('.reel'));
  const rows = [0, 1, 2];
  return rows.map((row) => reels.map((reel) => {
    const spans = reel.querySelectorAll('.reel-content span');
    const t = spans[row] ? (spans[row].textContent || '') : '';
    return canonicalSymbol(t);
  }));
}

function evaluateAllLines() {
  const lines = getAllLineSymbols();
  const results = lines.map(evaluateLineWin).filter(Boolean);
  let total = 0; let hasReplay = false; const msgs = [];
  for (const r of results) {
    if (r.replay) { hasReplay = true; }
    else { total += r.payout; msgs.push(`${r.symbol} 揃い +${r.payout}枚`); }
  }
  return { total, hasReplay, messages: msgs };
}

function glowHibiscus(typeOrPattern = 'normal') {
  clearTimeout(hibiscusTimer);
  const left = document.getElementById("hibiscus");
  const right = document.getElementById("hibiscus-right");
  const all = [left, right].filter(Boolean);
  const clsAll = ['glowing','glow-normal','glow-strobe','glow-breathe','glow-wave','glow-twinkle','glow-steady','glow-ultraslow','glow-rotate','glow-leaf','flash-red','flash-blue','flash-yellow','wave-a','wave-b'];
  all.forEach(el => el.classList.remove(...clsAll));

  // decide pattern
  let pattern = 'glow-normal';
  hibiscusMute = false;
  if (typeOrPattern === 'big') {
    if (nextGameForceNormal) { pattern = 'glow-normal'; nextGameForceNormal = false; }
    else {
      // 75%: 通常点滅, 25%: プレミア
      // プレミアのうち10%を超プレミア（回転/葉）に振分 → 全体2.5%
      const premiumIds = [2,3,4,5,6,7,8,9,10,11,12]; // 通常プレミア
      const ultraIds = [13,14]; // 超プレミア
      let idx;
      if (Math.random() < 0.75) {
        idx = 1; // normal
      } else {
        idx = (Math.random() < 0.10)
          ? ultraIds[Math.floor(Math.random()*ultraIds.length)]
          : premiumIds[Math.floor(Math.random()*premiumIds.length)];
      }
      hibiscusPattern = idx; // 保存して停止タイミング演出に使用
      switch (idx) {
        case 1: pattern = 'glow-normal'; break; // 通常
        case 2: pattern = 'glow-normal'; hibiscusMute = true; break; // 無音＋通常
        case 3: pattern = 'glow-strobe'; break; // 高速
        case 4: pattern = 'glow-twinkle'; break; // ﾒﾗﾒﾗ相当
        case 5: pattern = 'glow-breathe'; break; // ﾎﾞﾜｧ～
        case 6: pattern = 'glow-normal'; scheduleBeat337(all); break; // 3,3,7拍子
        case 7: pattern = 'glow-wave'; // 右から点滅
                left && left.classList.add('wave-b');
                right && right.classList.add('wave-a');
                break;
        case 8: pattern = 'glow-steady'; break; // 点灯
        case 9: pattern = 'glow-ultraslow'; nextGameForceNormal = true; break; // 超低速→次回通常
        case 10: pattern = 'glow-normal'; setTimeout(()=>flashColor('red'), 650); break; // 爆発
        case 11: pattern = 'glow-normal'; break; // 第一停止で青ﾌﾗｯｼｭ（stopで処理）
        case 12: pattern = 'glow-normal'; break; // 第二停止で黄ﾌﾗｯｼｭ（stopで処理）
        case 13: pattern = 'glow-rotate'; break; // 回転プレミア
        case 14: pattern = 'glow-leaf'; break; // 超プレミア：葉っぱのみ点滅
        default: pattern = 'glow-normal';
      }
    }
  } else if (typeOrPattern === 'reg') {
    pattern = 'glow-normal';
  } else if (typeof typeOrPattern === 'string' && typeOrPattern.startsWith('glow-')) {
    pattern = typeOrPattern; // direct pattern name
  } else {
    pattern = 'glow-normal';
  }

  if (pattern === 'glow-wave') {
    left && left.classList.add('glow-wave','wave-a');
    right && right.classList.add('glow-wave','wave-b');
  } else {
    all.forEach(el => el.classList.add(pattern));
  }

  hibiscusTimer = setTimeout(() => {
    all.forEach(el => el.classList.remove(...clsAll));
    hibiscusTimer = null;
  }, 6000);
}

// Special freeze visual: rotate + green leaf + color flashes
function glowFreeze() {
  clearHibiscusGlow();
  const left = document.getElementById('hibiscus');
  const right = document.getElementById('hibiscus-right');
  const all = [left, right].filter(Boolean);
  all.forEach(el => el && el.classList.add('glow-rotate','glow-leaf'));
  // burst of multi color flashes
  const colors = ['red','blue','yellow','red','yellow'];
  let t = 200;
  colors.forEach((c)=>{ setTimeout(()=>flashColor(c), t); t += 220; });
  hibiscusTimer = setTimeout(() => { clearHibiscusGlow(); }, 7000);
}

function clearHibiscusGlow() {
  clearTimeout(hibiscusTimer);
  hibiscusTimer = null;
  const left = document.getElementById("hibiscus");
  const right = document.getElementById("hibiscus-right");
  const all = [left, right].filter(Boolean);
  const clsAll = ['glowing','glow-normal','glow-strobe','glow-breathe','glow-wave','glow-twinkle','glow-steady','glow-ultraslow','glow-rotate','glow-leaf','flash-red','flash-blue','flash-yellow','wave-a','wave-b'];
  all.forEach(el => el.classList.remove(...clsAll));
  hibiscusPattern = null; hibiscusMute = false;
}

function flashColor(color) {
  const left = document.getElementById('hibiscus');
  const right = document.getElementById('hibiscus-right');
  const all = [left, right].filter(Boolean);
  const cls = color === 'blue' ? 'flash-blue' : color === 'yellow' ? 'flash-yellow' : 'flash-red';
  all.forEach(el => {
    el.classList.remove('flash-red','flash-blue','flash-yellow');
    el.classList.add(cls);
    setTimeout(()=> el.classList.remove(cls), 420);
  });
}

function scheduleBeat337(allEls) {
  // simple JS sequence: 3 flashes, pause, 3 flashes, pause, 7 flashes
  const seq = [3, 3, 7];
  let t = 0; const gap = 80; const pause = 280;
  seq.forEach((n, idx) => {
    for (let i=0;i<n;i++) {
      setTimeout(()=>flashColor('red'), t); t += gap;
    }
    t += pause;
  });
}

// Extra SFX for premium patterns
function playExplosion() { try { ensureAudio(); const now = audioCtx.currentTime; const noise = audioCtx.createBufferSource(); const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate*0.35, audioCtx.sampleRate); const data = buffer.getChannelData(0); for(let i=0;i<data.length;i++){ data[i] = (Math.random()*2-1) * Math.exp(-i/(data.length*0.7)); } noise.buffer = buffer; const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.001, now+0.35); noise.connect(gain); gain.connect(audioCtx.destination); noise.start(); } catch {} }
function playWaveFX() { try { ensureAudio(); const now = audioCtx.currentTime; const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.type='sine'; osc.frequency.setValueAtTime(180, now); osc.frequency.linearRampToValueAtTime(120, now+0.5); gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.001, now+0.6); osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(now+0.6);} catch {} }
function playThunderFX() { try { ensureAudio(); const now = audioCtx.currentTime; const noise = audioCtx.createBufferSource(); const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate*0.6, audioCtx.sampleRate); const data = buffer.getChannelData(0); for(let i=0;i<data.length;i++){ data[i] = (Math.random()*2-1) * Math.exp(-i/(data.length*0.5)); } const osc = audioCtx.createOscillator(); osc.type='sine'; osc.frequency.setValueAtTime(90, now); osc.frequency.exponentialRampToValueAtTime(40, now+0.6); const g1 = audioCtx.createGain(); const g2 = audioCtx.createGain(); g1.gain.setValueAtTime(0.18, now); g1.gain.exponentialRampToValueAtTime(0.001, now+0.6); g2.gain.setValueAtTime(0.12, now); g2.gain.exponentialRampToValueAtTime(0.001, now+0.6); noise.buffer=buffer; noise.connect(g1); osc.connect(g2); g1.connect(audioCtx.destination); g2.connect(audioCtx.destination); noise.start(); osc.start(); noise.stop(now+0.6); osc.stop(now+0.6);} catch {} }

function updateCoinDisplay() {
  const spinBtn = document.getElementById("spinButton");
  spinBtn.disabled = isSpinning || coinBalance < costPerSpin;
  spinBtn.setAttribute("aria-disabled", spinBtn.disabled);
  const resetBtn = document.getElementById("resetButton");
  resetBtn.disabled = isSpinning;
  resetBtn.setAttribute("aria-disabled", resetBtn.disabled);
  document.getElementById("coinDisplay").innerText = `所持コイン：${coinBalance}枚`;
  storage.save("coinBalance", coinBalance);
}

function handleSpin() {
  if (isSpinning) return;
  if (coinBalance < costPerSpin) {
    setMessage("コインが足りません", true);
    playSound("error");
    return;
  }

  saveState();
  isSpinning = true;
  const spinBtn = document.getElementById("spinButton");
  spinBtn.setAttribute("aria-busy", "true");
  setMessage("スピン中…");
  playSound("click");
  clearHibiscusGlow();

  coinBalance -= costPerSpin;
  updateCoinDisplay();

  spinReels();

  // 少し余裕を持って停止後の最終出目を評価する（タイミング競合対策）
  // Evaluate slightly after reels stop to avoid timing races
  setTimeout(() => {
    const isError = false; // remove random error simulation
    if (isError) {
      setMessage("エラーが発生しました", true);
      playSound("error");
      coinBalance += costPerSpin;
    } else {
      const isBonus = Math.random() < 1 / 100;
      if (isBonus) {
        setMessage("🌺 ハイビスカス点灯！ボーナス当選！ 🌺");
        glowHibiscus();
        playKyuin();
        coinBalance += 350;
        spinReels(true);
      } else {
        setMessage("ハズレ…次こそ当てよう！");
      }
    }
    isSpinning = false;
    spinBtn.removeAttribute("aria-busy");
    updateCoinDisplay();
    setUndoDisabled(!lastState);
  }, spinDuration + 50);
}

try {
  const _sb = document.getElementById("spinButton"); if (_sb) _sb.addEventListener("click", handleSpin);
  const _rb = document.getElementById("resetButton"); if (_rb) _rb.addEventListener("click", resetGame);
  const _tt = document.getElementById("themeToggle"); if (_tt) _tt.addEventListener("click", toggleTheme);
  const _st = document.getElementById("soundToggle"); if (_st) _st.addEventListener("click", toggleSound);
} catch {}

// Duplicate controls in settings panel
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "themeToggle2") toggleTheme();
  if (e.target && e.target.id === "soundToggle2") toggleSound();
});

// Nav toggle
try { const _nv = document.getElementById("navToggle"); if (_nv) _nv.addEventListener("click", toggleNav); } catch {}
document.querySelectorAll('#siteNav .nav-link').forEach((a) => a.addEventListener('click', () => {
  const nav = document.getElementById('siteNav');
  if (nav.classList.contains('open')) toggleNav();
}));

// --- 設定選択と新しいスピンロジック（設定1〜6対応） ---
function handleSettingChange(value) {
  const v = String(value);
  if (!SETTINGS[v]) return;
  currentSetting = Number(v);
  storage.save("setting", currentSetting);
}
const settingSelect = document.getElementById("settingSelect");
if (settingSelect) {
  const saved = storage.load("setting", 1);
  currentSetting = Number(saved);
  settingSelect.value = String(currentSetting);
  settingSelect.addEventListener("change", (e) => handleSettingChange(e.target.value));
}

function handleSpinV2() {
  if (isSpinning) return;
  if (coinBalance < costPerSpin) {
    setMessage("コインが足りません", true);
    playSound("error");
    return;
  }

  saveState();
  isSpinning = true;
  const spinBtn = document.getElementById("spinButton");
  spinBtn.setAttribute("aria-busy", "true");
  setMessage("スピン中…");
  playSound("click");
  clearHibiscusGlow();

  coinBalance -= costPerSpin;
  updateCoinDisplay();
  spinReels();

  setTimeout(() => {
    const isError = false; // remove random error simulation
    if (isError) {
      setMessage("エラーが発生しました", true);
      playSound("error");
      coinBalance += costPerSpin;
    } else {
      const table = SETTINGS[currentSetting] || SETTINGS[1];
      const pBig = 1 / table.big;
      const pReg = 1 / table.reg;
      const u = Math.random();
      if (u < pBig) {
        setMessage("🌺 BIGボーナス！350枚GET！");
        glowHibiscus();
        playKyuin();
        coinBalance += PAYOUT.big;
        spinReels(true);
      } else if (u < pBig + pReg) {
        setMessage("🌺 REGボーナス！100枚GET！");
        glowHibiscus();
        playKyuin();
        coinBalance += PAYOUT.reg;
        spinReels(true);
      } else {
        setMessage("ハズレ…次こそ当てよう！");
      }
    }
    isSpinning = false;
    spinBtn.removeAttribute("aria-busy");
    updateCoinDisplay();
    setUndoDisabled(!lastState);
  }, spinDuration + 50);
}

// 既存のクリックハンドラを置き換え
try {
  const spinBtn = document.getElementById("spinButton");
  if (spinBtn) {
    spinBtn.removeEventListener("click", handleSpin);
    spinBtn.addEventListener("click", handleSpinV2);
  }
} catch {}

// Theming on load
(function initPreferences() {
  const savedTheme = storage.load("theme", null);
  // Default to dark mode when no preference is saved
  if (savedTheme === "dark" || savedTheme === null) {
    document.body.classList.add("dark");
  }
  soundEnabled = storage.load("soundEnabled", true);
  coinBalance = storage.load("coinBalance", 100);
  reflectThemeButtons();
  reflectSoundButtons();
  // Unlock audio on first user interaction
  try {
    ['pointerdown','keydown','touchstart','click'].forEach((ev)=>{
      document.addEventListener(ev, () => { try { ensureAudio(); } catch {} }, { once: true, passive: true });
    });
  } catch {}
})();

function resetGame() {
  if (isSpinning) return;
  coinBalance = 100;
  betCount = 0;
  lastState = null;
  setMessage("ゲームをリセットしました");
  playSound("click");
  const reels = document.querySelectorAll(".reel");
  reels.forEach((reel) => { reel.innerHTML = ""; });
  clearHibiscusGlow();
  updateCoinDisplay();
  setUndoDisabled(true);
  updateBetDisplay();
  updatePanelControls();
}

function saveState() {
  if (!enableUndo) return;
  const reels = Array.from(document.querySelectorAll(".reel")).map((reel) => reel.innerHTML);
  lastState = { coinBalance, message: document.getElementById("message").innerText, reels };
  setUndoDisabled(false);
}

function undo() {
  if (!enableUndo || !lastState) return;
  coinBalance = lastState.coinBalance;
  setMessage(lastState.message);
  const reels = document.querySelectorAll(".reel");
  reels.forEach((reel, i) => { reel.innerHTML = lastState.reels[i]; });
  lastState = null;
  updateCoinDisplay();
  setUndoDisabled(true);
  playSound("click");
}

if (enableUndo) {
  document.getElementById("undoButton").addEventListener("click", undo);
} else {
  document.getElementById("undoButton").style.display = "none";
}

function setUndoDisabled(disabled) {
  if (!enableUndo) return;
  const btn = document.getElementById("undoButton");
  btn.disabled = disabled;
  btn.setAttribute("aria-disabled", disabled);
}

// Space/Enter one‑key play: BET -> LEVER -> STOP(左→中→右)
function handleSpacePlay() {
  // If spinning, stop next available reel in order
  if (isSpinning) {
    const i = [0,1,2].find(idx => reelSpinning[idx] && !reelStopped[idx]);
    if (i !== undefined) stopReel(i);
    return;
  }
  // Not spinning: if no BET, bet max; otherwise pull lever
  if (betCount === 0) {
    pressBet();
  } else {
    pullLever();
  }
}

document.addEventListener("keydown", (e) => {
  if (enableUndo && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
    return;
  }
  if (e.key.toLowerCase() === "r") {
    e.preventDefault();
    resetGame();
    return;
  }
  if ((e.key === " " || e.key === "Enter") && (!e.target || e.target.tagName !== "BUTTON")) {
    e.preventDefault();
    handleSpacePlay();
  }
});

updateCoinDisplay();

// --- Enhancements: 7 正規化 + 小役/リプレイ判定付きのスピン関数 ---
function normalizeSevens(root) {
  try {
    root.querySelectorAll('span').forEach((el) => {
      const t = el.textContent || '';
      if (t.includes('7')) {
        el.textContent = '7';
        el.classList.add('seven');
      }
    });
  } catch {}
}

function getCenterLineSymbols() {
  const reels = Array.from(document.querySelectorAll('.reel'));
  return reels.map((reel) => {
    const spans = reel.querySelectorAll('.reel-content span');
    if (spans.length >= 2) {
      const t = spans[1].textContent || '';
      return t.includes('7') ? '7' : t;
    }
    return '';
  });
}

function evaluateLineWin(symbols) {
  if (!symbols || symbols.length !== 3) return null;
  const [a, b, c] = symbols;
  if (a === b && b === c) {
    switch (a) {
      case '🔔': return { type: 'bell', symbol: '🔔', payout: 9 };
      case '🍉': return { type: 'watermelon', symbol: '🍉', payout: 12 };
      case '🍒': return { type: 'cherry', symbol: '🍒', payout: 4 };
      case '⭐': return { type: 'replay', symbol: '⭐', payout: 0, replay: true };
      default: return null;
    }
  }
  return null;
}

function handleSpinV3() {
  if (isSpinning) return;
  if (coinBalance < costPerSpin) {
    setMessage("コインが足りません", true);
    playSound("error");
    return;
  }

  saveState();
  isSpinning = true;
  const spinBtn = document.getElementById("spinButton");
  spinBtn.setAttribute("aria-busy", "true");
  setMessage("スピン中…");
  playSound("click");
  clearHibiscusGlow();

  coinBalance -= costPerSpin;
  updateCoinDisplay();

  // 通常回転
  spinReels();

  setTimeout(() => {
    const isError = false; // remove random error simulation
    if (isError) {
      setMessage("エラーが発生しました", true);
      playSound("error");
      coinBalance += costPerSpin;
    } else {
      // BIG/REG/フリーズ 抽選（設定連動）
      const table = SETTINGS[currentSetting] || SETTINGS[1];
      const pFreeze = table.freeze ? 1 / table.freeze : 0;
      const pBig = 1 / table.big;
      const pReg = 1 / table.reg;
      const u = Math.random();
      let awarded = false;
      if (u < pFreeze) {
        setMessage("❄️❄️ ❄️ ❄️ フリーズ！SUPER BIG　2000枚GET！❄️ ❄️ ❄️ ❄️" );
        glowFreeze();
        playFreezeFX();
        coinBalance += PAYOUT.freeze;
        playPayoutBurst(PAYOUT.freeze);
        spinReels(true);
        awarded = true;
      } else if (u < pFreeze + pBig) {
        setMessage("🌺 BIGボーナス！350枚GET！");
        glowHibiscus('big');
        playKyuin();
        coinBalance += PAYOUT.big;
        playPayoutBurst(PAYOUT.big);
        spinReels(true);
        awarded = true;
      } else if (u < pFreeze + pBig + pReg) {
        setMessage("🌺 REGボーナス！100枚GET！");
        glowHibiscus('reg');
        playKyuin();
        coinBalance += PAYOUT.reg;
        playPayoutBurst(PAYOUT.reg);
        spinReels(true);
        awarded = true;
      }

      if (!awarded) {
        // 小役/リプレイ（全3ライン横）
        const res = evaluateAllLines();
        const parts = [];
        if (res.hasReplay) { coinBalance += costPerSpin; parts.push('リプレイ'); }
        if (res.total > 0) { coinBalance += res.total; parts.push(res.messages.join(' / ')); playSound('win'); }
        setMessage(parts.length ? parts.join(' / ') : 'ハズレ…次こそ...！');
      }
    }

    isSpinning = false;
    spinBtn.removeAttribute("aria-busy");
    updateCoinDisplay();
    setUndoDisabled(!lastState);
  }, spinDuration);
}

// クリックハンドラを最新版に差し替え
try {
  const spinBtn = document.getElementById('spinButton');
  if (spinBtn) {
    spinBtn.removeEventListener('click', handleSpin);
    spinBtn.removeEventListener('click', handleSpinV2);
    spinBtn.addEventListener('click', handleSpinV3);
  }
} catch {}

// ===================== Manual lever + stop mode =====================
// Start a continuous scroll for a reel
function startReel(i) {
  const reel = document.getElementById(`reel${i}`);
  const reelContent = document.createElement('div');
  reelContent.classList.add('reel-content');
  for (let k = 0; k < 10; k++) {
    const span = document.createElement('span');
    span.textContent = randomSymbolManual();
    reelContent.appendChild(span);
  }
  reel.innerHTML = '';
  reel.appendChild(reelContent);
  reelContent.style.animation = 'spin 0.2s linear infinite';
  reelSpinning[i] = true;
  reelStopped[i] = false;
}

// Stop a reel and set final 3 symbols
function stopReel(i) {
  if (!isSpinning || !reelSpinning[i] || reelStopped[i]) return;
  if (pendingBonus === 'freeze' || freezeActive) return; // during freeze sequence, ignore manual stops
  ensureAudio();
  const reel = document.getElementById(`reel${i}`);
  const finalContent = document.createElement('div');
  finalContent.classList.add('reel-content');
  for (let r = 0; r < 3; r++) {
    const span = document.createElement('span');
    let sym = randomSymbolManual();
    // If bonus is pending, force center line based on stop order
    if (pendingBonus && r === 1) {
      const stoppedCount = reelStopped.filter(Boolean).length; // reels stopped before this stop
      if (pendingBonus === 'big' || pendingBonus === 'freeze') {
        sym = '7';
      } else if (pendingBonus === 'reg') {
        // First two stopped reels show 7, last stopped reel shows BAR
        sym = stoppedCount < 2 ? '7' : 'BAR';
      }
    }
    if (String(sym).includes('7')) { span.textContent = '7'; span.classList.add('seven'); }
    else if (sym === 'BAR') { span.textContent = 'BAR'; span.classList.add('bar'); }
    else { span.textContent = sym; }
    finalContent.appendChild(span);
  }
  reel.innerHTML = '';
  reel.appendChild(finalContent);
  reelSpinning[i] = false;
  reelStopped[i] = true;
  // Premium triggers tied to stop timing
  const stoppedCountNow = reelStopped.filter(Boolean).length;
  if (pendingBonus === 'big') {
    if (hibiscusPattern === 11 && stoppedCountNow === 1) { flashColor('blue'); playWaveFX(); }
    if (hibiscusPattern === 12 && stoppedCountNow === 2) { flashColor('yellow'); playThunderFX(); }
  }
  // If all reels stopped, evaluate
  if (reelStopped.every(Boolean)) {
    evaluateManualOutcome();
  }
  updatePanelControls();
}

function runFreezeSequence() {
  if (freezeActive) return;
  freezeActive = true;
  const reels = Array.from(document.querySelectorAll('.reel'));
  // Step1: glitch shake +不安定なスタッター(約1.8s)
  reels.forEach((reel) => {
    const rc = reel.querySelector('.reel-content');
    if (rc) rc.classList.add('glitching');
  });
  const rcList = reels.map(r => r.querySelector('.reel-content')).filter(Boolean);
  const stutterSchedule = [0, 280, 560, 820, 1100, 1380, 1660];
  stutterSchedule.forEach((t, idx) => {
    setTimeout(() => {
      rcList.forEach((rc, i) => {
        if (!rc) return;
        if (Math.random() < 0.7) { // ランダムに一瞬止める
          rc.classList.add('stall');
          rc.classList.add('nudge');
          setTimeout(()=>{ rc.classList.remove('stall'); rc.classList.remove('nudge'); }, 140);
        }
      });
    }, t);
  });

  // Step2: 逆回転（約1.4s）途中で小停止を挟む
  setTimeout(() => {
    rcList.forEach((rc) => { rc && rc.classList.remove('glitching'); rc && rc.classList.add('reverse'); });
    const microStops = [240, 520, 820, 1080];
    microStops.forEach((t)=>{
      setTimeout(()=>{ rcList.forEach((rc)=>{ if (Math.random()<0.6){ rc.classList.add('stall'); setTimeout(()=> rc.classList.remove('stall'), 110);} }); }, t);
    });
  }, 1800);

  // Step3: 強制揃い＋フラッシュ＋配当（約1.2s後）
  setTimeout(() => {
    rcList.forEach((rc)=> rc && rc.classList.remove('reverse'));
    reels.forEach((reel, idx) => {
      const finalContent = document.createElement('div');
      finalContent.classList.add('reel-content');
      for (let r=0;r<3;r++) {
        const sp = document.createElement('span');
        const sym = (r===1) ? '7' : randomSymbolManual();
        if (String(sym).includes('7')) { sp.textContent='7'; sp.classList.add('seven'); }
        else if (sym === 'BAR') { sp.textContent='BAR'; sp.classList.add('bar'); }
        else { sp.textContent=sym; }
        finalContent.appendChild(sp);
      }
      reel.innerHTML = '';
      reel.appendChild(finalContent);
      reelSpinning[idx] = false; reelStopped[idx] = true;
    });
    try { const ov = document.createElement('div'); ov.className='flash-overlay'; document.body.appendChild(ov); setTimeout(()=>ov.remove(), 260); } catch {}
    setMessage('✨ プレミアム発動 → SUPER BIG！');
    coinBalance += PAYOUT.freeze; playPayoutBurst(PAYOUT.freeze);
    isSpinning = false; pendingBonus = null; freezeActive = false; betCount = 0;
    updateCoinDisplay(); updateBetDisplay(); updatePanelControls(); setLeverEngaged(false);
  }, 1800 + 1400);
}

function getReelColumnSymbolsManual() {
  // returns array of 3 columns; each column is [top, middle, bottom]
  return [0,1,2].map(i => {
    const reel = document.getElementById(`reel${i}`);
    const spans = reel.querySelectorAll('.reel-content span');
    const col = [0,1,2].map(row => {
      const t = spans[row] ? (spans[row].textContent || '') : '';
      return canonicalSymbol(t);
    });
    return col;
  });
}

function evaluateFiveLinesManual() {
  const cols = getReelColumnSymbolsManual(); // [ [t,m,b], [t,m,b], [t,m,b] ]
  const lines = [];
  // rows 0..2
  for (let r=0;r<3;r++) lines.push([cols[0][r], cols[1][r], cols[2][r]]);
  // diagonals
  lines.push([cols[0][0], cols[1][1], cols[2][2]]);
  lines.push([cols[0][2], cols[1][1], cols[2][0]]);
  return lines.map(evaluateLineWin).filter(Boolean);
}

function evaluateManualOutcome() {
  // まずレバー時の抽選結果を優先
  if (pendingBonus === 'big') {
    setMessage('🌺 BIGボーナス！350枚GET！');
    // 一括加算（SEなし）
    coinBalance += 350;
    playPayoutBurst(350);
    isSpinning = false;
    betCount = 0;
    pendingBonus = null;
    updateCoinDisplay();
    updateBetDisplay();
    updatePanelControls();
    try { const leverBtn = document.getElementById('lever'); leverBtn && leverBtn.classList.remove('engaged'); } catch {}
    return;
  }
  if (pendingBonus === 'freeze') {
    setMessage('❄️ フリーズ！SUPER BIG +2000枚');
    coinBalance += PAYOUT.freeze;
    playPayoutBurst(PAYOUT.freeze);
    isSpinning = false;
    betCount = 0;
    pendingBonus = null;
    updateCoinDisplay();
    updateBetDisplay();
    updatePanelControls();
    try { const leverBtn = document.getElementById('lever'); leverBtn && leverBtn.classList.remove('engaged'); } catch {}
    return;
  }
  if (pendingBonus === 'reg') {
    setMessage('🌺 REGボーナス！100枚GET！');
    coinBalance += 120;
    playPayoutBurst(120);
    isSpinning = false;
    betCount = 0;
    pendingBonus = null;
    updateCoinDisplay();
    updateBetDisplay();
    updatePanelControls();
    try { const leverBtn = document.getElementById('lever'); leverBtn && leverBtn.classList.remove('engaged'); } catch {}
    return;
  }
  // 判定は5ライン（3横 + 斜め2）
  const cols = getReelColumnSymbolsManual();

  // 小役/リプレイ（5ライン合算）
  const wins = evaluateFiveLinesManual();
  const replayCount = wins.filter(w=>w.replay).length;
  const total = wins.filter(w=>!w.replay).reduce((s,w)=> s + (w.payout||0), 0);
  if (total > 0) {
    const msg = wins.filter(w=>!w.replay).map(w=>`${w.symbol}x3 +${w.payout}`).join(' / ');
    setMessage(msg);
    // 1枚ずつ払い出し（合算払い）
    addCoinsGradually(total, () => {
      isSpinning = false;
      betCount = 0;
      pendingBonus = null;
      updateCoinDisplay();
      updateBetDisplay();
      updatePanelControls();
      setLeverEngaged(false);
    });
  } else if (replayCount > 0) {
    setMessage('リプレイ');
    coinBalance += betCount; // BETぶん戻す
    isSpinning = false;
    betCount = 0;
    pendingBonus = null;
    updateCoinDisplay();
    updateBetDisplay();
    updatePanelControls();
    setLeverEngaged(false);
  } else {
    setMessage('ハズレ…次こそ当てよう！');
    isSpinning = false;
    betCount = 0;
    pendingBonus = null;
    updateCoinDisplay();
    updateBetDisplay();
    updatePanelControls();
    setLeverEngaged(false);
  }
}

function addCoinsGradually(amount, onDone) {
  let paid = 0;
  if (amount <= 0) { if (onDone) onDone(); return; }
  const iv = setInterval(() => {
    ensureAudio();
    coinBalance += 1;
    updateCoinDisplay();
    playSound('coin');
    paid += 1;
    if (paid >= amount) { clearInterval(iv); if (onDone) onDone(); }
  }, 60);
}

function pressBet() {
  if (isSpinning) return;
  if (coinBalance <= 0) { setMessage('コインが足りません', true); playSound('error'); return; }
  ensureAudio();
  // 一度の押下で最大3枚BET（残高が足りなければ残高分）
  betCount = Math.min(maxBet, coinBalance);
  playSound('click');
  updateBetDisplay();
}

function pullLever() {
  if (isSpinning) return;
  if (betCount === 0) { setMessage('BETしてください'); return; }
  if (coinBalance < betCount) { setMessage('コインが足りません', true); playSound('error'); return; }
  ensureAudio();
  saveState();
  isSpinning = true;
  setMessage('回転中…');
  clearHibiscusGlow();
  coinBalance -= betCount;
  updateCoinDisplay();
  playSound('click');
  setLeverEngaged(true);
  // 抽選（設定に連動）
  const table = SETTINGS[currentSetting] || SETTINGS[1];
  const pFreeze = table.freeze ? 1 / table.freeze : 0;
  const pBig = 1 / table.big;
  const pReg = 1 / table.reg;
  const u = Math.random();
  pendingBonus = u < pFreeze ? 'freeze' : (u < pFreeze + pBig ? 'big' : (u < pFreeze + pBig + pReg ? 'reg' : null));
  // レバーオンで点灯・SE（当選時）
  if (pendingBonus) {
    if (pendingBonus === 'freeze') { glowFreeze(); playFreezeFX(); setTimeout(runFreezeSequence, 350); }
    else { glowHibiscus(pendingBonus === 'big' ? 'big' : 'reg'); if (!(pendingBonus === 'big' && hibiscusMute)) playKyuin(); }
    // Pattern 10 immediate delayed explosion after lever-on
    if (hibiscusPattern === 10) { setTimeout(()=>{ flashColor('red'); playExplosion(); }, 650); }
  }
  // start reels
  for (let i=0;i<3;i++) startReel(i);
  updatePanelControls();
}

function updateBetDisplay() {
  const el = document.getElementById('betCount');
  if (el) el.textContent = String(betCount);
}

function updatePanelControls() {
  const betBtn = document.getElementById('betButton');
  const leverBtn = document.getElementById('lever');
  const stopBtns = [0,1,2].map(i => document.getElementById(`stop${i}`));
  if (betBtn) betBtn.disabled = isSpinning || betCount >= maxBet || coinBalance <= 0;
  if (leverBtn) leverBtn.disabled = isSpinning || betCount === 0;
  stopBtns.forEach((b,i)=>{ if (b) b.disabled = !isSpinning || !reelSpinning[i]; });
}

// Wire up panel events
try {
  const betBtn = document.getElementById('betButton');
  const leverBtn = document.getElementById('lever');
  const stopBtns = [0,1,2].map(i => document.getElementById(`stop${i}`));
  betBtn && betBtn.addEventListener('click', () => { pressBet(); updatePanelControls(); });
  leverBtn && leverBtn.addEventListener('click', () => { pullLever(); updatePanelControls(); });
  stopBtns.forEach((b,i)=> b && b.addEventListener('click', () => stopReel(i)));
  updatePanelControls();
  updateBetDisplay();
} catch {}

// Test hooks (non-invasive)
try {
  if (typeof window !== 'undefined') {
    window._game = {
      // state
      get coin(){ return coinBalance; }, set coin(v){ coinBalance = v; updateCoinDisplay(); },
      get bet(){ return betCount; }, set bet(v){ betCount = v; updateBetDisplay(); },
      // actions
      pressBet, pullLever, stopReel,
      // helper to set centers and evaluate
      forceEvaluate(centers) {
        [0,1,2].forEach((i)=>{
          const reel = document.getElementById(`reel${i}`);
          const cont = document.createElement('div');
          cont.classList.add('reel-content');
          // top, center, bottom
          const syms = [randomSymbolManual(), centers[i], randomSymbolManual()];
          syms.forEach((s)=>{
            const sp = document.createElement('span');
            if (String(s).includes('7')) { sp.textContent='7'; sp.classList.add('seven'); }
            else { sp.textContent = s; if (s==='BAR') sp.classList.add('bar'); }
            cont.appendChild(sp);
          });
          reel.innerHTML='';
          reel.appendChild(cont);
          reelSpinning[i] = false; reelStopped[i] = true;
        });
        isSpinning = true; // mimic in-spin finishing
        evaluateManualOutcome();
      }
    };
  }
} catch {}
