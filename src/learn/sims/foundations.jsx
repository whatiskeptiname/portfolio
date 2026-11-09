// Simulations for the foundations chapter: lines, learning by descent,
// probabilities, shrinkage, features, groups, directions and outliers.
import React, { useMemo, useState } from "react";
import { normal, range, rng } from "../math";
import {
  descend,
  fitLine,
  fitLogistic,
  fitPolynomial,
  kmeansStep,
  lineMse,
  logLoss,
  nearest,
  polyAt,
  principalAngle,
  rSquared,
  sigmoid,
  standardise,
  varianceAlong,
  zScores,
} from "../mlmath";
import { Axes, Button, Canvas, Readout, Sim, Slider, Toggle } from "../kit";
import { fix, frame, linePath, pct, useReport } from "../plot";

const W = 640;
const H = 320;

// ---------------------------------------------------------------------------
// The best straight line

/** Flats for sale: floor area (m²) and price (lakh rupees). */
function flats() {
  const rand = rng(21);
  return range(24).map(() => {
    const x = 40 + rand() * 110;
    return { x, y: 20 + 0.9 * x + normal(rand) * 14 };
  });
}

export function LineSim({ onState }) {
  const pts = useMemo(flats, []);
  const best = useMemo(() => fitLine(pts), [pts]);
  const [b, setB] = useState(0.4);
  const [a, setA] = useState(70);
  const [showErr, setShowErr] = useState(true);
  const X = frame([30, 160], [56, W - 20]);
  const Y = frame([0, 200], [H - 40, 16]);
  const mse = lineMse(pts, a, b);
  const bestMse = lineMse(pts, best.a, best.b);
  useReport(onState, { mse: +mse.toFixed(1), best: +bestMse.toFixed(1) });
  return (
    <Sim
      label="Fit a straight line to flat prices by hand"
      controls={
        <>
          <Slider label="Slope (lakh per m²)" value={b} min={0} max={2} step={0.02} onChange={setB} format={(v) => v.toFixed(2)} />
          <Slider label="Starting price" value={a} min={-60} max={120} step={1} onChange={setA} />
          <Toggle label="Show the errors" checked={showErr} onChange={setShowErr} />
          <Button
            onClick={() => {
              setA(Math.round(best.a));
              setB(+best.b.toFixed(2));
            }}
          >
            Least squares
          </Button>
        </>
      }
      readouts={
        <>
          <Readout label="Average squared error" value={fix(mse, 0)} tone="accent" />
          <Readout label="Best possible" value={fix(bestMse, 0)} />
          <Readout label="Explained (R²)" value={pct(Math.max(0, rSquared(pts, a, b)))} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[40, 80, 120, 160]} yTicks={[0, 100, 200]} xLabel="floor area (m²)" yLabel="price (lakh)" />
        {showErr &&
          pts.map((p, i) => <line key={i} className="line-bad thin" x1={X.f(p.x)} x2={X.f(p.x)} y1={Y.f(p.y)} y2={Y.f(Math.max(0, Math.min(200, a + b * p.x)))} />)}
        <path className="line-a thick" d={linePath([[30, a + b * 30], [160, a + b * 160]], X.f, Y.f)} />
        {pts.map((p, i) => (
          <circle key={i} className="dot-b" cx={X.f(p.x)} cy={Y.f(p.y)} r="5" />
        ))}
      </Canvas>
      <p className="sim-legend">The red stalks are the errors. Least squares makes the sum of their squares as small as it can be.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Rolling downhill

const bowl = (x) => 0.12 * (x - 1.5) ** 2 + 0.6 * Math.sin(1.4 * x) + 1.4;
const bowlSlope = (x) => 0.24 * (x - 1.5) + 0.84 * Math.cos(1.4 * x);
/** The lowest the loss goes anywhere on the chart (the deep valley, near x = 3.4). */
const DEEPEST = Math.min(...range(1201).map((i) => bowl(-5 + i / 100)));

export function DescentSim({ onState }) {
  const [rate, setRate] = useState(0.6);
  const [start, setStart] = useState(-3.5);
  const [steps, setSteps] = useState(0);
  const path = useMemo(() => descend(bowlSlope, start, rate, 40), [start, rate]);
  const shown = path.slice(0, steps + 1);
  const here = shown.at(-1);
  const X = frame([-5, 7], [56, W - 20]);
  const Y = frame([0, 6], [H - 40, 16]);
  const xs = range(161).map((i) => -5 + (12 * i) / 160);
  const blewUp = path.length < 41 || Math.abs(here) > 6.9;
  useReport(onState, { rate, steps, loss: +bowl(Math.max(-5, Math.min(7, here))).toFixed(3), x: +here.toFixed(2), deepest: DEEPEST });
  return (
    <Sim
      label="Roll a ball down a loss curve by gradient descent"
      controls={
        <>
          <Slider label="Learning rate (step size)" value={rate} min={0.05} max={5} step={0.05} onChange={(v) => { setRate(v); setSteps(0); }} format={(v) => v.toFixed(2)} />
          <Slider label="Start at" value={start} min={-5} max={7} step={0.25} onChange={(v) => { setStart(v); setSteps(0); }} />
          <Button primary onClick={() => setSteps((s) => Math.min(path.length - 1, s + 1))}>One step</Button>
          <Button onClick={() => setSteps(path.length - 1)}>Run 40 steps</Button>
          <Button onClick={() => setSteps(0)}>Reset</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Steps taken" value={steps} />
          <Readout label="Loss now" value={Math.abs(here) > 6.9 ? "off the chart" : fix(bowl(here))} tone="accent" />
          <Readout label="Slope here" value={Math.abs(here) > 6.9 ? "–" : fix(bowlSlope(here))} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[-4, -2, 0, 2, 4, 6]} yTicks={[0, 2, 4, 6]} xLabel="the model's setting (a weight)" yLabel="loss: how wrong it is" />
        <path className="line-muted thick" d={linePath(xs.map((x) => [x, bowl(x)]), X.f, Y.f)} />
        <path className="line-a" d={linePath(shown.filter((x) => x > -5 && x < 7).map((x) => [x, bowl(x)]), X.f, Y.f)} />
        {shown.map((x, i) =>
          x > -5 && x < 7 ? <circle key={i} className={i === shown.length - 1 ? "dot-b" : "dot-ink"} cx={X.f(x)} cy={Y.f(bowl(x))} r={i === shown.length - 1 ? 8 : 3} /> : null
        )}
        {blewUp && steps > 0 && (
          <text className="label" x={W / 2} y={36} textAnchor="middle">
            Too big a step: it overshoots and bounces away
          </text>
        )}
      </Canvas>
      <p className="sim-legend">Each step moves against the slope, by the slope times the learning rate. The curve has a shallow dip on the left: a start there can get stuck in it.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Yes or no, as a probability

/** Students: hours of revision (x) and whether they passed (c). */
function students() {
  const rand = rng(8);
  return range(40).map(() => {
    const x = rand() * 10;
    return { x, c: rand() < sigmoid(1.1 * (x - 4.6)) ? 1 : 0 };
  });
}

export function LogisticSim({ onState }) {
  const pts = useMemo(students, []);
  const best = useMemo(() => fitLogistic(pts), [pts]);
  const [w, setW] = useState(0.4);
  const [mid, setMid] = useState(6);
  const [cut, setCut] = useState(0.5);
  const b = -w * mid;
  const ps = pts.map((p) => sigmoid(w * p.x + b));
  const loss = logLoss(ps, pts.map((p) => p.c));
  const bestLoss = logLoss(pts.map((p) => sigmoid(best.w * p.x + best.b)), pts.map((p) => p.c));
  const acc = ps.filter((p, i) => (p >= cut ? 1 : 0) === pts[i].c).length / pts.length;
  useReport(onState, { loss: +loss.toFixed(3), best: +bestLoss.toFixed(3) });
  const X = frame([0, 10], [56, W - 20]);
  const Y = frame([-0.08, 1.08], [H - 40, 16]);
  const xs = range(101).map((i) => i / 10);
  return (
    <Sim
      label="Turn a score into a probability with the logistic curve"
      controls={
        <>
          <Slider label="Steepness" value={w} min={0.1} max={4} step={0.05} onChange={setW} format={(v) => v.toFixed(2)} />
          <Slider label="50/50 point (hours)" value={mid} min={0} max={10} step={0.1} onChange={setMid} format={(v) => v.toFixed(1)} />
          <Slider label="Say 'pass' above" value={cut} min={0.05} max={0.95} step={0.05} onChange={setCut} format={pct} />
          <Button
            onClick={() => {
              setW(+best.w.toFixed(2));
              setMid(+(-best.b / best.w).toFixed(1));
            }}
          >
            Best fit
          </Button>
        </>
      }
      readouts={
        <>
          <Readout label="Log loss" value={fix(loss, 3)} tone="accent" />
          <Readout label="Best possible" value={fix(bestLoss, 3)} />
          <Readout label="Right at this cut-off" value={pct(acc)} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[0, 2, 4, 6, 8, 10]} yTicks={[0, 0.5, 1]} fmtY={(v) => pct(v)} xLabel="hours of revision" yLabel="chance of passing" />
        <line className="line-ink dashed thin" x1={X.range[0]} x2={X.range[1]} y1={Y.f(cut)} y2={Y.f(cut)} />
        <path className="line-a thick" d={linePath(xs.map((x) => [x, sigmoid(w * x + b)]), X.f, Y.f)} />
        {pts.map((p, i) => (
          <circle key={i} className={p.c ? "dot-a" : "dot-b"} cx={X.f(p.x)} cy={Y.f(p.c ? 1 : 0) + (i % 3) * (p.c ? 4 : -4)} r="5" />
        ))}
      </Canvas>
      <p className="sim-legend">
        <span className="key key-a" /> passed <span className="key key-b" /> failed. The curve is the model's chance of passing; the dashed line is where it switches its answer to "pass".
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Shrink on purpose

function wiggles(seed, n) {
  const rand = rng(seed);
  return range(n).map(() => {
    const x = -1 + 2 * rand();
    return { x, y: Math.sin(2.4 * x) + 0.3 * normal(rand) };
  });
}

export function RidgeSim({ onState }) {
  const train = useMemo(() => wiggles(4, 14), []);
  const test = useMemo(() => wiggles(77, 200), []);
  const [degree, setDegree] = useState(9);
  const [logL, setLogL] = useState(-6);
  const lambda = 10 ** logL;
  const coef = useMemo(() => fitPolynomial(train, degree, lambda), [train, degree, lambda]);
  const err = (pts) => Math.sqrt(pts.reduce((s, p) => s + (p.y - polyAt(coef, p.x)) ** 2, 0) / pts.length);
  const trainErr = err(train);
  const testErr = err(test);
  const size = Math.sqrt(coef.slice(1).reduce((s, c) => s + c * c, 0));
  useReport(onState, { degree, logL, test: +testErr.toFixed(3), train: +trainErr.toFixed(3) });
  const X = frame([-1, 1], [56, W - 20]);
  const Y = frame([-2, 2], [H - 40, 16]);
  const xs = range(161).map((i) => -1 + i / 80);
  return (
    <Sim
      label="Fit a wiggly curve, then shrink it with a penalty"
      controls={
        <>
          <Slider label="Wiggliness (polynomial degree)" value={degree} min={1} max={12} onChange={setDegree} />
          <Slider label="Penalty (λ)" value={logL} min={-6} max={1} step={0.25} onChange={setLogL} format={(v) => (v <= -5.9 ? "none" : (10 ** v).toPrecision(2))} />
        </>
      }
      readouts={
        <>
          <Readout label="Error on its 14 points" value={fix(trainErr)} />
          <Readout label="Error on new points" value={fix(testErr)} tone="accent" />
          <Readout label="Size of the weights" value={size > 999 ? "huge" : fix(size, 1)} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[-1, 0, 1]} yTicks={[-2, 0, 2]} xLabel="x" yLabel="y" />
        <path className="line-muted dashed" d={linePath(xs.map((x) => [x, Math.sin(2.4 * x)]), X.f, Y.f)} />
        <path className="line-a thick" d={linePath(xs.map((x) => [x, Math.max(-2, Math.min(2, polyAt(coef, x)))]), X.f, Y.f)} />
        {train.map((p, i) => (
          <circle key={i} className="dot-b" cx={X.f(p.x)} cy={Y.f(p.y)} r="5" />
        ))}
      </Canvas>
      <p className="sim-legend">The dashed curve is the truth the points came from. Turn the degree up to 12, then raise the penalty and watch the error on new points.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Features: scale changes who your neighbour is

const PEOPLE = [
  { name: "You", income: 52000, age: 29 },
  { name: "Asha", income: 52400, age: 67 },
  { name: "Bikash", income: 58500, age: 31 },
  { name: "Chandra", income: 21000, age: 45 },
  { name: "Dipa", income: 96000, age: 38 },
  { name: "Erik", income: 30500, age: 24 },
];

export function ScaleSim({ onState }) {
  const [scaled, setScaled] = useState(false);
  const raw = PEOPLE.map((p) => [p.income, p.age]);
  const rows = scaled ? standardise(raw).rows : raw;
  const n = nearest(rows.slice(1), rows[0]) + 1;
  useReport(onState, { scaled, nearest: PEOPLE[n].name });
  const X = frame(scaled ? [-2, 2.5] : [0, 110000], [56, W - 20]);
  const Y = frame(scaled ? [-2, 2.5] : [0, 110000], [H - 40, 16]);
  return (
    <Sim
      label="Find the most similar customer, before and after scaling"
      controls={<Toggle label="Scale each column (mean 0, spread 1)" checked={scaled} onChange={setScaled} />}
      readouts={
        <>
          <Readout label="Most similar to you" value={PEOPLE[n].name} tone="accent" />
          <Readout label="Their age" value={PEOPLE[n].age} />
          <Readout label="Their income" value={`Rs ${PEOPLE[n].income.toLocaleString()}`} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes
          x={X}
          y={Y}
          xTicks={scaled ? [-2, 0, 2] : [0, 50000, 100000]}
          yTicks={scaled ? [-2, 0, 2] : [0, 50000, 100000]}
          fmtX={(v) => (scaled ? v : `${v / 1000}k`)}
          fmtY={(v) => (scaled ? v : v)}
          xLabel={scaled ? "income (scaled)" : "income (rupees)"}
          yLabel={scaled ? "age (scaled)" : "age (years, on the same axis)"}
        />
        <line className="line-a thick" x1={X.f(rows[0][0])} y1={Y.f(rows[0][1])} x2={X.f(rows[n][0])} y2={Y.f(rows[n][1])} />
        {rows.map((r, i) => (
          <g key={i}>
            <circle className={i === 0 ? "dot-b" : "dot-a"} cx={X.f(r[0])} cy={Y.f(r[1])} r={i === 0 ? 8 : 6} />
            <text className="label" x={X.f(r[0]) + (i === 0 ? -34 : 8)} y={Y.f(r[1]) + (scaled ? -10 : [22, -12, 22, -12, -12, 22][i])}>
              {PEOPLE[i].name}
            </text>
          </g>
        ))}
      </Canvas>
      <p className="sim-legend">
        Unscaled, a difference of Rs 1,000 counts as much as 1,000 years, so age barely matters and every point sits on the floor of the chart. Scaled, both columns count.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Groups nobody labelled

function shoppers() {
  const rand = rng(31);
  const centres = [
    { x: 0.25, y: 0.7 },
    { x: 0.7, y: 0.75 },
    { x: 0.55, y: 0.25 },
  ];
  return range(60).map((i) => {
    const c = centres[i % 3];
    return { x: c.x + normal(rand) * 0.07, y: c.y + normal(rand) * 0.07 };
  });
}


export function KMeansSim({ onState }) {
  const pts = useMemo(shoppers, []);
  const [k, setK] = useState(3);
  const [rounds, setRounds] = useState(0);
  const [start, setStart] = useState(2);
  const state = useMemo(() => {
    // Centres start on k shoppers picked at random (a new pick each "random start").
    const rand = rng(start * 7 + 1);
    const picks = [];
    while (picks.length < k) {
      const i = Math.floor(rand() * pts.length);
      if (!picks.includes(i)) picks.push(i);
    }
    let centres = picks.map((i) => ({ ...pts[i] }));
    let s = { label: pts.map(() => -1), centres, inertia: NaN };
    for (let r = 0; r < rounds; r++) {
      s = kmeansStep(pts, centres);
      centres = s.centres;
    }
    return s;
  }, [pts, k, rounds, start]);
  useReport(onState, { k, rounds, inertia: Number.isFinite(state.inertia) ? +state.inertia.toFixed(3) : null });
  const X = frame([0, 1], [56, W - 20]);
  const Y = frame([0, 1], [H - 40, 16]);
  const cls = ["dot-a", "dot-b", "dot-ink", "dot-a", "dot-b"];
  return (
    <Sim
      label="Group shoppers with k-means, one round at a time"
      controls={
        <>
          <Slider label="Groups (k)" value={k} min={2} max={5} onChange={(v) => { setK(v); setRounds(0); }} />
          <Button primary onClick={() => setRounds((r) => r + 1)}>One round</Button>
          <Button
            onClick={() => {
              setStart((s) => s + 1);
              setRounds(0);
            }}
          >
            New random start
          </Button>
        </>
      }
      readouts={
        <>
          <Readout label="Rounds" value={rounds} />
          <Readout label="Spread inside groups" value={Number.isFinite(state.inertia) ? fix(state.inertia) : "–"} tone="accent" />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xLabel="visits a month" yLabel="average basket" />
        {pts.map((p, i) => (
          <circle key={i} className={state.label[i] < 0 ? "dot-ink" : cls[state.label[i]]} cx={X.f(p.x)} cy={Y.f(p.y)} r="5" opacity={state.label[i] >= 3 ? 0.55 : 1} />
        ))}
        {state.centres.map((c, i) => (
          <g key={i}>
            <rect className="handle" x={X.f(c.x) - 9} y={Y.f(c.y) - 9} width="18" height="18" rx="4" />
            <text className="label" x={X.f(c.x) + 13} y={Y.f(c.y) + 4}>
              {i + 1}
            </text>
          </g>
        ))}
      </Canvas>
      <p className="sim-legend">
        Each round: every shopper joins the nearest centre (the squares), then each centre moves to the middle of its shoppers. Nobody told it what the groups are. Some starts get stuck with two centres sharing one group: try another start.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Squashing two columns into one

function heights() {
  const rand = rng(6);
  return range(60).map(() => {
    const a = normal(rand);
    const b = normal(rand) * 0.35;
    return { x: 5 + 1.6 * a - 0.5 * b, y: 5 + 1.2 * a + 0.9 * b };
  });
}

export function PcaSim({ onState }) {
  const pts = useMemo(heights, []);
  const best = useMemo(() => principalAngle(pts), [pts]);
  const [deg, setDeg] = useState(100);
  const angle = (deg * Math.PI) / 180;
  const v = varianceAlong(pts, angle);
  const bestShare = varianceAlong(pts, best).share;
  useReport(onState, { share: +v.share.toFixed(3), best: +bestShare.toFixed(3) });
  const X = frame([0, 10], [56, W - 20]);
  const Y = frame([0, 10], [H - 40, 16]);
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  return (
    <Sim
      label="Turn a line to keep as much of the spread as possible"
      controls={
        <>
          <Slider label="Direction of the line" value={deg} min={0} max={180} step={1} onChange={setDeg} format={(v) => `${v}°`} />
          <Button onClick={() => setDeg(Math.round((((best * 180) / Math.PI) % 180 + 180) % 180))}>Find the best direction</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Spread kept" value={pct(v.share)} tone="accent" />
          <Readout label="Best possible with one line" value={pct(bestShare)} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[0, 5, 10]} yTicks={[0, 5, 10]} xLabel="arm span (scaled)" yLabel="height (scaled)" />
        <line className="line-a thick" x1={X.f(mx - ux * 6)} y1={Y.f(my - uy * 6)} x2={X.f(mx + ux * 6)} y2={Y.f(my + uy * 6)} />
        {pts.map((p, i) => {
          const t = (p.x - mx) * ux + (p.y - my) * uy;
          return (
            <g key={i}>
              <line className="line-muted thin" x1={X.f(p.x)} y1={Y.f(p.y)} x2={X.f(mx + t * ux)} y2={Y.f(my + t * uy)} />
              <circle className="dot-b" cx={X.f(p.x)} cy={Y.f(p.y)} r="4" />
              <circle className="dot-a" cx={X.f(mx + t * ux)} cy={Y.f(my + t * uy)} r="3" />
            </g>
          );
        })}
      </Canvas>
      <p className="sim-legend">Each point drops onto the line; one number (where it lands) replaces two. The best line keeps the landed points as spread out as possible.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// The odd one out

function payments() {
  const rand = rng(17);
  const normalOnes = range(70).map(() => ({ amount: 1800 + normal(rand) * 400, fraud: false }));
  const odd = [5200, 4600, 300, 6100, 4300].map((amount) => ({ amount, fraud: amount !== 4300 }));
  // The odd ones turn up among the ordinary ones, not all at the end.
  const at = [9, 24, 38, 51, 63];
  const all = [...normalOnes];
  at.forEach((pos, k) => all.splice(pos, 0, odd[k]));
  return all.map((p, i) => ({ ...p, i }));
}

export function OutlierSim({ onState }) {
  const pts = useMemo(payments, []);
  const z = useMemo(() => zScores(pts.map((p) => p.amount)), [pts]);
  const [cut, setCut] = useState(3);
  const flagged = pts.filter((_, i) => Math.abs(z[i]) >= cut);
  const caught = flagged.filter((p) => p.fraud).length;
  const fraud = pts.filter((p) => p.fraud).length;
  useReport(onState, { cut, flagged: flagged.length, caught });
  const X = frame([0, pts.length], [56, W - 20]);
  const Y = frame([0, 6500], [H - 40, 16]);
  const m = pts.reduce((s, p) => s + p.amount, 0) / pts.length;
  const sd = Math.sqrt(pts.reduce((s, p) => s + (p.amount - m) ** 2, 0) / pts.length);
  return (
    <Sim
      label="Flag payments that are unusually far from normal"
      controls={<Slider label="Flag beyond (standard deviations)" value={cut} min={1} max={4} step={0.1} onChange={setCut} format={(v) => v.toFixed(1)} />}
      readouts={
        <>
          <Readout label="Flagged" value={flagged.length} />
          <Readout label="Of the 4 frauds, caught" value={`${caught} of ${fraud}`} tone="accent" />
          <Readout label="False alarms" value={flagged.length - caught} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} yTicks={[0, 2000, 4000, 6000]} xLabel="payments, in order" yLabel="amount (Rs)" />
        <rect className="region-a" x={X.range[0]} y={Y.f(Math.min(6500, m + cut * sd))} width={X.range[1] - X.range[0]} height={Math.max(0, Y.f(Math.max(0, m - cut * sd)) - Y.f(Math.min(6500, m + cut * sd)))} opacity="0.25" />
        {pts.map((p, i) => (
          <circle key={i} className={Math.abs(z[i]) >= cut ? "dot-b" : "dot-ink"} cx={X.f(i + 0.5)} cy={Y.f(p.amount)} r={p.fraud ? 7 : 4} />
        ))}
      </Canvas>
      <p className="sim-legend">The band is "normal". Big dots are the real frauds; orange ones are flagged. One large payment is honest, and the Rs 300 fraud is small enough to hide.</p>
    </Sim>
  );
}

