// The building blocks every lesson simulation is made of: a drawing area,
// controls under it, and live readouts. Colours come from CSS classes, so the
// drawings follow the light/dark theme.
import React, { createContext, useContext, useId } from "react";
import { countOnce, here, shortName } from "../lib/visits";

// Which simulation a control belongs to, so a count can say "the depth slider in the tree sim".
const SimName = createContext("");

/** Counts a control being used: once per page visit for each control (and each choice made). */
function useCountControl() {
  const sim = useContext(SimName);
  return (...what) => countOnce("control", here(), sim, ...what);
}

/** A linear map from a data range onto a pixel range. */
/** An SVG path through points, skipping gaps (null y). */
/** A filled band between a lower and an upper line. */
/** A simulation's frame: the picture, then its controls and readouts. */
export function Sim({ children, controls, readouts, label, wide = false }) {
  // Counts the first touch of each simulation, to see which ones get played with.
  const name = shortName(label?.split(":")[0] || "sim");
  const touch = () => countOnce("sim", here(), name);
  return (
    <SimName.Provider value={name}>
      <figure className={`sim${wide ? " sim-wide" : ""}`} aria-label={label} onPointerDownCapture={touch} onKeyDownCapture={touch}>
        <div className="sim-stage">{children}</div>
        {(controls || readouts) && (
          <div className="sim-bottom">
            {controls && <div className="sim-controls">{controls}</div>}
            {readouts && <dl className="sim-readouts">{readouts}</dl>}
          </div>
        )}
      </figure>
    </SimName.Provider>
  );
}

/** An SVG drawing area with a fixed coordinate system that scales to fit. */
export function Canvas({ width = 640, height = 300, children, className = "", ...rest }) {
  return (
    <svg className={`sim-svg ${className}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" {...rest}>
      {children}
    </svg>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format = (v) => v }) {
  const id = useId();
  const count = useCountControl();
  return (
    <div className="ctl ctl-slider">
      <label htmlFor={id}>
        {label} <output>{format(value)}</output>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => {
          count(label);
          onChange(Number(e.target.value));
        }}
      />
    </div>
  );
}

export function Toggle({ label, checked, onChange }) {
  const count = useCountControl();
  return (
    <label className="ctl ctl-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          count(label, e.target.checked ? "on" : "off");
          onChange(e.target.checked);
        }}
      />
      <span className="ctl-switch" aria-hidden="true" />
      {label}
    </label>
  );
}

/** A row of mutually exclusive buttons. */
export function Choice({ label, options, value, onChange }) {
  const count = useCountControl();
  return (
    <div className="ctl ctl-choice" role="group" aria-label={label}>
      {label && <span className="ctl-label">{label}</span>}
      <div className="ctl-segments">
        {options.map((o) => {
          const [v, text] = Array.isArray(o) ? o : [o, o];
          return (
            <button
              key={String(v)}
              type="button"
              aria-pressed={value === v}
              onClick={() => {
                count(label || "choice", typeof text === "string" ? text : String(v));
                onChange(v);
              }}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Button({ children, onClick, primary = false, disabled = false }) {
  const count = useCountControl();
  return (
    <button
      type="button"
      className={`ctl-btn${primary ? " is-primary" : ""}`}
      onClick={(e) => {
        count(typeof children === "string" ? children : "button");
        onClick?.(e);
      }}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/** A live number beside the drawing. */
export function Readout({ label, value, tone }) {
  return (
    <div className={`readout${tone ? ` tone-${tone}` : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * Calls `tick(dt)` every frame while `running` and the element is on screen.
 * Returns a ref for that element.
 */
/** A clock that runs on its own (for ambient animation), still for reduced motion. */
/** Tells a quiz task what the simulation currently shows. */
/** Pointer position in an SVG's own coordinates. */
/** Drag handling for an SVG: onMove gets the pointer in SVG coordinates. */
/** Light axes with a handful of labelled ticks. */
export function Axes({ x, y, xTicks = [], yTicks = [], xLabel, yLabel, fmtX = (v) => v, fmtY = (v) => v }) {
  const [x0, x1] = x.range;
  const [y0, y1] = y.range;
  return (
    <g className="axes">
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line className="grid" x1={x0} x2={x1} y1={y.f(t)} y2={y.f(t)} />
          <text className="tick" x={x0 - 6} y={y.f(t)} textAnchor="end" dominantBaseline="middle">
            {fmtY(t)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={`x${t}`} className="tick" x={x.f(t)} y={y0 + 16} textAnchor="middle">
          {fmtX(t)}
        </text>
      ))}
      <line className="axis" x1={x0} x2={x1} y1={y0} y2={y0} />
      {xLabel && (
        <text className="axis-label is-x" x={x1} y={y0 + 32} textAnchor="end">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text className="axis-label" x={x0} y={y1 - 10}>
          {yLabel}
        </text>
      )}
    </g>
  );
}

/** Maths set inline in the reading text. */
export const M = ({ children }) => <span className="m">{children}</span>;

/** A displayed equation, with an optional plain-words reading under it. */
export function Eq({ children, says }) {
  return (
    <div className="eq">
      <div className="eq-math">{children}</div>
      {says && <p className="eq-says">{says}</p>}
    </div>
  );
}

/** A small comparison table for "how it works" sections. */
export function Table({ head, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (j ? <td key={j}>{c}</td> : <th key={j} scope="row">{c}</th>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A frame of reference: a scale plus the pixel range it maps to. */