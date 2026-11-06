// The site's light/dark choice. It starts from the system setting; a choice is
// remembered and applied before first paint by the inline script in index.html
// (data-theme on <html>).
import { useEffect, useState } from "react";

const KEY = "theme";
const COLORS = { light: "#f4f4f1", dark: "#0a0a0b" }; // the browser's own bar matches the page

const systemDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;
const current = () => document.documentElement.dataset.theme || (systemDark() ? "dark" : "light");

let fadeTimer = 0;

export function useTheme() {
  const [theme, setTheme] = useState(current);

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLORS[theme]);
  }, [theme]);

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
    // Fade between themes for a moment, rather than snapping.
    root.classList.add("theme-fade");
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => root.classList.remove("theme-fade"), 400);
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode etc.: it just won't be remembered.
    }
    setTheme(next);
  };

  return [theme, flip];
}
