// Walkthroughs for the trees chapter. Each scene is a picture of time t, from 0
// (start of the scene) to 1 (its finished frame).
import React, { useMemo } from "react";
import { crowdRight, range, rng } from "../math";
import { Axes, Canvas } from "../kit";
import { frame, linePath, pct } from "../plot";

const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
const phase = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

// 1. Each tree gets its own random resample of the rows, and its own columns.
export function Resample({ t }) {
  const rows = 12;
  const trees = useMemo(() => {
    const rand = rng(41);
    const cols = ["age", "plan", "bills", "calls", "tenure"];
    return range(3).map((k) => ({
      picks: range(rows).map(() => Math.floor(rand() * rows)),
      cols: [cols[k], cols[(k + 2) % 5], cols[(k + 4) % 5]],
    }));
  }, []);
  const cell = 18;
  return (
    <Canvas width={640} height={300}>
      <text className="label" x={24} y={34}>
        Your data: 12 customers
      </text>
      {range(rows).map((i) => (
        <g key={i} transform={`translate(${24 + (i % 4) * (cell + 6)},${50 + Math.floor(i / 4) * (cell + 6)})`}>
          <rect width={cell} height={cell} rx="4" className="node" />
          <text className="note" x={cell / 2} y={13} textAnchor="middle">
            {i + 1}
          </text>
        </g>
      ))}
      {trees.map((tree, k) => {
        const local = ease(phase(t, k * 0.22, k * 0.22 + 0.5));
        const shown = Math.round(local * rows);
        const used = new Set(tree.picks.slice(0, shown));
        const left = rows - new Set(tree.picks).size;
        const x0 = 180 + k * 150;
        return (
          <g key={k} opacity={0.25 + 0.75 * Math.min(1, local * 3)}>
            <text className="label" x={x0} y={34}>
              Tree {k + 1}
            </text>
            {tree.picks.slice(0, shown).map((p, j) => (
              <g key={j} transform={`translate(${x0 + (j % 4) * (cell + 6)},${50 + Math.floor(j / 4) * (cell + 6)})`}>
                <rect width={cell} height={cell} rx="4" className="cm-cell tone-good" />
                <text className="note" x={cell / 2} y={13} textAnchor="middle">
                  {p + 1}
                </text>
              </g>
            ))}
            {local >= 1 && (
              <>
                <text className="note" x={x0} y={140}>
                  {left} customers left out
                </text>
                <text className="note" x={x0} y={158}>
                  {used.size < rows ? "some picked twice" : ""}
                </text>
              </>
            )}
            {local >= 1 && (
              <g transform={`translate(${x0},176)`}>
                <text className="note" y={0}>
                  may only look at:
                </text>
                {tree.cols.map((c, j) => (
                  <g key={c} transform={`translate(0,${12 + j * 24})`}>
                    <rect width={84} height={20} rx="10" className="cm-cell tone-bad" />
                    <text className="note" x={42} y={14} textAnchor="middle">
                      {c}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </g>
        );
      })}
    </Canvas>
  );
}

// 2. The trees vote; their mistakes cancel, until they start copying each other.
export function Vote({ t }) {
  const p = 0.6;
  const grow = ease(phase(t, 0, 0.5));
  const copy = ease(phase(t, 0.6, 0.95));
  const n = Math.max(1, Math.round(grow * 50) * 2 + 1);
  const votes = useMemo(() => {
    const rand = rng(7);
    return range(101).map(() => rand());
  }, []);
  const shared = 0.72; // the shared answer, when trees copy: this time, wrong
  const acc = crowdRight(n, p, copy);
  const X = frame([0, 1], [24, 616]);
  return (
    <Canvas width={640} height={300}>
      <text className="label" x={24} y={30}>
        {n} {n === 1 ? "tree" : "trees"} vote{n === 1 ? "s" : ""}. Each is right only 60% of the time.
      </text>
      {range(n).map((i) => {
        const own = votes[i] < p;
        const right = copy > 0 && votes[(i * 37) % 101] < copy ? shared < p : own;
        return <rect key={i} x={24 + (i % 26) * 23} y={46 + Math.floor(i / 26) * 23} width={18} height={18} rx="4" className={right ? "bar-a" : "bar-bad"} />;
      })}
      <text className="note" x={24} y={160}>
        How often the vote is right
      </text>
      <rect className="frame-line" x={X.f(0)} y={170} width={X.f(1) - X.f(0)} height={14} rx="7" />
      <rect className="bar-a" x={X.f(0)} y={170} width={X.f(acc) - X.f(0)} height={14} rx="7" />
      <line className="line-ink" x1={X.f(0.6)} x2={X.f(0.6)} y1={164} y2={190} />
      <text className="note" x={X.f(0.6)} y={204} textAnchor="middle">
        one tree: 60%
      </text>
      <text className="label" x={X.f(acc) - 4} y={162} textAnchor="end">
        {pct(acc)}
      </text>
      {copy > 0 && (
        <text className="label" x={24} y={250} opacity={Math.min(1, copy * 2)}>
          Now the trees copy each other ({pct(copy)} of the time): the mistakes stop cancelling.
        </text>
      )}
      {copy === 0 && grow >= 1 && (
        <text className="label" x={24} y={250}>
          Different mistakes cancel out, so the crowd is right far more often.
        </text>
      )}
    </Canvas>
  );
}

// 3. More trees help, then level off: a few hundred is plenty.
export function Plateau({ t }) {
  const X = frame([1, 500], [60, 610]);
  const Y = frame([0.55, 1], [250, 30]);
  const ns = range(250).map((i) => 1 + i * 2);
  const upto = Math.max(2, Math.round(ease(phase(t, 0, 0.75)) * ns.length));
  const pts = ns.slice(0, upto).map((n) => [n, crowdRight(n, 0.6, 0.15)]);
  const last = pts[pts.length - 1];
  return (
    <Canvas width={640} height={300}>
      <Axes x={X} y={Y} xTicks={[1, 100, 200, 300, 400, 500]} yTicks={[0.6, 0.7, 0.8, 0.9]} fmtY={(v) => pct(v)} xLabel="trees in the forest" />
      <path className="line-a thick" d={linePath(pts, X.f, Y.f)} />
      <circle className="dot-ink" cx={X.f(last[0])} cy={Y.f(last[1])} r="5" />
      {t > 0.8 && (
        <text className="label" x={X.f(500)} y={Y.f(0.7)} textAnchor="end" opacity={phase(t, 0.8, 0.9)}>
          Past a few hundred trees it barely moves: more is never worse, only slower.
        </text>
      )}
    </Canvas>
  );
}
