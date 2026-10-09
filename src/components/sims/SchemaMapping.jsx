// Database Schema Mapping: three matching stages map messy source columns
// onto a canonical model; a YAML config re-weights them without code.
import React, { useMemo, useState } from "react";
import { CANONICAL, DEFAULT_WEIGHTS, mapSchema } from "../../lib/sims";
import { Stat } from "./shared";
import { ease } from "./anim";
import { STAGES } from "./stages";

const STAGE_KEY = [null, "name", "type", "semantic"];

const stages = STAGES["schema-mapping"];

export default function SchemaMapping({ stage, t }) {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const { rows, accuracy } = useMemo(() => mapSchema(weights), [weights]);
  const left = 40;
  const right = 400;
  const rowY = (i) => 48 + i * 30;
  const canonY = (field) => rowY(CANONICAL.findIndex((c) => c.field === field));
  const key = STAGE_KEY[stage];
  const reveal = (i) => ease(t, 0.2 + i * 0.18, 0.35);
  return (
    <div className="sim-layout">
      <svg className="sim-svg" viewBox="0 0 640 360" role="img" aria-label={stages[stage].title}>
        <text x={left} y="26" className="s-mono">source</text>
        <text x={right} y="26" className="s-mono">canonical model</text>
        {rows.map((r, i) => {
          const showLine = stage >= 4 && r.match;
          const ty = r.match ? canonY(r.match) : rowY(i);
          const score = key ? r.stages[key] : 0;
          return (
            <g key={r.column}>
              <rect x={left} y={rowY(i) - 13} width="170" height="24" rx="6" className="s-panel" />
              <text x={left + 10} y={rowY(i) + 4} className="s-mono">
                {r.column}
              </text>
              {stage === 2 && (
                <text x={left + 162} y={rowY(i) + 4} textAnchor="end" className="s-mono-small">
                  {r.type}
                </text>
              )}
              {key && (
                <g opacity={reveal(i)}>
                  <rect x={left + 180} y={rowY(i) - 5} width="120" height="8" rx="4" className="s-track" />
                  <rect x={left + 180} y={rowY(i) - 5} width={120 * score} height="8" rx="4" className="s-fill" />
                </g>
              )}
              {showLine && (
                <path
                  d={`M${left + 170} ${rowY(i)} C${left + 260} ${rowY(i)} ${right - 90} ${ty} ${right} ${ty}`}
                  className={r.correct ? "s-map-ok" : "s-map-bad"}
                  opacity={stage === 4 ? reveal(i) : 1}
                />
              )}
              {stage >= 4 && !r.match && (
                <text x={left + 182} y={rowY(i) + 4} className="s-mono-small s-warn" opacity={stage === 4 ? reveal(i) : 1}>
                  ? needs review
                </text>
              )}
            </g>
          );
        })}
        {CANONICAL.map((c, i) => (
          <g key={c.field}>
            <rect x={right} y={rowY(i) - 13} width="190" height="24" rx="6" className="s-panel-strong" />
            <text x={right + 10} y={rowY(i) + 4} className="s-mono">
              {c.field}
            </text>
            {stage === 2 && (
              <text x={right + 182} y={rowY(i) + 4} textAnchor="end" className="s-mono-small">
                {c.type}
              </text>
            )}
          </g>
        ))}
      </svg>
      <aside className="sim-side">
        <Stat label="Mapped correctly" value={stage >= 4 ? `${Math.round(accuracy * 100)}%` : "—"} tone={stage >= 4 ? (accuracy > 0.7 ? "ok" : undefined) : undefined} />
        {stage >= 5 ? (
          <>
            <pre className="sim-yaml">
              {`matching:
  weights:
    name: ${weights.name.toFixed(2)}
    type: ${weights.type.toFixed(2)}
    semantic: ${weights.semantic.toFixed(2)}
  threshold: ${weights.threshold.toFixed(2)}`}
            </pre>
            {["name", "type", "semantic", "threshold"].map((k) => (
              <label className="sim-control" key={k}>
                <span>{k}</span>
                <input type="range" min="0" max="1" step="0.05" value={weights[k]} onChange={(e) => setWeights((w) => ({ ...w, [k]: +e.target.value }))} />
              </label>
            ))}
            <button className="link-btn" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
              Reset to defaults
            </button>
          </>
        ) : (
          <p className="sim-hint">
            {key ? `Bars show each column's ${key === "semantic" ? "meaning" : key} score against the field it's heading for.` : "Ten source columns, ten canonical fields."}
          </p>
        )}
      </aside>
    </div>
  );
}
