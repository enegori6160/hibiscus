(function () {
  const cfg = window.AD_CONFIG;
  const state = {
    currentCoins: cfg.INITIAL_COINS, playCount: 0,
    isRewardAdOpen: false, isInterstitialAdOpen: false,
    isOutOfCoinsModalOpen: false
  };
  let hooks = {};
  let dialog;
  let previousFocus;

  function emitState() {
    if (hooks.onStateChange) hooks.onStateChange({ ...state });
  }

  function close() {
    dialog.close();
    state.isOutOfCoinsModalOpen = false;
    emitState();
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }

  function showOutOfCoinsModal() {
    if (!dialog || dialog.open) return false;
    previousFocus = document.activeElement;
    state.isOutOfCoinsModalOpen = true;
    dialog.showModal();
    emitState();
    return true;
  }

  function init(options) {
    hooks = options || {};
    for (const key of ['currentCoins', 'playCount']) {
      try {
        const raw = localStorage.getItem(key);
        const value = raw === null ? state[key] : Number(JSON.parse(raw));
        if (Number.isFinite(value) && value >= 0) state[key] = Math.floor(value);
      } catch {}
    }
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'refill-dialog';
      dialog.setAttribute('aria-labelledby', 'refill-title');
      dialog.innerHTML = '<h2 id="refill-title">コインを無料補充</h2>' +
        '<p>ゲーム内コインを' + cfg.REWARD_COINS + '枚補充して続けられます。料金はかかりません。</p>' +
        '<div class="ad-modal-actions"><button type="button" data-refill>補充する</button>' +
        '<button type="button" data-close>閉じる</button></div>';
      document.body.appendChild(dialog);
      dialog.querySelector('[data-refill]').addEventListener('click', function () {
        if (!state.isOutOfCoinsModalOpen) return;
        state.isOutOfCoinsModalOpen = false;
        if (hooks.onRewardComplete) hooks.onRewardComplete(cfg.REWARD_COINS);
        close();
      });
      dialog.querySelector('[data-close]').addEventListener('click', close);
      dialog.addEventListener('cancel', function (event) {
        event.preventDefault();
        close();
      });
    }
    emitState();
  }

  // Preserve the game adapter contract; no advertising provider is connected.
  window.AdSystem = {
    init,
    destroy: function () {
      if (dialog) { dialog.remove(); dialog = null; }
      state.isOutOfCoinsModalOpen = false;
      emitState();
    },
    setCurrentCoins: function (value) { state.currentCoins = value; emitState(); },
    setPlayCount: function (value) { state.playCount = value; emitState(); },
    incrementPlayCount: function () { state.playCount += 1; emitState(); return state.playCount; },
    shouldShowInterstitial: function () { return false; },
    showRewardAd: showOutOfCoinsModal,
    showOutOfCoinsModal,
    showInterstitialAd: function () { return false; },
    isAnyAdOpen: function () { return state.isOutOfCoinsModalOpen; },
    getState: function () { return { ...state }; }
  };
})();
