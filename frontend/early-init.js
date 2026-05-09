/**
 * early-init.js — first script on every HTML page (<body>, before content).
 *
 * Purpose: Apply saved Look & Feel settings before the browser paints anything,
 *           so visitors never flash the wrong theme or unwanted motion.
 *
 * Connects to the app via:
 *   - Reads the same localStorage keys that script.js (Settings section) WRITES:
 *       liveEventTheme, liveEventA11yReduceMotion,
 *       liveEventA11yLargeText, liveEventA11yHighContrast
 *   - Toggles <body> classes (e.g. theme-dark, reduce-animations) that style.css
 *     reacts to globally.
 *
 * Presenter note: Mention this as “architectural glue” — not business logic,
 * just synchronizing visuals with persisted preferences as early as possible.
 *
 * Keys MUST stay in sync with script.js (same localStorage names).
 */
(function applyEarlyPreferences() {
  try {
    var body = document.body;
    if (!body) return;

    /* ① Theme mirrors Settings — body.theme-dark swaps entire palette via CSS vars */
    var theme = localStorage.getItem("liveEventTheme") || "light";
    body.classList.toggle("theme-dark", theme === "dark");

    /* ② Motion reductions — BOTH classes exist for backwards-compatible selectors */
    var reduceMotion = localStorage.getItem("liveEventA11yReduceMotion") === "true";
    body.classList.toggle("reduce-animations", reduceMotion);
    body.classList.toggle("a11y-reduce-motion", reduceMotion);

    /* ③ Optional larger base font scale */
    body.classList.toggle(
      "a11y-large-text",
      localStorage.getItem("liveEventA11yLargeText") === "true"
    );

    /* ④ High-contrast palette adjustments */
    body.classList.toggle(
      "a11y-high-contrast",
      localStorage.getItem("liveEventA11yHighContrast") === "true"
    );
  } catch (e) {
    /* Private mode / blocked storage — ignore */
  }
})();
