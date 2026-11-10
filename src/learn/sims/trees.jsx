// Simulations for the trees and ensembles chapter.
import React, { useMemo, useState } from "react";
import {
  accuracy,
  bestSplit,
  boost,
  bootstrapCoverage,
  confusion,
  countClasses,
  crowdRight,
  gini,
  growTree,
  mean,
  moons,
  normal,
  range,
  rates,
  rmse,
  rng,
  roc,
} from "../math";
import { Axes, Button, Canvas, Choice, Readout, Sim, Slider, Toggle } from "../kit";
import { fix, frame, linePath, pct, useDrag, useLoop, useReport } from "../plot";

// ---------------------------------------------------------------------------
// One question: where to split

/** Gym members: months since joining (x) and support calls last month (y); c = 1 cancelled. */
function members() {
  const rand = rng(13);
  return range(44).map(() => {
    const months = 1 + rand() * 46;
    const calls = Math.min(8, Math.max(0, Math.round(normal(rand) * 1.6 + 3)));
    const risk = 1 / (1 + Math.exp(0.22 * (months - 14) - 0.8 * (calls - 3.5)));
    return { x: months, y: calls + (rand() - 0.5) * 0.5, c: rand() < risk ? 1 : 0 };
  });
}

export function SplitSim({ onState }) {
  const pts = useMemo(members, []);
  const [axis, setAxis] = useState("x");
  const [at, setAt] = useState({ x: 30, y: 6 });
  const W = 640;
  const H = 320;
  const X = frame([0, 48], [56, W - 20]);
  const Y = frame([-0.5, 8.5], [H - 40, 16]);
  const [svg, drag] = useDrag((p) => setAt((a) => ({ ...a, [axis]: axis === "x" ? Math.max(0, Math.min(48, X.f.invert(p.x))) : Math.max(-0.5, Math.min(8.5, Y.f.invert(p.y))) })));
  const v = at[axis];
  const left = pts.filter((p) => p[axis] < v);
  const right = pts.filter((p) => p[axis] >= v);
  const gl = gini(countClasses(left));
  const gr = gini(countClasses(right));
  const weighted = (left.length * gl + right.length * gr) / pts.length;
  const parent = gini(countClasses(pts));
  const best = useMemo(() => bestSplit(pts), [pts]);
  const bestOnAxis = useMemo(() => {
    const only = bestSplit(pts.map((p) => ({ ...p, [axis === "x" ? "y" : "x"]: 0 })));
    return only;
  }, [pts, axis]);
  useReport(onState, { weighted: +weighted.toFixed(3), best: +best.score.toFixed(3), axis });

  const sideLabel = axis === "x" ? ["joined recently", "members for longer"] : ["few calls", "many calls"];
  // Each side is tinted by its majority (amber: most cancelled; teal: most
  // stayed), more strongly the less mixed it is.
  const tint = (group) => {
    const share = group.length ? countClasses(group)[1] / group.length : 0.5;
    return { className: share >= 0.5 ? "region-b" : "region-a", opacity: 0.06 + Math.abs(share - 0.5) * 0.6 };
  };
  const lowSide = tint(left);
  const highSide = tint(right);
  return (
    <Sim
      label="Drag the line to split the gym members into two groups"
      controls={
        <>
          <Choice label="Split on" options={[["x", "Months as a member"], ["y", "Support calls"]]} value={axis} onChange={setAxis} />
          <Button onClick={() => bestOnAxis && setAt((a) => ({ ...a, [axis]: bestOnAxis.at }))}>Find the best line</Button>
        </>
      }
      readouts={
        <>
          <Readout label={`Mix, ${sideLabel[0]}`} value={`${fix(gl)} (${left.length})`} />
          <Readout label={`Mix, ${sideLabel[1]}`} value={`${fix(gr)} (${right.length})`} />
          <Readout label="Mix after the split" value={fix(weighted)} tone="accent" />
          <Readout label="Gain" value={fix(parent - weighted)} />
        </>
      }
    >
      <Canvas width={W} height={H} ref={svg} {...drag} className="draggable">
        <Axes x={X} y={Y} xTicks={[0, 12, 24, 36, 48]} yTicks={[0, 2, 4, 6, 8]} xLabel="months as a member" yLabel="support calls" />
        {axis === "x" ? (
          <>
            <rect {...lowSide} x={X.range[0]} y={Y.range[1]} width={Math.max(0, X.f(v) - X.range[0])} height={Y.range[0] - Y.range[1]} />
            <rect {...highSide} x={X.f(v)} y={Y.range[1]} width={Math.max(0, X.range[1] - X.f(v))} height={Y.range[0] - Y.range[1]} />
            <line className="split" x1={X.f(v)} x2={X.f(v)} y1={Y.range[1]} y2={Y.range[0]} />
            <rect className="handle" x={X.f(v) - 7} y={(Y.range[0] + Y.range[1]) / 2 - 18} width="14" height="36" rx="7" />
          </>
        ) : (
          <>
            <rect {...lowSide} x={X.range[0]} y={Y.f(v)} width={X.range[1] - X.range[0]} height={Math.max(0, Y.range[0] - Y.f(v))} />
            <rect {...highSide} x={X.range[0]} y={Y.range[1]} width={X.range[1] - X.range[0]} height={Math.max(0, Y.f(v) - Y.range[1])} />
            <line className="split" x1={X.range[0]} x2={X.range[1]} y1={Y.f(v)} y2={Y.f(v)} />
            <rect className="handle" x={(X.range[0] + X.range[1]) / 2 - 18} y={Y.f(v) - 7} width="36" height="14" rx="7" />
          </>
        )}
        {pts.map((p, i) => (
          <circle key={i} className={p.c ? "dot-b" : "dot-a"} cx={X.f(p.x)} cy={Y.f(p.y)} r="6" />
        ))}
      </Canvas>
      <p className="sim-legend">
        <span className="key key-b" /> cancelled <span className="key key-a" /> stayed. Each side is tinted by its majority; the stronger the tint, the less mixed it is.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Depth: from too simple to memorising

export function DepthSim({ onState }) {
  const [depth, setDepth] = useState(2);
  const [noise, setNoise] = useState(true);
  const train = useMemo(() => moons(120, noise ? 0.13 : 0.05, 5), [noise]);
  const test = useMemo(() => moons(400, noise ? 0.13 : 0.05, 99), [noise]);
  const curve = useMemo(
    () =>
      range(12).map((i) => {
        const t = growTree(train, i + 1);
        return { d: i + 1, train: accuracy(train, t.predict), test: accuracy(test, t.predict) };
      }),
    [train, test]
  );
  const tree = useMemo(() => growTree(train, depth), [train, depth]);
  const now = curve[depth - 1];
  const bestTest = Math.max(...curve.map((c) => c.test));
  useReport(onState, { depth, noise, test: now.test, bestTest, gap: +(now.train - now.test).toFixed(3) });

  const W = 640;
  const H = 300;
  const X = frame([0, 1], [10, 330]);
  const Y = frame([0, 1], [290, 10]);
  const cells = 36;
  const grid = [];
  for (let i = 0; i < cells; i++)
    for (let j = 0; j < cells; j++) {
      const x = (i + 0.5) / cells;
      const y = (j + 0.5) / cells;
      grid.push({ i, j, c: tree.predict(x, y) });
    }
  const cw = (X.range[1] - X.range[0]) / cells;
  const ch = (Y.range[0] - Y.range[1]) / cells;
  const CX = frame([1, 12], [400, 620]);
  const CY = frame([0.5, 1], [260, 20]);
  return (
    <Sim
      label="Grow the tree deeper and watch training and test accuracy"
      controls={
        <>
          <Slider label="Depth (questions in a row)" value={depth} min={1} max={12} onChange={setDepth} />
          <Toggle label="Noisy data" checked={noise} onChange={setNoise} />
        </>
      }
      readouts={
        <>
          <Readout label="Right on training data" value={pct(now.train)} />
          <Readout label="Right on new data" value={pct(now.test)} tone="accent" />
          <Readout label="Gap" value={pct(now.train - now.test)} tone={now.train - now.test > 0.08 ? "bad" : undefined} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        {grid.map((g) => (
          <rect key={`${g.i}-${g.j}`} className={g.c ? "region-b" : "region-a"} x={X.range[0] + g.i * cw} y={Y.range[0] - (g.j + 1) * ch} width={cw + 0.5} height={ch + 0.5} opacity="0.28" />
        ))}
        {train.map((p, i) => (
          <circle key={i} className={p.c ? "dot-b" : "dot-a"} cx={X.f(p.x)} cy={Y.f(p.y)} r="3.6" />
        ))}
        <Axes x={CX} y={CY} xTicks={[1, 4, 8, 12]} yTicks={[0.5, 0.75, 1]} fmtY={(v) => pct(v)} xLabel="depth" />
        <path className="line-muted" d={linePath(curve.map((c) => [c.d, c.train]), CX.f, CY.f)} />
        <path className="line-a" d={linePath(curve.map((c) => [c.d, c.test]), CX.f, CY.f)} />
        <circle className="dot-ink" cx={CX.f(depth)} cy={CY.f(now.test)} r="5" />
        <text className="note" x={CX.f(12)} y={CY.f(curve[11].train) - 8} textAnchor="end">
          training
        </text>
        <text className="note note-a" x={CX.f(12)} y={CY.f(curve[11].test) + 16} textAnchor="end">
          new data
        </text>
      </Canvas>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// The accuracy trap

function scored(rare) {
  const rand = rng(rare ? 21 : 22);
  const n = 400;
  const share = rare ? 0.06 : 0.5;
  return range(n).map(() => {
    const c = rand() < share ? 1 : 0;
    const z = normal(rand) * 1.1 + (c ? 1.4 : -0.6);
    return { score: 1 / (1 + Math.exp(-z)), c };
  });
}

export function ThresholdSim({ onState }) {
  const [rare, setRare] = useState(true);
  const [threshold, setThreshold] = useState(0.5);
  const items = useMemo(() => scored(rare), [rare]);
  const m = confusion(items, threshold);
  const r = rates(m);
  const { curve, auc } = useMemo(() => roc(items), [items]);
  useReport(onState, { recall: +r.recall.toFixed(3), precision: +r.precision.toFixed(3), threshold, rare });

  const W = 640;
  const H = 300;
  const X = frame([0, 1], [20, 380]);
  const bins = 25;
  const hist = [0, 1].map((c) => range(bins).map((b) => items.filter((it) => it.c === c && Math.min(bins - 1, Math.floor(it.score * bins)) === b).length));
  // Each class on its own scale, so the rare one is still visible.
  const maxCount = hist.map((counts) => Math.max(...counts, 1));
  const bw = (X.range[1] - X.range[0]) / bins;
  const RX = frame([0, 1], [436, 632]);
  const RY = frame([0, 1], [200, 20]);
  return (
    <Sim
      label="Move the threshold and watch the four kinds of answer"
      controls={
        <>
          <Slider label="Flag when the score is at least" value={threshold} min={0} max={1} step={0.01} onChange={setThreshold} format={(v) => v.toFixed(2)} />
          <Toggle label="Fraud is rare (6% of cases)" checked={rare} onChange={setRare} />
        </>
      }
      readouts={
        <>
          <Readout label="Accuracy" value={pct(r.accuracy)} />
          <Readout label="Precision" value={pct(r.precision)} />
          <Readout label="Recall" value={pct(r.recall)} tone="accent" />
          <Readout label="F1" value={fix(r.f1)} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        {hist.map((counts, c) =>
          counts.map((n, b) => {
            const h = (n / maxCount[c]) * 110;
            return c === 0 ? (
              <rect key={`a${b}`} className="bar-a" x={X.range[0] + b * bw + 1} y={130 - h} width={bw - 2} height={h} />
            ) : (
              <rect key={`b${b}`} className="bar-b" x={X.range[0] + b * bw + 1} y={140} width={bw - 2} height={h} />
            );
          })
        )}
        <text className="note" x={X.range[0]} y={22}>
          honest payments
        </text>
        <text className="note" x={X.range[0]} y={270}>
          fraud (scaled up to fit)
        </text>
        <line className="split" x1={X.f(threshold)} x2={X.f(threshold)} y1={10} y2={280} />
        <text className="note" x={X.f(threshold) + 6} y={292}>
          flagged →
        </text>
        <g className="cm" transform="translate(432,204)">
          {[
            ["caught", m.tp, "good"],
            ["false alarm", m.fp, "bad"],
            ["missed", m.fn, "bad"],
            ["cleared", m.tn, "good"],
          ].map(([label, n, tone], i) => (
            <g key={label} transform={`translate(${(i % 2) * 104},${Math.floor(i / 2) * 50})`}>
              {/* The count on top and its name underneath, so neither crowds the other on a phone. */}
              <rect className={`cm-cell tone-${tone}`} width="100" height="46" rx="6" />
              <text className="cm-n" x="8" y="20">
                {n}
              </text>
              <text className="cm-label" x="8" y="38">
                {label}
              </text>
            </g>
          ))}
        </g>
        <rect className="frame-line" x={RX.range[0]} y={RY.range[1]} width={RX.range[1] - RX.range[0]} height={RY.range[0] - RY.range[1]} />
        <path className="line-muted dashed" d={`M${RX.f(0)},${RY.f(0)}L${RX.f(1)},${RY.f(1)}`} />
        <path className="line-a" d={linePath(curve.map((p) => [p.fpr, p.tpr]), RX.f, RY.f)} />
        <circle className="dot-ink" cx={RX.f(r.fpr)} cy={RY.f(r.recall)} r="5" />
        <text className="note" x={RX.range[0]} y={14}>
          ROC curve, area {fix(auc)}
        </text>
      </Canvas>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// The crowd

export function CrowdSim({ onState }) {
  const [trees, setTrees] = useState(1);
  const [copying, setCopying] = useState(0);
  const [seed, setSeed] = useState(1);
  const p = 0.6;
  const rho = copying / 100;
  const acc = crowdRight(trees, p, rho);
  const votes = useMemo(() => {
    const rand = rng(seed * 997 + trees);
    const shared = rand() < p;
    return range(trees).map(() => (rand() < rho ? shared : rand() < p));
  }, [trees, rho, seed]);
  const yes = votes.filter(Boolean).length;
  useReport(onState, { trees, copying, acc: +acc.toFixed(3) });
  return (
    <Sim
      label="Add trees to the vote and change how alike they are"
      controls={
        <>
          <Slider label="Trees voting" value={trees} min={1} max={101} step={2} onChange={setTrees} />
          <Slider label="How much the trees copy each other" value={copying} min={0} max={100} step={5} onChange={setCopying} format={(v) => `${v}%`} />
          <Button onClick={() => setSeed((s) => s + 1)}>Ask a new customer</Button>
        </>
      }
      readouts={
        <>
          <Readout label="One tree is right" value="60%" />
          <Readout label="The vote is right" value={pct(acc)} tone="accent" />
          <Readout label="This time" value={`${yes} right, ${trees - yes} wrong`} />
        </>
      }
    >
      <div className="voters" aria-hidden="true">
        {votes.map((ok, i) => (
          <span key={i} className={`voter ${ok ? "is-right" : "is-wrong"}`} style={{ animationDelay: `${Math.min(i, 40) * 12}ms` }} />
        ))}
      </div>
      <div className="meter" aria-hidden="true">
        <div className="meter-fill" style={{ width: pct(acc) }} />
        <div className="meter-mark" style={{ left: "60%" }} />
      </div>
    </Sim>
  );
}

export function BootstrapSim() {
  const [draw, setDraw] = useState(1);
  const n = 20;
  const picks = useMemo(() => {
    const rand = rng(draw * 31);
    return range(n).map(() => Math.floor(rand() * n));
  }, [draw]);
  const counts = range(n).map((i) => picks.filter((p) => p === i).length);
  const inBag = counts.filter((c) => c > 0).length;
  return (
    <Sim
      label="Draw a bootstrap sample of 20 rows from 20"
      controls={<Button onClick={() => setDraw((d) => d + 1)}>Draw another sample</Button>}
      readouts={
        <>
          <Readout label="Rows picked at least once" value={`${inBag} of ${n}`} tone="accent" />
          <Readout label="Left out (out-of-bag)" value={n - inBag} />
          <Readout label="On average, for big data" value={pct(bootstrapCoverage(1e6), 1)} />
        </>
      }
    >
      <div className="rows">
        {counts.map((c, i) => (
          <div key={`${draw}-${i}`} className={`row-chip${c ? "" : " is-out"}`}>
            <span>row {i + 1}</span>
            <span className="row-count">{c ? `×${c}` : "left out"}</span>
          </div>
        ))}
      </div>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Boosting

function wavy() {
  const rand = rng(8);
  const xs = range(60).map(() => rand());
  const ys = xs.map((x) => Math.sin(5 * x) + 0.6 * x + normal(rand) * 0.22);
  const tx = range(200).map(() => rand());
  const ty = tx.map((x) => Math.sin(5 * x) + 0.6 * x + normal(rand) * 0.22);
  return { xs, ys, tx, ty };
}

export function BoostSim({ onState }) {
  const data = useMemo(wavy, []);
  const [rounds, setRounds] = useState(1);
  const [rate, setRate] = useState(0.3);
  const [playing, setPlaying] = useState(false);
  const acc = React.useRef(0);
  const ref = useLoop((dt) => {
    acc.current += dt;
    if (acc.current > 0.12) {
      acc.current = 0;
      setRounds((r) => {
        if (r >= 150) {
          setPlaying(false);
          return r;
        }
        return r + 1;
      });
    }
  }, playing);
  const model = useMemo(() => boost(data.xs, data.ys, rounds, rate), [data, rounds, rate]);
  const prev = useMemo(() => boost(data.xs, data.ys, Math.max(0, rounds - 1), rate), [data, rounds, rate]);
  const trainErr = rmse(data.ys, data.xs.map(model.predict));
  const testErr = rmse(data.ty, data.tx.map(model.predict));
  useReport(onState, { rounds, rate, trainErr: +trainErr.toFixed(3), testErr: +testErr.toFixed(3) });

  const W = 640;
  const H = 300;
  const X = frame([0, 1], [40, W - 16]);
  const Y = frame([-1.4, 2], [H - 30, 14]);
  const grid = range(161).map((i) => i / 160);
  return (
    <Sim
      label="Add small trees one at a time, each fixing what the others got wrong"
      controls={
        <>
          <Slider label="Trees so far" value={rounds} min={0} max={150} onChange={(v) => setRounds(v)} />
          <Choice label="Learning rate" options={[[0.05, "0.05"], [0.3, "0.3"], [1, "1"]]} value={rate} onChange={setRate} />
          <Button primary onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Error on training points" value={fix(trainErr)} />
          <Readout label="Error on new points" value={fix(testErr)} tone="accent" />
        </>
      }
    >
      <div ref={ref}>
        <Canvas width={W} height={H}>
          <Axes x={X} y={Y} yTicks={[-1, 0, 1, 2]} />
          {data.xs.map((x, i) => (
            <line key={`r${i}`} className="residual" x1={X.f(x)} x2={X.f(x)} y1={Y.f(data.ys[i])} y2={Y.f(prev.predict(x))} />
          ))}
          {data.xs.map((x, i) => (
            <circle key={i} className="dot-a" cx={X.f(x)} cy={Y.f(data.ys[i])} r="4" />
          ))}
          <path className="line-b thick" d={linePath(grid.map((x) => [x, model.predict(x)]), X.f, Y.f)} />
        </Canvas>
      </div>
      <p className="sim-legend">
        <span className="key key-a" /> data <span className="key key-b" /> the model so far. The thin lines are what the next tree tries to fix.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Honest testing: leakage and searching for settings

/**
 * Picks the 10 "best" features out of 400 pure-noise ones, either using every
 * row (leaky) or only the training rows of each fold (honest), then scores a
 * nearest-centroid classifier with 5-fold cross-validation.
 */
function leakExperiment(leaky, seed) {
  const rand = rng(seed);
  const n = 60;
  const f = 400;
  const X = range(n).map(() => range(f).map(() => normal(rand)));
  const y = range(n).map((i) => i % 2);
  const pick = (rows) => {
    const scores = range(f).map((j) => {
      const m1 = mean(rows.filter((r) => y[r] === 1).map((r) => X[r][j]));
      const m0 = mean(rows.filter((r) => y[r] === 0).map((r) => X[r][j]));
      return { j, s: Math.abs(m1 - m0) };
    });
    return scores.sort((a, b) => b.s - a.s).slice(0, 10).map((s) => s.j);
  };
  const all = range(n);
  const leakyPick = pick(all);
  let right = 0;
  for (let k = 0; k < 5; k++) {
    const testRows = all.filter((r) => r % 5 === k);
    const trainRows = all.filter((r) => r % 5 !== k);
    const feats = leaky ? leakyPick : pick(trainRows);
    const centroid = (c) => feats.map((j) => mean(trainRows.filter((r) => y[r] === c).map((r) => X[r][j])));
    const c0 = centroid(0);
    const c1 = centroid(1);
    for (const r of testRows) {
      const d = (c) => feats.reduce((s, j, i) => s + (X[r][j] - c[i]) ** 2, 0);
      if ((d(c1) < d(c0) ? 1 : 0) === y[r]) right++;
    }
  }
  return right / n;
}

export function LeakSim({ onState }) {
  const [leaky, setLeaky] = useState(true);
  const [seed, setSeed] = useState(3);
  const score = useMemo(() => leakExperiment(leaky, seed), [leaky, seed]);
  useReport(onState, { leaky, score });
  const folds = range(5);
  return (
    <Sim
      label="Cross-validation with and without a leak"
      controls={
        <>
          <Toggle label="Choose features using all the rows first (the leak)" checked={leaky} onChange={setLeaky} />
          <Button onClick={() => setSeed((s) => s + 1)}>New random data</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Cross-validated accuracy" value={pct(score)} tone={leaky && score > 0.6 ? "bad" : "accent"} />
          <Readout label="Truth (the data is pure noise)" value="50%" />
        </>
      }
    >
      <div className="folds" aria-hidden="true">
        {folds.map((k) => (
          <div key={k} className="fold-row">
            <span className="fold-name">fold {k + 1}</span>
            {folds.map((j) => (
              <span key={j} className={`fold-cell ${j === k ? "is-test" : "is-train"}${leaky && j === k ? " is-leak" : ""}`} />
            ))}
          </div>
        ))}
      </div>
      <p className="sim-legend">
        <span className="key key-a" /> train <span className="key key-b" /> check. {leaky ? "The features were picked while looking at the check rows too." : "Each fold picks its features from its own training rows only."}
      </p>
    </Sim>
  );
}

/** A made-up validation score over two settings, where only one of them really matters. */
const landscape = (a, b) => 0.7 + 0.18 * Math.exp(-((a - 0.62) ** 2) / 0.012) - 0.03 * (b - 0.5) ** 2;

export function SearchSim({ onState }) {
  const [how, setHow] = useState("grid");
  const [seed, setSeed] = useState(1);
  const trials = useMemo(() => {
    const rand = rng(seed * 13 + how.length);
    if (how === "grid") return [0.15, 0.5, 0.85].flatMap((a) => [0.15, 0.5, 0.85].map((b) => ({ a, b })));
    if (how === "random") return range(9).map(() => ({ a: rand(), b: rand() }));
    // Guided: a few random tries, then each new try near the best so far.
    const out = range(3).map(() => ({ a: rand(), b: rand() }));
    while (out.length < 9) {
      const best = out.reduce((x, y) => (landscape(y.a, y.b) > landscape(x.a, x.b) ? y : x));
      const spread = 0.25 / (out.length - 1);
      out.push({ a: Math.min(1, Math.max(0, best.a + normal(rand) * spread)), b: Math.min(1, Math.max(0, best.b + normal(rand) * 0.2)) });
    }
    return out;
  }, [how, seed]);
  const best = Math.max(...trials.map((t) => landscape(t.a, t.b)));
  useReport(onState, { how, best });
  const N = 40;
  const S = 260;
  const cells = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) cells.push({ i, j, v: landscape((i + 0.5) / N, (j + 0.5) / N) });
  return (
    <Sim
      label="Nine tries to find the best settings"
      controls={
        <>
          <Choice label="Search" options={[["grid", "Grid"], ["random", "Random"], ["guided", "Guided"]]} value={how} onChange={setHow} />
          <Button onClick={() => setSeed((s) => s + 1)}>Try again</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Best score found" value={pct(best, 1)} tone="accent" />
          <Readout label="Best possible" value={pct(0.88, 1)} />
        </>
      }
    >
      <Canvas width={640} height={300}>
        <g transform="translate(190,16)">
          {cells.map((c) => (
            <rect key={`${c.i}-${c.j}`} x={(c.i * S) / N} y={S - ((c.j + 1) * S) / N} width={S / N + 0.5} height={S / N + 0.5} className="heat" opacity={Math.max(0, (c.v - 0.66) / 0.22)} />
          ))}
          {trials.map((t, i) => (
            <g key={i}>
              <circle className="trial" cx={t.a * S} cy={S - t.b * S} r="7" />
              <text className="trial-n" x={t.a * S} y={S - t.b * S + 3.5} textAnchor="middle">
                {i + 1}
              </text>
            </g>
          ))}
          <rect className="frame-line" width={S} height={S} />
          <text className="note" x={S / 2} y={S + 18} textAnchor="middle">
            learning rate (matters a lot)
          </text>
          <text className="note" x={-10} y={S / 2} textAnchor="middle" transform={`rotate(-90 -10 ${S / 2})`}>
            min leaf size (barely matters)
          </text>
        </g>
      </Canvas>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Why did it say that?

const BASE = -1.05; // log-odds of the average customer cancelling (about 26%)
const FEATURES = [
  { id: "contract", label: "Contract", options: [["monthly", "Month to month", 0.75], ["year", "One year", -0.55], ["two", "Two years", -1.2]], avg: 0.05 },
  { id: "months", label: "Months as a customer", min: 1, max: 72, coef: -0.03, avg: 32 },
  { id: "calls", label: "Support calls last month", min: 0, max: 8, coef: 0.28, avg: 2 },
  { id: "autopay", label: "Pays automatically", coef: -0.45, avg: 0.45 },
];

const logistic = (z) => 1 / (1 + Math.exp(-z));

export function ShapSim({ onState }) {
  const [v, setV] = useState({ contract: "monthly", months: 4, calls: 3, autopay: false });
  const contributions = FEATURES.map((f) => {
    if (f.options) return { f, c: f.options.find((o) => o[0] === v.contract)[2] - f.avg };
    if (f.id === "autopay") return { f, c: f.coef * ((v.autopay ? 1 : 0) - f.avg) };
    return { f, c: f.coef * (v[f.id] - f.avg) };
  });
  const z = BASE + contributions.reduce((s, x) => s + x.c, 0);
  const risk = logistic(z);
  useReport(onState, { risk: +risk.toFixed(3) });
  // Lay the pushes end to end, in probability terms, starting from the average.
  let at = BASE;
  const steps = contributions.map(({ f, c }) => {
    const from = logistic(at);
    at += c;
    return { f, from, to: logistic(at), c };
  });
  const X = frame([0, 1], [24, 616]);
  return (
    <Sim
      label="Change one customer's details and see each one push the prediction"
      controls={
        <>
          <Choice label="Contract" options={FEATURES[0].options.map(([k, t]) => [k, t])} value={v.contract} onChange={(c) => setV({ ...v, contract: c })} />
          <Slider label="Months as a customer" value={v.months} min={1} max={72} onChange={(m) => setV({ ...v, months: m })} />
          <Slider label="Support calls last month" value={v.calls} min={0} max={8} onChange={(c) => setV({ ...v, calls: c })} />
          <Toggle label="Pays automatically" checked={v.autopay} onChange={(a) => setV({ ...v, autopay: a })} />
        </>
      }
      readouts={
        <>
          <Readout label="Average customer" value={pct(logistic(BASE))} />
          <Readout label="This customer" value={pct(risk)} tone="accent" />
        </>
      }
    >
      <Canvas width={640} height={230}>
        <line className="axis" x1={X.f(0)} x2={X.f(1)} y1={204} y2={204} />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text key={t} className="tick" x={X.f(t)} y={220} textAnchor="middle">
            {pct(t)}
          </text>
        ))}
        <line className="line-muted dashed" x1={X.f(logistic(BASE))} x2={X.f(logistic(BASE))} y1={8} y2={204} />
        {steps.map((s, i) => {
          const x0 = X.f(Math.min(s.from, s.to));
          const w = Math.max(2, Math.abs(X.f(s.to) - X.f(s.from)));
          const up = s.to > s.from;
          // Labels sit past the end the bar grows towards, unless that would run off the chart.
          const after = up ? x0 + w < 380 : x0 < 240;
          return (
            <g key={s.f.id} transform={`translate(0,${14 + i * 46})`}>
              <rect className={up ? "push-up" : "push-down"} x={x0} y={0} width={w} height={22} rx="4" />
              <text className="push-label" x={up === after ? x0 + w + 8 : x0 - 8} y={15} textAnchor={up === after ? "start" : "end"}>
                {s.f.label} {up ? "+" : "−"}
                {Math.abs((s.to - s.from) * 100).toFixed(0)} pts
              </text>
            </g>
          );
        })}
        <line className="split" x1={X.f(risk)} x2={X.f(risk)} y1={8} y2={204} />
      </Canvas>
      <p className="sim-legend">
        <span className="key key-up" /> pushes towards cancelling <span className="key key-down" /> pushes towards staying. The dashed line is the average customer.
      </p>
    </Sim>
  );
}
