// Reusable animated scenes for the lesson walkthroughs. Each is drawn at time
// t, from 0 (the scene starts) to 1 (its finished frame), and takes its content
// as props, so a lesson's walkthrough is mostly data (see reels/index.js).
import React from "react";
import { range } from "../math";
import { Axes, Canvas } from "../kit";
import { bandPath, frame, linePath } from "../plot";

const W = 640;
const H = 300;
const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
const phase = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

/** A short note that fades in near the end of a scene. */
function Note({ t, text, y = 286, from = 0.75 }) {
  if (!text) return null;
  return (
    <text className="label" x={W / 2} y={y} textAnchor="middle" opacity={phase(t, from, from + 0.12)}>
      {text}
    </text>
  );
}

/** Steps of a method as boxes joined by arrows, lighting up one after another. */
export function Flow({ t, steps, tone = "a", note, wrap = 4 }) {
  const n = steps.length;
  const cols = Math.min(n, wrap);
  const rows = Math.ceil(n / cols);
  const bw = (W - 40 - (cols - 1) * 28) / cols;
  const bh = rows > 1 ? 76 : 108;
  const top = rows > 1 ? 36 : 76;
  return (
    <Canvas width={W} height={H}>
      {steps.map((s, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = 20 + c * (bw + 28);
        const y = top + r * (bh + 34);
        const on = phase(t, (i / n) * 0.8, (i / n) * 0.8 + 0.14);
        const [title, sub] = Array.isArray(s) ? s : [s];
        return (
          <g key={i} opacity={0.18 + 0.82 * on}>
            <rect x={x} y={y} width={bw} height={bh} rx="12" className={on > 0.5 ? `reel-box tone-${tone}` : "reel-box"} />
            <text className="reel-step-n" x={x + 12} y={y + 22}>
              {i + 1}
            </text>
            <foreignObject x={x + 8} y={y + 26} width={bw - 16} height={bh - 30}>
              <div className="reel-step">
                <strong>{title}</strong>
                {sub && <span>{sub}</span>}
              </div>
            </foreignObject>
            {c < cols - 1 && i < n - 1 && <path className="reel-arrow" d={`M${x + bw + 4},${y + bh / 2}h18m-6,-5l6,5l-6,5`} opacity={on} />}
          </g>
        );
      })}
      <Note t={t} text={note} />
    </Canvas>
  );
}

/**
 * Lines drawn left to right as the scene plays. `lines`: [{ f(x) or points,
 * cls, label }]; `band`: an optional shaded range { lo(x), hi(x) }; `marks`:
 * vertical markers { x, label } that appear at the end.
 */
export function Curves({ t, x, y, lines, band, marks = [], xLabel, yLabel, xTicks = [], yTicks = [], fmtX, fmtY, note, stagger = false }) {
  const X = frame(x, [56, W - 24]);
  const Y = frame(y, [H - 46, 20]);
  const xs = range(161).map((i) => x[0] + ((x[1] - x[0]) * i) / 160);
  return (
    <Canvas width={W} height={H}>
      <Axes x={X} y={Y} xTicks={xTicks} yTicks={yTicks} xLabel={xLabel} yLabel={yLabel} fmtX={fmtX} fmtY={fmtY} />
      {band && (
        <path
          className={band.cls ?? "area-b"}
          d={bandPath(
            xs.slice(0, Math.max(2, Math.round(ease(phase(t, 0, 0.75)) * xs.length))),
            xs.map(band.lo),
            xs.map(band.hi),
            X.f,
            Y.f
          )}
        />
      )}
      {lines.map((l, i) => {
        const start = stagger ? (i / lines.length) * 0.6 : 0;
        const k = ease(phase(t, start, start + (stagger ? 0.35 : 0.75)));
        const pts = l.points ?? xs.map((v) => [v, l.f(v)]);
        const shown = pts.slice(0, Math.max(2, Math.round(k * pts.length)));
        const end = shown[shown.length - 1];
        return (
          <g key={i}>
            <path className={`${l.cls ?? "line-a"} thick`} d={linePath(shown, X.f, Y.f)} />
            {l.label && k > 0.98 && (
              <text className={`note ${l.cls === "line-b" ? "note-b" : l.cls === "line-a" ? "note-a" : ""}`} x={X.f(end[0]) - 4} y={Y.f(end[1]) - 8 + (l.dy ?? 0)} textAnchor="end">
                {l.label}
              </text>
            )}
          </g>
        );
      })}
      {marks.map((m) => (
        <g key={m.label} opacity={phase(t, 0.7, 0.85)}>
          <line className="line-ink dashed thin" x1={X.f(m.x)} x2={X.f(m.x)} y1={Y.range[0]} y2={Y.range[1]} />
          <text className="label" x={X.f(m.x) + 6} y={Y.range[1] + 14}>
            {m.label}
          </text>
        </g>
      ))}
      <Note t={t} text={note} y={H - 6} from={0.8} />
    </Canvas>
  );
}

