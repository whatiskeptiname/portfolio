// Walkthrough scenes that need real maths behind them: boosting fits, Gaussian
// processes, sampling, diffusion, attention and so on. Each is drawn at t (0–1).
import React, { useMemo } from "react";
import { betaPdf, boost, convolve, gp, metropolis, normal, normalPdf, range, rbf, rng } from "../math";
import { Axes, Canvas } from "../kit";
import { bandPath, frame, linePath } from "../plot";

const W = 640;
const H = 300;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => 1 - (1 - clamp01(x)) ** 3;
const phase = (t, a, b) => clamp01((t - a) / (b - a));

function Note({ t, text, y = H - 6, from = 0.8 }) {
  if (!text) return null;
  return (
    <text className="label" x={W / 2} y={y} textAnchor="middle" opacity={phase(t, from, from + 0.12)}>
      {text}
    </text>
  );
}

// --- Boosting: small trees fixing what's left, round by round. --------------

export function BoostFit({ t, rate = 0.3, maxRounds = 60, note }) {
  const data = useMemo(() => {
    const rand = rng(8);
    const xs = range(50).map(() => rand());
    const ys = xs.map((x) => Math.sin(5 * x) + 0.6 * x + normal(rand) * 0.18);
    return { xs, ys };
  }, []);
  const rounds = Math.max(0, Math.round(ease(phase(t, 0, 0.85)) * maxRounds));
  const model = useMemo(() => boost(data.xs, data.ys, rounds, rate), [data, rounds, rate]);
  const X = frame([0, 1], [40, W - 20]);
  const Y = frame([-1.3, 2], [H - 40, 20]);
  const grid = range(161).map((i) => i / 160);
  return (
    <Canvas width={W} height={H}>
      <Axes x={X} y={Y} yTicks={[-1, 0, 1, 2]} />
      {data.xs.map((x, i) => (
        <line key={`r${i}`} className="residual" x1={X.f(x)} x2={X.f(x)} y1={Y.f(data.ys[i])} y2={Y.f(model.predict(x))} />
      ))}
      {data.xs.map((x, i) => (
        <circle key={i} className="dot-a" cx={X.f(x)} cy={Y.f(data.ys[i])} r="4" />
      ))}
      <path className="line-b thick" d={linePath(grid.map((x) => [x, model.predict(x)]), X.f, Y.f)} />
      <text className="label" x={W - 24} y={30} textAnchor="end">
        {rounds} {rounds === 1 ? "tree" : "trees"}
      </text>
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- Beta curves: beliefs about a rate. -------------------------------------

/** One or more Beta curves; with `grow`, each appears in turn. */
export function Beliefs({ t, curves, note, grow = true, xLabel = "the rate" }) {
  const X = frame([0, 1], [40, W - 20]);
  const xs = range(201).map((i) => i / 200);
  const all = curves.map((c) => xs.map((x) => [x, betaPdf(x, c.a, c.b)]));
  const top = Math.max(...all.flat().map((p) => p[1]));
  const Y = frame([0, top * 1.1], [H - 46, 20]);
  return (
    <Canvas width={W} height={H}>
      <Axes x={X} y={Y} xTicks={[0, 0.25, 0.5, 0.75, 1]} fmtX={(v) => `${Math.round(v * 100)}%`} xLabel={xLabel} />
      {curves.map((c, i) => {
        const k = grow ? phase(t, (i / curves.length) * 0.75, (i / curves.length) * 0.75 + 0.18) : phase(t, 0, 0.4);
        const pts = all[i];
        const peak = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
        return (
          <g key={i} opacity={k}>
            {c.fill && <path className={c.cls === "line-b" ? "area-b" : "area-a"} d={`${linePath(pts, X.f, Y.f)}L${X.f(1)},${Y.f(0)}L${X.f(0)},${Y.f(0)}Z`} />}
            <path className={`${c.cls ?? "line-a"} thick ${c.dashed ? "dashed" : ""}`} d={linePath(pts, X.f, Y.f)} />
            {c.label && (
              <text className="note" x={X.f(peak[0])} y={Y.f(peak[1]) - 8} textAnchor="middle">
                {c.label}
              </text>
            )}
          </g>
        );
      })}
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- Two people updating on the same evidence. ------------------------------

export function Converge({ t, note }) {
  const flips = useMemo(() => {
    const rand = rng(5);
    return range(300).map(() => rand() < 0.4);
  }, []);
  const n = Math.round(ease(phase(t, 0, 0.85)) * 300);
  const k = flips.slice(0, n).filter(Boolean).length;
  const people = [
    { a: 2 + k, b: 18 + n - k, cls: "line-a", label: "sceptic" },
    { a: 12 + k, b: 4 + n - k, cls: "line-b", label: "optimist" },
  ];
  const X = frame([0, 1], [40, W - 20]);
  const xs = range(201).map((i) => i / 200);
  const top = Math.max(6, ...people.flatMap((p) => xs.map((x) => betaPdf(x, p.a, p.b))));
  const Y = frame([0, top * 1.1], [H - 46, 30]);
  return (
    <Canvas width={W} height={H}>
      <Axes x={X} y={Y} xTicks={[0, 0.25, 0.5, 0.75, 1]} fmtX={(v) => `${Math.round(v * 100)}%`} xLabel="how often it works" />
      {people.map((p) => (
        <path key={p.label} className={`${p.cls} thick`} d={linePath(xs.map((x) => [x, betaPdf(x, p.a, p.b)]), X.f, Y.f)} />
      ))}
      <text className="label" x={40} y={22}>
        Evidence: {k} worked, {n - k} didn't
      </text>
      <text className="note note-a" x={W - 20} y={22} textAnchor="end">
        sceptic {Math.round((people[0].a / (people[0].a + people[0].b)) * 100)}% · optimist {Math.round((people[1].a / (people[1].a + people[1].b)) * 100)}%
      </text>
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- Correlated pairs, and what knowing one says about the other. -----------

export function Correlated({ t, rho = 0.6, note }) {
  const pts = useMemo(() => {
    const rand = rng(3);
    return range(160).map(() => {
      const a = normal(rand);
      const b = normal(rand);
      return [a, rho * a + Math.sqrt(1 - rho * rho) * b];
    });
  }, [rho]);
  const X = frame([-3, 3], [60, 380]);
  const Y = frame([-3, 3], [H - 30, 20]);
  const x0 = 1.5;
  const k = phase(t, 0.35, 0.6);
  const ys = range(121).map((i) => -3 + i * 0.05);
  const D = frame([0, 0.5], [420, 620]);
  const condSd = Math.sqrt(1 - rho * rho);
  return (
    <Canvas width={W} height={H}>
      {pts.map(([a, b], i) => (
        <circle key={i} className="dot-a" cx={X.f(a)} cy={Y.f(b)} r="3" opacity={0.5 * phase(t, 0, 0.2)} />
      ))}
      <line className="split" x1={X.f(x0)} x2={X.f(x0)} y1={Y.range[0]} y2={Y.range[1]} opacity={k} />
      <path className="line-muted" d={linePath(ys.map((y) => [normalPdf(y), y]), D.f, Y.f)} />
      <path className="line-b thick" opacity={k} d={linePath(ys.map((y) => [normalPdf(y, rho * x0, condSd), y]), D.f, Y.f)} />
      <text className="note" x={420} y={16}>
        grey: knowing nothing · orange: knowing x
      </text>
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- Rain, sprinkler, wet grass. --------------------------------------------

export function Network({ t, note }) {
  const nodes = [
    { id: "rain", label: "It rained", x: 160, y: 60 },
    { id: "spr", label: "Sprinkler on", x: 480, y: 60 },
    { id: "wet", label: "Grass is wet", x: 320, y: 200 },
  ];
  const at = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = [
    ["rain", "spr"],
    ["rain", "wet"],
    ["spr", "wet"],
  ];
  return (
    <Canvas width={W} height={H}>
      {edges.map(([a, b], i) => {
        const k = ease(phase(t, 0.2 + i * 0.18, 0.35 + i * 0.18));
        const A = at[a];
        const B = at[b];
        return <line key={i} className="edge" x1={A.x} y1={A.y + 22} x2={A.x + (B.x - A.x) * k} y2={A.y + 22 + (B.y - 22 - A.y - 22) * k} />;
      })}
      {nodes.map((n, i) => (
        <g key={n.id} opacity={phase(t, i * 0.08, i * 0.08 + 0.15)}>
          <rect className="reel-box tone-a" x={n.x - 75} y={n.y - 22} width={150} height={44} rx="12" />
          <text className="label" x={n.x} y={n.y + 5} textAnchor="middle">
            {n.label}
          </text>
        </g>
      ))}
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- Gaussian process: points arriving, band pinching. ----------------------

const GP_POINTS = [
  { x: 0.12, y: 0.5 },
  { x: 0.3, y: -0.4 },
  { x: 0.52, y: 0.3 },
  { x: 0.78, y: 0.9 },
];

export function GPScene({ t, length = 0.12, note, show = "points" }) {
  const n = show === "points" ? Math.round(ease(phase(t, 0, 0.8)) * GP_POINTS.length) : GP_POINTS.length;
  const xs = range(121).map((i) => i / 120);
  const L = show === "points" ? length : 0.04 + ease(phase(t, 0, 0.8)) * 0.3;
  const post = gp(GP_POINTS.slice(0, n), xs, (a, b) => rbf(a, b, L), 0.05);
  const sd = post.cov.map((row, i) => Math.sqrt(Math.max(0, row[i])));
  const X = frame([0, 1], [40, W - 20]);
  const Y = frame([-2.6, 2.6], [H - 30, 20]);
  return (
    <Canvas width={W} height={H}>
      <Axes x={X} y={Y} yTicks={[-2, 0, 2]} />
      <path className="area-a" d={bandPath(xs, post.mean.map((m, i) => m - 2 * sd[i]), post.mean.map((m, i) => m + 2 * sd[i]), X.f, Y.f)} />
      <path className="line-a thick" d={linePath(xs.map((x, i) => [x, post.mean[i]]), X.f, Y.f)} />
      {GP_POINTS.slice(0, n).map((p, i) => (
        <circle key={i} className="dot-ink" cx={X.f(p.x)} cy={Y.f(p.y)} r="5" />
      ))}
      {show === "length" && (
        <text className="label" x={W - 24} y={30} textAnchor="end">
          reach: {L.toFixed(2)}
        </text>
      )}
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- MCMC: a walker's footprints building up the shape. --------------------

const hills = (x) => 0.65 * normalPdf(x, -1.6, 0.5) + 0.35 * normalPdf(x, 2.6, 0.6);

export function Walker({ t, note }) {
  const run = useMemo(() => metropolis(hills, { start: -1.6, step: 2, n: 3000, seed: 12 }), []);
  const count = Math.max(1, Math.round(ease(phase(t, 0, 0.85)) * 3000));
  const X = frame([-4, 5], [30, W - 20]);
  const Y = frame([0, 0.6], [130, 20]);
  const Hh = frame([0, 0.6], [H - 34, 160]);
  const xs = range(181).map((i) => -4 + (i / 180) * 9);
  const bins = 45;
  const hist = range(bins).fill(0);
  for (const s of run.samples.slice(0, count)) {
    const b = Math.floor(((s + 4) / 9) * bins);
    if (b >= 0 && b < bins) hist[b]++;
  }
  const bw = 9 / bins;
  const here = run.samples[count - 1];
  return (
    <Canvas width={W} height={H}>
      <path className="area-muted" d={`${linePath(xs.map((x) => [x, hills(x)]), X.f, Y.f)}L${X.f(5)},${Y.f(0)}L${X.f(-4)},${Y.f(0)}Z`} />
      <circle className="dot-ink" cx={X.f(here)} cy={Y.f(hills(here))} r="7" />
      {hist.map((c, i) => {
        const h = c / (count * bw);
        return <rect key={i} className="bar-a" x={X.f(-4 + i * bw) + 0.5} y={Hh.f(h)} width={X.f(bw) - X.f(0) - 1} height={Hh.f(0) - Hh.f(h)} />;
      })}
      <path className="line-muted dashed" d={linePath(xs.map((x) => [x, hills(x)]), X.f, Hh.f)} />
      <text className="note" x={30} y={16}>
        the shape we want
      </text>
      <text className="note" x={30} y={156}>
        where the walker has been ({count} steps)
      </text>
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- Forecast fans: how uncertainty grows ahead. ----------------------------

export function Fan({ t, model = "ar", note }) {
  const hist = useMemo(() => {
    const rand = rng(9);
    let x = 0;
    return range(60).map(() => (x = model === "ar" ? 0.7 * x + normal(rand) : x + normal(rand)));
  }, [model]);
  const Hn = 40;
  const last = hist[hist.length - 1];
  const fc = range(Hn).map((h0) => {
    const h = h0 + 1;
    return model === "ar" ? { m: last * 0.7 ** h, sd: Math.sqrt((1 - 0.7 ** (2 * h)) / (1 - 0.49)) } : { m: last, sd: Math.sqrt(h) };
  });
  const shown = Math.max(2, Math.round(ease(phase(t, 0.2, 0.85)) * Hn));
  const X = frame([0, 100], [40, W - 20]);
  const vals = [...hist, ...fc.map((f) => f.m + 2 * f.sd), ...fc.map((f) => f.m - 2 * f.sd)];
  const Y = frame([Math.min(...vals) - 1, Math.max(...vals) + 1], [H - 30, 20]);
  const xs = range(shown).map((i) => 60 + i);
  return (
    <Canvas width={W} height={H}>
      <path className="area-b" d={bandPath(xs, xs.map((_, i) => fc[i].m - 1.96 * fc[i].sd), xs.map((_, i) => fc[i].m + 1.96 * fc[i].sd), X.f, Y.f)} />
      <path className="line-ink" d={linePath(hist.map((v, i) => [i, v]), X.f, Y.f)} opacity={phase(t, 0, 0.2)} />
      <path className="line-b thick" d={linePath([[59, last], ...xs.map((x, i) => [x, fc[i].m])], X.f, Y.f)} />
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- Time series built from parts. ------------------------------------------

export function BuildSeries({ t, note }) {
  const noise = useMemo(() => {
    const rand = rng(2);
    return range(96).map(() => normal(rand));
  }, []);
  const tr = phase(t, 0, 0.3);
  const se = phase(t, 0.3, 0.6);
  const no = phase(t, 0.6, 0.85);
  const ys = range(96).map((i) => 100 + 0.5 * i * tr + 14 * Math.sin((2 * Math.PI * i) / 12) * se + 4 * noise[i] * no);
  const X = frame([0, 95], [40, W - 20]);
  const Y = frame([70, 165], [H - 40, 30]);
  const stage = no > 0 ? "+ noise" : se > 0 ? "+ season" : "trend";
  return (
    <Canvas width={W} height={H}>
      <Axes x={X} y={Y} xTicks={[0, 24, 48, 72, 95]} fmtX={(v) => `month ${v + 1}`} />
      <path className="line-ink thick" d={linePath(ys.map((v, i) => [i, v]), X.f, Y.f)} />
      <text className="reel-line accent" x={W - 30} y={36} textAnchor="end">
        {stage}
      </text>
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- Convolution: a filter sliding over an image. ----------------------------

const N = 12;
const IMG = range(N).map((y) => range(N).map((x) => ((x - 5.5) ** 2 + (y - 5.5) ** 2 < 14 ? 1 : 0)));
const SOBEL = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];
const OUT = convolve(IMG, SOBEL);

export function Slide({ t, note }) {
  const steps = N * N;
  const s = Math.floor(ease(phase(t, 0, 0.85)) * steps);
  const c = 16;
  const grey = (v) => {
    const g = Math.round(Math.max(0, Math.min(1, v)) * 255);
    return `rgb(${g},${g},${g})`;
  };
  const cx = s % N;
  const cy = Math.floor(Math.min(s, steps - 1) / N);
  return (
    <Canvas width={W} height={H}>
      <g transform="translate(60,40)">
        {IMG.map((row, y) => row.map((v, x) => <rect key={`${x}-${y}`} x={x * c} y={y * c} width={c - 1} height={c - 1} style={{ fill: grey(v) }} />))}
        {s < steps && <rect className="kernel" x={(cx - 1) * c - 1} y={(cy - 1) * c - 1} width={3 * c + 1} height={3 * c + 1} />}
      </g>
      <text className="note" x={60} y={30}>
        image
      </text>
      <g transform="translate(380,40)">
        {OUT.map((row, y) =>
          row.map((v, x) => (y * N + x <= s ? <rect key={`${x}-${y}`} x={x * c} y={y * c} width={c - 1} height={c - 1} style={{ fill: grey(0.5 + v / 8) }} /> : null))
        )}
      </g>
      <text className="note" x={380} y={30}>
        what the vertical-edge filter sees
      </text>
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- Learning signal through a deep network. --------------------------------

export function Signal({ t: time, skip: fixed, compare = false, note }) {
  // With `compare`, the first half shows a plain network and the second half the same with skips.
  const skip = compare ? time >= 0.5 : fixed;
  const t = compare ? (time < 0.5 ? time * 2 : (time - 0.5) * 2) : time;
  const layers = 30;
  const factors = useMemo(() => {
    const rand = rng(14);
    return range(layers).map(() => 0.62 + rand() * 0.3);
  }, []);
  const signal = [];
  let g = 1;
  for (let l = layers - 1; l >= 0; l--) {
    g *= skip ? 1 + (factors[l] - 0.77) * 0.1 : factors[l];
    signal[l] = g;
  }
  const shown = Math.round(ease(phase(t, 0, 0.8)) * layers);
  const y = (v) => 240 - Math.max(0, (Math.log10(v) + 8) / 8) * 200;
  const bw = (W - 60) / layers;
  return (
    <Canvas width={W} height={H}>
      {signal.map((v, l) =>
        layers - 1 - l < shown ? <rect key={l} className={v < 0.01 ? "bar-bad" : "bar-a"} x={30 + l * bw + 1} y={y(v)} width={bw - 2} height={240 - y(v)} rx="2" /> : null
      )}
      <text className="note" x={30} y={262}>
        first layer
      </text>
      <text className="note" x={W - 30} y={262} textAnchor="end">
        last layer (the signal starts here)
      </text>
      <text className="label" x={30} y={24}>
        {skip ? "With skip connections" : "Plain network"}: signal reaching each layer (log scale)
      </text>
      <Note t={compare ? time : t} text={note} y={H - 10} />
    </Canvas>
  );
}

// --- Diffusion: noise in, noise out. ----------------------------------------

export function Noise({ t, reverse = false, note }) {
  const { x0, eps } = useMemo(() => {
    const rand = rng(6);
    const pts = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * 2 * Math.PI;
      pts.push([Math.cos(a), Math.sin(a)]);
    }
    for (let i = 0; i < 20; i++) pts.push([-0.35 + normal(rand) * 0.05, -0.3 + normal(rand) * 0.05], [0.35 + normal(rand) * 0.05, -0.3 + normal(rand) * 0.05]);
    for (let i = 0; i < 40; i++) {
      const a = Math.PI * (0.2 + (0.6 * i) / 40);
      pts.push([0.55 * Math.cos(a), 0.15 + 0.4 * Math.sin(a)]);
    }
    return { x0: pts, eps: pts.map(() => [normal(rand), normal(rand)]) };
  }, []);
  const k = ease(phase(t, 0, 0.85));
  const level = reverse ? 1 - k : k; // 0 = picture, 1 = pure noise
  const signal = Math.sqrt(1 - level * 0.995);
  const noise = Math.sqrt(level * 0.995);
  return (
    <Canvas width={W} height={H}>
      <g transform="translate(320,140) scale(72)">
        {x0.map(([x, y], i) => (
          <circle key={i} className="dot-a" cx={signal * x + noise * eps[i][0]} cy={signal * y + noise * eps[i][1]} r={0.035} style={{ strokeWidth: 0 }} />
        ))}
      </g>
      <text className="label" x={30} y={30}>
        {reverse ? "Removing predicted noise, step by step" : "Adding noise, step by step"}
      </text>
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- Image patches and attention. -------------------------------------------

const COLOURS = { sky: "#8cbff2", sun: "#ffd94d", grass: "#59b359", wall: "#d9665a", roof: "#73402f" };
const SCENE = range(16).map((y) =>
  range(16).map((x) => {
    if ((x - 12.5) ** 2 + (y - 3) ** 2 < 5) return "sun";
    if (y >= 12) return "grass";
    if (y >= 8 && y <= 11 && x >= 2 && x <= 7) return "wall";
    if (y >= 5 && y <= 7 && Math.abs(x - 4.5) <= y - 4) return "roof";
    return "sky";
  })
);

export function Patches({ t, attend = false, note }) {
  const c = 14;
  const split = ease(phase(t, 0, 0.5));
  const gap = split * 6;
  const sel = 9;
  const centre = (p) => [100 + (p % 4) * (4 * c + gap) + 2 * c, 30 + Math.floor(p / 4) * (4 * c + gap) + 2 * c];
  const weights = [0.02, 0.03, 0.05, 0.02, 0.04, 0.16, 0.05, 0.03, 0.22, 0, 0.06, 0.05, 0.05, 0.08, 0.07, 0.07];
  return (
    <Canvas width={W} height={H}>
      {SCENE.map((row, y) =>
        row.map((k, x) => {
          const p = Math.floor(y / 4) * 4 + Math.floor(x / 4);
          const ox = (p % 4) * gap;
          const oy = Math.floor(p / 4) * gap;
          return <rect key={`${x}-${y}`} x={100 + x * c + ox} y={30 + y * c + oy} width={c} height={c} style={{ fill: COLOURS[k] }} />;
        })
      )}
      {attend &&
        weights.map((w, j) =>
          j === sel ? null : (
            <line key={j} className="line-ink" x1={centre(sel)[0]} y1={centre(sel)[1]} x2={centre(j)[0]} y2={centre(j)[1]} style={{ strokeWidth: 0.5 + w * 16, opacity: phase(t, 0.3, 0.7) * Math.min(1, 0.2 + w * 4) }} />
          )
        )}
      {!attend && (
        <g opacity={phase(t, 0.5, 0.75)}>
          {range(17).map((i) => (
            <rect key={i} x={420 + (i % 6) * 32} y={60 + Math.floor(i / 6) * 32} width={26} height={26} rx="5" className={i === 0 ? "reel-box tone-a" : "reel-box"} />
          ))}
          <text className="note" x={420} y={50}>
            [CLS] + 16 patch tokens
          </text>
        </g>
      )}
      <Note t={t} text={note} />
    </Canvas>
  );
}

// --- Grad-CAM: where the evidence for a class is. ---------------------------

export function Heat({ t, note }) {
  const c = 30;
  const k = phase(t, 0.3, 0.8);
  const heat = (x, y) => Math.max(0, Math.exp(-((x - 2) ** 2 + (y - 3.4) ** 2) / 3.5));
  return (
    <Canvas width={W} height={H}>
      <g transform="translate(200,30)">
        <rect className="node" width={7 * c} height={7 * c} rx="8" />
        <ellipse className="px-on" cx={2.4 * c} cy={3.8 * c} rx={1.9 * c} ry={1.4 * c} fillOpacity="0.45" />
        <circle className="px-on" cx={1.4 * c} cy={2.2 * c} r={0.9 * c} fillOpacity="0.45" />
        <circle className="px-on" cx={5.4 * c} cy={5.3 * c} r={0.8 * c} fillOpacity="0.6" />
        {range(7).map((y) => range(7).map((x) => <rect key={`${x}${y}`} x={x * c} y={y * c} width={c} height={c} className="heat-b" fillOpacity={heat(x, y) * 0.75 * k} />))}
      </g>
      <text className="note" x={200} y={250}>
        heat for "dog": the evidence sits on the dog, not the ball
      </text>
      <Note t={t} text={note} />
    </Canvas>
  );
}
