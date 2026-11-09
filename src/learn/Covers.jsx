// A small moving picture for each chapter: the chapter's main idea, playing on
// a loop. Still for anyone who prefers reduced motion; paused off screen.
import React, { useMemo } from "react";
import { betaPdf, normal, range, rng } from "./math";
import { useClock } from "./plot";
import "./learn.css";

const W = 320;
const H = 200;

function TreesCover({ t }) {
  const pts = useMemo(() => {
    const rand = rng(4);
    return range(46).map(() => {
      const x = rand();
      const y = rand();
      return { x, y, c: (x < 0.45 && y > 0.35) || (x > 0.7 && y < 0.5) ? 1 : 0 };
    });
  }, []);
  // The splits a tree would make, drawn one after another.
  const splits = [
    { x1: 0.45, y1: 0, x2: 0.45, y2: 1 },
    { x1: 0, y1: 0.35, x2: 0.45, y2: 0.35 },
    { x1: 0.7, y1: 0, x2: 0.7, y2: 1 },
    { x1: 0.7, y1: 0.5, x2: 1, y2: 0.5 },
  ];
  const phase = t % 7;
  const sx = (v) => 20 + v * (W - 40);
  const sy = (v) => H - 20 - v * (H - 40);
  const regions = [
    { x: 0, y: 0.35, w: 0.45, h: 0.65, at: 2 },
    { x: 0.7, y: 0, w: 0.3, h: 0.5, at: 4 },
  ];
  return (
    <>
      {regions.map((r, i) => (
        <rect key={i} className="region-b" x={sx(r.x)} y={sy(r.y + r.h)} width={r.w * (W - 40)} height={r.h * (H - 40)} opacity={Math.max(0, Math.min(1, phase - r.at)) * 0.3} />
      ))}
      {splits.map((s, i) => {
        const k = Math.max(0, Math.min(1, phase - i - 0.6));
        return <line key={i} className="split" x1={sx(s.x1)} y1={sy(s.y1)} x2={sx(s.x1 + (s.x2 - s.x1) * k)} y2={sy(s.y1 + (s.y2 - s.y1) * k)} />;
      })}
      {pts.map((p, i) => (
        <circle key={i} className={p.c ? "dot-b" : "dot-a"} cx={sx(p.x)} cy={sy(p.y)} r="4" />
      ))}
    </>
  );
}

function BayesCover({ t }) {
  const flips = useMemo(() => {
    const rand = rng(9);
    return range(60).map(() => rand() < 0.7);
  }, []);
  const n = Math.min(60, Math.floor((t % 9) * 9));
  const k = flips.slice(0, n).filter(Boolean).length;
  const a = 2 + k;
  const b = 2 + n - k;
  const xs = range(121).map((i) => i / 120);
  const ys = xs.map((x) => betaPdf(x, a, b));
  const top = Math.max(8, ...ys);
  const sx = (v) => 20 + v * (W - 40);
  const sy = (v) => H - 28 - (v / top) * (H - 60);
  const d = xs.map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join("");
  return (
    <>
      <path className="area-a" d={`${d}L${sx(1)},${sy(0)}L${sx(0)},${sy(0)}Z`} />
      <path className="line-a thick" d={d} />
      <line className="axis" x1={20} x2={W - 20} y1={sy(0)} y2={sy(0)} />
      {flips.slice(0, n).map((f, i) => (
        <circle key={i} className={f ? "dot-a" : "dot-b"} cx={23 + i * 4.75} cy={H - 12} r="2.2" />
      ))}
    </>
  );
}

function TimeCover({ t }) {
  const series = useMemo(() => {
    const rand = rng(3);
    return range(72).map((i) => 0.35 + i * 0.004 + 0.13 * Math.sin((i / 12) * 2 * Math.PI) + normal(rand) * 0.02);
  }, []);
  const shown = Math.min(series.length, Math.floor((t % 8) * 14));
  const sx = (i) => 16 + (i / 95) * (W - 32);
  const sy = (v) => H - 16 - v * (H - 32);
  const d = series.slice(0, shown).map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join("");
  const last = series.length - 1;
  const fan = Math.max(0, Math.min(1, (t % 8) * 14 / series.length - 1) * 3);
  const ahead = range(25).map((h) => {
    const i = last + h;
    const mid = 0.35 + i * 0.004 + 0.13 * Math.sin((i / 12) * 2 * Math.PI);
    return { i, mid, w: 0.015 + h * 0.006 };
  });
  const upto = Math.floor(fan * 24);
  const band = ahead.slice(0, upto + 1);
  return (
    <>
      {band.length > 1 && (
        <path
          className="area-b"
          d={`${band.map((p, k) => `${k ? "L" : "M"}${sx(p.i)},${sy(p.mid + p.w)}`).join("")}${[...band].reverse().map((p) => `L${sx(p.i)},${sy(p.mid - p.w)}`).join("")}Z`}
        />
      )}
      {band.length > 1 && <path className="line-b dashed" d={band.map((p, k) => `${k ? "L" : "M"}${sx(p.i)},${sy(p.mid)}`).join("")} />}
      <path className="line-a thick" d={d} />
    </>
  );
}

