// Simulations for the neural networks chapter: one neuron, layers, activations,
// a traced layer, backprop, normalisation, training a deep network, and memory
// in recurrent networks.
import React, { useMemo, useState } from "react";
import { range, rng } from "../math";
import { ACTIVATIONS, gradientThrough, memoryLeft, spreadThroughLayers, TRACE, traceLayer, traceWorking, trainMlp, xorPoints } from "../mlmath";
import { Axes, Button, Canvas, Choice, Readout, Sim, Slider, Toggle } from "../kit";
import { fix, frame, linePath, pct, useReport } from "../plot";

const W = 640;
const H = 320;

// ---------------------------------------------------------------------------
// One neuron

/** Two exam scores (scaled −1…1) and whether the student was admitted: a straight line separates them. */
function admissions() {
  const rand = rng(14);
  return range(50).map(() => {
    const x = rand() * 2 - 1;
    const y = rand() * 2 - 1;
    return { x, y, c: 0.9 * x + 0.6 * y + 0.1 > 0 ? 1 : 0 };
  });
}

export function NeuronSim({ onState }) {
  const [data, setData] = useState("line");
  const pts = useMemo(() => (data === "line" ? admissions() : xorPoints(50, 9)), [data]);
  const [w1, setW1] = useState(0.2);
  const [w2, setW2] = useState(1);
  const [b, setB] = useState(0);
  const fires = (p) => w1 * p.x + w2 * p.y + b > 0;
  const acc = pts.filter((p) => (fires(p) ? 1 : 0) === p.c).length / pts.length;
  useReport(onState, { data, acc: +acc.toFixed(3) });
  const X = frame([-1, 1], [56, W - 20]);
  const Y = frame([-1, 1], [H - 40, 16]);
  // The boundary w1·x + w2·y + b = 0, clipped to the chart.
  const line = Math.abs(w2) > 1e-3 ? [[-1, -(w1 * -1 + b) / w2], [1, -(w1 * 1 + b) / w2]] : [[-b / (w1 || 1e-3), -1], [-b / (w1 || 1e-3), 1]];
  const cells = 24;
  return (
    <Sim
      label="Set a neuron's weights to separate two classes with a line"
      controls={
        <>
          <Choice label="Data" options={[["line", "Separable"], ["xor", "Opposite corners (XOR)"]]} value={data} onChange={setData} />
          <Slider label="Weight on score 1" value={w1} min={-2} max={2} step={0.05} onChange={setW1} format={(v) => v.toFixed(2)} />
          <Slider label="Weight on score 2" value={w2} min={-2} max={2} step={0.05} onChange={setW2} format={(v) => v.toFixed(2)} />
          <Slider label="Bias" value={b} min={-1.5} max={1.5} step={0.05} onChange={setB} format={(v) => v.toFixed(2)} />
        </>
      }
      readouts={<Readout label="Right" value={pct(acc)} tone="accent" />}
    >
      <Canvas width={W} height={H}>
        {range(cells).map((i) =>
          range(cells).map((j) => {
            const x = -1 + (2 * (i + 0.5)) / cells;
            const y = -1 + (2 * (j + 0.5)) / cells;
            const on = w1 * x + w2 * y + b > 0;
            return <rect key={`${i}-${j}`} className={on ? "region-a" : "region-b"} x={X.f(-1 + (2 * i) / cells)} y={Y.f(-1 + (2 * (j + 1)) / cells)} width={(X.range[1] - X.range[0]) / cells + 0.5} height={(Y.range[0] - Y.range[1]) / cells + 0.5} opacity="0.18" />;
          })
        )}
        <Axes x={X} y={Y} xTicks={[-1, 0, 1]} yTicks={[-1, 0, 1]} xLabel="input 1" yLabel="input 2" />
        <path className="line-ink thick" d={linePath(line.map(([x, y]) => [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]), X.f, Y.f)} />
        {pts.map((p, i) => (
          <circle key={i} className={p.c ? "dot-a" : "dot-b"} cx={X.f(p.x)} cy={Y.f(p.y)} r="5" />
        ))}
      </Canvas>
      <p className="sim-legend">
        The neuron fires (teal side) when input 1 × weight + input 2 × weight + bias is above zero, so its boundary is always one straight line. Try the XOR data: no line gets much past 75%.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Layers that bend the line

export function LayersSim({ onState }) {
  const pts = useMemo(() => xorPoints(80, 4), []);
  const [hidden, setHidden] = useState(0);
  const [trained, setTrained] = useState(false);
  const net = useMemo(() => (trained ? (hidden === 0 ? trainMlp(pts, 4, { activation: "linear", steps: 500 }) : trainMlp(pts, hidden, { steps: 1500, rate: 1, seed: 2 })) : null), [pts, hidden, trained]);
  useReport(onState, { hidden, acc: net ? +net.accuracy.toFixed(3) : null });
  const X = frame([-1, 1], [40, 360]);
  const Y = frame([-1, 1], [H - 30, 10]);
  const cells = 30;
  const L = frame([0, 1500], [440, W - 16]);
  const LY = frame([0, 0.75], [H - 40, 20]);
  return (
    <Sim
      label="Add hidden neurons and train the network on data no line can split"
      controls={
        <>
          <Slider label="Hidden neurons" value={hidden} min={0} max={8} onChange={(v) => { setHidden(v); setTrained(false); }} format={(v) => (v === 0 ? "none (one straight line)" : v)} />
          <Button primary onClick={() => setTrained(true)}>Train</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Right after training" value={net ? pct(net.accuracy) : "–"} tone="accent" />
          <Readout label="Loss" value={net ? fix(net.loss, 3) : "–"} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        {net &&
          range(cells).map((i) =>
            range(cells).map((j) => {
              const x = -1 + (2 * (i + 0.5)) / cells;
              const y = -1 + (2 * (j + 0.5)) / cells;
              const p = net.predict(x, y);
              return <rect key={`${i}-${j}`} className={p >= 0.5 ? "region-a" : "region-b"} x={X.f(-1 + (2 * i) / cells)} y={Y.f(-1 + (2 * (j + 1)) / cells)} width={(X.range[1] - X.range[0]) / cells + 0.5} height={(Y.range[0] - Y.range[1]) / cells + 0.5} opacity={0.08 + Math.abs(p - 0.5) * 0.5} />;
            })
          )}
        {pts.map((p, i) => (
          <circle key={i} className={p.c ? "dot-a" : "dot-b"} cx={X.f(p.x)} cy={Y.f(p.y)} r="4.5" />
        ))}
        <Axes x={L} y={LY} xTicks={[0, 750, 1500]} yTicks={[0, 0.25, 0.5, 0.75]} xLabel="training steps" yLabel="loss" />
        {net && <path className="line-a thick" d={linePath(net.history.map((h) => [h.step * (1500 / Math.max(1, net.history.at(-1).step)), Math.min(0.75, h.loss)]), L.f, LY.f)} />}
      </Canvas>
      <p className="sim-legend">Left: what the trained network says everywhere (teal: class A). Right: its loss as it trains. With no hidden layer it can only draw one line; a few hidden neurons, each drawing its own line and bending it, can carve out the corners.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Backpropagation on the smallest network there is

export function BackpropSim({ onState }) {
  const x = 1;
  const target = 0.8;
  const [w, setW] = useState({ w1: -0.5, w2: 0.3 });
  const [steps, setSteps] = useState(0);
  const h = Math.tanh(w.w1 * x);
  const out = w.w2 * h;
  const loss = 0.5 * (out - target) ** 2;
  const dOut = out - target;
  const gw2 = dOut * h;
  const dh = dOut * w.w2;
  const gw1 = dh * (1 - h * h) * x;
  useReport(onState, { loss: +loss.toFixed(5), steps });
  const step = () => {
    setW((v) => ({ w1: v.w1 - 0.5 * gw1, w2: v.w2 - 0.5 * gw2 }));
    setSteps((s) => s + 1);
  };
  return (
    <Sim
      label="Pass the blame backwards through a two-weight network"
      controls={
        <>
          <Slider label="Weight 1" value={w.w1} min={-2} max={2} step={0.01} onChange={(v) => setW((o) => ({ ...o, w1: v }))} format={(v) => v.toFixed(2)} />
          <Slider label="Weight 2" value={w.w2} min={-2} max={2} step={0.01} onChange={(v) => setW((o) => ({ ...o, w2: v }))} format={(v) => v.toFixed(2)} />
          <Button primary onClick={step}>One step of backprop</Button>
          <Button onClick={() => { setW({ w1: -0.5, w2: 0.3 }); setSteps(0); }}>Reset</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Output (want 0.80)" value={fix(out)} />
          <Readout label="Loss" value={fix(loss, 4)} tone="accent" />
          <Readout label="Steps" value={steps} />
        </>
      }
    >
      <div className="bp-chain">
        <div className="bp-node">
          <small>input</small>
          <strong>{fix(x)}</strong>
        </div>
        <div className="bp-edge">
          <span>× w1 = {fix(w.w1)}</span>
          <em>blame: {fix(gw1, 3)}</em>
        </div>
        <div className="bp-node">
          <small>hidden, tanh</small>
          <strong>{fix(h)}</strong>
        </div>
        <div className="bp-edge">
          <span>× w2 = {fix(w.w2)}</span>
          <em>blame: {fix(gw2, 3)}</em>
        </div>
        <div className="bp-node">
          <small>output</small>
          <strong>{fix(out)}</strong>
        </div>
        <div className="bp-edge is-loss">
          <span>vs 0.80</span>
          <em>error {fix(dOut, 3)}</em>
        </div>
      </div>
      <p className="sim-legend">
        Forward (top numbers): input → hidden → output. Backward (blame): the error at the output is passed back along each weight by the chain rule. Each step moves every weight against its blame.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Training a big network: optimiser, dropout, early stopping

export function TrainingSim({ onState }) {
  const [opt, setOpt] = useState("sgd");
  const [dropout, setDropout] = useState(false);
  const [early, setEarly] = useState(false);
  const E = 60;
  const k = opt === "adam" ? 0.16 : 0.05;
  const floor = dropout ? 0.12 : 0.03;
  const train = (e) => floor + (1 - floor) * Math.exp(-k * e);
  const over = (e) => (dropout ? 0.0012 : 0.006) * Math.max(0, e - (opt === "adam" ? 12 : 30)) ** 1.25;
  const val = (e) => train(e) + 0.08 + over(e);
  const vals = range(E + 1).map(val);
  const best = vals.indexOf(Math.min(...vals));
  const stopAt = early ? Math.min(E, best + 5) : E;
  const kept = early ? best : E;
  useReport(onState, { opt, dropout, early, final: +vals[kept].toFixed(3) });
  const X = frame([0, E], [56, W - 20]);
  const Y = frame([0, 1], [H - 40, 16]);
  return (
    <Sim
      label="Train a deep network and watch for overfitting"
      controls={
        <>
          <Choice label="Optimiser" options={[["sgd", "Plain SGD"], ["adam", "Adam"]]} value={opt} onChange={setOpt} />
          <Toggle label="Dropout" checked={dropout} onChange={setDropout} />
          <Toggle label="Early stopping" checked={early} onChange={setEarly} />
        </>
      }
      readouts={
        <>
          <Readout label="Validation loss of the model you keep" value={fix(vals[kept], 3)} tone="accent" />
          <Readout label="Epoch kept" value={kept} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[0, 20, 40, 60]} yTicks={[0, 0.5, 1]} xLabel="epochs" yLabel="loss" />
        <path className="line-a thick" d={linePath(range(stopAt + 1).map((e) => [e, train(e)]), X.f, Y.f)} />
        <path className="line-b thick" d={linePath(range(stopAt + 1).map((e) => [e, Math.min(1, val(e))]), X.f, Y.f)} />
        {early && (
          <>
            <line className="line-ink dashed thin" x1={X.f(best)} x2={X.f(best)} y1={Y.range[0]} y2={Y.range[1]} />
            <text className="label" x={X.f(best) + 6} y={30}>
              best epoch, kept
            </text>
          </>
        )}
      </Canvas>
      <p className="sim-legend">
        <span className="key key-a" /> training loss <span className="key key-b" /> validation loss. Illustrative curves with the usual shapes: Adam gets there faster, dropout keeps the two closer, early stopping keeps the best epoch.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Remembering what came before

export function MemorySim({ onState }) {
  const [plain, setPlain] = useState(0.8);
  const [gate, setGate] = useState(0.97);
  const [len, setLen] = useState(30);
  const rnn = memoryLeft(len, plain);
  const lstm = memoryLeft(len, gate);
  useReport(onState, { len, lstm: +lstm.toFixed(3), rnn: +rnn.toFixed(4) });
  const X = frame([0, 60], [56, W - 20]);
  const Y = frame([0, 1.5], [H - 40, 16]);
  const xs = range(61);
  return (
    <Sim
      label="See how much of an early word a recurrent network still remembers"
      controls={
        <>
          <Slider label="Plain RNN: kept per step" value={plain} min={0.5} max={1.1} step={0.01} onChange={setPlain} format={(v) => v.toFixed(2)} />
          <Slider label="LSTM forget gate" value={gate} min={0.8} max={1} step={0.005} onChange={setGate} format={(v) => v.toFixed(3)} />
          <Slider label="Words since the important one" value={len} min={1} max={60} onChange={setLen} />
        </>
      }
      readouts={
        <>
          <Readout label="Plain RNN remembers" value={rnn > 9.99 ? "exploded" : pct(Math.min(1, rnn))} />
          <Readout label="LSTM remembers" value={pct(lstm)} tone="accent" />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[0, 20, 40, 60]} yTicks={[0, 0.5, 1, 1.5]} fmtY={(v) => pct(v)} xLabel="steps (words) later" yLabel="share of the signal left" />
        <path className="line-b thick" d={linePath(xs.map((t) => [t, Math.min(1.5, memoryLeft(t, plain))]), X.f, Y.f)} />
        <path className="line-a thick" d={linePath(xs.map((t) => [t, memoryLeft(t, gate)]), X.f, Y.f)} />
        <line className="line-ink dashed thin" x1={X.f(len)} x2={X.f(len)} y1={Y.range[0]} y2={Y.range[1]} />
      </Canvas>
      <p className="sim-legend">
        <span className="key key-b" /> plain RNN <span className="key key-a" /> LSTM. A plain RNN multiplies its memory by about the same factor every word, so it fades (below 1) or blows up (above 1). An LSTM's gate can sit close to 1 and carry it a long way.
      </p>
    </Sim>
  );
}


// ---------------------------------------------------------------------------
// Activation functions and what they do to the gradient

const ACT_NAMES = [
  ["sigmoid", "Sigmoid"],
  ["tanh", "Tanh"],
  ["relu", "ReLU"],
  ["leaky", "Leaky ReLU"],
  ["gelu", "GELU"],
];

export function ActivationSim({ onState }) {
  const [name, setName] = useState("sigmoid");
  const [depth, setDepth] = useState(10);
  const a = ACTIVATIONS[name];
  const left = gradientThrough(name, depth);
  useReport(onState, { name, depth, left: +left.toPrecision(3) });
  const X = frame([-4, 4], [56, 330]);
  const Y = frame([-1.2, 4], [H - 40, 16]);
  const xs = range(161).map((i) => -4 + i / 20);
  const G = frame([1, 30], [400, W - 16]);
  const GY = frame([-8, 1], [H - 40, 16]); // log10 of the gradient left
  return (
    <Sim
      label="Compare activation functions and how much gradient survives through depth"
      controls={
        <>
          <Choice label="Activation" options={ACT_NAMES} value={name} onChange={setName} />
          <Slider label="Layers to pass back through" value={depth} min={1} max={30} onChange={setDepth} />
        </>
      }
      readouts={
        <>
          <Readout label="Output range" value={a.range} />
          <Readout label="Slope at 0" value={fix(a.df(0), 2)} />
          <Readout label={`Gradient left after ${depth} layers`} value={left < 1e-4 ? left.toExponential(1) : pct(left, left < 0.1 ? 1 : 0)} tone="accent" />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[-4, -2, 0, 2, 4]} yTicks={[-1, 0, 1, 2, 3, 4]} xLabel="input" yLabel="output (solid) and slope (dashed)" />
        <path className="line-a thick" d={linePath(xs.map((x) => [x, Math.max(-1.2, Math.min(4, a.f(x)))]), X.f, Y.f)} />
        <path className="line-b dashed" d={linePath(xs.map((x) => [x, a.df(x)]), X.f, Y.f)} />
        <Axes x={G} y={GY} xTicks={[1, 10, 20, 30]} yTicks={[-8, -4, 0]} fmtY={(v) => (v === 0 ? "100%" : `1e${v}`)} xLabel="layers back" yLabel="gradient left (log)" />
        {ACT_NAMES.map(([n]) => (
          <path key={n} className={n === name ? "line-a thick" : "line-muted thin"} d={linePath(range(30).map((i) => [i + 1, Math.max(-8, Math.log10(gradientThrough(n, i + 1, 800)))]), G.f, GY.f)} />
        ))}
        <circle className="dot-b" cx={G.f(depth)} cy={GY.f(Math.max(-8, Math.log10(left)))} r="6" />
      </Canvas>
      <p className="sim-legend">
        Left: the activation and its slope. Right: how much of the learning signal reaches a layer that far back, with each activation's standard weight initialisation. A slope that's mostly below 1 shrinks the signal at every layer.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Normalisation: keeping the numbers in range

export function NormSim({ onState }) {
  const [norm, setNorm] = useState("none");
  const [scale, setScale] = useState(1.6);
  const [batch, setBatch] = useState(16);
  const result = useMemo(() => spreadThroughLayers({ depth: 20, scale, norm, batch }), [scale, norm, batch]);
  const last = result.spreads.at(-1);
  useReport(onState, { norm, scale, batch, last: +last.toPrecision(3), batchEffect: +result.batchEffect.toFixed(3) });
  const X = frame([1, 20], [56, W - 20]);
  const Y = frame([-4, 4], [H - 40, 16]); // log10 of the spread
  return (
    <Sim
      label="Push numbers through 20 layers, with and without normalisation"
      controls={
        <>
          <Choice label="Normalisation" options={[["none", "None"], ["batch", "Batch norm"], ["layer", "Layer norm"]]} value={norm} onChange={setNorm} />
          <Slider label="Weight size at the start" value={scale} min={0.6} max={2.4} step={0.05} onChange={setScale} format={(v) => v.toFixed(2)} />
          <Slider label="Batch size" value={batch} min={2} max={64} onChange={setBatch} />
        </>
      }
      readouts={
        <>
          <Readout label="Spread of values at layer 20" value={last > 1e4 ? "exploded" : last < 1e-4 ? "vanished" : fix(last, 2)} tone="accent" />
          <Readout label="Same input, other batch-mates: output changes" value={pct(result.batchEffect)} />
        </>
      }
    >
      <Canvas width={W} height={H}>
        <Axes x={X} y={Y} xTicks={[1, 5, 10, 15, 20]} yTicks={[-4, -2, 0, 2, 4]} fmtY={(v) => (v === 0 ? "1" : `1e${v}`)} xLabel="layer" yLabel="spread of the values (log scale)" />
        <rect className="region-a" x={X.range[0]} y={Y.f(0.5)} width={X.range[1] - X.range[0]} height={Y.f(-0.5) - Y.f(0.5)} opacity="0.15" />
        <path className="line-a thick" d={linePath(result.spreads.map((sp, i) => [i + 1, Math.max(-4, Math.min(4, Math.log10(sp)))]), X.f, Y.f)} />
      </Canvas>
      <p className="sim-legend">A real 20-layer ReLU network on random inputs. The band is a healthy range. Without normalisation, slightly too-big weights explode and too-small ones vanish; batch norm and layer norm rescale every layer back into range.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// One layer, traced: where the weights, the normalisation and the activation
// are each calculated, for a batch of four inputs.

// The diagram is drawn narrower than the other sims so its numbers stay readable
// on a phone, and it stays pinned while the working scrolls beneath it.
const TW = 480;
const TH = 250;
const TCOL = [40, 240, 440];
const trow = (n, i) => 118 + (i - (n - 1) / 2) * 78;
const BOX = { w: 124, h: 66 };

export function TraceSim({ onState }) {
  const [act, setAct] = useState("none");
  const [norm, setNorm] = useState("none");
  const [ex, setEx] = useState(0);
  const [pick, setPick] = useState(0);
  const t = traceLayer(act, norm);
  const working = traceWorking(act, norm, ex, pick);
  const { W1, W2, X } = TRACE;
  useReport(onState, { act, norm, ex, pick, y: t.Y[ex].map((v) => +v.toFixed(3)) });
  const left = TCOL[1] - BOX.w / 2;
  const right = TCOL[1] + BOX.w / 2;
  // Connections into the picked neuron stand out; the rest fade back.
  const edge = (w, lit) => ({
    className: w >= 0 ? "line-a" : "line-b",
    style: { strokeWidth: 1 + Math.abs(w) * 3 },
    opacity: lit ? 0.9 : 0.14,
  });
  const choose = (j) => (e) => {
    if (e.type === "click" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setPick(j);
    }
  };
  return (
    <Sim
      label="Trace one input through a layer: weighted sums, normalisation, activation"
      controls={
        <>
          <Choice label="Input from the batch" options={X.map((x, i) => [String(i), `#${i + 1} (${x.join(", ")})`])} value={String(ex)} onChange={(v) => setEx(+v)} />
          <Choice label="Activation" options={[["none", "None"], ["relu", "ReLU"], ["sigmoid", "Sigmoid"], ["tanh", "Tanh"]]} value={act} onChange={setAct} />
          <Choice label="Normalisation" options={[["none", "None"], ["batch", "Batch norm"], ["layer", "Layer norm"]]} value={norm} onChange={setNorm} />
        </>
      }
      readouts={
        <>
          <Readout label="Output 1" value={fix(t.Y[ex][0])} tone="accent" />
          <Readout label="Output 2" value={fix(t.Y[ex][1])} tone="accent" />
        </>
      }
    >
      <div className="trace-stick">
        <Canvas width={TW} height={TH} className="trace-svg">
          {W2.map((w, o) => w.map((wk, k) => <line key={`b${o}${k}`} {...edge(wk, k === pick)} x1={right} y1={trow(3, k)} x2={TCOL[2] - 26} y2={trow(2, o)} />))}
          {W1.map((w, j) => w.map((wk, k) => <line key={`a${j}${k}`} {...edge(wk, j === pick)} x1={TCOL[0] + 22} y1={trow(3, k)} x2={left} y2={trow(3, j)} />))}
          {W1[pick].map((wk, k) => {
            // Each weight is labelled a third of the way along its connection, where the three don't overlap.
            const x = TCOL[0] + 22 + (left - TCOL[0] - 22) * 0.4;
            const y = trow(3, k) + (trow(3, pick) - trow(3, k)) * 0.4;
            return (
              <g key={`w${k}`} className="trace-weight">
                <rect x={x - 28} y={y - 12} width="56" height="22" rx="6" />
                <text x={x} y={y + 4} textAnchor="middle">
                  ×{fix(wk, 1)}
                </text>
              </g>
            );
          })}
          {X[ex].map((v, k) => (
            <g key={`x${k}`}>
              <circle className="trace-node" cx={TCOL[0]} cy={trow(3, k)} r="22" />
              <text className="trace-num" x={TCOL[0]} y={trow(3, k) + 5} textAnchor="middle">
                {fix(v, 1)}
              </text>
            </g>
          ))}
          {[0, 1, 2].map((j) => {
            const y = trow(3, j);
            return (
              <g
                key={`h${j}`}
                className={`trace-neuron${j === pick ? " is-picked" : ""}`}
                role="button"
                tabIndex={0}
                aria-pressed={j === pick}
                aria-label={`Hidden neuron ${j + 1}: show its working`}
                onClick={choose(j)}
                onKeyDown={choose(j)}
              >
                <rect className="trace-node" x={left} y={y - BOX.h / 2} width={BOX.w} height={BOX.h} rx="12" />
                <text className="trace-line" x={left + 12} y={y - 12}>
                  z = {fix(t.Z[ex][j])}
                </text>
                <text className={`trace-line${norm === "none" ? " is-off" : ""}`} x={left + 12} y={y + 7}>
                  ẑ = {norm === "none" ? "z" : fix(t.N[ex][j])}
                </text>
                <text className={`trace-line is-out${act === "none" ? " is-off" : ""}`} x={left + 12} y={y + 26}>
                  a = {fix(t.A[ex][j])}
                </text>
              </g>
            );
          })}
          {[0, 1].map((o) => (
            <g key={`y${o}`}>
              <circle className="trace-node is-out" cx={TCOL[2]} cy={trow(2, o)} r="26" />
              <text className="trace-num" x={TCOL[2]} y={trow(2, o) + 5} textAnchor="middle">
                {fix(t.Y[ex][o])}
              </text>
            </g>
          ))}
          <text className="axis-label" x={TCOL[0]} y={TH - 2} textAnchor="middle">
            inputs
          </text>
          <text className="axis-label" x={TCOL[1]} y={TH - 2} textAnchor="middle">
            hidden layer (tap one)
          </text>
          <text className="axis-label" x={TCOL[2]} y={TH - 2} textAnchor="middle">
            outputs
          </text>
        </Canvas>
      </div>
      <p className="sim-legend">
        Teal weights are positive, orange negative; thicker is bigger. In each hidden neuron, z is the weighted sum, ẑ the normalised sum and a the
        activation, the only number that travels on. Tap a hidden neuron to see its working.
      </p>
      <ol className="trace-work" aria-live="polite" aria-label={`The working for hidden neuron ${pick + 1}, input #${ex + 1}`}>
        {working.map((step) => (
          <li key={step.name}>
            <div className="trace-head">
              <span className="trace-step">{step.name}</span>
              {step.over && <span className="trace-over">over {step.over}</span>}
            </div>
            <div className="trace-maths">
              <code className="trace-rule">{step.rule}</code>
              <code className="trace-sub">
                {step.sub}
                {step.result !== null && <strong> = {fix(step.result)}</strong>}
              </code>
            </div>
          </li>
        ))}
      </ol>
    </Sim>
  );
}
