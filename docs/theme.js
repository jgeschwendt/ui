/* theme.js — the theme toggle both pages share, loaded in <head> so a stored
   choice is on <html> before first paint rather than flashing in at the end of
   <body>. An explicit choice writes data-theme; "auto" removes it and lets
   prefers-color-scheme decide. */

/* The same key on both pages, deliberately: the two are one site under the
   server, and a theme chosen on one is the theme the other opens in. */
const THEME_KEY = "ui-theme";

/* Blocked site data makes localStorage throw on touch; the choice then lasts
   only as long as the page, and nothing after this line notices. */
function stored(op, mode) {
  try {
    return localStorage[op](THEME_KEY, mode);
  } catch {}
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "auto") root.removeAttribute("data-theme");
  else root.dataset.theme = mode;
  stored(mode === "auto" ? "removeItem" : "setItem", mode);
  for (const b of document.querySelectorAll("[data-theme-set]")) {
    b.setAttribute("aria-pressed", b.dataset.themeSet === mode);
  }
}

applyTheme(stored("getItem") || "auto");
// The buttons are not parsed yet: delegate their clicks, and press them once they exist.
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-theme-set]");
  if (b) applyTheme(b.dataset.themeSet);
});
document.addEventListener("DOMContentLoaded", () => applyTheme(document.documentElement.dataset.theme || "auto"));
