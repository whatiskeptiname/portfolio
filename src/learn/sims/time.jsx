// Simulations for the forecasting chapter.
import React, { useMemo, useState } from "react";
import {
  acf,
  arma,
  difference,
  growRegTree,
  holtWinters,
  leastSquares,
  mae,
  mape,
  mase,
  mean,
  normal,
  pacf,
  range,
  rmse,
  rng,
  rolling,
  ses,
  smape,
  solveSPD,
  sum,
  variance,
} from "../math";
import { Axes, Button, Canvas, Choice, Readout, Sim, Slider, Toggle } from "../kit";
import { bandPath, fix, frame, linePath, pct, useReport } from "../plot";

/** Monthly sales of a seasonal product: trend, a yearly season and noise. */
function salesSeries(n = 96, seed = 4) {
  const rand = rng(seed);
  return range(n).map((t) => 100 + 0.6 * t + 18 * Math.sin((2 * Math.PI * (t - 2)) / 12) + normal(rand) * 5);
}

const extent = (xs) => {
  const v = xs.filter((x) => x != null && Number.isFinite(x));
  return [Math.min(...v), Math.max(...v)];
};
const padded = ([lo, hi], k = 0.08) => [lo - (hi - lo) * k, hi + (hi - lo) * k || 1];

// ---------------------------------------------------------------------------
// The parts of a series

