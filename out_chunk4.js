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

