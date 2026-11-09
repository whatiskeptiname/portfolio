// Simulations for the "in the wild" chapter: serving, versioning, drift,
// A/B tests, retraining, fairness and recommendations.
import React, { useMemo, useState } from "react";
import { normal, range, rng } from "../math";
import { abTest, accuracyOverTime, batching, factorise, gaussianSample, groupRates, histogram, psi } from "../mlmath";
import { Axes, Button, Canvas, Readout, Sim, Slider, Toggle } from "../kit";
import { fix, frame, linePath, pct, useReport } from "../plot";

const W = 640;
const H = 320;

// ---------------------------------------------------------------------------
// Serving: batch size against waiting

const COST = { batch: 12, item: 3 }; // ms per batch, ms per request

export function ServeSim({ onState }) {
  const [batch, setBatch] = useState(4);
  const [traffic, setTraffic] = useState(60);
  const now = batching(batch, traffic, COST.item, COST.batch);
  useReport(onState, { batch, traffic, latency: Number.isFinite(now.latency) ? Math.round(now.latency) : null, capacity: Math.round(now.capacity) });
  const X = frame([1, 32], [60, W - 20]);
  const Y = frame([0, 400], [H - 40, 16]);
  const sizes = range(32).map((i) => i + 1);
  const lat = sizes.map((b) => [b, Math.min(400, batching(b, traffic, COST.item, COST.batch).latency)]);
  return (
    <Sim
      label="Pick a batch size for a model server"
      controls={
        <>
          <Slider label="Requests a second" value={traffic} min={5} max={200} step={5} onChange={setTraffic} />
          <Slider label="Batch size" value={batch} min={1} max={32} onChange={setBatch} />
        </>
      }
      readouts={
        <>
          <Readout label="Can handle" value={`${Math.round(now.capacity)}/s`} />
          <Readout label="Average wait" value={Number.isFinite(now.latency) ? `${Math.round(now.latency)} ms` : "queue grows forever"} tone="accent" />
          <Readout label="Busy" value={now.load < 1 ? pct(now.load) : "overloaded"} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[1, 8, 16, 24, 32]} yTicks={[0, 100, 200, 300, 400]} xLabel="batch size" yLabel="average wait (ms)" />
        <rect className="region-b" x={X.range[0]} y={Y.f(400)} width={X.range[1] - X.range[0]} height={Y.f(200) - Y.f(400)} opacity="0.12" />
        <text className="label" x={X.range[1] - 6} y={Y.f(390)} textAnchor="end">
          over a 200 ms budget
        </text>
        <path className="line-a thick" d={linePath(lat, X.f, Y.f)} />
        <circle className="dot-b" cx={X.f(batch)} cy={Y.f(Math.min(400, now.latency))} r="8" />
      </Canvas>
      <p className="sim-legend">Each batch costs 12 ms to start plus 3 ms per request. Small batches waste the start-up cost; big ones make requests wait for the batch to fill.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Which model was that?

export function VersionSim({ onState }) {
  const [data, setData] = useState(false);
  const [code, setCode] = useState(false);
  const [seed, setSeed] = useState(false);
  const [runs, setRuns] = useState([]);
  const [n, setN] = useState(0);
  const train = () => {
    const k = n + 1;
    setN(k);
    // Each unpinned thing moves the result a little, differently every time.
    const wobble = (on, scale, s) => (on ? 0 : (rng(k * 31 + s)() - 0.5) * scale);
    const acc = 0.87 + wobble(data, 0.04, 1) + wobble(code, 0.03, 2) + wobble(seed, 0.012, 3);
    setRuns((r) => [...r.slice(-7), { k, acc, pinned: data && code && seed }]);
  };
  const recent = runs.slice(-3).map((r) => r.acc.toFixed(4));
  const same = recent.length >= 2 && new Set(recent).size === 1;
  useReport(onState, { pinned: data && code && seed, runs: runs.length, same });
  return (
    <Sim
      label="Retrain the same model and see if you get the same model"
      controls={
        <>
          <Toggle label="Pin the data version" checked={data} onChange={setData} />
          <Toggle label="Pin the code (commit)" checked={code} onChange={setCode} />
          <Toggle label="Fix the random seed" checked={seed} onChange={setSeed} />
          <Button primary onClick={train}>Train again</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Runs" value={runs.length} />
          <Readout label="Last runs agree" value={recent.length < 2 ? "–" : same ? "exactly" : "no"} tone="accent" />
        </>
      }
    >
      <ol className="run-log">
        {runs.length === 0 && <li className="is-empty">Press "Train again" a few times.</li>}
        {runs.map((r) => (
          <li key={r.k}>
            <span>run {r.k}</span>
            <strong>{(r.acc * 100).toFixed(2)}%</strong>
            <small>{r.pinned ? "data v12 · commit 4f2a9c · seed 42" : "whatever was there at the time"}</small>
          </li>
        ))}
      </ol>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// The world moves on

export function DriftSim({ onState }) {
  const [shift, setShift] = useState(0);
  const train = useMemo(() => gaussianSample(2000, 30, 8, 5), []);
  const live = useMemo(() => gaussianSample(2000, 30 + shift, 8 + Math.abs(shift) * 0.2, 9), [shift]);
  const bins = 12;
  const ht = histogram(train, 0, 80, bins);
  const hl = histogram(live, 0, 80, bins);
  const p = psi(ht, hl);
  const acc = 0.91 - 0.0035 * shift * shift - 0.004 * Math.abs(shift);
  useReport(onState, { shift, psi: +p.toFixed(3) });
  const X = frame([0, 80], [56, W - 20]);
  const top = Math.max(...ht, ...hl);
  const Y = frame([0, top * 1.1], [H - 40, 16]);
  const bw = (X.f(80) - X.f(0)) / bins;
  return (
    <Sim
      label="Shift the live data away from the training data"
      controls={<Slider label="How far customers' ages have moved" value={shift} min={-15} max={20} step={1} onChange={setShift} format={(v) => `${v > 0 ? "+" : ""}${v} years`} />}
      readouts={
        <>
          <Readout label="Drift score (PSI)" value={fix(p)} tone="accent" />
          <Readout label="Alarm" value={p < 0.1 ? "quiet" : p < 0.25 ? "worth a look" : "drift!"} />
          <Readout label="Accuracy now (if we could check)" value={pct(Math.max(0.5, acc))} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[0, 20, 40, 60, 80]} xLabel="customer age" yLabel="customers" />
        {ht.map((c, i) => (
          <rect key={`t${i}`} className="bar-muted" x={X.f(0) + i * bw + 3} y={Y.f(c)} width={bw / 2 - 3} height={Y.f(0) - Y.f(c)} />
        ))}
        {hl.map((c, i) => (
          <rect key={`l${i}`} className={p < 0.25 ? "bar-a" : "bar-bad"} x={X.f(0) + i * bw + bw / 2} y={Y.f(c)} width={bw / 2 - 3} height={Y.f(0) - Y.f(c)} />
        ))}
      </Canvas>
      <p className="sim-legend">Grey: the ages the model was trained on. Coloured: this month's customers. The drift score compares the two without needing to know who was right.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Let the users decide

export function AbSim({ onState }) {
  const [lift, setLift] = useState(1);
  const [users, setUsers] = useState(1000);
  const [seed, setSeed] = useState(1);
  const base = 0.1;
  const result = useMemo(() => {
    const rand = rng(seed * 13 + users);
    const conv = (p) => range(users).filter(() => rand() < p).length;
    const kA = conv(base);
    const kB = conv(base + lift / 100);
    return abTest(kA, users, kB, users);
  }, [seed, users, lift]);
  const wins = useMemo(() => {
    let w = 0;
    for (let s = 0; s < 40; s++) {
      const rand = rng(1000 + s * 7 + users);
      const conv = (p) => range(users).filter(() => rand() < p).length;
      if (abTest(conv(base), users, conv(base + lift / 100), users).p < 0.05) w++;
    }
    return w / 40;
  }, [users, lift]);
  useReport(onState, { lift, users, p: +result.p.toFixed(3), power: wins });
  const X = frame([-6, 8], [60, W - 20]);
  return (
    <Sim
      label="Run an A/B test of a new recommendation model"
      controls={
        <>
          <Slider label="True improvement (percentage points)" value={lift} min={0} max={4} step={0.5} onChange={setLift} format={(v) => `${v}`} />
          <Slider label="Users in each group" value={users} min={500} max={20000} step={500} onChange={setUsers} />
          <Button primary onClick={() => setSeed((s) => s + 1)}>Run the test again</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Old model" value={pct(result.pA, 1)} />
          <Readout label="New model" value={pct(result.pB, 1)} />
          <Readout label="p-value" value={result.p < 0.001 ? "< 0.001" : fix(result.p, 3)} tone="accent" />
          <Readout label="Tests that would spot it" value={pct(wins)} />
        </>
      }
    >
      <Canvas width={W} height={150}>
        <line className="axis" x1={X.range[0]} x2={X.range[1]} y1={90} y2={90} />
        {[-6, -4, -2, 0, 2, 4, 6, 8].map((v) => (
          <text key={v} className="tick" x={X.f(v)} y={110} textAnchor="middle">
            {v}
          </text>
        ))}
        <line className="line-ink dashed thin" x1={X.f(0)} x2={X.f(0)} y1={20} y2={96} />
        <line className={result.lo > 0 ? "line-a thick" : "line-muted thick"} x1={X.f(Math.max(-6, result.lo * 100))} x2={X.f(Math.min(8, result.hi * 100))} y1={60} y2={60} />
        <circle className="dot-b" cx={X.f(Math.max(-6, Math.min(8, result.diff * 100)))} cy={60} r="7" />
        <text className="axis-label" x={X.range[1]} y={140} textAnchor="end">
          difference in sign-ups (percentage points), with its 95% range
        </text>
      </Canvas>
      <p className="sim-legend">If the range crosses zero, the test can't tell the models apart. Small real improvements need many users to show up reliably.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// When to retrain

export function RetrainSim({ onState }) {
  const [every, setEvery] = useState(0);
  const [decay, setDecay] = useState(0.15);
  const days = 180;
  const acc = accuracyOverTime(days, 0.92, decay / 100, every);
  const avg = acc.reduce((s, a) => s + a, 0) / days;
  const retrains = every ? Math.floor((days - 1) / every) : 0;
  useReport(onState, { every, avg: +avg.toFixed(3), retrains, low: +Math.min(...acc).toFixed(3) });
  const X = frame([0, days], [60, W - 20]);
  const Y = frame([0.6, 0.95], [H - 40, 16]);
  return (
    <Sim
      label="Choose how often to retrain a model that slowly goes stale"
      controls={
        <>
          <Slider label="Retrain every (days)" value={every} min={0} max={90} step={5} onChange={setEvery} format={(v) => (v === 0 ? "never" : `${v} days`)} />
          <Slider label="How fast the world changes" value={decay} min={0.05} max={0.3} step={0.01} onChange={setDecay} format={(v) => `${v.toFixed(2)} pts/day`} />
        </>
      }
      readouts={
        <>
          <Readout label="Average accuracy" value={pct(avg, 1)} tone="accent" />
          <Readout label="Retrains in 6 months" value={retrains} />
          <Readout label="Lowest point" value={pct(Math.min(...acc), 1)} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[0, 30, 60, 90, 120, 150, 180]} yTicks={[0.6, 0.7, 0.8, 0.9]} fmtY={(v) => pct(v)} xLabel="days in production" yLabel="accuracy" />
        <line className="line-bad dashed thin" x1={X.range[0]} x2={X.range[1]} y1={Y.f(0.85)} y2={Y.f(0.85)} />
        <text className="label" x={X.range[1] - 4} y={Y.f(0.85) - 6} textAnchor="end">
          the minimum the business accepts
        </text>
        <path className="line-a thick" d={linePath(acc.map((a, d) => [d, a]), X.f, Y.f)} />
      </Canvas>
      <p className="sim-legend">Every retrain resets the model to fresh data, but costs time, compute and a round of checks.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Fair for whom?

function applicants() {
  const rand = rng(12);
  const group = (shift, n, g) =>
    range(n).map(() => {
      const y = rand() < 0.5 ? 1 : 0; // will repay (1) or not
      const score = Math.min(1, Math.max(0, 0.5 + (y ? 0.18 : -0.12) + shift + normal(rand) * 0.13));
      return { y, score, g };
    });
  // Group B's scores run lower for the same outcome: its history is thinner, so the model is less sure about it.
  return [...group(0.03, 200, "A"), ...group(-0.09, 200, "B")];
}

export function FairSim({ onState }) {
  const people = useMemo(applicants, []);
  const [cut, setCut] = useState(0.5);
  const [split, setSplit] = useState(false);
  const [cutB, setCutB] = useState(0.4);
  // Approve those predicted to repay: score ≥ cut. Errors: good payers turned away (fnr), bad ones approved (fpr).
  const a = groupRates(people.filter((p) => p.g === "A"), cut);
  const b = groupRates(people.filter((p) => p.g === "B"), split ? cutB : cut);
  useReport(onState, { gap: +Math.abs(a.fnr - b.fnr).toFixed(3), split });
  const bars = [
    { label: "A: good payers refused", v: a.fnr, cls: "bar-a" },
    { label: "B: good payers refused", v: b.fnr, cls: "bar-b" },
    { label: "A: bad loans approved", v: a.fpr, cls: "bar-a" },
    { label: "B: bad loans approved", v: b.fpr, cls: "bar-b" },
  ];
  const X = frame([0, 4], [40, W - 20]);
  const Y = frame([0, 0.8], [H - 60, 16]);
  return (
    <Sim
      label="Set a loan cut-off and compare errors between two groups"
      controls={
        <>
          <Slider label={split ? "Cut-off for group A" : "Cut-off (both groups)"} value={cut} min={0.2} max={0.8} step={0.01} onChange={setCut} format={(v) => v.toFixed(2)} />
          <Toggle label="Separate cut-off for group B" checked={split} onChange={setSplit} />
          {split && <Slider label="Cut-off for group B" value={cutB} min={0.2} max={0.8} step={0.01} onChange={setCutB} format={(v) => v.toFixed(2)} />}
        </>
      }
      readouts={
        <>
          <Readout label="Gap in good payers refused" value={pct(Math.abs(a.fnr - b.fnr))} tone="accent" />
          <Readout label="Approved, A / B" value={`${pct(a.flagged)} / ${pct(b.flagged)}`} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} yTicks={[0, 0.2, 0.4, 0.6, 0.8]} fmtY={(v) => pct(v)} yLabel="share of each group" />
        {bars.map((bar, i) => (
          <g key={bar.label}>
            <rect className={bar.cls} x={X.f(i) + 14} y={Y.f(bar.v)} width={X.f(1) - X.f(0) - 28} height={Y.f(0) - Y.f(bar.v)} rx="4" />
            <text className="label" x={X.f(i + 0.5)} y={Y.f(bar.v) - 6} textAnchor="middle">
              {pct(bar.v)}
            </text>
            <foreignObject x={X.f(i)} y={H - 54} width={X.f(1) - X.f(0)} height={50}>
              <div className="reel-bar-label">{bar.label}</div>
            </foreignObject>
          </g>
        ))}
      </Canvas>
      <p className="sim-legend">Synthetic data. The model scores group B lower for the same behaviour, so one cut-off turns away far more of B's good payers.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// People who liked this also liked…

const FILMS = ["Action A", "Action B", "Action C", "Romance A", "Romance B", "Romance C"];
const VIEWERS = ["Anu", "Bijay", "Chhiring", "Deepa", "Eshan", "Firoj"];
/** Ratings (1–5): the first three viewers like action, the rest romance; blanks are unseen. */
const KNOWN = [
  [5, 4, null, 1, null, 2],
  [4, null, 5, null, 1, 1],
  [null, 5, 4, 2, 1, null],
  [1, null, 2, 5, 4, null],
  [2, 1, null, null, 5, 4],
  [null, 2, 1, 4, null, 5],
];

export function RecSim({ onState }) {
  const [who, setWho] = useState(0);
  const [tastes, setTastes] = useState(2);
  const model = useMemo(() => {
    const ratings = [];
    KNOWN.forEach((row, u) => row.forEach((r, i) => r != null && ratings.push({ u, i, r })));
    return factorise(ratings, 6, 6, tastes, { steps: 600 });
  }, [tastes]);
  const unseen = KNOWN[who].map((r, i) => (r == null ? i : -1)).filter((i) => i >= 0);
  const best = unseen.map((i) => ({ i, p: model.predict(who, i) })).sort((a, b) => b.p - a.p)[0];
  useReport(onState, { who, tastes, pick: FILMS[best.i] });
  return (
    <Sim
      label="Fill in the ratings people haven't given yet"
      controls={
        <>
          <Slider label="Viewer" value={who} min={0} max={5} onChange={setWho} format={(v) => VIEWERS[v]} />
          <Slider label="Hidden tastes (k)" value={tastes} min={1} max={3} onChange={setTastes} />
        </>
      }
      readouts={
        <>
          <Readout label={`Recommend to ${VIEWERS[who]}`} value={FILMS[best.i]} tone="accent" />
          <Readout label="Predicted rating" value={fix(best.p, 1)} />
          <Readout label="Error on known ratings" value={fix(model.rmse, 2)} />
        </>
      }
    >
      <div className="rec-wrap">
      <table className="rec-grid">
        <thead>
          <tr>
            <th />
            {FILMS.map((f) => (
              <th key={f}>{f}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {KNOWN.map((row, u) => (
            <tr key={u} className={u === who ? "is-who" : ""}>
              <th>{VIEWERS[u]}</th>
              {row.map((r, i) => {
                const p = model.predict(u, i);
                return (
                  <td key={i} className={r == null ? "is-guess" : ""} style={{ "--r": (Math.max(1, Math.min(5, r ?? p)) - 1) / 4 }}>
                    {r ?? fix(Math.max(1, Math.min(5, p)), 1)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="sim-legend">Bold numbers are real ratings; faded ones are the model's guesses, learned only from the pattern of who liked what.</p>
    </Sim>
  );
}
