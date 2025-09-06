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