function VisionCover({ t }) {
  const N = 10;
  const img = useMemo(() => range(N).map((y) => range(N).map((x) => ((x - 4.5) ** 2 + (y - 4.5) ** 2 < 11 ? 1 : 0))), []);
  const steps = (N - 2) * (N - 2);
  const s = Math.floor((t * 9) % (steps + 12));
  const cell = 15;
  const ox = 20;
  const oy = 25;
  const ox2 = 180;
  const edge = (x, y) => {
    let gx = 0;
    let gy = 0;
    const k = [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1],
    ];
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        gx += img[y + j][x + i] * k[j + 1][i + 1];
        gy += img[y + j][x + i] * k[i + 1][j + 1];
      }
    return Math.min(1, Math.hypot(gx, gy) / 3);
  };
  const cur = Math.min(s, steps - 1);
  const cx = 1 + (cur % (N - 2));
  const cy = 1 + Math.floor(cur / (N - 2));
  return (
    <>
      {img.map((row, y) =>
        row.map((v, x) => <rect key={`${x}-${y}`} className={v ? "px-on" : "px-off"} x={ox + x * cell} y={oy + y * cell} width={cell - 1} height={cell - 1} />)
      )}
      {range(N - 2).map((y) =>
        range(N - 2).map((x) => {
          const idx = y * (N - 2) + x;
          return idx <= s ? <rect key={`o${x}-${y}`} className="px-out" x={ox2 + (x + 1) * cell} y={oy + (y + 1) * cell} width={cell - 1} height={cell - 1} opacity={0.12 + edge(x + 1, y + 1) * 0.88} /> : null;
        })
      )}
      {s < steps && (
        <>
          <rect className="kernel" x={ox + (cx - 1) * cell - 1} y={oy + (cy - 1) * cell - 1} width={cell * 3 + 1} height={cell * 3 + 1} />
          <line className="kernel-link" x1={ox + (cx + 2) * cell} y1={oy + cy * cell + cell / 2} x2={ox2 + cx * cell} y2={oy + cy * cell + cell / 2} />
        </>
      )}
    </>
  );
}

// A line settling into the points by gradient descent: each frame is one step.
function FoundationsCover({ t }) {
  const pts = useMemo(() => {
    const rand = rng(21);
    return range(26).map(() => {
      const x = rand();
      return { x, y: 0.15 + 0.7 * x + normal(rand) * 0.07 };
    });
  }, []);
  const sx = (v) => 24 + v * (W - 48);
  const sy = (v) => H - 20 - v * (H - 40);
  // Gradient descent from a flat line, one step per tenth of a second, looping.
  const steps = Math.floor((t % 7) * 10);
  let a = 0.9;
  let b = -0.6;
  for (let i = 0; i < steps; i++) {
    let ga = 0;
    let gb = 0;
    for (const p of pts) {
      const e = a + b * p.x - p.y;
      ga += e;
      gb += e * p.x;
    }
    a -= (0.9 * ga) / pts.length;
    b -= (0.9 * gb) / pts.length;
  }
  return (
    <>
      {pts.map((p, i) => (
        <g key={i}>
          <line className="line-bad thin" x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y)} y2={sy(Math.max(0, Math.min(1, a + b * p.x)))} opacity="0.6" />
          <circle className="dot-b" cx={sx(p.x)} cy={sy(p.y)} r="4" />
        </g>
      ))}
      <line className="line-a thick" x1={sx(0)} y1={sy(a)} x2={sx(1)} y2={sy(a + b)} />
    </>
  );
}

// The next word, picked one at a time: bars of probability, the top one highlighted.
const PHRASE = ["The", "capital", "of", "Nepal", "is", "Kathmandu"];
function LanguageCover({ t }) {
  const n = Math.floor(t % 7) % PHRASE.length;
  const rand = rng(n + 5);
  const bars = range(6).map((i) => (i === 0 ? 0.55 : 0.35 * rand() * (1 - i / 7)));
  const bw = (W - 60) / 6;
  return (
    <>
      <text className="label" x={W / 2} y={26} textAnchor="middle" style={{ fontSize: 15 }}>
        {PHRASE.slice(0, n + 1).join(" ")}▍
      </text>
      {bars.map((v, i) => (
        <rect key={i} className={i === 0 ? "bar-a" : "bar-muted"} x={30 + i * bw + 4} y={H - 20 - v * 220} width={bw - 8} height={v * 220} rx="4" />
      ))}
    </>
  );
}

