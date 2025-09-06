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

  setTimeout(() => {
    const isError = Math.random() < 0.05;
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
