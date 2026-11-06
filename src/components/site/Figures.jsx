// The landing page's pictures: each one draws what a result actually means,
// using the numbers from the CV. They're drawn in the page's own tokens, so
// they follow the theme, and only move while they're on screen. The words they
// illustrate are in the text beside them, so they're hidden from screen readers.
import React, { useEffect, useRef } from "react";

/** Adds `is-on` while the element is in view, so its picture plays each time you arrive. */
function useOnScreen() {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.IntersectionObserver) {
      el?.classList.add("is-on");
      return;
    }
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.3) el.classList.add("is-on");
        else if (e.intersectionRatio === 0) el.classList.remove("is-on");
      },
      { threshold: [0, 0.3] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Figure({ className = "", children }) {
  const ref = useOnScreen();
  return (
    <figure className={`fig ${className}`} ref={ref} aria-hidden="true">
      {children}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// The hero: one video through the model, before and after optimization. The
// frames really do travel 7× faster in the lower lane.

const FORCEPS = (
  <>
    <path d="M22 16 62 31M22 48 62 33" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <circle cx="17" cy="14" r="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="17" cy="50" r="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
  </>
);
const KNEE = (
  <>
    <path d="M37 0h14v17c6 2 8 8 5 12H33c-3-4-1-10 4-12z" />
    <path d="M33 34h23c2 5-1 9-5 11v19H39V45c-4-2-7-6-6-11z" />
  </>
);
const SCALPEL = (
  <g transform="rotate(-24 44 32)">
    <rect x="10" y="29" width="38" height="6" rx="2" />
    <path d="M50 28h7l20 5-20 3h-7z" />
  </g>
);
const HAND = (
  <>
    <rect x="31" y="31" width="26" height="25" rx="7" />
    {[31, 37.6, 44.2, 50.8].map((x, i) => (
      <rect key={x} x={x} y={[15, 10, 12, 18][i]} width="5.4" height="24" rx="2.7" />
    ))}
    <rect x="17" y="35" width="20" height="6" rx="3" transform="rotate(32 31 40)" />
  </>
);
const PROBE = (
  <>
    <path d="M14 53 61 20" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="65" cy="17" r="4.5" />
  </>
);

const SCENES = [
  { label: "knee", art: KNEE, box: [25, 3, 39, 58] },
  { label: "scalpel", art: SCALPEL, box: [9, 10, 70, 44] },
  { label: "hand", art: HAND, box: [15, 6, 46, 53] },
  { label: "forceps", art: FORCEPS, box: [9, 6, 57, 52] },
  { label: "knee", art: KNEE, box: [25, 3, 39, 58] },
  { label: "probe", art: PROBE, box: [10, 9, 62, 47] },
];

function Frame({ scene, detected }) {
  const [x, y, w, h] = scene.box;
  const tag = scene.label.length * 4.6 + 6;
  return (
    <svg className="race-frame" viewBox="0 0 88 64">
      <g className="race-art" fill="currentColor">
        {scene.art}
      </g>
      {detected && (
        <g className="race-box">
          <rect x={x} y={y} width={w} height={h} rx="2" />
          <path d={`M${x} ${y}h${tag}v10H${x}z`} />
          <text x={x + 3} y={y + 7.5}>
            {scene.label}
          </text>
        </g>
      )}
    </svg>
  );
}

const strip = (detected) =>
  [0, 1, 2, 3].flatMap((round) =>
    SCENES.map((scene, i) => <Frame key={`${round}-${i}`} scene={scene} detected={detected} />)
  );

const FAST_LOOP = 8; // seconds for the six frames in the fast lane

function Lane({ name, speed, fps }) {
  const duration = { "--loop": `${FAST_LOOP * (speed === 7 ? 1 : 7)}s` };
  return (
    <div className="race-lane">
      <p className="race-head">
        <span>{name}</span>
        <span className="race-fps">
          <b>{fps}</b> FPS
        </span>
      </p>
      <div className="race-window">
        <div className="race-side race-raw">
          <div className="race-strip" style={duration}>
            {strip(false)}
          </div>
        </div>
        <div className="race-side race-seen">
          <div className="race-strip" style={duration}>
            {strip(true)}
          </div>
        </div>
        <span className="race-gate" />
      </div>
    </div>
  );
}

// A typical vision model at 42 ms an image (the baseline in the inference
// simulation), and the same model at the CV's 7×.
const FPS_BEFORE = 24;
const FPS_AFTER = 167;

export function InferenceRace() {
  const ref = useOnScreen();
  return (
    <figure
      className="race"
      ref={ref}
      role="img"
      aria-label={`The same video through a vision model before and after optimization: about ${FPS_BEFORE} frames per second before, about ${FPS_AFTER} after.`}
    >
      <Lane name="Before optimization" speed={1} fps={FPS_BEFORE} />
      <Lane name="After optimization" speed={7} fps={FPS_AFTER} />
      <figcaption>Up to 7× faster, within 2% of baseline accuracy. The FPS are an example at that ratio, from a 42 ms baseline.</figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Why hire me

// A network losing half its connections, and the ones left taking the weight.
const LAYERS = [
  [34, 4],
  [122, 6],
  [210, 6],
  [298, 4],
];
const nodeY = (count, i) => 110 + (i - (count - 1) / 2) * 34;
const NET = (() => {
  const edges = [];
  LAYERS.slice(0, -1).forEach(([x, n], l) => {
    const [x2, n2] = LAYERS[l + 1];
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n2; b++) {
        // An even, fixed half of the connections goes.
        const keep = (a * 3 + b * 5 + l) % 2 === 0;
        edges.push({ x, y: nodeY(n, a), x2, y2: nodeY(n2, b), keep, id: `${l}-${a}-${b}`, delay: edges.length * 11 });
      }
    }
  });
  return edges;
})();

export function PruneFigure() {
  return (
    <Figure className="fig-prune">
      <svg viewBox="0 0 332 220">
        {NET.map((e) => (
          <line
            key={e.id}
            className={e.keep ? "net-keep" : "net-cut"}
            x1={e.x}
            y1={e.y}
            x2={e.x2}
            y2={e.y2}
            style={{ transitionDelay: `${e.delay}ms` }}
          />
        ))}
        {LAYERS.map(([x, n]) =>
          Array.from({ length: n }, (_, i) => <circle key={`${x}-${i}`} className="net-node" cx={x} cy={nodeY(n, i)} r="8" />)
        )}
      </svg>
    </Figure>
  );
}

// A model travelling out to a live endpoint.
const STOPS = [
  { x: 30, name: "Train" },
  { x: 90, name: "Track" },
  { x: 150, name: "Deploy" },
  { x: 210, name: "Live" },
];

export function PipelineFigure() {
  return (
    <Figure className="fig-pipeline">
      <svg viewBox="0 0 240 120">
        <path className="pipe-line" d="M30 50H210" />
        <circle className="pipe-token" cx="30" cy="50" r="5" />
        {STOPS.map((s, i) => (
          <g key={s.name}>
            <circle className="pipe-stop" style={{ animationDelay: `${i * 1.6}s` }} cx={s.x} cy="50" r="11" />
            <text className="pipe-name" x={s.x} y="86" textAnchor="middle">{s.name}</text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}

// A capture rig seen from above. Each camera's view starts small at the lens
// and widens toward the subject.
const RIG = 30;
const RIG_R = 112;
const KEPT = new Set(Array.from({ length: 9 }, (_, i) => Math.round((i * RIG) / 9)));

export function CameraRing() {
  return (
    <Figure className="fig-rig">
      <svg viewBox="-130 -130 260 260">
        {Array.from({ length: RIG }, (_, i) => {
          const a = (i / RIG) * Math.PI * 2;
          const kept = KEPT.has(i);
          const deg = (a * 180) / Math.PI;
          return (
            <g key={i} transform={`rotate(${deg})`}>
              {kept && <path className="rig-cone" d={`M${RIG_R - 4} 0L-20 -30A36 36 0 0 0 -20 30Z`} style={{ transitionDelay: `${900 + i * 30}ms` }} />}
              <rect
                className={kept ? "rig-kept" : "rig-gone"}
                x={RIG_R - 5}
                y="-6"
                width="12"
                height="12"
                rx="3"
                style={{ transitionDelay: `${i * 26}ms` }}
              />
            </g>
          );
        })}
        <g className="rig-subject">
          <path d="M-8 -46h16v24c7 2 10 9 6 16h-28c-4-7-1-14 6-16z" />
          <path d="M-14 2h28c2 6-1 11-6 13v31H-8V15c-5-2-8-7-6-13z" />
        </g>
      </svg>
    </Figure>
  );
}

// Asking a forecast a question in plain language. Illustrative numbers.
const DEMAND = [52, 48, 60, 66, 62, 74, 70, 82, 78, 92, 112, 84];
const chartX = (i) => 18 + i * 29;
const chartY = (v) => 140 - v;
const line = (from, to) =>
  DEMAND.slice(from, to + 1)
    .map((v, i) => `${i ? "L" : "M"}${chartX(from + i)} ${chartY(v)}`)
    .join("");

export function AskFigure() {
  return (
    <Figure className="fig-ask">
      <p className="ask-q">Which month peaks?</p>
      <svg viewBox="0 0 356 166">
        <path className="ask-axis" d="M8 140H348" />
        <g className="ask-plot">
          <path className="ask-known" d={line(0, 8)} />
          <path className="ask-forecast" d={line(8, 11)} />
        </g>
        <circle className="ask-peak" cx={chartX(10)} cy={chartY(DEMAND[10])} r="9" />
        <text className="ask-month" x={chartX(10)} y="164" textAnchor="middle">Nov</text>
        <text className="ask-note" x="10" y="164">illustrative</text>
      </svg>
    </Figure>
  );
}

// One supervisor, eleven capstone projects, and the fellows on each. How the
// cohort was split between projects is drawn evenly; the totals are real.
const PROJECTS = 11;
const FELLOWS_EACH = 3;

export function TeamFigure() {
  return (
    <Figure className="fig-team">
      <svg viewBox="-130 -130 260 260">
        {Array.from({ length: PROJECTS }, (_, i) => {
          const a = (i / PROJECTS) * 360;
          return (
            <g key={i} transform={`rotate(${a})`} className="team-project" style={{ transitionDelay: `${i * 80}ms` }}>
              <line className="team-spoke" x1="20" y1="0" x2="66" y2="0" />
              <circle className="team-node" cx="72" cy="0" r="9" />
              {Array.from({ length: FELLOWS_EACH }, (_, f) => {
                const spread = (f - (FELLOWS_EACH - 1) / 2) * 0.17;
                return <circle key={f} className="team-fellow" cx={106 * Math.cos(spread)} cy={106 * Math.sin(spread)} r="5" />;
              })}
            </g>
          );
        })}
        <circle className="team-hub" r="18" />
      </svg>
    </Figure>
  );
}
