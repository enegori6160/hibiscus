// Symbols and config
const symbols = ["🍒", "🍋", "⭐", "🍇", "🔔", "7️⃣"];
const spinDuration = 600;
const costPerSpin = 3;
const enableUndo = true;

let coinBalance = 100;
let isSpinning = false;
let lastState = null;
let soundEnabled = true;
let audioCtx;

// Utilities: persistence
const storage = {
  save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  load(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
};

function playSound(type) {
  if (!soundEnabled) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    const freq = type === "win" ? 880 : type === "error" ? 220 : 440;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (e) {
    console.warn("Web Audio not supported", e);
  }
}

// Pachislo-like "kyuin" multi-chirp for bonus
function playKyuin() {
  if (!soundEnabled) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
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
    }, spinDuration);
  });
}

function glowHibiscus() {
  const left = document.getElementById("hibiscus");
  const right = document.getElementById("hibiscus-right");
  [left, right].forEach(el => el && el.classList.add("glowing"));
  setTimeout(() => { [left, right].forEach(el => el && el.classList.remove("glowing")); }, 6000);
}

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
  document.getElementById("hibiscus").classList.remove("glowing");

  coinBalance -= costPerSpin;
  updateCoinDisplay();

  spinReels();

  setTimeout(() => {
    const isError = Math.random() < 0.05;
    if (isError) {
      setMessage("エラーが発生しました", true);
      playSound("error");
      coinBalance += costPerSpin;
    } else {
      const isBonus = Math.random() < 1 / 3;
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
  }, spinDuration);
}

document.getElementById("spinButton").addEventListener("click", handleSpin);
document.getElementById("resetButton").addEventListener("click", resetGame);
document.getElementById("themeToggle").addEventListener("click", toggleTheme);
document.getElementById("soundToggle").addEventListener("click", toggleSound);

// Duplicate controls in settings panel
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "themeToggle2") toggleTheme();
  if (e.target && e.target.id === "soundToggle2") toggleSound();
});

// Nav toggle
document.getElementById("navToggle").addEventListener("click", toggleNav);
document.querySelectorAll('#siteNav .nav-link').forEach((a) => a.addEventListener('click', () => {
  const nav = document.getElementById('siteNav');
  if (nav.classList.contains('open')) toggleNav();
}));

// Theming on load
(function initPreferences() {
  const savedTheme = storage.load("theme", null);
  const preferDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (savedTheme === "dark" || (!savedTheme && preferDark)) {
    document.body.classList.add("dark");
  }
  soundEnabled = storage.load("soundEnabled", true);
  coinBalance = storage.load("coinBalance", 100);
  reflectThemeButtons();
  reflectSoundButtons();
})();

function resetGame() {
  if (isSpinning) return;
  coinBalance = 100;
  lastState = null;
  setMessage("ゲームをリセットしました");
  playSound("click");
  const reels = document.querySelectorAll(".reel");
  reels.forEach((reel) => { reel.innerHTML = ""; });
  document.getElementById("hibiscus").classList.remove("glowing");
  updateCoinDisplay();
  setUndoDisabled(true);
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

document.addEventListener("keydown", (e) => {
  if (enableUndo && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
  }
  if (e.key.toLowerCase() === "r") {
    e.preventDefault();
    resetGame();
  }
  if (e.key === " " || e.key === "Enter") {
    if (e.target.tagName !== "BUTTON") {
      e.preventDefault();
      handleSpin();
    }
  }
});

updateCoinDisplay();
