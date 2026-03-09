(function () {
  const cfg = window.AD_CONFIG || {
    INITIAL_COINS: 100,
    COINS_PER_PLAY: 3,
    REWARD_COINS: 50,
    INTERSTITIAL_INTERVAL: 50,
    REWARD_AD_SECONDS: 5,
    INTERSTITIAL_AD_SECONDS: 4
  };

  const STORAGE_KEYS = {
    currentCoins: 'currentCoins',
    playCount: 'playCount'
  };

  const state = {
    currentCoins: cfg.INITIAL_COINS,
    playCount: 0,
    isRewardAdOpen: false,
    isInterstitialAdOpen: false,
    isOutOfCoinsModalOpen: false
  };

  let hooks = {
    onRewardComplete: function () {},
    onStateChange: function () {},
    onInterstitialClose: function () {}
  };

  let root = null;
  let outOfCoinsModal = null;
  let rewardModal = null;
  let interstitialModal = null;

  let rewardCountdown = cfg.REWARD_AD_SECONDS;
  let interstitialCountdown = cfg.INTERSTITIAL_AD_SECONDS;
  let rewardTimerId = null;
  let interstitialTimerId = null;
  let rewardFinalizeTimerId = null;
  let interstitialFinalizeTimerId = null;
  let rewardDeadline = 0;
  let interstitialDeadline = 0;
  let rewardClaimed = false;

  function loadNumber(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      const num = Number(JSON.parse(raw));
      return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveNumber(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(Math.max(0, Math.floor(value))));
    } catch {}
  }

  function emitState() {
    saveNumber(STORAGE_KEYS.currentCoins, state.currentCoins);
    saveNumber(STORAGE_KEYS.playCount, state.playCount);
    try {
      hooks.onStateChange({ ...state });
    } catch (err) {
      try { console.error('AdSystem onStateChange error', err); } catch {}
    }
  }

  function isAnyAdOpen() {
    return state.isRewardAdOpen || state.isInterstitialAdOpen || state.isOutOfCoinsModalOpen;
  }

  function updateRootVisibility() {
    if (!root) return;
    root.hidden = !isAnyAdOpen();
  }

  function stopTimers() {
    if (rewardTimerId) {
      clearTimeout(rewardTimerId);
      rewardTimerId = null;
    }
    if (interstitialTimerId) {
      clearTimeout(interstitialTimerId);
      interstitialTimerId = null;
    }
    if (rewardFinalizeTimerId) {
      clearTimeout(rewardFinalizeTimerId);
      rewardFinalizeTimerId = null;
    }
    if (interstitialFinalizeTimerId) {
      clearTimeout(interstitialFinalizeTimerId);
      interstitialFinalizeTimerId = null;
    }
  }

  function closeOutOfCoinsModal() {
    state.isOutOfCoinsModalOpen = false;
    if (outOfCoinsModal) outOfCoinsModal.hidden = true;
    updateRootVisibility();
    emitState();
  }

  function closeRewardModal() {
    state.isRewardAdOpen = false;
    if (rewardModal) rewardModal.hidden = true;
    updateRootVisibility();
    emitState();
  }

  function closeInterstitialModal() {
    state.isInterstitialAdOpen = false;
    if (interstitialModal) interstitialModal.hidden = true;
    updateRootVisibility();
    try {
      hooks.onInterstitialClose();
    } catch (err) {
      try { console.error('AdSystem onInterstitialClose error', err); } catch {}
    }
    emitState();
  }

  function showOutOfCoinsModal() {
    if (!outOfCoinsModal || state.isRewardAdOpen || state.isInterstitialAdOpen) return;
    state.isOutOfCoinsModalOpen = true;
    outOfCoinsModal.hidden = false;
    updateRootVisibility();
    emitState();
  }

  function startRewardAd() {
    if (!rewardModal || state.isRewardAdOpen || state.isInterstitialAdOpen) return false;
    closeOutOfCoinsModal();
    rewardClaimed = false;
    rewardCountdown = cfg.REWARD_AD_SECONDS;
    rewardDeadline = Date.now() + rewardCountdown * 1000;

    const seconds = rewardModal.querySelector('[data-role="reward-seconds"]');
    const claimBtn = rewardModal.querySelector('[data-role="reward-claim"]');

    if (seconds) seconds.textContent = String(rewardCountdown);
    if (claimBtn) {
      claimBtn.disabled = true;
      claimBtn.setAttribute('aria-disabled', 'true');
    }

    state.isRewardAdOpen = true;
    rewardModal.hidden = false;
    updateRootVisibility();

    stopTimers();
    const tickReward = function () {
      const remaining = Math.max(0, Math.ceil((rewardDeadline - Date.now()) / 1000));
      rewardCountdown = remaining;
      if (seconds) seconds.textContent = String(remaining);
      if (remaining <= 0) {
        rewardTimerId = null;
        if (claimBtn) {
          claimBtn.disabled = false;
          claimBtn.setAttribute('aria-disabled', 'false');
        }
        return;
      }
      rewardTimerId = setTimeout(tickReward, 200);
    };
    tickReward();
    rewardFinalizeTimerId = setTimeout(function () {
      rewardCountdown = 0;
      if (seconds) seconds.textContent = '0';
      if (claimBtn) {
        claimBtn.disabled = false;
        claimBtn.setAttribute('aria-disabled', 'false');
      }
    }, Math.max(1000, cfg.REWARD_AD_SECONDS * 1000 + 120));
    emitState();
    return true;
  }

  function claimReward() {
    if (rewardClaimed || rewardCountdown > 0) return;
    rewardClaimed = true;
    try {
      hooks.onRewardComplete(cfg.REWARD_COINS);
    } catch (err) {
      try { console.error('AdSystem onRewardComplete error', err); } catch {}
    }
    closeRewardModal();
  }

  function showInterstitialAd() {
    if (!interstitialModal || state.isRewardAdOpen || state.isInterstitialAdOpen) return false;

    interstitialCountdown = cfg.INTERSTITIAL_AD_SECONDS;
    interstitialDeadline = Date.now() + interstitialCountdown * 1000;
    const seconds = interstitialModal.querySelector('[data-role="interstitial-seconds"]');
    const closeBtn = interstitialModal.querySelector('[data-role="interstitial-close"]');

    if (seconds) seconds.textContent = String(interstitialCountdown);
    if (closeBtn) closeBtn.hidden = true;

    state.isInterstitialAdOpen = true;
    interstitialModal.hidden = false;
    updateRootVisibility();

    stopTimers();
    const tickInterstitial = function () {
      const remaining = Math.max(0, Math.ceil((interstitialDeadline - Date.now()) / 1000));
      interstitialCountdown = remaining;
      if (seconds) seconds.textContent = String(remaining);
      if (remaining <= 0) {
        interstitialTimerId = null;
        if (closeBtn) closeBtn.hidden = false;
        return;
      }
      interstitialTimerId = setTimeout(tickInterstitial, 200);
    };
    tickInterstitial();
    interstitialFinalizeTimerId = setTimeout(function () {
      interstitialCountdown = 0;
      if (seconds) seconds.textContent = '0';
      if (closeBtn) closeBtn.hidden = false;
    }, Math.max(1000, cfg.INTERSTITIAL_AD_SECONDS * 1000 + 120));
    emitState();

    return true;
  }

  function showRewardAd() {
    return startRewardAd();
  }

  function createBase() {
    if (root) return;

    root = document.createElement('div');
    root.id = 'adOverlayRoot';
    root.className = 'ad-overlay-root';
    root.hidden = true;

    outOfCoinsModal = document.createElement('div');
    outOfCoinsModal.className = 'ad-modal';
    outOfCoinsModal.hidden = true;
    outOfCoinsModal.innerHTML =
      '<div class="ad-modal-card" role="dialog" aria-modal="true" aria-labelledby="outOfCoinsTitle">' +
      '<h2 id="outOfCoinsTitle">コインが足りません</h2>' +
      '<p>広告を見るとコインを回復できます</p>' +
      '<div class="ad-modal-actions">' +
      '<button type="button" data-role="watch-reward-ad" class="ad-btn ad-btn-primary">広告を見る</button>' +
      '<button type="button" data-role="close-out-of-coins" class="ad-btn">閉じる</button>' +
      '</div>' +
      '</div>';

    rewardModal = document.createElement('div');
    rewardModal.className = 'ad-modal';
    rewardModal.hidden = true;
    rewardModal.innerHTML =
      '<div class="ad-modal-card" role="dialog" aria-modal="true" aria-labelledby="rewardAdTitle">' +
      '<h2 id="rewardAdTitle">広告表示中</h2>' +
      '<p>報酬まで残り <strong data-role="reward-seconds">5</strong> 秒</p>' +
      '<div class="ad-modal-actions">' +
      '<button type="button" data-role="reward-claim" class="ad-btn ad-btn-primary" disabled>コイン' + cfg.REWARD_COINS + '枚を受け取る</button>' +
      '</div>' +
      '</div>';

    interstitialModal = document.createElement('div');
    interstitialModal.className = 'ad-modal';
    interstitialModal.hidden = true;
    interstitialModal.innerHTML =
      '<div class="ad-modal-card" role="dialog" aria-modal="true" aria-labelledby="interstitialAdTitle">' +
      '<h2 id="interstitialAdTitle">広告表示中</h2>' +
      '<p>残り <strong data-role="interstitial-seconds">4</strong> 秒</p>' +
      '<div class="ad-modal-actions">' +
      '<button type="button" data-role="interstitial-close" class="ad-btn ad-btn-primary" hidden>閉じる</button>' +
      '</div>' +
      '</div>';

    root.appendChild(outOfCoinsModal);
    root.appendChild(rewardModal);
    root.appendChild(interstitialModal);
    document.body.appendChild(root);

    outOfCoinsModal.querySelector('[data-role="watch-reward-ad"]').addEventListener('click', showRewardAd);
    outOfCoinsModal.querySelector('[data-role="close-out-of-coins"]').addEventListener('click', closeOutOfCoinsModal);
    rewardModal.querySelector('[data-role="reward-claim"]').addEventListener('click', claimReward);
    interstitialModal.querySelector('[data-role="interstitial-close"]').addEventListener('click', closeInterstitialModal);
  }

  function init(options) {
    hooks = {
      ...hooks,
      ...(options || {})
    };

    state.currentCoins = loadNumber(STORAGE_KEYS.currentCoins, cfg.INITIAL_COINS);
    state.playCount = loadNumber(STORAGE_KEYS.playCount, 0);

    createBase();
    emitState();
  }

  function setCurrentCoins(value) {
    state.currentCoins = Math.max(0, Math.floor(Number(value) || 0));
    emitState();
  }

  function setPlayCount(value) {
    state.playCount = Math.max(0, Math.floor(Number(value) || 0));
    emitState();
  }

  function incrementPlayCount() {
    state.playCount += 1;
    emitState();
    return state.playCount;
  }

  function shouldShowInterstitial() {
    if (state.playCount <= 0) return false;
    return state.playCount % cfg.INTERSTITIAL_INTERVAL === 0;
  }

  function destroy() {
    stopTimers();
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }
    root = null;
    outOfCoinsModal = null;
    rewardModal = null;
    interstitialModal = null;
  }

  window.AdSystem = {
    init,
    destroy,
    setCurrentCoins,
    setPlayCount,
    incrementPlayCount,
    shouldShowInterstitial,
    showRewardAd,
    showOutOfCoinsModal,
    showInterstitialAd,
    isAnyAdOpen,
    getState: function () { return { ...state }; }
  };
})();