export function ComponentsSim({ onState }) {
  const [trend, setTrend] = useState(0.5);
  const [season, setSeason] = useState(15);
  const [cycle, setCycle] = useState(0);
  const [noise, setNoise] = useState(4);
  const n = 96;
  const parts = useMemo(() => {
    const rand = rng(2);
    const e = range(n).map(() => normal(rand));
    return {
      trend: range(n).map((t) => trend * t),
      season: range(n).map((t) => season * Math.sin((2 * Math.PI * t) / 12)),
      cycle: range(n).map((t) => cycle * Math.sin((2 * Math.PI * t) / 41 + 1)),
      noise: e.map((x) => x * noise),
    };
  }, [trend, season, cycle, noise]);
  const total = range(n).map((t) => 100 + parts.trend[t] + parts.season[t] + parts.cycle[t] + parts.noise[t]);
  const shares = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, variance(v)]));
  const all = sum(Object.values(shares)) || 1;
  useReport(onState, { trend, season, cycle, noise, seasonShare: shares.season / all });
  const X = frame([0, n - 1], [40, 620]);
  const Y = frame(padded(extent(total)), [150, 12]);
  const strips = [
    ["trend", "Trend", "line-a"],
    ["season", "Season (12 months)", "line-b"],
    ["cycle", "Cycle (about 3½ years)", "line-ink"],
    ["noise", "Noise", "line-muted"],
  ];
  return (
    <Sim
      label="Build a monthly series out of its parts"
      controls={
        <>
          <Slider label="Trend (per month)" value={trend} min={-1} max={1.5} step={0.1} onChange={setTrend} />
          <Slider label="Season size" value={season} min={0} max={30} onChange={setSeason} />
          <Slider label="Business cycle size" value={cycle} min={0} max={25} onChange={setCycle} />
          <Slider label="Noise" value={noise} min={0} max={15} onChange={setNoise} />
        </>
      }
      readouts={
        <>
          {strips.map(([k, label]) => (
            <Readout key={k} label={`${label.split(" (")[0]}'s share of the wiggle`} value={pct(shares[k] / all)} />
          ))}
        </>
      }
    >
      <Canvas width={640} height={378}>
        <Axes x={X} y={Y} xTicks={[0, 24, 48, 72, 95]} fmtX={(v) => `month ${v + 1}`} />
        <path className="line-ink thick" d={linePath(total.map((v, t) => [t, v]), X.f, Y.f)} />
        {strips.map(([k, label, cls], i) => {
          // Each part gets its own strip: the name on top, its curve underneath, clear of the next name.
          const top = 190 + i * 48;
          const [lo, hi] = extent(parts[k]);
          const S = frame(hi - lo < 1e-9 ? [lo - 1, hi + 1] : [lo, hi], [top + 40, top + 16]);
          return (
            <g key={k}>
              <text className="note" x={40} y={top + 6}>
                {label}
              </text>
              <path className={cls} d={linePath(parts[k].map((v, t) => [t, v]), X.f, S.f)} />
            </g>
          );
        })}
      </Canvas>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Stationarity

const SERIES = {
  price: () => {
    const rand = rng(31);
    let p = 100;
    return range(120).map(() => (p *= Math.exp(0.008 + 0.045 * normal(rand))));
  },
  sales: () => {
    const rand = rng(32);
    return range(120).map((t) => (60 + 0.9 * t) * (1 + 0.22 * Math.sin((2 * Math.PI * t) / 12)) * (1 + 0.03 * normal(rand)));
  },
  noise: () => arma(120, 0.3, 0, 33).map((x) => 20 + x * 3),
};

export function StationaritySim({ onState }) {
  const [kind, setKind] = useState("price");
  const [log, setLog] = useState(false);
  const [diff, setDiff] = useState(false);
  const [sdiff, setSdiff] = useState(false);
  const raw = useMemo(() => SERIES[kind](), [kind]);
  let xs = log ? raw.map(Math.log) : raw;
  if (sdiff) xs = difference(xs, 12);
  if (diff) xs = difference(xs, 1);
  const half = Math.floor(xs.length / 2);
  const a = xs.slice(0, half);
  const b = xs.slice(half);
  const sd = Math.sqrt(variance(xs)) || 1;
  const meanShift = Math.abs(mean(b) - mean(a)) / sd;
  const spreadRatio = Math.sqrt(variance(b) / (variance(a) || 1e-9));
  // A season shows up as a strong correlation 12 months apart.
  const memory = acf(xs, 12);
  const seasonal = xs.length > 30 && memory[12] > 0.45;
  // A value that's almost the same as last month's, every month, is a random walk: it wanders off.
  const wanders = memory[1] > 0.9;
  const stationary = meanShift < 0.5 && spreadRatio > 0.67 && spreadRatio < 1.5 && !seasonal && !wanders;
  useReport(onState, { kind, log, diff, sdiff, stationary });
  const offset = raw.length - xs.length;
  const m = rolling(xs, 12, mean);
  const s = rolling(xs, 12, (w) => Math.sqrt(variance(w)));
  const X = frame([0, raw.length - 1], [46, 620]);
  const Y = frame(padded(extent(xs)), [260, 14]);
  const idx = range(xs.length).filter((i) => m[i] != null);
  return (
    <Sim
      label="Transform a series until its average and spread stop drifting"
      controls={
        <>
          <Choice label="Series" options={[["price", "Share price"], ["sales", "Monthly sales"], ["noise", "Temperature anomaly"]]} value={kind} onChange={setKind} />
          <Toggle label="Take the log" checked={log} onChange={setLog} />
          <Toggle label="Change from last month" checked={diff} onChange={setDiff} />
          <Toggle label="Change from same month last year" checked={sdiff} onChange={setSdiff} />
        </>
      }
      readouts={
        <>
          <Readout label="Average drift (second half vs first)" value={`${fix(meanShift, 2)} sd`} tone={meanShift >= 0.5 ? "bad" : undefined} />
          <Readout label="Spread ratio (second half / first)" value={`× ${fix(spreadRatio, 2)}`} tone={spreadRatio <= 0.67 || spreadRatio >= 1.5 ? "bad" : undefined} />
          <Readout label="Wanders like a random walk" value={wanders ? "yes" : "no"} tone={wanders ? "bad" : undefined} />
          <Readout label="Repeats every 12 months" value={seasonal ? "yes" : "no"} tone={seasonal ? "bad" : undefined} />
          <Readout label="Rough verdict" value={stationary ? "looks stationary" : "not stationary"} tone={stationary ? "accent" : "bad"} />
        </>
      }
    >
      <Canvas width={640} height={290}>
        <Axes x={X} y={Y} yTicks={[]} />
        <path className="area-a" d={bandPath(idx.map((i) => i + offset), idx.map((i) => m[i] - s[i]), idx.map((i) => m[i] + s[i]), X.f, Y.f)} />
        <path className="line-ink thin" d={linePath(xs.map((v, i) => [i + offset, v]), X.f, Y.f)} />
        <path className="line-a thick" d={linePath(idx.map((i) => [i + offset, m[i]]), X.f, Y.f)} />
      </Canvas>
      <p className="sim-legend">
        <span className="key key-a" /> the 12-month rolling average, with a band one rolling standard deviation wide. Stationary means both stay put.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Memory: ACF and PACF

function Bars({ values, X, Y, cls, from = 1 }) {
  return values.map((v, i) => <rect key={i} className={cls} x={X.f(i + from) - 4} y={Math.min(Y.f(v), Y.f(0))} width={8} height={Math.abs(Y.f(v) - Y.f(0))} rx="2" />);
}

export function ACFSim({ onState }) {
  const [phi, setPhi] = useState(0.7);
  const [theta, setTheta] = useState(0);
  const xs = useMemo(() => arma(400, phi, theta, 21), [phi, theta]);
  const r = acf(xs, 20).slice(1);
  const p = pacf(xs, 20);
  const band = 1.96 / Math.sqrt(xs.length);
  useReport(onState, { phi, theta });
  const TX = frame([0, 119], [40, 620]);
  const TY = frame(padded(extent(xs.slice(0, 120))), [96, 10]);
  const AX = frame([0.5, 20.5], [40, 320]);
  const PX = frame([0.5, 20.5], [350, 630]);
  const BY = frame([-1, 1], [290, 140]);
  return (
    <Sim
      label="Set how much each value remembers, and read the memory off the two bar charts"
      controls={
        <>
          <Slider label="φ: how much of last month carries over" value={phi} min={-0.9} max={0.9} step={0.1} onChange={setPhi} format={(v) => v.toFixed(1)} />
          <Slider label="θ: how much of last month's surprise carries over" value={theta} min={-0.9} max={0.9} step={0.1} onChange={setTheta} format={(v) => v.toFixed(1)} />
        </>
      }
      readouts={
        <>
          <Readout label="ACF at lag 1" value={fix(r[0])} />
          <Readout label="ACF at lag 3" value={fix(r[2])} />
          <Readout label="PACF at lag 1" value={fix(p[0])} />
          <Readout label="PACF at lag 2" value={fix(p[1])} />
        </>
      }
    >
      <Canvas width={640} height={310}>
        <path className="line-ink thin" d={linePath(xs.slice(0, 120).map((v, i) => [i, v]), TX.f, TY.f)} />
        <text className="note" x={40} y={128}>
          ACF: correlation with k months ago
        </text>
        <text className="note" x={350} y={128}>
          PACF: the same, net of shorter lags
        </text>
        {[AX, PX].map((AXIS, j) => (
          <g key={j}>
            <rect className="area-muted" x={AXIS.range[0]} y={BY.f(band)} width={AXIS.range[1] - AXIS.range[0]} height={BY.f(-band) - BY.f(band)} />
            <line className="axis" x1={AXIS.range[0]} x2={AXIS.range[1]} y1={BY.f(0)} y2={BY.f(0)} />
            {[1, 5, 10, 15, 20].map((t) => (
              <text key={t} className="tick" x={AXIS.f(t)} y={BY.range[0] + 14} textAnchor="middle">
                {t}
              </text>
            ))}
          </g>
        ))}
        <Bars values={r} X={AX} Y={BY} cls="bar-a" />
        <Bars values={p} X={PX} Y={BY} cls="bar-b" />
      </Canvas>
      <p className="sim-legend">Bars inside the grey band are indistinguishable from zero.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Classical forecasters

const HOLD = 12;

function classical(method, train, { window, alpha }) {
  const n = train.length;
  if (method === "naive") return range(HOLD).map(() => train[n - 1]);
  if (method === "snaive") return range(HOLD).map((h) => train[n - 12 + (h % 12)]);
  if (method === "ma") return range(HOLD).map(() => mean(train.slice(n - window)));
  if (method === "ses") return range(HOLD).map(() => ses(train, alpha).level);
  return holtWinters(train, 12, alpha, 0.05, 0.3, HOLD).forecast;
}

export function ForecastSim({ onState }) {
  const series = useMemo(() => salesSeries(), []);
  const train = series.slice(0, -HOLD);
  const test = series.slice(-HOLD);
  const [method, setMethod] = useState("naive");
  const [window, setWindow] = useState(6);
  const [alpha, setAlpha] = useState(0.3);
  const f = classical(method, train, { window, alpha });
  const err = mae(test, f);
  const base = mae(test, classical("snaive", train, {}));
  useReport(onState, { method, mae: err, snaive: base });
  const start = series.length - 48;
  const X = frame([start, series.length - 1], [46, 620]);
  const Y = frame(padded(extent([...series.slice(start), ...f])), [260, 14]);
  return (
    <Sim
      label="Forecast the last 12 months with each classical method and compare"
      controls={
        <>
          <Choice
            label="Method"
            options={[
              ["naive", "Last value"],
              ["snaive", "Same month last year"],
              ["ma", "Moving average"],
              ["ses", "Exp. smoothing"],
              ["hw", "Holt–Winters"],
            ]}
            value={method}
            onChange={setMethod}
          />
          {method === "ma" && <Slider label="Average over (months)" value={window} min={2} max={24} onChange={setWindow} />}
          {(method === "ses" || method === "hw") && <Slider label="α: weight on the newest month" value={alpha} min={0.05} max={1} step={0.05} onChange={setAlpha} format={(v) => v.toFixed(2)} />}
        </>
      }
      readouts={
        <>
          <Readout label="Average miss (MAE)" value={fix(err, 1)} tone="accent" />
          <Readout label="'Same month last year' misses by" value={fix(base, 1)} />
          <Readout label="Compared with that" value={err < base ? `${pct(1 - err / base)} better` : `${pct(err / base - 1)} worse`} tone={err < base ? undefined : "bad"} />
        </>
      }
    >
      <Canvas width={640} height={290}>
        <Axes x={X} y={Y} yTicks={[]} xTicks={[start, series.length - HOLD]} fmtX={(v) => (v === start ? "4 years ago" : "forecast starts")} />
        <rect className="area-muted" x={X.f(series.length - HOLD - 0.5)} y={Y.range[1]} width={X.range[1] - X.f(series.length - HOLD - 0.5)} height={Y.range[0] - Y.range[1]} />
        <path className="line-ink" d={linePath(series.slice(start).map((v, i) => [start + i, v]), X.f, Y.f)} />
        <path className="line-b thick" d={linePath([[series.length - HOLD - 1, train[train.length - 1]], ...f.map((v, h) => [series.length - HOLD + h, v])], X.f, Y.f)} />
      </Canvas>
      <p className="sim-legend">
        <span className="key" style={{ background: "var(--text)" }} /> what happened <span className="key key-b" /> the forecast. The shaded months were hidden from the method.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// ARIMA intuition: how forecast uncertainty grows

export function FanSim({ onState }) {
  // Starts on the random walk, whose range never stops widening, so the task needs a real change.
  const [model, setModel] = useState("rw");
  const [phi, setPhi] = useState(0.7);
  const sigma = 1;
  const hist = useMemo(() => {
    const rand = rng(9);
    let x = 0;
    return range(80).map(() => {
      const e = normal(rand) * sigma;
      x = model === "ar" ? phi * x + e : model === "rw" ? x + e : x + 0.25 + e;
      return x;
    });
  }, [model, phi]);
  const H = 40;
  const last = hist[hist.length - 1];
  const fc = range(H).map((h0) => {
    const h = h0 + 1;
    if (model === "ar") return { m: last * phi ** h, sd: sigma * Math.sqrt((1 - phi ** (2 * h)) / (1 - phi * phi)) };
    if (model === "rw") return { m: last, sd: sigma * Math.sqrt(h) };
    return { m: last + 0.25 * h, sd: sigma * Math.sqrt(h) };
  });
  const widthAt = (h) => 2 * 1.96 * fc[h - 1].sd;
  useReport(onState, { model, phi, ratio: widthAt(40) / widthAt(12) });
  const all = [...hist, ...fc.map((f) => f.m + 2 * f.sd), ...fc.map((f) => f.m - 2 * f.sd)];
  const X = frame([0, 80 + H], [40, 620]);
  const Y = frame(padded(extent(all)), [270, 14]);
  const xs = fc.map((_, i) => 80 + i);
  return (
    <Sim
      label="Pick a model and watch how its uncertainty grows with the forecast horizon"
      controls={
        <>
          <Choice label="Model" options={[["ar", "AR(1): pulled back to the average"], ["rw", "Random walk"], ["drift", "Random walk with drift"]]} value={model} onChange={setModel} />
          {model === "ar" && <Slider label="φ: how strongly it remembers" value={phi} min={0} max={0.98} step={0.02} onChange={setPhi} format={(v) => v.toFixed(2)} />}
        </>
      }
      readouts={
        <>
          <Readout label="95% range, 1 step ahead" value={`± ${fix(widthAt(1) / 2, 1)}`} />
          <Readout label="12 steps ahead" value={`± ${fix(widthAt(12) / 2, 1)}`} />
          <Readout label="40 steps ahead" value={`± ${fix(widthAt(40) / 2, 1)}`} tone="accent" />
        </>
      }
    >
      <Canvas width={640} height={290}>
        <Axes x={X} y={Y} yTicks={[]} />
        <path className="area-b" d={bandPath(xs, fc.map((f) => f.m - 1.96 * f.sd), fc.map((f) => f.m + 1.96 * f.sd), X.f, Y.f)} />
        <path className="area-b" d={bandPath(xs, fc.map((f) => f.m - 1.28 * f.sd), fc.map((f) => f.m + 1.28 * f.sd), X.f, Y.f)} />
        <path className="line-ink" d={linePath(hist.map((v, i) => [i, v]), X.f, Y.f)} />
        <path className="line-b thick" d={linePath([[79, last], ...fc.map((f, i) => [80 + i, f.m])], X.f, Y.f)} />
      </Canvas>
      <p className="sim-legend">
        <span className="key key-b" /> forecast, with 80% and 95% ranges
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Machine learning for forecasting: lag features, and why trees can't extrapolate

const LAGS = [1, 12];

function mlForecast(kind, train, horizon) {
  const n = train.length;
  if (kind === "linear" || kind === "tree") {
    const rows = [];
    const ys = [];
    for (let t = 12; t < n; t++) {
      rows.push(LAGS.map((l) => train[t - l]));
      ys.push(train[t]);
    }
    const predict =
      kind === "tree"
        ? growRegTree(rows, ys, 5, 4)
        : (() => {
            const w = leastSquares(rows.map((r) => [1, ...r]), ys);
            return (r) => w[0] + r[0] * w[1] + r[1] * w[2];
          })();
    const hist = [...train];
    return range(horizon).map(() => {
      const v = predict(LAGS.map((l) => hist[hist.length - l]));
      hist.push(v);
      return v;
    });
  }
  // A tree on changes: predict how much this month beats the same month last
  // year, from recent such changes, then add that to last year's value.
  const d = difference(train, 12);
  const rows = [];
  const ys = [];
  for (let t = 12; t < d.length; t++) {
    rows.push(LAGS.map((l) => d[t - l]));
    ys.push(d[t]);
  }
  const predict = growRegTree(rows, ys, 2, 6);
  const dh = [...d];
  const hist = [...train];
  return range(horizon).map(() => {
    const change = predict(LAGS.map((l) => dh[dh.length - l]));
    dh.push(change);
    const v = hist[hist.length - 12] + change;
    hist.push(v);
    return v;
  });
}

export function MLForecastSim({ onState }) {
  const series = useMemo(() => salesSeries(132, 6), []);
  const horizon = 36;
  const train = series.slice(0, -horizon);
  const test = series.slice(-horizon);
  const [kind, setKind] = useState("tree");
  const f = useMemo(() => mlForecast(kind, train, horizon), [kind, train]);
  const err = mae(test, f);
  const ceiling = Math.max(...train);
  useReport(onState, { kind, mae: err, aboveCeiling: Math.max(...f) > ceiling + 1 });
  const X = frame([60, series.length - 1], [46, 620]);
  const Y = frame(padded(extent([...series.slice(60), ...f])), [260, 14]);
  return (
    <Sim
      label="Forecast three years ahead with lag features and three different models"
      controls={<Choice label="Model" options={[["tree", "Tree on the values"], ["diff", "Tree on yearly changes"], ["linear", "Linear regression"]]} value={kind} onChange={setKind} />}
      readouts={
        <>
          <Readout label="Average miss over 3 years" value={fix(err, 1)} tone="accent" />
          <Readout label="Highest value in training" value={fix(ceiling, 0)} />
          <Readout label="Highest value forecast" value={fix(Math.max(...f), 0)} tone={Math.max(...f) <= ceiling + 1 ? "bad" : undefined} />
        </>
      }
    >
      <Canvas width={640} height={290}>
        <Axes x={X} y={Y} yTicks={[]} />
        <line className="line-bad dashed thin" x1={X.range[0]} x2={X.range[1]} y1={Y.f(ceiling)} y2={Y.f(ceiling)} />
        <text className="note" x={X.range[0] + 4} y={Y.f(ceiling) - 6}>
          highest value the model saw in training
        </text>
        <rect className="area-muted" x={X.f(series.length - horizon - 0.5)} y={Y.range[1]} width={X.range[1] - X.f(series.length - horizon - 0.5)} height={Y.range[0] - Y.range[1]} />
        <path className="line-ink" d={linePath(series.slice(60).map((v, i) => [60 + i, v]), X.f, Y.f)} />
        <path className="line-b thick" d={linePath(f.map((v, h) => [series.length - horizon + h, v]), X.f, Y.f)} />
      </Canvas>
      <p className="sim-legend">
        Each model sees two features: last month's value and the value 12 months ago. <span className="key key-b" /> forecast
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Testing a forecaster honestly

export function BacktestSim({ onState }) {
  const [shuffled, setShuffled] = useState(false);
  const blocks = 24;
  const folds = useMemo(() => {
    if (!shuffled) return range(4).map((k) => ({ train: range(12 + k * 3), test: range(3).map((j) => 12 + k * 3 + j) }));
    const rand = rng(5);
    const order = range(blocks).sort(() => rand() - 0.5);
    return range(4).map((k) => {
      const test = order.slice(k * 6, k * 6 + 6);
      return { train: range(blocks).filter((b) => !test.includes(b)), test };
    });
  }, [shuffled]);
  const leaks = sum(folds.map((f) => f.train.filter((b) => b > Math.min(...f.test)).length));
  useReport(onState, { shuffled, leaks });
  return (
    <Sim
      label="Which months each fold trains on and is tested on"
      controls={<Toggle label="Shuffle the months, like ordinary k-fold" checked={shuffled} onChange={setShuffled} />}
      readouts={<Readout label="Training months that come after a test month" value={leaks} tone={leaks ? "bad" : "accent"} />}
    >
      <div className="folds" aria-hidden="true">
        {folds.map((f, k) => (
          <div key={k} className="fold-row fold-row-time" style={{ gridTemplateColumns: `56px repeat(${blocks}, 1fr)` }}>
            <span className="fold-name">fold {k + 1}</span>
            {range(blocks).map((b) => {
              const isTest = f.test.includes(b);
              const isTrain = f.train.includes(b);
              const late = isTrain && b > Math.min(...f.test);
              return <span key={b} className={`fold-cell ${isTest ? "is-test" : isTrain ? "is-train" : "is-unused"}${late ? " is-leak" : ""}`} />;
            })}
          </div>
        ))}
      </div>
      <p className="sim-legend">
        <span className="key key-a" /> train <span className="key key-b" /> test, one square per month, oldest on the left. {leaks ? "Red outlines are months from the future used for training." : "Every test month comes after all its training months."}
      </p>
    </Sim>
  );
}

export function MetricsSim({ onState }) {
  const [low, setLow] = useState(40);
  const actual = [80, 95, 110, 120, 130, low, 125, 115, 100, 90, 85, 88];
  const errors = [6, -5, 8, -7, 4, 6, -6, 5, -4, 6, -5, 4];
  const forecast = actual.map((a, i) => a + errors[i]);
  const train = salesSeries(48, 9).map((v) => v - 40);
  const m = {
    mae: mae(actual, forecast),
    rmse: rmse(actual, forecast),
    mape: mape(actual, forecast),
    smape: smape(actual, forecast),
    wmape: (100 * sum(actual.map((a, i) => Math.abs(a - forecast[i])))) / sum(actual.map(Math.abs)),
    mase: mase(actual, forecast, train, 12),
  };
  useReport(onState, { low, mape: m.mape });
  const X = frame([-0.5, 11.5], [46, 620]);
  const Y = frame([0, 145], [250, 14]);
  return (
    <Sim
      label="The same forecast errors, scored by six metrics"
      controls={<Slider label="Sales in the quietest month" value={low} min={1} max={120} onChange={setLow} />}
      readouts={
        <>
          <Readout label="MAE" value={fix(m.mae, 1)} />
          <Readout label="RMSE" value={fix(m.rmse, 1)} />
          <Readout label="MAPE" value={`${fix(m.mape, 1)}%`} tone={m.mape > 20 ? "bad" : "accent"} />
          <Readout label="sMAPE" value={`${fix(m.smape, 1)}%`} />
          <Readout label="WMAPE" value={`${fix(m.wmape, 1)}%`} />
          <Readout label="MASE" value={fix(m.mase, 2)} />
        </>
      }
    >
      <Canvas width={640} height={280}>
        <Axes x={X} y={Y} yTicks={[0, 50, 100]} xTicks={[0, 3, 6, 9]} fmtX={(v) => ["Jan", "Apr", "Jul", "Oct"][v / 3]} />
        {actual.map((a, i) => (
          <g key={i}>
            <rect className="bar-muted" x={X.f(i) - 14} y={Y.f(a)} width={13} height={Y.f(0) - Y.f(a)} rx="2" />
            <rect className="bar-b" x={X.f(i) + 1} y={Y.f(forecast[i])} width={13} height={Y.f(0) - Y.f(forecast[i])} rx="2" />
          </g>
        ))}
      </Canvas>
      <p className="sim-legend">
        <span className="key" style={{ background: "var(--muted)" }} /> actual <span className="key key-b" /> forecast. Every month is off by 4 to 8 units, whatever its size.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Forecasts that add up

const LEAVES = ["Store A", "Store B", "Store C", "Store D"];
const ACTUAL = [120, 80, 64, 36];
// Base forecasts made separately for every level: total, two regions, four stores.
const BASE = { total: 318, north: 196, south: 92, leaves: [111, 91, 58, 30] };
const SHARES = [0.39, 0.27, 0.21, 0.13]; // each store's usual share of the total

function reconcile(method) {
  const b = BASE;
  if (method === "base") return { total: b.total, north: b.north, south: b.south, leaves: b.leaves };
  let leaves;
  if (method === "bottom") leaves = b.leaves;
  else if (method === "top") leaves = SHARES.map((s) => s * b.total);
  else {
    // Least-squares reconciliation: the coherent set of numbers closest to all seven forecasts.
    const S = [
      [1, 1, 1, 1],
      [1, 1, 0, 0],
      [0, 0, 1, 1],
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    const yhat = [b.total, b.north, b.south, ...b.leaves];
    const StS = range(4).map((i) => range(4).map((j) => sum(S.map((r) => r[i] * r[j]))));
    const Sty = range(4).map((i) => sum(S.map((r, k) => r[i] * yhat[k])));
    leaves = solveSPD(StS, Sty);
  }
  return { total: sum(leaves), north: leaves[0] + leaves[1], south: leaves[2] + leaves[3], leaves };
}

export function HierarchySim({ onState }) {
  const [method, setMethod] = useState("base");
  const r = reconcile(method);
  const truth = { total: sum(ACTUAL), north: ACTUAL[0] + ACTUAL[1], south: ACTUAL[2] + ACTUAL[3], leaves: ACTUAL };
  const all = (o) => [o.total, o.north, o.south, ...o.leaves];
  const err = mean(all(r).map((v, i) => Math.abs(v - all(truth)[i])));
  const gap = Math.abs(r.total - (r.north + r.south)) + Math.abs(r.north - r.leaves[0] - r.leaves[1]) + Math.abs(r.south - r.leaves[2] - r.leaves[3]);
  useReport(onState, { method, coherent: gap < 0.5, err });
  const node = (x, y, label, v, t) => (
    <g transform={`translate(${x - 62},${y - 24})`}>
      <rect className="node" width="124" height="48" rx="10" />
      <text className="note" x="10" y="17">
        {label}
      </text>
      <text className="label" x="10" y="37">
        {fix(v, 0)}
      </text>
      <text className="note" x="114" y="37" textAnchor="end">
        real {t}
      </text>
    </g>
  );
  const pos = { total: [320, 34], north: [170, 124], south: [470, 124], leaves: [[95, 224], [245, 224], [395, 224], [545, 224]] };
  return (
    <Sim
      label="Seven forecasts for one business: the total, two regions and four stores"
      controls={<Choice label="Method" options={[["base", "Forecast each separately"], ["bottom", "Bottom-up"], ["top", "Top-down"], ["ols", "Reconcile all (least squares)"]]} value={method} onChange={setMethod} />}
      readouts={
        <>
          <Readout label="Do the numbers add up?" value={gap < 0.5 ? "yes" : `no: off by ${fix(gap, 0)}`} tone={gap < 0.5 ? "accent" : "bad"} />
          <Readout label="Average miss across all seven" value={fix(err, 1)} />
        </>
      }
    >
      <Canvas width={640} height={260}>
        {[
          [pos.total, pos.north],
          [pos.total, pos.south],
          [pos.north, pos.leaves[0]],
          [pos.north, pos.leaves[1]],
          [pos.south, pos.leaves[2]],
          [pos.south, pos.leaves[3]],
        ].map(([a, b], i) => (
          <line key={i} className="edge" x1={a[0]} y1={a[1] + 24} x2={b[0]} y2={b[1] - 24} />
        ))}
        {node(...pos.total, "Total", r.total, truth.total)}
        {node(...pos.north, "North", r.north, truth.north)}
        {node(...pos.south, "South", r.south, truth.south)}
        {pos.leaves.map((p, i) => <g key={i}>{node(...p, LEAVES[i], r.leaves[i], ACTUAL[i])}</g>)}
      </Canvas>
    </Sim>
  );
}
