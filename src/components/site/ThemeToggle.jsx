// The light/dark switch in the header (the choice itself lives in useTheme).
import React from "react";
import Icon from "../Icon";
import { useTheme } from "./useTheme";
import { countEvent } from "../../lib/visits";

export default function ThemeToggle() {
  const [theme, flip] = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  // A sliding switch: sun on the left, moon on the right, the knob glides over.
  return (
    <button className={`theme-toggle${dark ? " is-dark" : ""}`} role="switch" aria-checked={dark} onClick={() => {
        countEvent("theme", dark ? "light" : "dark");
        flip();
      }}
      aria-label="Dark mode" title={label}>
      <span className="theme-toggle-icon sun" aria-hidden="true">
        <Icon name="sun" />
      </span>
      <span className="theme-toggle-icon moon" aria-hidden="true">
        <Icon name="moon" />
      </span>
      <span className="theme-toggle-knob" aria-hidden="true" />
    </button>
  );
}
