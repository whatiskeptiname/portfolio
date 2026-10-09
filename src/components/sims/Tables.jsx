// Table Detection & Document Analysis: build and label a receipt dataset,
// detect the table, recover its rows and columns, and read it out.
import React, { useState } from "react";
import { RECEIPT, tableCells } from "../../lib/sims";
import { DetBox, Stat } from "./shared";
import { clamp, ease } from "./anim";
import { STAGES } from "./stages";

const AUG = [
  { key: "rotate", label: "Rotate" },
  { key: "noise", label: "Noise" },
  { key: "blur", label: "Blur" },
  { key: "warp", label: "Perspective" },
];

// Speckle for the "noise" augmentation: fixed pseudo-random dots on the paper.
const NOISE = (() => {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 220 }, () => [62 + rnd() * 216, 32 + rnd() * 306]);
})();

function Receipt({ aug, children }) {
  const transform = [aug.rotate ? "rotate(-4 170 190)" : "", aug.warp ? "matrix(1 0.04 -0.06 1 12 -6)" : ""].join(" ");
  return (
    <g transform={transform} filter={aug.blur ? "url(#blur)" : undefined}>
      <rect x="60" y="30" width="220" height="310" rx="4" className="s-paper" />
      <text x="170" y="58" textAnchor="middle" className="s-receipt-title">
        KTM GROCERS
      </text>
      <text x="170" y="74" textAnchor="middle" className="s-receipt">
        Bill #2041 · 2025-03-18
      </text>
      {tableCells(72, 92, 196, 150).map((c) => (
        <text key={`${c.r}-${c.c}`} x={c.c ? c.x + c.w - 4 : c.x + 2} y={c.y + c.h / 2 + 4} textAnchor={c.c ? "end" : "start"} className={c.r ? "s-receipt" : "s-receipt-bold"}>
          {c.text}
        </text>
      ))}
      <text x="72" y="272" className="s-receipt-bold">
        TOTAL
      </text>
      <text x="268" y="272" textAnchor="end" className="s-receipt-bold">
        3,680
      </text>
      {aug.noise &&
        NOISE.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.9" className="s-noise" />)}
      {children}
    </g>
  );
}

const stages = STAGES.tables;

export default function Tables({ stage, t }) {
  const [aug, setAug] = useState({ rotate: false, noise: false, blur: false, warp: false });
  // In stage 1 the augmentations switch on one by one, unless you've set them.
  const [touched, setTouched] = useState(false);
  const shown = stage === 0 && !touched ? Object.fromEntries(AUG.map((a, i) => [a.key, t > 0.5 + i * 0.8])) : aug;
  const cells = tableCells(72, 92, 196, 150);
  const rows = RECEIPT.length;
  return (
    <div className="sim-layout">
      <svg className="sim-svg" viewBox="0 0 640 360" role="img" aria-label={stages[stage].title}>
        <defs>
          <filter id="blur">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
        </defs>
        <Receipt aug={stage === 0 ? shown : aug}>
          {stage === 1 && (
            <>
              <rect x="70" y="90" width={200 * ease(t, 0.3, 1.2)} height={154 * ease(t, 0.3, 1.2)} className="s-draw" />
              <path d={`M${70 + 200 * ease(t, 0.3, 1.2)} ${90 + 154 * ease(t, 0.3, 1.2)} l8 14 l3 -6 l7 1 z`} className="s-ink-fill" />
            </>
          )}
          {stage >= 2 && <DetBox x={70} y={90} w={200} h={154} label="table 0.97" opacity={stage === 2 ? ease(t, 0.3, 0.8) : 1} />}
          {stage >= 3 &&
            cells.map((c, i) => (
              <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} className="s-cell" opacity={stage === 3 ? ease(t, 0.3 + (c.r * 4 + c.c) * 0.08, 0.3) : 0.6} />
            ))}
        </Receipt>
        {stage === 4 && (
          <g>
            <path d="M300 180 L340 180" className="s-arrow" markerEnd="url(#tarrow)" />
            <defs>
              <marker id="tarrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L10 5 L0 10 Z" className="s-ink-fill" />
              </marker>
            </defs>
            {RECEIPT.map((row, r) =>
              row.map((text, c) => {
                const x = 352 + [0, 110, 150, 200][c];
                const y = 100 + r * 28;
                return (
                  <g key={`${r}-${c}`} opacity={ease(t, 0.2 + r * 0.4, 0.4)}>
                    <rect x={x} y={y - 18} width={[108, 38, 48, 66][c]} height="26" className={r ? "s-grid-cell" : "s-grid-head"} />
                    <text x={x + 6} y={y} className="s-mono">
                      {text}
                    </text>
                  </g>
                );
              })
            )}
          </g>
        )}
      </svg>
      <aside className="sim-side">
        {stage === 0 && (
          <fieldset className="sim-toggles">
            <legend>Augmentations</legend>
            {AUG.map((a) => (
              <label key={a.key}>
                <input
                  type="checkbox"
                  checked={!!shown[a.key]}
                  onChange={(e) => {
                    setTouched(true);
                    setAug({ ...shown, [a.key]: e.target.checked });
                  }}
                />
                {a.label}
              </label>
            ))}
          </fieldset>
        )}
        {stage >= 1 && <Stat label="Tool" value={stage === 1 ? "Label Studio · CVAT" : stage === 2 ? "Cascade TabNet" : "TabStructNet"} />}
        {stage >= 3 && <Stat label="Rows × columns" value={`${rows} × ${RECEIPT[0].length}`} tone="ok" />}
        {stage === 4 && <Stat label="Cells read" value={`${Math.round(clamp((t - 0.2) / (rows * 0.4)) * rows * 4)} / ${rows * 4}`} />}
        <p className="sim-hint">{stage === 0 ? "Toggle augmentations to see what the model trains on." : "Augmentations you chose stay on, so you can test it on a messy scan."}</p>
      </aside>
    </div>
  );
}
