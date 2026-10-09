// Light / dark switch. Starts from the system setting; a choice is
// remembered and applied before first paint by the inline script in
// index.html (data-theme on <html>).
import React, { useEffect, useState } from "react";

const KEY = "theme";
const systemDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;
const current = () => document.documentElement.dataset.theme || (systemDark() ? "dark" : "light");

export default function ThemeToggle() {
  const [theme, setTheme] = useState(current);

  // With no saved choice, follow the system if it changes.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const follow = () => !document.documentElement.dataset.theme && setTheme(current());
    mq.addEventListener("change", follow);
    return () => mq.removeEventListener("change", follow);
  }, []);

  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    // Fade the page between themes for a moment, rather than snapping.
    root.classList.add("theme-fade");
    clearTimeout(flip.timer);
    flip.timer = setTimeout(() => root.classList.remove("theme-fade"), 400);
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode etc.: it just won't be remembered.
    }
    setTheme(next);
  };

  const dark = theme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  // A sliding switch: sun on the left, moon on the right, the knob glides over.
  return (
    <button className={`theme-toggle${dark ? " is-dark" : ""}`} role="switch" aria-checked={dark} onClick={flip} aria-label="Dark mode" title={label}>
      <span className="theme-toggle-icon sun" aria-hidden="true">
        ☀
      </span>
      <span className="theme-toggle-icon moon" aria-hidden="true">
        ☾
      </span>
      <span className="theme-toggle-knob" aria-hidden="true" />
    </button>
  );
}
