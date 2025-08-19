// シンボル定義
const symbols = ["🍍", "🍒", "⭐", "🌺", "🍇", "７"];
const spinDuration = 500;
const costPerSpin = 3;
const enableUndo = true;

let coinBalance = 100;
let isSpinning = false;
let lastState = null;


// リール回転関数（ボーナス時は777固定表示）
function spinReels(isBonus = false) {
  const reels = document.querySelectorAll(".reel");

  reels.forEach((reel, index) => {
    const reelContent = document.createElement("div");
    reelContent.classList.add("reel-content");

    // 回転演出用の10個
    for (let i = 0; i < 10; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const span = document.createElement("span");
      span.textContent = symbol;
      reelContent.appendChild(span);
    }

    reel.innerHTML = "";
    reel.appendChild(reelContent);
    reelContent.style.animation = "spin 0.2s linear infinite";

    // 回転停止して最終表示へ
    setTimeout(() => {
      reelContent.style.animation = "none";
      const finalContent = document.createElement("div");
      finalContent.classList.add("reel-content");

      for (let i = 0; i < 3; i++) {
        const span = document.createElement("span");

        if (isBonus) {
          // ボーナス時は斜め揃いの７７７
          if (
            (index === 0 && i === 0) ||
            (index === 1 && i === 1) ||
            (index === 2 && i === 2)
          ) {
            span.textContent = "７";
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

// ハイビスカス点灯処理
function glowHibiscus() {
  const hibiscus = document.getElementById("hibiscus");
  hibiscus.classList.add("glowing");
  setTimeout(() => {
    hibiscus.classList.remove("glowing");
  }, 6000);
}
// function glowHibiscus() {
//   const hibiscusLeft = document.getElementById("hibiscus-left");
//   const hibiscusRight = document.getElementById("hibiscus-right");

//   hibiscusLeft.classList.add("glowing");
//   hibiscusRight.classList.add("glowing");

//   setTimeout(() => {
//     hibiscusLeft.classList.remove("glowing");
//     hibiscusRight.classList.remove("glowing");
//   }, 6000);
// }


function updateCoinDisplay() {
  const spinBtn = document.getElementById("spinButton");
  spinBtn.disabled = isSpinning || coinBalance < costPerSpin;
  spinBtn.setAttribute("aria-disabled", spinBtn.disabled);
  const resetBtn = document.getElementById("resetButton");
  resetBtn.disabled = isSpinning;
  resetBtn.setAttribute("aria-disabled", resetBtn.disabled);
  document.getElementById("coinDisplay").innerText = `残高：${coinBalance}枚`;
}

function handleSpin() {
  if (isSpinning) return;
  if (coinBalance < costPerSpin) {
    document.getElementById("message").innerText = "残高がありません";
    return;
  }

  saveState();
  isSpinning = true;
  const spinBtn = document.getElementById("spinButton");
  spinBtn.setAttribute("aria-busy", "true");
  document.getElementById("message").innerText = "処理中…";
  document.getElementById("message").classList.remove("error");
  document.getElementById("hibiscus").classList.remove("glowing");

  coinBalance -= costPerSpin;
  updateCoinDisplay();

  spinReels();

  setTimeout(() => {
    const isError = Math.random() < 0.05;
    if (isError) {
      document.getElementById("message").innerText = "エラーが発生しました";
      document.getElementById("message").classList.add("error");
      coinBalance += costPerSpin;
    } else {
      const isBonus = Math.random() < 1 / 3;
      if (isBonus) {
        document.getElementById("message").innerText =
          "🌺 ハイビスカスが光った！ボーナス確定！ 🌺";
        glowHibiscus();
        coinBalance += 350;
        spinReels(true);
      } else {
        document.getElementById("message").innerText =
          "ハズレ…もう一回挑戦！";
      }
    }
    isSpinning = false;
    spinBtn.removeAttribute("aria-busy");
    updateCoinDisplay();
    setUndoDisabled(!lastState);
  }, spinDuration);
}

document
  .getElementById("spinButton")
  .addEventListener("click", handleSpin);

function resetGame() {
  if (isSpinning) return;
  coinBalance = 100;
  lastState = null;
  document.getElementById("message").innerText = "ゲームをリセットしました";
  document.getElementById("message").classList.remove("error");
  const reels = document.querySelectorAll(".reel");
  reels.forEach((reel) => {
    reel.innerHTML = "";
  });
  document.getElementById("hibiscus").classList.remove("glowing");
  updateCoinDisplay();
  setUndoDisabled(true);
}

document.getElementById("resetButton").addEventListener("click", resetGame);

function saveState() {
  if (!enableUndo) return;
  const reels = Array.from(document.querySelectorAll(".reel")).map(
    (reel) => reel.innerHTML
  );
  lastState = {
    coinBalance,
    message: document.getElementById("message").innerText,
    reels,
  };
  setUndoDisabled(false);
}

function undo() {
  if (!enableUndo || !lastState) return;
  coinBalance = lastState.coinBalance;
  document.getElementById("message").innerText = lastState.message;
  const reels = document.querySelectorAll(".reel");
  reels.forEach((reel, i) => {
    reel.innerHTML = lastState.reels[i];
  });
  lastState = null;
  updateCoinDisplay();
  setUndoDisabled(true);
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
  if (
    enableUndo &&
    (e.ctrlKey || e.metaKey) &&
    e.key.toLowerCase() === "z"
  ) {
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

