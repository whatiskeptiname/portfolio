// Demand Forecasting: a price change rippling through units and revenue,
// the business numbers on top, and plain-language questions about it.
import React, { useMemo, useState } from "react";
import { BASE_PRICE, explainForecast, forecast } from "../../lib/sims";
import { Stat } from "./shared";
import { clamp, ease, lerp } from "./anim";
import { STAGES } from "./stages";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const QUESTIONS = [
  { key: "worth", text: "Is this price change worth it?" },
  { key: "peak", text: "Which month peaks?" },
  { key: "ytd", text: "Where do we end the year?" },
];
const money = (v) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(0)}k`);

const stages = STAGES.forecasting;

export default function Forecasting({ stage, t }) {
  const [manual, setManual] = useState(null);
  const [month, setMonth] = useState(10);
  const [question, setQuestion] = useState("worth");
  // Stage 2 eases the price down 10% unless you move the slider yourself.
  const auto = stage === 0 ? 0 : stage === 1 ? lerp(0, -0.1, ease(t, 0.5, 2.5)) : -0.1;
  const change = manual ?? auto;
  const rows = useMemo(() => forecast(change), [change]);
  const max = Math.max(...rows.map((r) => Math.max(r.revenue, r.baseRevenue))) * 1.1;
  const x = (m) => 70 + m * 46;
  const y = (v) => 300 - (v / max) * 240;
  const line = (key) => rows.map((r, m) => `${m ? "L" : "M"}${x(m)} ${y(r[key])}`).join(" ");
  const sel = rows[month];
  const answer = explainForecast(Math.round(change * 100) / 100, question);
  const typed = stage === 3 ? answer.slice(0, Math.floor(clamp((t - 0.4) / 3) * answer.length)) : answer;
  return (
    <div className="sim-layout">
      <svg className="sim-svg" viewBox="0 0 640 360" role="img" aria-label={stages[stage].title}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1="60" x2="600" y1={300 - f * 240} y2={300 - f * 240} className="s-grid" />
            <text x="54" y={304 - f * 240} textAnchor="end" className="s-mono-small">
              {money(max * f)}
            </text>
          </g>
        ))}
        {rows.map((r, m) => (
          <g key={m} onClick={() => setMonth(m)} className="s-click">
            <rect x={x(m) - 15} y={y(r.revenue)} width="30" height={300 - y(r.revenue)} rx="4" className={m === month && stage >= 2 ? "s-bar-sel" : "s-bar"} />
            <text x={x(m)} y="320" textAnchor="middle" className="s-mono-small">
              {MONTHS[m]}
            </text>
          </g>
        ))}
        <path d={line("baseRevenue")} className="s-line-base" />
        {change !== 0 && <path d={line("revenue")} className="s-line" />}
        {stage >= 2 && sel.mom != null && (
          <text x={x(month)} y={Math.max(56, y(Math.max(sel.revenue, sel.baseRevenue)) - 24)} textAnchor="middle" className="s-label">
            {sel.mom >= 0 ? "+" : ""}
            {(sel.mom * 100).toFixed(1)}% MoM
          </text>
        )}
        <text x="70" y="36" className="s-mono">
          price ${(BASE_PRICE * (1 + change)).toFixed(2)} ({change >= 0 ? "+" : ""}
          {(change * 100).toFixed(0)}%) · dashed = baseline
        </text>
      </svg>
      <aside className="sim-side">
        <label className="sim-control">
          <span>Price change: {(change * 100).toFixed(0)}%</span>
          <input type="range" min="-20" max="20" value={Math.round(change * 100)} onChange={(e) => setManual(+e.target.value / 100)} />
        </label>
        {stage < 3 ? (
          <>
            <Stat label="Units, first month" value={`${((rows[0].units / rows[0].baseUnits - 1) * 100).toFixed(1)}%`} />
            {stage >= 2 && (
              <>
                <Stat label={`Year-to-date by ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month]}`} value={money(sel.ytd)} />
                <Stat label="vs baseline" value={`${sel.ytd - sel.baseYtd >= 0 ? "+" : ""}${money(sel.ytd - sel.baseYtd)}`} tone={sel.ytd >= sel.baseYtd ? "ok" : "bad"} />
                <p className="sim-hint">Click a month to inspect it.</p>
              </>
            )}
          </>
        ) : (
          <div className="sim-chat">
            {QUESTIONS.map((q) => (
              <button key={q.key} className={`chip${q.key === question ? " is-on" : ""}`} aria-pressed={q.key === question} onClick={() => setQuestion(q.key)}>
                {q.text}
              </button>
            ))}
            <p className="sim-answer">{typed || "…"}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