/** Bars that grow, with labels and values. `bars`: [{ label, value, cls, text }]. */
export function Bars({ t, bars, max, note, unit = "", sequential = true }) {
  const top = max ?? Math.max(...bars.map((b) => b.value)) * 1.1;
  const n = bars.length;
  const bw = Math.min(110, (W - 80) / n - 16);
  const gap = (W - 60 - n * bw) / Math.max(1, n - 1);
  const base = 236;
  return (
    <Canvas width={W} height={H}>
      <line className="axis" x1={20} x2={W - 20} y1={base} y2={base} />
      {bars.map((b, i) => {
        const k = ease(sequential ? phase(t, (i / n) * 0.7, (i / n) * 0.7 + 0.25) : phase(t, 0, 0.6));
        const h = (b.value / top) * 190 * k;
        const x = 30 + i * (bw + gap);
        return (
          <g key={i}>
            <rect className={b.cls ?? "bar-a"} x={x} y={base - h} width={bw} height={Math.max(0, h)} rx="5" />
            <text className="label" x={x + bw / 2} y={base - h - 8} textAnchor="middle" opacity={k}>
              {b.text ?? `${Math.round(b.value * k * 10) / 10}${unit}`}
            </text>
            <foreignObject x={x - 14} y={base + 4} width={bw + 28} height={44}>
              <div className="reel-bar-label">{b.label}</div>
            </foreignObject>
          </g>
        );
      })}
      <Note t={t} text={note} y={H - 6} from={0.82} />
    </Canvas>
  );
}

/** Lines of text revealed one at a time: a worked sum or a rule. */
export function Lines({ t, lines, note, big = false }) {
  const n = lines.length;
  return (
    <Canvas width={W} height={H}>
      {lines.map((l, i) => {
        const k = phase(t, (i / n) * 0.75, (i / n) * 0.75 + 0.12);
        const [text, cls] = Array.isArray(l) ? l : [l, ""];
        return (
          <text key={i} className={`reel-line ${big ? "is-big" : ""} ${cls}`} x={W / 2} y={(big ? 70 : 54) + i * (big ? 54 : 40)} textAnchor="middle" opacity={k} transform={`translate(0, ${(1 - k) * 8})`}>
            {text}
          </text>
        );
      })}
      <Note t={t} text={note} />
    </Canvas>
  );
}

/**
 * Points on a plane, with lines drawn one after another (splits, a boundary).
 * Coordinates are 0–1. `lines`: [{ x1, y1, x2, y2, label }]; `regions`: shaded
 * rectangles { x, y, w, h, cls } that fade in after the lines.
 */
