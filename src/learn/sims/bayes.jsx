// Simulations for the probability chapter.
import React, { useMemo, useRef, useState } from "react";
import { betaBinomial, betaInterval, betaPdf, enumerate, estimates, gp, metropolis, normal, normalPdf, periodic, range, rbf, rng, sampleMvn } from "../math";
import { Axes, Button, Canvas, Choice, Readout, Sim, Slider, Toggle } from "../kit";
import { bandPath, fix, frame, linePath, pct, svgPoint, useLoop, useReport } from "../plot";

const GRID = range(201).map((i) => i / 200);

/** A Beta curve as points, scaled to a given peak height. */
const betaCurve = (a, b) => GRID.map((x) => [x, betaPdf(x, a, b)]);

// ---------------------------------------------------------------------------
// Two kinds of not knowing

export function UncertaintySim({ onState }) {
  const [shots, setShots] = useState(10);
  const truth = 0.7;
  // The made shots in the first n attempts, from one fixed season.
  const season = useMemo(() => {
    const rand = rng(17);
    return range(500).map(() => rand() < truth);
  }, []);
  const made = season.slice(0, shots).filter(Boolean).length;
  const a = 1 + made;
  const b = 1 + shots - made;
  const [lo, hi] = betaInterval(a, b);
  const next = range(11).map((k) => betaBinomial(k, 10, a, b));
  const nextMean = next.reduce((s, p, k) => s + p * k, 0);
  const nextSd = Math.sqrt(next.reduce((s, p, k) => s + p * (k - nextMean) ** 2, 0));
  useReport(onState, { shots, width: +(hi - lo).toFixed(3), nextSd: +nextSd.toFixed(2) });

  const curve = betaCurve(a, b);
  const top = Math.max(...curve.map((p) => p[1]), 3);
  const X = frame([0, 1], [40, 300]);
  const Y = frame([0, top], [250, 30]);
  const BX = frame([-0.5, 10.5], [360, 620]);
  const BY = frame([0, Math.max(0.45, ...next)], [250, 30]);
  return (
    <Sim
      label="Watch a player's shots and see what you learn about them, and what stays unpredictable"
      controls={<Slider label="Shots you've watched" value={shots} min={0} max={500} step={1} onChange={setShots} />}
      readouts={
        <>
          <Readout label="Made so far" value={`${made} of ${shots}`} />
          <Readout label="Range for their true rate" value={`${pct(lo)} to ${pct(hi)}`} tone="accent" />
          <Readout label="Next 10 shots, typical spread" value={`± ${fix(nextSd, 1)} baskets`} />
        </>
      }
    >
      <Canvas width={640} height={290}>
        <text className="label" x={40} y={16}>
          What you believe about their true rate
        </text>
        <Axes x={X} y={Y} xTicks={[0, 0.5, 1]} fmtX={(v) => pct(v)} />
        <path className="area-a" d={`${linePath(curve, X.f, Y.f)}L${X.f(1)},${Y.f(0)}L${X.f(0)},${Y.f(0)}Z`} />
        <path className="line-a thick" d={linePath(curve, X.f, Y.f)} />
        <line className="line-muted dashed" x1={X.f(truth)} x2={X.f(truth)} y1={Y.range[0]} y2={Y.range[1]} />
        <text className="note" x={X.f(truth) - 4} y={Y.range[0] - 6} textAnchor="end">
          truth: 70%
        </text>
        <text className="label" x={360} y={16}>
          Baskets in their next 10 shots
        </text>
        {next.map((p, k) => (
          <rect key={k} className="bar-b" x={BX.f(k) - 9} y={BY.f(p)} width={18} height={BY.f(0) - BY.f(p)} rx="3" />
        ))}
        <Axes x={BX} y={BY} xTicks={[0, 2, 4, 6, 8, 10]} />
      </Canvas>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Three ways to estimate

export function EstimatorSim({ onState }) {
  const [n, setN] = useState(5);
  const [k, setK] = useState(4);
  const [priorMean, setPriorMean] = useState(0.2);
  const [strength, setStrength] = useState(10);
  const kk = Math.min(k, n);
  const a = priorMean * strength;
  const b = (1 - priorMean) * strength;
  const e = estimates(kk, n, a, b);
  const [lo, hi] = betaInterval(e.posterior.a, e.posterior.b);
  useReport(onState, { n, k: kk, mle: e.mle, map: e.map, strength, priorMean });

  const prior = betaCurve(a, b);
  const post = betaCurve(e.posterior.a, e.posterior.b);
  const like = GRID.map((x) => [x, n ? Math.exp(kk * Math.log(Math.max(x, 1e-9)) + (n - kk) * Math.log(Math.max(1 - x, 1e-9))) : 1]);
  const likeTop = Math.max(...like.map((p) => p[1]));
  const top = Math.max(4, ...post.map((p) => p[1]), ...prior.map((p) => p[1]));
  const likeScaled = like.map(([x, y]) => [x, (y / likeTop) * top * 0.9]);
  const X = frame([0, 1], [40, 620]);
  const Y = frame([0, top * 1.05], [260, 24]);
  const mark = (v, cls, label, dy) =>
    Number.isFinite(v) && (
      <g>
        <line className={cls} x1={X.f(v)} x2={X.f(v)} y1={Y.range[0]} y2={Y.range[1] + dy} />
        <text className={`note ${cls === "line-a" ? "note-a" : cls === "line-b" ? "note-b" : ""}`} x={X.f(v) + 5} y={Y.range[1] + dy + 10}>
          {label}
        </text>
      </g>
    );
  return (
    <Sim
      label="A sign-up rate estimated three ways"
      controls={
        <>
          <Slider label="Visitors so far" value={n} min={0} max={200} onChange={setN} />
          <Slider label="Of them, signed up" value={kk} min={0} max={n} onChange={setK} />
          <Slider label="Prior: typical rate for pages like this" value={priorMean} min={0.05} max={0.95} step={0.05} onChange={setPriorMean} format={(v) => pct(v)} />
          <Slider label="Prior: how sure (worth this many visitors)" value={strength} min={2} max={100} onChange={setStrength} />
        </>
      }
      readouts={
        <>
          <Readout label="MLE (data only)" value={Number.isFinite(e.mle) ? pct(e.mle) : "no data"} />
          <Readout label="MAP (data + prior, peak)" value={Number.isFinite(e.map) ? pct(e.map) : "–"} />
          <Readout label="Posterior, 94% range" value={`${pct(lo)} to ${pct(hi)}`} tone="accent" />
        </>
      }
    >
      <Canvas width={640} height={290}>
        <Axes x={X} y={Y} xTicks={[0, 0.25, 0.5, 0.75, 1]} fmtX={(v) => pct(v)} xLabel="sign-up rate" />
        <path className="line-muted dashed" d={linePath(prior, X.f, Y.f)} />
        <path className="line-b" d={linePath(likeScaled, X.f, Y.f)} />
        <path className="area-a" d={`${linePath(post, X.f, Y.f)}L${X.f(1)},${Y.f(0)}L${X.f(0)},${Y.f(0)}Z`} />
        <path className="line-a thick" d={linePath(post, X.f, Y.f)} />
        {mark(e.mle, "line-b", "MLE", 0)}
        {mark(e.map, "line-a", "MAP", 22)}
      </Canvas>
      <p className="sim-legend">
        <span className="key" style={{ background: "var(--muted)" }} /> prior <span className="key key-b" /> what the data alone says (likelihood) <span className="key key-a" /> posterior: both combined
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Updating one fact at a time

const PRIORS = [
  { id: "doubter", name: "The sceptic", a: 2, b: 18 },
  { id: "fan", name: "The optimist", a: 12, b: 4 },
];

export function UpdateSim({ onState }) {
  const [obs, setObs] = useState([]);
  const [truth, setTruth] = useState(0.4);
  const seed = useRef(1);
  const k = obs.filter(Boolean).length;
  const n = obs.length;
  const add = (v) => setObs((o) => [...o, v]);
  const addMany = (m) => {
    const rand = rng(seed.current++ * 7919);
    setObs((o) => [...o, ...range(m).map(() => rand() < truth)]);
  };
  const posts = PRIORS.map((p) => ({ ...p, pa: p.a + k, pb: p.b + n - k }));
  const means = posts.map((p) => p.pa / (p.pa + p.pb));
  useReport(onState, { n, gap: +Math.abs(means[0] - means[1]).toFixed(3) });
  const curves = posts.map((p) => betaCurve(p.pa, p.pb));
  const top = Math.max(5, ...curves.flat().map((p) => p[1]));
  const X = frame([0, 1], [40, 620]);
  const Y = frame([0, top * 1.05], [250, 20]);
  return (
    <Sim
      label="Two people with different starting beliefs watch the same evidence"
      controls={
        <>
          <Button onClick={() => add(true)}>It worked</Button>
          <Button onClick={() => add(false)}>It didn't</Button>
          <Button onClick={() => addMany(10)}>10 more trials</Button>
          <Button onClick={() => addMany(100)}>100 more</Button>
          <Button onClick={() => setObs([])}>Start over</Button>
          <Slider label="How often it really works" value={truth} min={0.05} max={0.95} step={0.05} onChange={setTruth} format={(v) => pct(v)} />
        </>
      }
      readouts={
        <>
          <Readout label="Evidence" value={`${k} worked, ${n - k} didn't`} />
          <Readout label="The sceptic now says" value={pct(means[0])} />
          <Readout label="The optimist now says" value={pct(means[1])} />
          <Readout label="How far apart they are" value={pct(Math.abs(means[0] - means[1]))} tone="accent" />
        </>
      }
    >
      <Canvas width={640} height={280}>
        <Axes x={X} y={Y} xTicks={[0, 0.25, 0.5, 0.75, 1]} fmtX={(v) => pct(v)} xLabel="how often it works" />
        <path className="area-a" d={`${linePath(curves[0], X.f, Y.f)}L${X.f(1)},${Y.f(0)}L${X.f(0)},${Y.f(0)}Z`} />
        <path className="line-a thick" d={linePath(curves[0], X.f, Y.f)} />
        <path className="area-b" d={`${linePath(curves[1], X.f, Y.f)}L${X.f(1)},${Y.f(0)}L${X.f(0)},${Y.f(0)}Z`} />
        <path className="line-b thick" d={linePath(curves[1], X.f, Y.f)} />
        <line className="line-muted dashed" x1={X.f(truth)} x2={X.f(truth)} y1={Y.range[0]} y2={Y.range[1]} />
      </Canvas>
      <p className="sim-legend">
        <span className="key key-a" /> the sceptic, who started at 10% <span className="key key-b" /> the optimist, who started at 75%. The dashed line is the truth.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Two related unknowns: a multivariate Gaussian

export function GaussianSim({ onState }) {
  const [rho, setRho] = useState(0.5);
  const [x0, setX0] = useState(185);
  const mx = 170;
  const my = 170;
  const sd = 9;
  const pts = useMemo(() => {
    const rand = rng(5);
    return range(220).map(() => {
      const z1 = normal(rand);
      const z2 = normal(rand);
      return [mx + sd * z1, my + sd * (rho * z1 + Math.sqrt(1 - rho * rho) * z2)];
    });
  }, [rho]);
  const condMean = my + rho * (x0 - mx);
  const condSd = sd * Math.sqrt(1 - rho * rho);
  useReport(onState, { rho, condSd: +condSd.toFixed(2), x0 });
  const X = frame([140, 200], [50, 420]);
  const Y = frame([140, 200], [270, 20]);
  const ys = range(121).map((i) => 140 + i * 0.5);
  const D = frame([0, 0.12], [440, 620]);
  const svgRef = useRef(null);
  const drag = (e) => {
    if (e.type === "pointermove" && e.buttons !== 1 && e.pointerType !== "touch") return;
    const p = svgPoint(svgRef.current, e);
    setX0(Math.round(Math.max(145, Math.min(195, X.f.invert(p.x)))));
  };
  // The 1- and 2-sd ellipses.
  const ellipse = (k) => {
    const angle = Math.PI / 4;
    const l1 = sd * Math.sqrt(1 + rho);
    const l2 = sd * Math.sqrt(1 - rho);
    return range(73)
      .map((i) => {
        const t = (i / 72) * 2 * Math.PI;
        const u = k * l1 * Math.cos(t);
        const v = k * l2 * Math.sin(t);
        const x = mx + u * Math.cos(angle) - v * Math.sin(angle);
        const y = my + u * Math.sin(angle) + v * Math.cos(angle);
        return `${i ? "L" : "M"}${X.f(x).toFixed(1)},${Y.f(y).toFixed(1)}`;
      })
      .join("");
  };
  return (
    <Sim
      label="Heights of parents and their grown children. Pick a parent's height and see what it tells you about the child."
      controls={
        <>
          <Slider label="How strongly the two are linked (correlation)" value={rho} min={0} max={0.95} step={0.05} onChange={setRho} />
          <Slider label="The parent's height" value={x0} min={145} max={195} onChange={setX0} format={(v) => `${v} cm`} />
        </>
      }
      readouts={
        <>
          <Readout label="Child, knowing nothing" value={`${my} ± ${sd} cm`} />
          <Readout label="Child, knowing the parent" value={`${fix(condMean, 0)} ± ${fix(condSd, 1)} cm`} tone="accent" />
        </>
      }
    >
      <Canvas width={640} height={300} ref={svgRef} onPointerDown={drag} onPointerMove={drag} className="draggable">
        <Axes x={X} y={Y} xTicks={[150, 170, 190]} yTicks={[150, 170, 190]} xLabel="parent (cm)" yLabel="child (cm)" />
        {pts.map(([x, y], i) => (
          <circle key={i} className="dot-a" cx={X.f(x)} cy={Y.f(y)} r="2.6" opacity="0.55" />
        ))}
        <path className="line-muted thin" d={ellipse(1)} />
        <path className="line-muted thin dashed" d={ellipse(2)} />
        <line className="split" x1={X.f(x0)} x2={X.f(x0)} y1={Y.range[0]} y2={Y.range[1]} />
        <circle className="dot-ink" cx={X.f(x0)} cy={Y.f(condMean)} r="5" />
        <path className="line-muted" d={linePath(ys.map((y) => [normalPdf(y, my, sd), y]), D.f, Y.f)} />
        <path className="area-b" d={`${linePath(ys.map((y) => [normalPdf(y, condMean, condSd), y]), D.f, Y.f)}L${D.f(0)},${Y.f(200)}L${D.f(0)},${Y.f(140)}Z`} />
        <path className="line-b thick" d={linePath(ys.map((y) => [normalPdf(y, condMean, condSd), y]), D.f, Y.f)} />
        <line className="axis" x1={D.f(0)} x2={D.f(0)} y1={Y.range[0]} y2={Y.range[1]} />
        <text className="note" x={D.f(0) + 4} y={14}>
          child's height
        </text>
      </Canvas>
      <p className="sim-legend">
        Drag across the chart to move the parent's height. <span className="key" style={{ background: "var(--muted)" }} /> knowing nothing <span className="key key-b" /> knowing the parent
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// A Bayesian network

const NET = {
  rain: { p: () => 0.2 },
  sprinkler: { p: (w) => (w.rain ? 0.01 : 0.4) },
  wet: { p: (w) => (w.rain && w.sprinkler ? 0.99 : w.rain ? 0.8 : w.sprinkler ? 0.9 : 0.02) },
};
const NODES = [
  { id: "rain", label: "It rained", x: 170, y: 60 },
  { id: "sprinkler", label: "Sprinkler was on", x: 470, y: 60 },
  { id: "wet", label: "The grass is wet", x: 320, y: 220 },
];
const EDGES = [
  ["rain", "sprinkler"],
  ["rain", "wet"],
  ["sprinkler", "wet"],
];

export function NetworkSim({ onState }) {
  const [evidence, setEvidence] = useState({});
  const p = enumerate(NET, evidence);
  useReport(onState, { evidence, rain: +p.rain.toFixed(3) });
  const cycle = (id) =>
    setEvidence((e) => {
      const next = { ...e };
      if (!(id in e)) next[id] = true;
      else if (e[id]) next[id] = false;
      else delete next[id];
      return next;
    });
  const at = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <Sim
      label="Click a box to say you've seen it happen, click again for 'didn't happen', and again to forget"
      controls={<Button onClick={() => setEvidence({})}>Forget everything</Button>}
      readouts={
        <>
          {NODES.map((n) => (
            <Readout key={n.id} label={n.label} value={n.id in evidence ? (evidence[n.id] ? "seen: yes" : "seen: no") : pct(p[n.id])} tone={n.id === "rain" ? "accent" : undefined} />
          ))}
        </>
      }
    >
      <Canvas width={640} height={280}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0L10,5L0,10z" className="handle" />
          </marker>
        </defs>
        {EDGES.map(([a, b]) => {
          const A = at[a];
          const B = at[b];
          const dx = B.x - A.x;
          const dy = B.y - A.y;
          const len = Math.hypot(dx, dy);
          const ux = dx / len;
          const uy = dy / len;
          // Leave each box at its edge, plus a little air.
          const edge = Math.min(90 / Math.max(Math.abs(ux), 1e-6), 30 / Math.max(Math.abs(uy), 1e-6)) + 6;
          return <line key={a + b} className="edge" x1={A.x + ux * edge} y1={A.y + uy * edge} x2={B.x - ux * edge} y2={B.y - uy * edge} markerEnd="url(#arrow)" />;
        })}
        {NODES.map((n) => {
          const seen = n.id in evidence;
          const val = seen ? (evidence[n.id] ? 1 : 0) : p[n.id];
          return (
            <g key={n.id} className="hit" onClick={() => cycle(n.id)} transform={`translate(${n.x - 90},${n.y - 30})`} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), cycle(n.id))} aria-label={`${n.label}: ${seen ? (evidence[n.id] ? "seen yes" : "seen no") : pct(p[n.id])}`}>
              <rect className={`node${seen ? " is-evidence" : ""}`} width="180" height="60" rx="12" />
              <text className="label" x="14" y="24">
                {n.label}
              </text>
              <rect className="frame-line" x="14" y="36" width="152" height="10" rx="5" />
              <rect className={seen ? "bar-a" : "bar-b"} x="14" y="36" width={Math.max(2, 152 * val)} height="10" rx="5" />
            </g>
          );
        })}
      </Canvas>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Gaussian processes

const GP_XS = range(121).map((i) => i / 120);

export function GPSim({ onState }) {
  const [points, setPoints] = useState([
    { x: 0.15, y: 0.4 },
    { x: 0.42, y: -0.5 },
    { x: 0.7, y: 0.6 },
  ]);
  const [length, setLength] = useState(0.12);
  const [kind, setKind] = useState("smooth");
  const [noise, setNoise] = useState(0.05);
  const [samples, setSamples] = useState(true);
  const kernel = useMemo(() => (kind === "smooth" ? (a, b) => rbf(a, b, length) : (a, b) => periodic(a, b, length * 6, 0.25)), [kind, length]);
  const post = useMemo(() => gp(points, GP_XS, kernel, noise), [points, kernel, noise]);
  const sd = post.cov.map((row, i) => Math.sqrt(Math.max(0, row[i])));
  const draws = useMemo(() => {
    if (!samples) return [];
    const rand = rng(3);
    return range(3).map(() => sampleMvn(post.mean, post.cov, rand));
  }, [post, samples]);
  useReport(onState, { n: points.length, maxSd: +Math.max(...sd).toFixed(2), length, kind });
  const X = frame([0, 1], [30, 620]);
  const Y = frame([-2.6, 2.6], [270, 14]);
  const svgRef = useRef(null);
  const add = (e) => {
    const p = svgPoint(svgRef.current, e);
    const x = X.f.invert(p.x);
    const y = Y.f.invert(p.y);
    if (x < 0 || x > 1 || y < -2.6 || y > 2.6) return;
    setPoints((pts) => [...pts, { x, y }]);
  };
  return (
    <Sim
      label="Click the chart to add measurements. The band is where the function could be."
      controls={
        <>
          <Choice label="What the function is like" options={[["smooth", "Smooth"], ["repeat", "Repeating"]]} value={kind} onChange={setKind} />
          <Slider label="How far each point's influence reaches" value={length} min={0.03} max={0.4} step={0.01} onChange={setLength} />
          <Slider label="Measurement noise" value={noise} min={0.01} max={0.5} step={0.01} onChange={setNoise} />
          <Toggle label="Show possible functions" checked={samples} onChange={setSamples} />
          <Button onClick={() => setPoints([])}>Clear points</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Measurements" value={points.length} />
          <Readout label="Widest uncertainty" value={`± ${fix(2 * Math.max(...sd), 1)}`} tone="accent" />
        </>
      }
    >
      <Canvas width={640} height={290} ref={svgRef} onClick={add} className="draggable">
        <Axes x={X} y={Y} yTicks={[-2, 0, 2]} />
        <path className="area-a" d={bandPath(GP_XS, post.mean.map((m, i) => m - 2 * sd[i]), post.mean.map((m, i) => m + 2 * sd[i]), X.f, Y.f)} />
        {draws.map((d, i) => (
          <path key={i} className="line-b thin" opacity="0.7" d={linePath(GP_XS.map((x, j) => [x, d[j]]), X.f, Y.f)} />
        ))}
        <path className="line-a thick" d={linePath(GP_XS.map((x, i) => [x, post.mean[i]]), X.f, Y.f)} />
        {points.map((p, i) => (
          <circle key={i} className="dot-ink" cx={X.f(p.x)} cy={Y.f(p.y)} r="5" />
        ))}
      </Canvas>
      <p className="sim-legend">
        <span className="key key-a" /> best guess, with the 95% band <span className="key key-b" /> three functions the GP thinks are possible
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// MCMC

/** Two hills: a density with a gap in the middle, easy to get stuck on one side of. */
const twoHills = (x) => 0.65 * normalPdf(x, -1.6, 0.5) + 0.35 * normalPdf(x, 2.6, 0.6);

export function MCMCSim({ onState }) {
  const [step, setStep] = useState(0.8);
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(false);
  const run = useMemo(() => metropolis(twoHills, { start: -1.6, step, n: 4000, seed: 12 }), [step]);
  const acc = useRef(0);
  const ref = useLoop((dt) => {
    acc.current += dt * 60;
    const add = Math.floor(acc.current);
    if (!add) return;
    acc.current -= add;
    setCount((c) => {
      const next = Math.min(4000, c + add * (c < 60 ? 1 : 4));
      if (next >= 4000) setRunning(false);
      return next;
    });
  }, running);
  const shown = run.samples.slice(0, count);
  const accepted = run.proposals.slice(0, count).filter((p) => p.ok).length;
  const right = shown.filter((x) => x > 0.5).length;
  useReport(onState, { count, step, acceptance: count ? accepted / count : 0, rightShare: count ? right / count : 0 });
  const X = frame([-4, 5], [30, 620]);
  const Y = frame([0, 0.6], [140, 14]);
  const xs = range(181).map((i) => -4 + (i / 180) * 9);
  const bins = 45;
  const hist = range(bins).fill(0);
  for (const s of shown) {
    const b = Math.floor(((s + 4) / 9) * bins);
    if (b >= 0 && b < bins) hist[b]++;
  }
  const binW = 9 / bins;
  const H = frame([0, 0.6], [270, 160]);
  const last = run.proposals[count - 1];
  return (
    <Sim
      label="A walker proposes steps and keeps the ones that don't drop too far. Its footprints build up the shape."
      controls={
        <>
          <Slider label="Step size" value={step} min={0.05} max={6} step={0.05} onChange={(v) => (setStep(v), setCount(0))} />
          <Button primary onClick={() => (count >= 4000 && setCount(0), setRunning((r) => !r))}>
            {running ? "Pause" : count ? "Keep walking" : "Start walking"}
          </Button>
          <Button onClick={() => setCount((c) => Math.min(4000, c + 1))}>One step</Button>
          <Button onClick={() => (setCount(0), setRunning(false))}>Reset</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Steps taken" value={count} />
          <Readout label="Proposals accepted" value={count ? pct(accepted / count) : "–"} tone="accent" />
          <Readout label="Time on the right hill" value={count ? `${pct(right / count)} (should be 35%)` : "–"} />
        </>
      }
    >
      <div ref={ref}>
        <Canvas width={640} height={290}>
          <path className="area-muted" d={`${linePath(xs.map((x) => [x, twoHills(x)]), X.f, Y.f)}L${X.f(5)},${Y.f(0)}L${X.f(-4)},${Y.f(0)}Z`} />
          <path className="line-muted" d={linePath(xs.map((x) => [x, twoHills(x)]), X.f, Y.f)} />
          <line className="axis" x1={X.range[0]} x2={X.range[1]} y1={Y.f(0)} y2={Y.f(0)} />
          {last && (
            <g>
              <line className={last.ok ? "line-a" : "line-bad"} x1={X.f(last.from)} x2={X.f(last.to)} y1={Y.f(twoHills(last.from)) - 8} y2={Y.f(twoHills(last.from)) - 8} />
              <circle className={last.ok ? "dot-a" : "dot-b"} cx={X.f(last.to)} cy={Y.f(twoHills(last.to))} r="4" />
              <circle className="dot-ink" cx={X.f(run.samples[count - 1])} cy={Y.f(twoHills(run.samples[count - 1]))} r="7" />
            </g>
          )}
          {!last && <circle className="dot-ink" cx={X.f(-1.6)} cy={Y.f(twoHills(-1.6))} r="7" />}
          {count > 0 &&
            hist.map((c, i) => {
              const h = c / (count * binW);
              return <rect key={i} className="bar-a" x={X.f(-4 + i * binW) + 0.5} y={H.f(h)} width={X.f(binW) - X.f(0) - 1} height={H.f(0) - H.f(h)} />;
            })}
          <path className="line-muted dashed" d={linePath(xs.map((x) => [x, twoHills(x)]), X.f, H.f)} />
          <line className="axis" x1={X.range[0]} x2={X.range[1]} y1={H.f(0)} y2={H.f(0)} />
          <text className="note" x={X.range[0]} y={Y.range[1]}>
            the shape we want to sample
          </text>
          <text className="note" x={X.range[0]} y={H.range[1] + 6}>
            where the walker has been
          </text>
        </Canvas>
      </div>
    </Sim>
  );
}