// Live data drifting away from the training data, and the alarm going off.
function WildCover({ t }) {
  const shift = 4 * (0.5 - 0.5 * Math.cos(((t % 8) / 8) * Math.PI * 2));
  const xs = range(14).map((i) => i);
  const bump = (x, mu) => Math.exp(-((x - mu) ** 2) / 6);
  const bw = (W - 40) / 14;
  return (
    <>
      {xs.map((x) => (
        <g key={x}>
          <rect className="bar-muted" x={20 + x * bw + 2} y={H - 20 - bump(x, 5) * 140} width={bw / 2 - 2} height={bump(x, 5) * 140} />
          <rect className={shift > 2.5 ? "bar-bad" : "bar-a"} x={20 + x * bw + bw / 2} y={H - 20 - bump(x, 5 + shift) * 140} width={bw / 2 - 2} height={bump(x, 5 + shift) * 140} />
        </g>
      ))}
    </>
  );
}

// A small network: signals flow forward along the edges, then the blame flows back.
function NeuralCover({ t }) {
  const layers = [3, 5, 5, 2];
  const pos = layers.map((n, l) => range(n).map((i) => [40 + l * ((W - 80) / 3), H / 2 + (i - (n - 1) / 2) * 34]));
  const p = (t % 6) / 6; // 0–0.5 forward, 0.5–1 backward
  const front = p < 0.5 ? p * 2 * 3 : 3 - (p - 0.5) * 2 * 3; // which layer gap is lit
  const back = p >= 0.5;
  return (
    <>
      {pos.slice(0, -1).map((col, l) =>
        col.map(([x1, y1], i) =>
          pos[l + 1].map(([x2, y2], j) => {
            const lit = Math.max(0, 1 - Math.abs(front - (l + 0.5)) * 1.6);
            return <line key={`${l}-${i}-${j}`} className={back ? "line-b" : "line-a"} x1={x1} y1={y1} x2={x2} y2={y2} opacity={0.12 + lit * 0.7} strokeWidth="1.5" />;
          })
        )
      )}
      {pos.flat().map(([x, y], k) => (
        <circle key={k} className="dot-a" cx={x} cy={y} r="7" />
      ))}
    </>
  );
}

const COVERS = { foundations: FoundationsCover, neural: NeuralCover, trees: TreesCover, bayes: BayesCover, time: TimeCover, vision: VisionCover, language: LanguageCover, wild: WildCover };

// What each cover is showing: the method, and the step it's on (by its clock).
const CAPTIONS = {
  neural: (t) => {
    const p = (t % 6) / 6;
    return { method: "Backpropagation", step: p < 0.5 ? "1 · Signals flow forward, layer by layer" : p < 0.8 ? "2 · The error flows back as blame" : "3 · Every weight takes a small step" };
  },
  foundations: (t) => {
    const n = Math.floor((t % 7) * 10);
    return { method: "Gradient descent", step: n < 8 ? "1 · Start with a guess" : n < 30 ? "2 · Step downhill to shrink the errors" : "3 · Settle on the best line" };
  },
  language: (t) => {
    const n = Math.floor(t % 7) % 6;
    return { method: "Next-token prediction", step: n < 2 ? "1 · Score every possible next word" : n < 4 ? "2 · Pick one and add it" : "3 · Repeat, one token at a time" };
  },
  wild: (t) => {
    const shift = 4 * (0.5 - 0.5 * Math.cos(((t % 8) / 8) * Math.PI * 2));
    return { method: "Drift monitoring", step: shift < 1 ? "1 · Live data matches training" : shift < 2.5 ? "2 · The world starts to move" : "3 · Drift: time to retrain" };
  },
  trees: (t) => {
    const p = t % 7;
    return {
      method: "Decision tree",
      step: p < 1.6 ? "1 · Ask the best first question" : p < 3.6 ? "2 · Ask again inside each side" : p < 5 ? "3 · Each region takes its majority" : "A few simple questions, readable rules",
    };
  },
  bayes: (t) => {
    const n = Math.min(60, Math.floor((t % 9) * 9));
    return { method: "Bayesian updating", step: n < 10 ? "1 · Start unsure: a wide belief" : n < 40 ? "2 · Each result nudges the belief" : "3 · More data: narrower, surer" };
  },
  time: (t) => {
    const shown = (t % 8) * 14;
    return { method: "Forecasting", step: shown < 36 ? "1 · Learn the trend and the season" : shown < 72 ? "2 · …from the past only" : "3 · Project ahead; the range widens" };
  },
  vision: (t) => {
    const s = (t * 9) % (64 + 12);
    return { method: "Convolution", step: s < 22 ? "1 · Slide a 3×3 filter over the image" : s < 50 ? "2 · Multiply and add at every spot" : "3 · The output lights up the edges" };
  },
};

export default function Cover({ kind, running = true }) {
  const [t, ref] = useClock(running);
  const Picture = COVERS[kind];
  const caption = CAPTIONS[kind]?.(t + 4.5);
  return (
    <div className="cover" ref={ref} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="sim-svg">
        {Picture && <Picture t={t + 4.5} />}
      </svg>
      {caption && (
        <p className="cover-caption">
          <strong>{caption.method}</strong>
          <span key={caption.step}>{caption.step}</span>
        </p>
      )}
    </div>
  );
}