export function Scatter({ t, points, lines = [], regions = [], note, xLabel, yLabel }) {
  const sx = (v) => 60 + v * (W - 100);
  const sy = (v) => H - 50 - v * (H - 80);
  const n = Math.max(1, lines.length);
  return (
    <Canvas width={W} height={H}>
      {regions.map((r, i) => (
        <rect key={i} className={r.cls ?? "region-b"} x={sx(r.x)} y={sy(r.y + r.h)} width={r.w * (W - 100)} height={r.h * (H - 80)} opacity={phase(t, 0.7, 0.85) * 0.3} />
      ))}
      {points.map((p, i) => (
        <circle key={i} className={p.c ? "dot-b" : "dot-a"} cx={sx(p.x)} cy={sy(p.y)} r="5" opacity={phase(t, 0, 0.1)} />
      ))}
      {lines.map((l, i) => {
        const k = ease(phase(t, 0.1 + (i / n) * 0.55, 0.1 + (i / n) * 0.55 + 0.15));
        return (
          <g key={i}>
            <line className="split" x1={sx(l.x1)} y1={sy(l.y1)} x2={sx(l.x1 + (l.x2 - l.x1) * k)} y2={sy(l.y1 + (l.y2 - l.y1) * k)} />
            {l.label && k > 0.9 && (
              <g transform={`translate(${sx(l.lx ?? l.x2) + 6},${sy(l.ly ?? l.y2) + 4})`}>
                <rect className="reel-tag" x={-4} y={-14} width={l.label.length * 6.6 + 10} height={20} rx="6" />
                <text className="label" x={1} y={0}>
                  {l.label}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {xLabel && (
        <text className="axis-label" x={W - 40} y={H - 30} textAnchor="end">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text className="axis-label" x={60} y={22}>
          {yLabel}
        </text>
      )}
      <Note t={t} text={note} y={H - 8} />
    </Canvas>
  );
}

/** A small binary tree of questions and answers, revealed level by level. */
export function Tree({ t, root, note }) {
  // root: { q, yes: node|leaf, no: node|leaf }; leaf: { leaf: "text", c: 0|1 }
  const nodes = [];
  const walk = (n, x, y, spread, depth, parent, edge) => {
    nodes.push({ n, x, y, depth, parent, edge });
    if (n.leaf) return;
    walk(n.yes, x - spread, y + 84, spread / 2, depth + 1, { x, y }, "yes");
    walk(n.no, x + spread, y + 84, spread / 2, depth + 1, { x, y }, "no");
  };
  walk(root, W / 2, 40, 150, 0, null, null);
  const depth = Math.max(...nodes.map((n) => n.depth)) + 1;
  return (
    <Canvas width={W} height={H}>
      {nodes.map((d, i) => {
        const k = phase(t, (d.depth / depth) * 0.75, (d.depth / depth) * 0.75 + 0.15);
        const label = d.n.leaf ?? d.n.q;
        const w = Math.max(90, label.length * 7.2 + 20);
        return (
          <g key={i} opacity={k}>
            {d.parent && (
              <>
                <line className="edge" x1={d.parent.x} y1={d.parent.y + 16} x2={d.x} y2={d.y - 16} />
                <text className="note" x={(d.parent.x + d.x) / 2 + (d.edge === "yes" ? -14 : 14)} y={(d.parent.y + d.y) / 2 + 4} textAnchor="middle">
                  {d.edge}
                </text>
              </>
            )}
            <rect className={d.n.leaf ? `reel-box tone-${d.n.c ? "b" : "a"}` : "reel-box"} x={d.x - w / 2} y={d.y - 16} width={w} height={32} rx="9" />
            <text className="label" x={d.x} y={d.y + 5} textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
      <Note t={t} text={note} />
    </Canvas>
  );
}

/** Rows of blocks: which are used for training and which for testing, fold by fold. */
export function Folds({ t, rows, cols, kind = "kfold", note }) {
  const cw = (W - 120) / cols;
  return (
    <Canvas width={W} height={H}>
      {range(rows).map((r) => {
        const k = phase(t, (r / rows) * 0.7, (r / rows) * 0.7 + 0.15);
        return (
          <g key={r} opacity={0.15 + 0.85 * k} transform={`translate(0,${30 + r * 44})`}>
            <text className="note" x={20} y={20}>
              {kind === "kfold" ? `fold ${r + 1}` : `cut-off ${r + 1}`}
            </text>
            {range(cols).map((c) => {
              let cls = "is-train";
              if (kind === "kfold") cls = c === r ? "is-test" : "is-train";
              else {
                const end = Math.floor(cols * 0.45) + r * 2;
                cls = c < end ? "is-train" : c < end + 2 ? "is-test" : "is-unused";
              }
              return <rect key={c} x={96 + c * cw} y={6} width={cw - 4} height={22} rx="4" className={`reel-cell ${cls}`} />;
            })}
          </g>
        );
      })}
      <g transform={`translate(96, ${30 + rows * 44 + 4})`}>
        <rect className="reel-cell is-train" width={14} height={12} rx="3" />
        <text className="note" x={20} y={11}>
          train
        </text>
        <rect className="reel-cell is-test" x={80} width={14} height={12} rx="3" />
        <text className="note" x={100} y={11}>
          test
        </text>
      </g>
      <Note t={t} text={note} />
    </Canvas>
  );
}

/** Pushes from a starting value to a result, bar by bar (a waterfall). */
export function Waterfall({ t, start, steps, unit = "%", note, max = 100 }) {
  const X = frame([0, max], [150, W - 40]);
  let at = start.value;
  const rows = [{ label: start.label, from: 0, to: start.value, base: true }];
  for (const s of steps) {
    rows.push({ label: s.label, from: at, to: at + s.value });
    at += s.value;
  }
  rows.push({ label: "Prediction", from: 0, to: at, base: true, total: true });
  return (
    <Canvas width={W} height={H}>
      {rows.map((r, i) => {
        const k = ease(phase(t, (i / rows.length) * 0.8, (i / rows.length) * 0.8 + 0.15));
        const lo = Math.min(r.from, r.to);
        const hi = Math.max(r.from, r.to);
        const up = r.to >= r.from;
        const cls = r.base ? (r.total ? "bar-a" : "bar-muted") : up ? "push-up" : "push-down";
        const y = 24 + i * 38;
        return (
          <g key={i} opacity={0.15 + 0.85 * k}>
            <text className="label" x={140} y={y + 16} textAnchor="end">
              {r.label}
            </text>
            <rect className={cls} x={X.f(lo)} y={y} width={Math.max(2, (X.f(hi) - X.f(lo)) * k)} height={24} rx="4" />
            <text className="note" x={X.f(hi) + 8} y={y + 16}>
              {r.base ? `${Math.round(r.to)}${unit}` : `${up ? "+" : "−"}${Math.abs(Math.round(r.to - r.from))} pts`}
            </text>
          </g>
        );
      })}
      <Note t={t} text={note} />
    </Canvas>
  );
}

/** Boxes on a picture: a prediction sliding onto the truth, with its IoU. */
export function Overlap({ t, note }) {
  const truth = { x: 250, y: 70, w: 180, h: 140 };
  const k = ease(phase(t, 0, 0.8));
  const pred = { x: 110 + (truth.x + 12 - 110) * k, y: 40 + (truth.y + 6 - 40) * k, w: 180, h: 140 };
  const ix = Math.max(pred.x, truth.x);
  const iy = Math.max(pred.y, truth.y);
  const iw = Math.max(0, Math.min(pred.x + pred.w, truth.x + truth.w) - ix);
  const ih = Math.max(0, Math.min(pred.y + pred.h, truth.y + truth.h) - iy);
  const inter = iw * ih;
  const iou = inter / (pred.w * pred.h * 2 - inter);
  return (
    <Canvas width={W} height={H}>
      <rect className="box-a" {...{ x: truth.x, y: truth.y, width: truth.w, height: truth.h }} />
      {iw > 0 && ih > 0 && <rect className="fill-overlap" x={ix} y={iy} width={iw} height={ih} />}
      <rect className="box-b" x={pred.x} y={pred.y} width={pred.w} height={pred.h} />
      <text className="note note-a" x={truth.x} y={truth.y + truth.h + 16}>
        truth
      </text>
      <text className="note note-b" x={pred.x} y={pred.y - 6}>
        prediction
      </text>
      <text className="reel-line is-big" x={540} y={140} textAnchor="middle">
        IoU {iou.toFixed(2)}
      </text>
      <text className="note" x={540} y={166} textAnchor="middle">
        {iou >= 0.5 ? "counts as found (≥ 0.5)" : "not yet a hit"}
      </text>
      <Note t={t} text={note} />
    </Canvas>
  );
}

/** A coloured pixel picture; `paint(x, y)` returns a class name or null. */
export function Pixels({ t, cols, rows, paint, note, reveal = "rows" }) {
  const c = Math.min((W - 80) / cols, (H - 60) / rows);
  const ox = (W - cols * c) / 2;
  return (
    <Canvas width={W} height={H}>
      {range(rows).map((y) =>
        range(cols).map((x) => {
          const order = reveal === "rows" ? y / rows : (x + y) / (cols + rows);
          const k = phase(t, order * 0.7, order * 0.7 + 0.1);
          const cls = paint(x, y, t);
          return <rect key={`${x}-${y}`} x={ox + x * c} y={20 + y * c} width={c - 1} height={c - 1} className={cls ?? "px-off"} opacity={cls ? 0.25 + 0.75 * k : 0.4} />;
        })
      )}
      <Note t={t} text={note} />
    </Canvas>
  );
}
