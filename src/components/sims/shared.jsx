// Small pieces shared by the case-study simulations.
import React from "react";

/** A detection box with its class-label tab, the way a model draws one. */
export function DetBox({ x, y, w, h, label, tone = "accent", opacity = 1 }) {
  const tab = Math.max(36, label.length * 6.4 + 12);
  return (
    <g className={`det det-${tone}`} opacity={opacity}>
      <rect x={x} y={y} width={w} height={h} rx="3" className="det-frame" />
      <rect x={x} y={y - 15} width={tab} height="15" rx="3" className="det-tab" />
      <text x={x + 6} y={y - 4} className="det-text">
        {label}
      </text>
    </g>
  );
}

/** A labelled readout for the panel beside a simulation. */
export function Stat({ label, value, tone }) {
  return (
    <div className={`sim-stat${tone ? ` tone-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
