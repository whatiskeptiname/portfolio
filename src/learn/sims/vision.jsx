// Simulations for the computer vision chapter.
import React, { useMemo, useRef, useState } from "react";
import { convolve, cosine, iou, nms, normal, quantize, range, receptiveField, rmse, rng, softmax } from "../math";
import { Button, Canvas, Choice, Readout, Sim, Slider, Toggle } from "../kit";
import { fix, pct, svgPoint, useLoop, useReport } from "../plot";

// ---------------------------------------------------------------------------
// Convolution

const N = 16;
const IMAGES = {
  house: () =>
    range(N).map((y) =>
      range(N).map((x) => {
        const roof = y >= 2 && y <= 7 && Math.abs(x - 7.5) <= y - 1.5;
        const wall = y >= 8 && y <= 13 && x >= 3 && x <= 12;
        const door = y >= 10 && y <= 13 && x >= 7 && x <= 8;
        return door ? 0.15 : roof || wall ? 1 : 0;
      })
    ),
  circle: () => range(N).map((y) => range(N).map((x) => ((x - 7.5) ** 2 + (y - 7.5) ** 2 < 30 ? 1 : 0))),
  stripes: () => range(N).map((y) => range(N).map((x) => ((x + y) % 6 < 3 ? 1 : 0))),
  letter: () => range(N).map((y) => range(N).map((x) => ((x >= 3 && x <= 5 && y >= 2 && y <= 13) || (y >= 11 && y <= 13 && x >= 3 && x <= 12) ? 1 : 0))),
};

const KERNELS = {
  identity: [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
  ],
  blur: [
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
  ],
  sharpen: [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ],
  vertical: [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ],
  horizontal: [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ],
};

const STEPS = [-2, -1, 0, 1, 2];

/** A shade of grey from black (0) to white (1), the way image pixels are shown. */
const grey = (t) => {
  const g = Math.round(Math.max(0, Math.min(1, t)) * 255);
  return `rgb(${g},${g},${g})`;
};
const hBar = range(9).map((y) => range(9).map(() => (y >= 4 ? 1 : 0)));
const vBar = range(9).map(() => range(9).map((x) => (x >= 4 ? 1 : 0)));
const peak = (img, k) => Math.max(...convolve(img, k).slice(2, 7).flatMap((r) => r.slice(2, 7)).map(Math.abs));

