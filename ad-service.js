(function () {
  const noop = function () {};

  let hooks = {
    onRewardGranted: noop,
    onStateChange: noop,
    onInterstitialClosed: noop
  };

  const guard = {
    rewardInFlight: false,
    interstitialInFlight: false,
    rewardGranted: false
  };

  function getAdapter() {
    return window.AdSystem || null;
  }

  function safeCall(fn, arg) {
    try { fn(arg); } catch (err) { try { console.error('AdService callback error', err); } catch {} }
  }

  function init(options) {
    hooks = { ...hooks, ...(options || {}) };
    const adapter = getAdapter();
    if (!adapter || typeof adapter.init !== 'function') return;

    adapter.init({
      onRewardComplete: function (rewardCoins) {
        if (guard.rewardGranted) return;
        guard.rewardGranted = true;
        guard.rewardInFlight = false;
        safeCall(hooks.onRewardGranted, rewardCoins);
      },
      onInterstitialClose: function () {
        guard.interstitialInFlight = false;
        safeCall(hooks.onInterstitialClosed);
      },
      onStateChange: function (state) {
        if (!state.isRewardAdOpen && !state.isOutOfCoinsModalOpen) {
          guard.rewardInFlight = false;
          guard.rewardGranted = false;
        }
        if (!state.isInterstitialAdOpen) {
          guard.interstitialInFlight = false;
        }
        safeCall(hooks.onStateChange, state);
      }
    });
  }

  function showRewardAd() {
    const adapter = getAdapter();
    if (!adapter || typeof adapter.showRewardAd !== 'function') return false;
    if (guard.rewardInFlight || adapter.isAnyAdOpen()) return false;
    guard.rewardInFlight = true;
    guard.rewardGranted = false;
    const opened = adapter.showRewardAd();
    if (!opened) {
      guard.rewardInFlight = false;
      guard.rewardGranted = false;
    }
    return !!opened;
  }

  function showOutOfCoinsModal() {
    const adapter = getAdapter();
    if (!adapter || typeof adapter.showOutOfCoinsModal !== 'function') return false;
    if (adapter.isAnyAdOpen()) return false;
    adapter.showOutOfCoinsModal();
    return true;
  }

  function showInterstitialAd() {
    const adapter = getAdapter();
    if (!adapter || typeof adapter.showInterstitialAd !== 'function') return false;
    if (guard.interstitialInFlight || adapter.isAnyAdOpen()) return false;
    guard.interstitialInFlight = true;
    const opened = adapter.showInterstitialAd();
    if (!opened) {
      guard.interstitialInFlight = false;
    }
    return !!opened;
  }

  function passthrough(name) {
    return function () {
      const adapter = getAdapter();
      const fn = adapter && adapter[name];
      if (typeof fn !== 'function') return undefined;
      return fn.apply(adapter, arguments);
    };
  }

  window.AdService = {
    init,
    showRewardAd,
    showOutOfCoinsModal,
    showInterstitialAd,
    isAnyAdOpen: passthrough('isAnyAdOpen'),
    setCurrentCoins: passthrough('setCurrentCoins'),
    setPlayCount: passthrough('setPlayCount'),
    getState: passthrough('getState')
  };
})();
