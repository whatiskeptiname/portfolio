// Simulations for the neural networks chapter: one neuron, layers, backprop,
// training a deep network, and memory in recurrent networks.
import React, { useMemo, useState } from "react";
import { range, rng } from "../math";
import { memoryLeft, trainMlp, xorPoints } from "../mlmath";
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