export function ConvSim({ onState }) {
  const [image, setImage] = useState("house");
  const [name, setName] = useState("vertical");
  const [custom, setCustom] = useState([
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
  ]);
  const [relu, setRelu] = useState(false);
  const [at, setAt] = useState({ x: 4, y: 9 });
  const kernel = name === "custom" ? custom : KERNELS[name];
  const img = useMemo(() => IMAGES[image](), [image]);
  const out = useMemo(() => convolve(img, kernel).map((r) => r.map((v) => (relu ? Math.max(0, v) : v))), [img, kernel, relu]);
  const h = peak(hBar, kernel);
  const v = peak(vBar, kernel);
  useReport(onState, { name, horizontal: +h.toFixed(2), vertical: +v.toFixed(2) });
  const top = Math.max(1, ...out.flat().map(Math.abs));
  const wTop = Math.max(1e-9, ...kernel.flat().map(Math.abs));
  const c = 13;
  // Editing starts from the filter on screen (rounded to whole numbers) and
  // steps the clicked weight through −2, −1, 0, 1, 2.
  const editCell = (i, j) => {
    const base = kernel.map((row) => row.map((w) => Math.max(-2, Math.min(2, Math.round(w)))));
    const next = base.map((row, y) => row.map((w, x) => (y === i && x === j ? STEPS[(STEPS.indexOf(w) + 1) % STEPS.length] : w)));
    setCustom(next);
    setName("custom");
  };
  const terms = [];
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const yy = at.y + j;
      const xx = at.x + i;
      const p = yy >= 0 && yy < N && xx >= 0 && xx < N ? img[yy][xx] : 0;
      terms.push(p * kernel[j + 1][i + 1]);
    }
  return (
    <Sim
      label="Slide a 3×3 filter over a small image. Click any output pixel to see the sum behind it, and click the filter's cells to edit it."
      controls={
        <>
          <Choice label="Image" options={[["house", "House"], ["circle", "Circle"], ["stripes", "Stripes"], ["letter", "Letter L"]]} value={image} onChange={setImage} />
          <Choice
            label="Filter"
            options={[
              ["identity", "Identity"],
              ["blur", "Blur"],
              ["sharpen", "Sharpen"],
              ["vertical", "Vertical edges"],
              ["horizontal", "Horizontal edges"],
              ["custom", "Your own"],
            ]}
            value={name}
            onChange={setName}
          />
          <Toggle label="ReLU (keep only positive responses)" checked={relu} onChange={setRelu} />
        </>
      }
      readouts={
        <>
          <Readout label={`Output at (${at.x + 1}, ${at.y + 1})`} value={fix(out[at.y][at.x], 2)} tone="accent" />
          <Readout label="Response to a horizontal edge" value={fix(h, 1)} />
          <Readout label="Response to a vertical edge" value={fix(v, 1)} />
        </>
      }
    >
      <Canvas width={640} height={250}>
        <g transform="translate(8,24)">
          <text className="note" y={-8}>
            image
          </text>
          {img.map((row, y) => row.map((p, x) => <rect key={`${x}-${y}`} x={x * c} y={y * c} width={c - 1} height={c - 1} style={{ fill: grey(p) }} />))}
          <rect className="kernel" x={(at.x - 1) * c - 1} y={(at.y - 1) * c - 1} width={3 * c + 1} height={3 * c + 1} />
        </g>
        <g transform="translate(240,70)">
          <text className="note" y={-8}>
            filter (click to edit)
          </text>
          {kernel.map((row, y) =>
            row.map((w, x) => (
              <g key={`${x}-${y}`} className="hit" onClick={() => editCell(y, x)}>
                <rect x={x * 36} y={y * 36} width={34} height={34} rx="6" className="frame-line" style={{ fill: grey(0.5 + (0.5 * w) / wTop) }} />
                <text className="label" x={x * 36 + 17} y={y * 36 + 22} textAnchor="middle" style={{ fill: 0.5 + (0.5 * w) / wTop > 0.55 ? "#000" : "#fff" }}>
                  {Math.abs(w - Math.round(w)) > 1e-6 ? "1/9" : w}
                </text>
              </g>
            ))
          )}
          <text className="note" x={0} y={130}>
            sum of the 9 products
          </text>
          <text className="label" x={0} y={148}>
            = {fix(terms.reduce((a, b) => a + b, 0), 2)}
          </text>
        </g>
        <g transform="translate(424,24)">
          <text className="note" y={-8}>
            output
          </text>
          {out.map((row, y) =>
            row.map((val, x) => (
              <rect
                key={`${x}-${y}`}
                x={x * c}
                y={y * c}
                width={c - 1}
                height={c - 1}
                className="hit"
                style={{ fill: grey(relu ? val / top : 0.5 + (0.5 * val) / top) }}
                onClick={() => setAt({ x, y })}
              />
            ))
          )}
          <rect className="kernel" x={at.x * c - 1} y={at.y * c - 1} width={c + 1} height={c + 1} />
        </g>
      </Canvas>
      <p className="sim-legend">
        {relu
          ? "Black means no response; the whiter a pixel, the stronger the filter matched there."
          : "Grey means no response. White is a strong positive response, black a strong negative one (the pattern, flipped)."}
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Going deep: how much learning signal reaches the first layers

export function DepthSignalSim({ onState }) {
  const [layers, setLayers] = useState(20);
  const [skip, setSkip] = useState(false);
  const factors = useMemo(() => {
    const rand = rng(14);
    return range(64).map(() => 0.62 + rand() * 0.3);
  }, []);
  // Going backwards from the last layer, each plain layer scales the signal by its factor.
  // A skip connection adds a direct path, so the factor becomes 1 + (a small extra).
  const signal = [];
  let g = 1;
  for (let l = layers - 1; l >= 0; l--) {
    g *= skip ? 1 + (factors[l] - 0.77) * 0.1 : factors[l];
    signal[l] = g;
  }
  const first = signal[0];
  useReport(onState, { layers, skip, first });
  const W = 600;
  const bw = W / layers;
  const y = (v) => 230 - Math.max(0, (Math.log10(v) + 8) / 8) * 200;
  return (
    <Sim
      label="How much of the learning signal reaches each layer of a deep network"
      controls={
        <>
          <Slider label="Layers" value={layers} min={4} max={64} onChange={setLayers} />
          <Toggle label="Skip connections (ResNet)" checked={skip} onChange={setSkip} />
        </>
      }
      readouts={
        <>
          <Readout label="Signal reaching the first layer" value={first > 0.01 ? pct(first, 0) : `1 in ${Math.round(1 / first).toLocaleString()}`} tone={first < 0.01 ? "bad" : "accent"} />
        </>
      }
    >
      <Canvas width={640} height={260}>
        {[1, 1e-2, 1e-4, 1e-6, 1e-8].map((t) => (
          <g key={t}>
            <line className="grid" x1={30} x2={630} y1={y(t)} y2={y(t)} />
            <text className="tick" x={26} y={y(t) + 4} textAnchor="end">
              {t === 1 ? "all" : `1e${Math.log10(t)}`}
            </text>
          </g>
        ))}
        {signal.map((v, l) => (
          <rect key={l} className={v < 0.01 ? "bar-bad" : "bar-a"} x={30 + l * bw + 1} y={y(v)} width={Math.max(1, bw - 2)} height={230 - y(v)} rx="2" />
        ))}
        <text className="note" x={30} y={250}>
          first layer (sees pixels)
        </text>
        <text className="note" x={630} y={250} textAnchor="end">
          last layer (makes the prediction)
        </text>
      </Canvas>
      <p className="sim-legend">A simplified picture: each layer scales the signal passing back through it. Log scale, so every grid line is 100 times less.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Detection: IoU and non-maximum suppression

function Car({ x, y }) {
  return (
    <g transform={`translate(${x},${y})`} className="scene">
      <rect className="px-on" x="0" y="34" width="190" height="46" rx="12" fillOpacity="0.55" />
      <path className="px-on" d="M38,36 L66,6 L136,6 L162,36 Z" fillOpacity="0.4" />
      <circle className="px-on" cx="44" cy="82" r="17" fillOpacity="0.85" />
      <circle className="px-on" cx="148" cy="82" r="17" fillOpacity="0.85" />
    </g>
  );
}

const TRUTH = { x: 194, y: 90, w: 200, h: 102 };

export function IoUSim({ onState }) {
  const [box, setBox] = useState({ x: 120, y: 40, w: 230, h: 140 });
  const svgRef = useRef(null);
  const grab = useRef(null);
  const score = iou(box, TRUTH);
  useReport(onState, { iou: score });
  const down = (e) => {
    e.preventDefault(); // a drag, not a text selection
    const p = svgPoint(svgRef.current, e);
    grab.current = { dx: p.x - box.x, dy: p.y - box.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!grab.current) return;
    const p = svgPoint(svgRef.current, e);
    setBox((b) => ({ ...b, x: Math.max(0, Math.min(640 - b.w, p.x - grab.current.dx)), y: Math.max(0, Math.min(260 - b.h, p.y - grab.current.dy)) }));
  };
  const ix = Math.max(box.x, TRUTH.x);
  const iy = Math.max(box.y, TRUTH.y);
  const iw = Math.max(0, Math.min(box.x + box.w, TRUTH.x + TRUTH.w) - ix);
  const ih = Math.max(0, Math.min(box.y + box.h, TRUTH.y + TRUTH.h) - iy);
  return (
    <Sim
      label="Drag the orange box over the car. IoU is the overlap divided by the area the two boxes cover together."
      controls={
        <>
          <Slider label="Box width" value={box.w} min={60} max={320} onChange={(w) => setBox((b) => ({ ...b, w }))} />
          <Slider label="Box height" value={box.h} min={40} max={240} onChange={(h) => setBox((b) => ({ ...b, h }))} />
        </>
      }
      readouts={
        <>
          <Readout label="IoU" value={fix(score, 2)} tone="accent" />
          <Readout label="Counts as found at 0.5?" value={score >= 0.5 ? "yes" : "no"} tone={score >= 0.5 ? undefined : "bad"} />
          <Readout label="At 0.75?" value={score >= 0.75 ? "yes" : "no"} tone={score >= 0.75 ? undefined : "bad"} />
        </>
      }
    >
      <Canvas width={640} height={260} ref={svgRef} className="draggable" onPointerMove={move} onPointerUp={() => (grab.current = null)} onPointerCancel={() => (grab.current = null)}>
        <Car x={199} y={88} />
        <rect className="box-a" x={TRUTH.x} y={TRUTH.y} width={TRUTH.w} height={TRUTH.h} />
        <text className="note note-a" x={TRUTH.x} y={TRUTH.y - 6}>
          the true box
        </text>
        {iw > 0 && ih > 0 && <rect className="fill-overlap" x={ix} y={iy} width={iw} height={ih} />}
        <rect className="box-b" x={box.x} y={box.y} width={box.w} height={box.h} fill="transparent" style={{ cursor: "move" }} onPointerDown={down} pointerEvents="all" />
        <text className="note note-b" x={box.x} y={box.y + box.h + 14}>
          the prediction (drag me)
        </text>
      </Canvas>
    </Sim>
  );
}

const CANDIDATES = [
  { x: 120, y: 40, w: 120, h: 190, score: 0.94 },
  { x: 132, y: 52, w: 112, h: 178, score: 0.81 },
  { x: 108, y: 30, w: 140, h: 200, score: 0.66 },
  { x: 126, y: 70, w: 100, h: 150, score: 0.48 },
  { x: 174, y: 46, w: 120, h: 186, score: 0.9 },
  { x: 184, y: 58, w: 118, h: 176, score: 0.77 },
  { x: 160, y: 36, w: 136, h: 200, score: 0.58 },
  { x: 196, y: 80, w: 96, h: 140, score: 0.44 },
].map((b, i) => ({ ...b, id: i }));

function Person({ x, y }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle className="px-on" cx="50" cy="26" r="19" fillOpacity="0.6" />
      <rect className="px-on" x="27" y="50" width="46" height="96" rx="20" fillOpacity="0.45" />
      <rect className="px-on" x="30" y="140" width="16" height="44" rx="7" fillOpacity="0.45" />
      <rect className="px-on" x="54" y="140" width="16" height="44" rx="7" fillOpacity="0.45" />
    </g>
  );
}

export function NMSSim({ onState }) {
  const [threshold, setThreshold] = useState(0.5);
  const [step, setStep] = useState(0);
  const result = useMemo(() => nms(CANDIDATES, threshold), [threshold]);
  const done = step >= result.steps.length;
  const shown = result.steps.slice(0, step);
  const kept = new Set(shown.map((s) => s.kept.id));
  const dropped = new Set(shown.flatMap((s) => s.dropped.map((d) => d.id)));
  useReport(onState, { threshold, kept: result.kept.length, finished: done });
  return (
    <Sim
      label="Two people, eight overlapping guesses. Step through non-maximum suppression."
      controls={
        <>
          <Slider label="Overlap that counts as a duplicate (IoU)" value={threshold} min={0.1} max={0.9} step={0.05} onChange={(t) => (setThreshold(t), setStep(0))} format={(v) => v.toFixed(2)} />
          <Button primary onClick={() => setStep((s) => Math.min(result.steps.length, s + 1))} disabled={done}>
            Next step
          </Button>
          <Button onClick={() => setStep(result.steps.length)}>Run to the end</Button>
          <Button onClick={() => setStep(0)}>Reset</Button>
        </>
      }
      readouts={
        <>
          <Readout label="Boxes kept" value={done ? result.kept.length : `${kept.size} so far`} tone="accent" />
          <Readout label="People in the picture" value="2" />
        </>
      }
    >
      <Canvas width={640} height={260}>
        <Person x={130} y={50} />
        <Person x={184} y={52} />
        {CANDIDATES.map((b) => {
          const cls = kept.has(b.id) ? "box-a" : dropped.has(b.id) ? "box-muted" : "box-b";
          return (
            <g key={b.id} opacity={dropped.has(b.id) ? 0.5 : 1}>
              <rect className={cls} x={b.x} y={b.y} width={b.w} height={b.h} style={{ strokeWidth: kept.has(b.id) ? 3 : 1.4 }} />
              {kept.has(b.id) && (
                <text className="note note-a" x={b.x + 4} y={b.y + 14}>
                  {b.score.toFixed(2)}
                </text>
              )}
            </g>
          );
        })}
        <g transform="translate(430,40)">
          {result.steps.map((s, i) => (
            <text key={i} className="note" y={i * 20} opacity={i < step ? 1 : 0.35}>
              {i + 1}. keep {s.kept.score.toFixed(2)}
              {s.dropped.length ? `, drop ${s.dropped.length}` : ""}
            </text>
          ))}
        </g>
      </Canvas>
      <p className="sim-legend">
        <span className="key key-b" /> waiting <span className="key key-a" /> kept. Grey dashed boxes were suppressed as duplicates.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Segmentation

const SCENE_W = 24;
const SCENE_H = 14;
/** Each pixel's class and which object it belongs to. */
const SCENE = range(SCENE_H).map((y) =>
  range(SCENE_W).map((x) => {
    if (y >= 6 && y <= 10 && x >= 1 && x <= 7 && !(y === 6 && (x === 1 || x === 7))) return { c: "car", id: 1 };
    if (y >= 7 && y <= 11 && x >= 13 && x <= 20 && !(y === 7 && (x === 13 || x === 20))) return { c: "car", id: 2 };
    if (y >= 4 && y <= 11 && x >= 9 && x <= 10) return { c: "person", id: 3 };
    if (y === 3 && x >= 9 && x <= 10) return { c: "person", id: 3 };
    if (y >= 10) return { c: "road", id: 0 };
    return { c: "sky", id: 0 };
  })
);
const CLASS_TONE = { car: "var(--c-a)", person: "var(--c-b)", road: "var(--muted)", sky: "transparent" };
const INSTANCE_TONE = { 1: "var(--c-a)", 2: "#a78bfa", 3: "var(--c-b)" };

export function MaskSim({ onState }) {
  const [mode, setMode] = useState("semantic");
  useReport(onState, { mode });
  const cell = 24;
  const fillFor = (p) => {
    if (mode === "semantic") return CLASS_TONE[p.c];
    if (mode === "instance") return p.id ? INSTANCE_TONE[p.id] : "transparent";
    if (mode === "panoptic") return p.id ? INSTANCE_TONE[p.id] : CLASS_TONE[p.c];
    return "transparent";
  };
  const boxes = [
    { x: 1, y: 6, w: 7, h: 5, label: "car" },
    { x: 13, y: 7, w: 8, h: 5, label: "car" },
    { x: 9, y: 3, w: 2, h: 9, label: "person" },
  ];
  return (
    <Sim
      label="The same street scene, labelled four ways"
      controls={
        <Choice
          label="Task"
          options={[
            ["classify", "Classification"],
            ["detect", "Detection"],
            ["semantic", "Semantic"],
            ["instance", "Instance"],
            ["panoptic", "Panoptic"],
          ]}
          value={mode}
          onChange={setMode}
        />
      }
      readouts={
        <Readout
          label="What the model outputs"
          value={
            {
              classify: "one label: 'street with cars'",
              detect: "3 boxes with labels",
              semantic: "a class for every pixel",
              instance: "a mask per object",
              panoptic: "every pixel: class, and object if countable",
            }[mode]
          }
        />
      }
    >
      <Canvas width={640} height={350}>
        <g transform="translate(32,8)">
          {SCENE.map((row, y) =>
            row.map((p, x) => (
              <g key={`${x}-${y}`}>
                <rect x={x * cell} y={y * cell} width={cell - 1} height={cell - 1} className={p.c === "sky" ? "px-off" : "px-on"} fillOpacity={p.c === "sky" ? 0.35 : p.c === "road" ? 0.25 : 0.6} />
                {mode !== "classify" && mode !== "detect" && <rect x={x * cell} y={y * cell} width={cell - 1} height={cell - 1} style={{ fill: fillFor(p) }} fillOpacity="0.75" />}
              </g>
            ))
          )}
          {mode === "detect" &&
            boxes.map((b, i) => (
              <g key={i}>
                <rect className="box-a" x={b.x * cell - 2} y={b.y * cell - 2} width={b.w * cell + 3} height={b.h * cell + 3} />
                <text className="note note-a" x={b.x * cell} y={b.y * cell - 6}>
                  {b.label}
                </text>
              </g>
            ))}
          {mode === "classify" && (
            <text className="label" x={8} y={22}>
              street with cars: 97%
            </text>
          )}
        </g>
      </Canvas>
    </Sim>
  );
}

export function ReceptiveSim({ onState }) {
  const [d, setD] = useState([1, 1, 1]);
  const size = 17;
  const c = 14;
  const counts = useMemo(() => {
    let set = new Map([[`8,8`, 1]]);
    for (let l = 2; l >= 0; l--) {
      const next = new Map();
      for (const [key, n] of set) {
        const [x, y] = key.split(",").map(Number);
        for (let j = -1; j <= 1; j++)
          for (let i = -1; i <= 1; i++) {
            const k = `${x + i * d[l]},${y + j * d[l]}`;
            next.set(k, (next.get(k) ?? 0) + n);
          }
      }
      set = next;
    }
    return set;
  }, [d]);
  const top = Math.max(...counts.values());
  const rf = receptiveField(d);
  useReport(onState, { rf, d });
  return (
    <Sim
      label="Three stacked 3×3 convolutions. Which input pixels can the centre output pixel see?"
      controls={
        <>
          {[0, 1, 2].map((l) => (
            <Choice key={l} label={`Layer ${l + 1} dilation`} options={[[1, "1"], [2, "2"], [4, "4"]]} value={d[l]} onChange={(v) => setD((old) => old.map((x, i) => (i === l ? v : x)))} />
          ))}
        </>
      }
      readouts={
        <>
          <Readout label="Field of view" value={`${rf} × ${rf} pixels`} tone="accent" />
          <Readout label="Weights used" value="3 × 9 = 27" />
          <Readout label="Plain layers needed for the same view" value={(rf - 1) / 2} />
        </>
      }
    >
      <Canvas width={640} height={250}>
        <g transform={`translate(${320 - (size * c) / 2},4)`}>
          {range(size).map((y) =>
            range(size).map((x) => {
              const n = counts.get(`${x},${y}`) ?? 0;
              return <rect key={`${x}-${y}`} x={x * c} y={y * c} width={c - 1} height={c - 1} className={n ? "px-out" : "px-off"} fillOpacity={n ? 0.25 + (n / top) * 0.75 : 0.5} />;
            })
          )}
          <rect className="kernel" x={8 * c - 1} y={8 * c - 1} width={c + 1} height={c + 1} />
        </g>
      </Canvas>
      <p className="sim-legend">Brighter cells reach the output through more paths. The outlined cell is the output pixel's position.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Generative models

/** A hand-made "decoder": two latent numbers become a shape. A trained VAE learns its own. */
function decode(z1, z2) {
  const n = 0.7 + ((z1 + 2) / 4) * 5.3; // from spiky to round to square
  const aspect = 0.55 + ((z2 + 2) / 4) * 0.9; // from wide to tall
  return range(73)
    .map((i) => {
      const t = (i / 72) * 2 * Math.PI;
      const c = Math.cos(t);
      const s = Math.sin(t);
      const x = Math.sign(c) * Math.abs(c) ** (2 / n);
      const y = Math.sign(s) * Math.abs(s) ** (2 / n);
      return [x / Math.sqrt(aspect), y * Math.sqrt(aspect)];
    })
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(3)},${y.toFixed(3)}`)
    .join("") + "Z";
}

export function LatentSim({ onState }) {
  const [z, setZ] = useState([0.2, -0.4]);
  const svgRef = useRef(null);
  useReport(onState, { z });
  const pad = { x: 20, y: 20, s: 220 };
  const toZ = (p) => [((p.x - pad.x) / pad.s) * 4 - 2, 2 - ((p.y - pad.y) / pad.s) * 4];
  const pick = (e) => {
    if (e.type === "pointerdown") e.preventDefault(); // a drag, not a text selection
    if (e.type === "pointermove" && e.buttons !== 1 && e.pointerType !== "touch") return;
    const p = svgPoint(svgRef.current, e);
    const [a, b] = toZ(p);
    if (a < -2 || a > 2 || b < -2 || b > 2) return;
    setZ([a, b]);
  };
  const grid = range(5).flatMap((j) => range(5).map((i) => [-1.6 + i * 0.8, 1.6 - j * 0.8]));
  return (
    <Sim label="Move through a two-number latent space. Every point decodes to a shape, and nearby points decode to similar shapes.">
      <Canvas width={640} height={260} ref={svgRef} onPointerDown={pick} onPointerMove={pick} className="draggable">
        <rect className="frame-line" x={pad.x} y={pad.y} width={pad.s} height={pad.s} rx="8" />
        {grid.map(([a, b]) => (
          <path key={`${a}${b}`} className="area-muted" d={decode(a, b)} transform={`translate(${pad.x + ((a + 2) / 4) * pad.s},${pad.y + ((2 - b) / 4) * pad.s}) scale(13)`} />
        ))}
        <circle className="dot-ink" cx={pad.x + ((z[0] + 2) / 4) * pad.s} cy={pad.y + ((2 - z[1]) / 4) * pad.s} r="7" />
        <text className="note" x={pad.x} y={pad.y + pad.s + 16}>
          z₁ →
        </text>
        <text className="note" x={pad.x + pad.s + 6} y={pad.y + 10}>
          ↑ z₂
        </text>
        <path className="area-a" d={decode(z[0], z[1])} transform="translate(450,130) scale(90)" />
        <path className="line-a" d={decode(z[0], z[1])} transform="translate(450,130) scale(90)" style={{ strokeWidth: 0.025 }} />
        <text className="note" x={450} y={250} textAnchor="middle">
          decoded from z = ({fix(z[0], 1)}, {fix(z[1], 1)})
        </text>
      </Canvas>
      <p className="sim-legend">Drag in the square. The decoder here is hand-made to show the idea; a VAE learns one from data.</p>
    </Sim>
  );
}

const T = 1000;
const BETAS = range(T).map((t) => 1e-4 + ((0.02 - 1e-4) * t) / (T - 1));
const ALPHA_BAR = (() => {
  let a = 1;
  return BETAS.map((b) => (a *= 1 - b));
})();

export function DiffusionSim({ onState }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { x0, eps } = useMemo(() => {
    const rand = rng(6);
    // A smiley: a ring, two eyes and a smile.
    const pts = [];
    for (let i = 0; i < 140; i++) {
      const a = (i / 140) * 2 * Math.PI;
      pts.push([Math.cos(a), Math.sin(a)]);
    }
    for (let i = 0; i < 30; i++) pts.push([-0.35 + normal(rand) * 0.05, -0.3 + normal(rand) * 0.05], [0.35 + normal(rand) * 0.05, -0.3 + normal(rand) * 0.05]);
    for (let i = 0; i < 60; i++) {
      const a = Math.PI * (0.2 + (0.6 * i) / 60);
      pts.push([0.55 * Math.cos(a), 0.15 + 0.4 * Math.sin(a)]);
    }
    return { x0: pts, eps: pts.map(() => [normal(rand), normal(rand)]) };
  }, []);
  useLoop(() => {
    setT((v) => {
      if (v <= 0) {
        setPlaying(false);
        return 0;
      }
      return Math.max(0, v - 8);
    });
  }, playing);
  const ab = t ? ALPHA_BAR[t - 1] : 1;
  const signal = Math.sqrt(ab);
  const noise = Math.sqrt(1 - ab);
  useReport(onState, { t, signal });
  return (
    <Sim
      label="Add noise step by step until the picture is gone; a diffusion model learns to walk back"
      controls={
        <>
          <Slider label="Noising step t" value={t} min={0} max={T} step={10} onChange={(v) => (setPlaying(false), setT(v))} />
          <Button primary onClick={() => (t === 0 && setT(T), setPlaying((p) => !p))}>
            {playing ? "Pause" : "Denoise from pure noise"}
          </Button>
        </>
      }
      readouts={
        <>
          <Readout label="Original signal kept (√ᾱ)" value={pct(signal)} tone="accent" />
          <Readout label="Noise (√(1 − ᾱ))" value={pct(noise)} />
        </>
      }
    >
      <Canvas width={640} height={260}>
        <g transform="translate(320,130) scale(78)">
          {x0.map(([x, y], i) => (
            <circle key={i} className="dot-a" cx={signal * x + noise * eps[i][0]} cy={signal * y + noise * eps[i][1]} r={0.035} style={{ strokeWidth: 0 }} />
          ))}
        </g>
      </Canvas>
      <p className="sim-legend">
        Each point is x_t = √ᾱ·x₀ + √(1 − ᾱ)·noise. "Denoise" here replays the same path backwards; a trained network has to predict the noise at every step to do it.
      </p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Transformers: patches and attention, and CLIP

const PALETTE = { sky: [0.55, 0.75, 0.95], sun: [1, 0.85, 0.3], grass: [0.35, 0.7, 0.35], wall: [0.85, 0.4, 0.35], roof: [0.45, 0.25, 0.2], door: [0.3, 0.2, 0.15] };
const SCENE_PX = range(16).map((y) =>
  range(16).map((x) => {
    if ((x - 12.5) ** 2 + (y - 3) ** 2 < 5) return "sun";
    if (y >= 12) return "grass";
    if (y >= 8 && y <= 11 && x >= 2 && x <= 7) return x >= 4 && x <= 5 && y >= 10 ? "door" : "wall";
    if (y >= 5 && y <= 7 && Math.abs(x - 4.5) <= y - 4) return "roof";
    return "sky";
  })
);
const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;

export function PatchSim({ onState }) {
  const [sel, setSel] = useState(9);
  const [temp, setTemp] = useState(0.3);
  const patches = useMemo(
    () =>
      range(16).map((p) => {
        const px = (p % 4) * 4;
        const py = Math.floor(p / 4) * 4;
        const cells = range(16).map((k) => PALETTE[SCENE_PX[py + Math.floor(k / 4)][px + (k % 4)]]);
        return [0, 1, 2].map((ch) => cells.reduce((s, c) => s + c[ch], 0) / 16);
      }),
    []
  );
  const scores = patches.map((v, j) => cosine(patches[sel].map((x) => x - 0.5), v.map((x) => x - 0.5)) - 0.04 * Math.hypot((j % 4) - (sel % 4), Math.floor(j / 4) - Math.floor(sel / 4)));
  // Attention over the other 15 patches (a patch's attention to itself is left out, to keep the picture readable).
  const others = softmax(scores.filter((_, j) => j !== sel), temp);
  const weights = range(16).map((j) => (j === sel ? 0 : others[j < sel ? j : j - 1]));
  const best = weights.map((w, j) => [w, j]).sort((a, b) => b[0] - a[0])[0];
  const wTop = Math.max(...weights);
  useReport(onState, { sel, temp });
  const c = 14;
  const center = (p) => [20 + (p % 4) * 4 * c + 2 * c, 20 + Math.floor(p / 4) * 4 * c + 2 * c];
  return (
    <Sim
      label="Cut the image into 16 patches. Click a patch to see which others it attends to."
      controls={<Slider label="Sharpness of attention (softmax temperature)" value={temp} min={0.03} max={1} step={0.01} onChange={setTemp} format={(v) => v.toFixed(2)} />}
      readouts={
        <>
          <Readout label="Selected patch" value={`#${sel + 1}`} />
          <Readout label="Attends most to" value={`#${best[1] + 1} (${pct(best[0])})`} tone="accent" />
          <Readout label="Spread over the other 14" value={pct(1 - best[0])} />
        </>
      }
    >
      <Canvas width={640} height={280}>
        <g>
          {SCENE_PX.map((row, y) => row.map((k, x) => <rect key={`${x}-${y}`} x={20 + x * c} y={20 + y * c} width={c} height={c} style={{ fill: rgb(PALETTE[k]) }} />))}
          {range(16).map((p) => (
            <rect key={p} className="hit" x={20 + (p % 4) * 4 * c} y={20 + Math.floor(p / 4) * 4 * c} width={4 * c} height={4 * c} fill="transparent" stroke="var(--bg)" strokeWidth="2" onClick={() => setSel(p)} />
          ))}
          {weights.map((w, j) =>
            j === sel ? null : <line key={j} className="line-ink" x1={center(sel)[0]} y1={center(sel)[1]} x2={center(j)[0]} y2={center(j)[1]} style={{ strokeWidth: 0.5 + w * 14, opacity: Math.min(1, 0.15 + w * 3) }} pointerEvents="none" />
          )}
          <rect className="kernel" x={20 + (sel % 4) * 4 * c} y={20 + Math.floor(sel / 4) * 4 * c} width={4 * c} height={4 * c} pointerEvents="none" />
        </g>
        <g transform="translate(290,24)">
          <text className="note" y={-6}>
            the transformer reads: [CLS] + 16 patches
          </text>
          <rect className="node is-on" x={0} y={6} width={30} height={26} rx="5" />
          <text className="note" x={15} y={23} textAnchor="middle">
            CLS
          </text>
          {range(16).map((p) => (
            <g key={p} transform={`translate(${34 + (p % 8) * 38},${6 + Math.floor(p / 8) * 32})`}>
              <rect width={34} height={26} rx="5" style={{ fill: rgb(patches[p]) }} stroke={p === sel ? "var(--c-b)" : "none"} strokeWidth="2.5" />
            </g>
          ))}
          <text className="note" y={92}>
            each also gets its position
          </text>
          {range(16).map((j) => (
            <g key={j} transform={`translate(${(j % 8) * 40},${112 + Math.floor(j / 8) * 64})`}>
              <rect className={j === sel ? "bar-muted" : "bar-a"} y={48 - (weights[j] / wTop) * 44} width={30} height={Math.max(1, (weights[j] / wTop) * 44)} rx="3" />
              <text className="tick" x={15} y={60} textAnchor="middle">
                {j + 1}
              </text>
            </g>
          ))}
        </g>
      </Canvas>
      <p className="sim-legend">To show the mechanics, attention here comes from colour similarity and distance. A trained ViT learns what to attend to.</p>
    </Sim>
  );
}

const CLIP_IMAGES = {
  cat: { label: "Cat", v: [0.9, 0.2, 0.1, 0.3] },
  bike: { label: "Bicycle", v: [0.1, 0.95, 0.1, 0.2] },
  tree: { label: "Tree", v: [0.15, 0.1, 0.95, 0.25] },
};
const CLIP_TEXTS = [
  { t: "a photo of a cat", v: [0.95, 0.1, 0.1, 0.25] },
  { t: "a photo of a dog", v: [0.75, 0.15, 0.15, 0.45] },
  { t: "a photo of a bicycle", v: [0.1, 0.9, 0.05, 0.25] },
  { t: "a photo of a tree", v: [0.1, 0.05, 0.9, 0.3] },
];

function ClipPicture({ kind }) {
  if (kind === "cat")
    return (
      <g className="scene">
        <path className="px-on" fillOpacity="0.6" d="M-40,-10 L-34,-52 L-12,-30 L12,-30 L34,-52 L40,-10 Q42,40 0,44 Q-42,40 -40,-10Z" />
        <circle className="dot-ink" cx="-14" cy="-6" r="4" />
        <circle className="dot-ink" cx="14" cy="-6" r="4" />
      </g>
    );
  if (kind === "bike")
    return (
      <g className="scene">
        <circle className="line-ink" cx="-30" cy="18" r="22" />
        <circle className="line-ink" cx="32" cy="18" r="22" />
        <path className="line-ink" d="M-30,18 L-6,-14 L22,-14 L32,18 M-6,-14 L4,18 L-30,18 M22,-14 L18,-26 M-10,-22 L2,-22" />
      </g>
    );
  return (
    <g className="scene">
      <rect className="px-on" x="-6" y="10" width="12" height="40" fillOpacity="0.6" />
      <circle className="dot-a" cx="0" cy="-12" r="34" style={{ opacity: 0.7 }} />
    </g>
  );
}

export function CLIPSim({ onState }) {
  const [img, setImg] = useState("cat");
  const sims = CLIP_TEXTS.map((x) => cosine(CLIP_IMAGES[img].v, x.v));
  const probs = softmax(sims.map((s) => s * 10));
  const best = probs.indexOf(Math.max(...probs));
  useReport(onState, { img, best: CLIP_TEXTS[best].t });
  return (
    <Sim
      label="Zero-shot classification: compare an image's embedding with the embeddings of some sentences"
      controls={<Choice label="Image" options={Object.entries(CLIP_IMAGES).map(([k, v]) => [k, v.label])} value={img} onChange={setImg} />}
      readouts={<Readout label="Best matching caption" value={CLIP_TEXTS[best].t} tone="accent" />}
    >
      <Canvas width={640} height={220}>
        <rect className="node" x={20} y={30} width={150} height={150} rx="14" />
        <g transform="translate(95,108)">
          <ClipPicture kind={img} />
        </g>
        {CLIP_TEXTS.map((x, i) => (
          <g key={x.t} transform={`translate(210,${34 + i * 42})`}>
            <text className="label" y={12}>
              {x.t}
            </text>
            <rect className="frame-line" y={20} width={380} height={10} rx="5" />
            <rect className={i === best ? "bar-a" : "bar-muted"} y={20} width={Math.max(3, probs[i] * 380)} height={10} rx="5" />
            <text className="note" x={420} y={30} textAnchor="end">
              {pct(probs[i])}
            </text>
          </g>
        ))}
      </Canvas>
      <p className="sim-legend">The embeddings here are made-up four-number vectors, to show the mechanics. Real CLIP embeddings have hundreds of dimensions, learned from 400 million captioned images.</p>
    </Sim>
  );
}

// ---------------------------------------------------------------------------
// Seeing what it saw, and shipping it

/** Four made-up feature maps over a 7×7 grid: two respond to the dog, two to the ball. */
const MAPS = [
  (x, y) => Math.exp(-((x - 2) ** 2 + (y - 3) ** 2) / 3),
  (x, y) => Math.exp(-((x - 2.5) ** 2 + (y - 4) ** 2) / 2),
  (x, y) => Math.exp(-((x - 5) ** 2 + (y - 5) ** 2) / 1.2),
  (x, y) => 0.4 * Math.exp(-((x - 5) ** 2 + (y - 4.5) ** 2) / 4) + 0.2,
];
const GRADS = { dog: [0.9, 0.7, -0.4, 0.05], ball: [-0.3, -0.1, 1, 0.4] };

export function GradCamSim({ onState }) {
  const [target, setTarget] = useState("dog");
  const w = GRADS[target];
  const cam = range(7).map((y) => range(7).map((x) => Math.max(0, MAPS.reduce((s, m, k) => s + w[k] * m(x, y), 0))));
  const top = Math.max(...cam.flat(), 1e-6);
  useReport(onState, { target });
  const c = 26;
  return (
    <Sim
      label="Grad-CAM: weight each feature map by how much it pushes the chosen class, add them up, keep the positive part"
      readouts={
        <>
          {w.map((v, k) => (
            <Readout key={k} label={`Weight on map ${k + 1}`} value={fix(v, 2)} tone={v < 0 ? "bad" : undefined} />
          ))}
        </>
      }
    >
      <Canvas width={640} height={240}>
        {MAPS.map((m, k) => (
          <g key={k} transform={`translate(${16 + (k % 2) * 92},${20 + Math.floor(k / 2) * 104})`}>
            <text className="note" y={-5}>
              map {k + 1}
            </text>
            {range(7).map((y) => range(7).map((x) => <rect key={`${x}${y}`} x={x * 12} y={y * 12} width={11} height={11} className="px-out" fillOpacity={0.08 + m(x, y) * 0.85} />))}
          </g>
        ))}
        <text className="note" x={214} y={124}>
          × weights, sum, ReLU →
        </text>
        <g transform="translate(380,30)">
          <rect className="node" width={7 * c} height={7 * c} rx="8" />
          {cam.map((row, y) => row.map((v, x) => <rect key={`${x}${y}`} x={x * c} y={y * c} width={c} height={c} className="heat-b" fillOpacity={(v / top) * 0.75} />))}
          {/* The dog and the ball are the controls: tap one to explain its score. They sit above the heat so they catch the tap. */}
          {[
            ["dog", <g key="d"><ellipse cx={2.4 * c} cy={3.8 * c} rx={1.9 * c} ry={1.4 * c} /><circle cx={1.4 * c} cy={2.2 * c} r={0.9 * c} /></g>],
            ["ball", <circle key="b" cx={5.4 * c} cy={5.3 * c} r={0.8 * c} />],
          ].map(([k, shape]) => (
            <g
              key={k}
              className={`cam-thing${target === k ? " is-picked" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={target === k}
              aria-label={`Explain the score for the ${k}`}
              onClick={() => setTarget(k)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setTarget(k))}
            >
              {shape}
            </g>
          ))}
          <text className="note" x={0} y={7 * c + 16}>
            tap the dog or the ball
          </text>
        </g>
      </Canvas>
      <p className="sim-legend">The feature maps and weights are made up to show the steps. In a real network they come from the last convolutional layer and its gradients.</p>
    </Sim>
  );
}

export function QuantSim({ onState }) {
  const [bits, setBits] = useState(8);
  const [clip, setClip] = useState(false);
  const weights = useMemo(() => {
    const rand = rng(23);
    return range(4000).map((i) => (i % 400 === 0 ? normal(rand) * 8 : normal(rand) * 0.6));
  }, []);
  const q = useMemo(() => {
    if (!clip) return quantize(weights, bits);
    // Calibrate the range on the bulk of the weights and clamp the rare outliers.
    const sorted = weights.map(Math.abs).sort((a, b) => a - b);
    const limit = sorted[Math.floor(sorted.length * 0.99)];
    const clamped = weights.map((w) => Math.max(-limit, Math.min(limit, w)));
    return quantize([...clamped, limit], bits).slice(0, -1);
  }, [weights, bits, clip]);
  // Relative rounding error, for the ordinary weights and for the rare large ones.
  const part = (keep) => {
    const idx = range(weights.length).filter(keep);
    const w = idx.map((i) => weights[i]);
    return rmse(w, idx.map((i) => q[i])) / rmse(w, w.map(() => 0));
  };
  const err = part((i) => i % 400 !== 0);
  const errLarge = part((i) => i % 400 === 0);
  const params = 25.6e6;
  const mb = (params * bits) / 8 / 1e6;
  useReport(onState, { bits, clip, err, errLarge });
  const lo = -3;
  const hi = 3;
  const bins = 60;
  const hist = (xs) => {
    const h = range(bins).fill(0);
    for (const x of xs) {
      const b = Math.floor(((x - lo) / (hi - lo)) * bins);
      if (b >= 0 && b < bins) h[b]++;
    }
    return h;
  };
  const h0 = hist(weights);
  const h1 = hist(q);
  const top = Math.max(...h0, ...h1);
  const bw = 600 / bins;
  return (
    <Sim
      label="Round a layer's weights to fewer bits and see what's lost"
      controls={
        <>
          <Slider label="Bits per weight" value={bits} min={2} max={16} onChange={setBits} />
          <Toggle label="Calibrate: clip the rare huge weights" checked={clip} onChange={setClip} />
        </>
      }
      readouts={
        <>
          <Readout label="Model size (25.6M weights)" value={`${fix(mb, 1)} MB`} tone="accent" />
          <Readout label="vs 32-bit floats" value={`${fix((params * 4) / 1e6, 0)} MB`} />
          <Readout label="Distinct values" value={(2 ** bits - 1).toLocaleString()} />
          <Readout label="Error, ordinary weights" value={pct(err, 1)} tone={err > 0.1 ? "bad" : undefined} />
          <Readout label="Error, the rare huge ones" value={pct(errLarge, 1)} />
        </>
      }
    >
      <Canvas width={640} height={230}>
        {h0.map((n, i) => (
          <rect key={`a${i}`} className="bar-muted" x={20 + i * bw} y={100 - (n / top) * 90} width={bw - 1} height={(n / top) * 90} />
        ))}
        {h1.map((n, i) => (
          <rect key={`b${i}`} className="bar-a" x={20 + i * bw} y={210 - (n / top) * 90} width={bw - 1} height={(n / top) * 90} />
        ))}
        <text className="note" x={20} y={14}>
          original weights (32-bit)
        </text>
        <text className="note" x={20} y={124}>
          after rounding to {bits} bits
        </text>
      </Canvas>
    </Sim>
  );
}
