/**
 * Early preferences (runs at the very top of <body>, before the rest of the page).
 *
 * Why this file exists:
 * - style.css loads in <head>, but script.js runs at the END of the page.
 * - Without this snippet, users briefly see light theme / full motion before
 *   script.js applies dark mode or "Reduce animations" from localStorage.
 * - Applying classes here keeps the first paint aligned with saved settings.
 *
 * Keys MUST stay in sync with script.js (same localStorage names).
 */
(function applyEarlyPreferences() {
  try {
    var body = document.body;
    if (!body) return;

    var theme = localStorage.getItem("liveEventTheme") || "light";
    body.classList.toggle("theme-dark", theme === "dark");

    var reduceMotion = localStorage.getItem("liveEventA11yReduceMotion") === "true";
    body.classList.toggle("reduce-animations", reduceMotion);
    body.classList.toggle("a11y-reduce-motion", reduceMotion);

    body.classList.toggle(
      "a11y-large-text",
      localStorage.getItem("liveEventA11yLargeText") === "true"
    );
    body.classList.toggle(
      "a11y-high-contrast",
      localStorage.getItem("liveEventA11yHighContrast") === "true"
    );
  } catch (e) {
    /* Private mode / blocked storage — ignore */
  }
})();
