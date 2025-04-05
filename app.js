// シンボル定義
const symbols = ["🍍", "🍒", "⭐", "🌺", "🍇", "７"];
const spinDuration = 500;

let coinBalance = 100;


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
  document.getElementById("coinDisplay").innerText = `残高：${coinBalance}枚`;
}

// スピンボタン処理
document.getElementById("spinButton").addEventListener("click", () => {
  // 残高チェック
  if (coinBalance < 3) {
    document.getElementById("message").innerText = "メダルが足りません！";
    return;
  }

  document.getElementById("message").innerText = "";
  document.getElementById("hibiscus").classList.remove("glowing");

  // メダル消費（1スピンあたり10枚）
  coinBalance -= 3;
  updateCoinDisplay();

  spinReels();       // 通常スピン
 

  setTimeout(() => {
    const isBonus = Math.random() < (1 / 3);
    if (isBonus) {
      document.getElementById("message").innerText = "🌺 ハイビスカスが光った！ボーナス確定！ 🌺";
      glowHibiscus();    // 光らせる（演出）
      coinBalance += 350; // ← 当選時に+350枚
      updateCoinDisplay();
      spinReels(true);
    } else {
      document.getElementById("message").innerText = "ハズレ…もう一回挑戦！";
    }
  }, spinDuration);
});

