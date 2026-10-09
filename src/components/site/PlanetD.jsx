// The "D" of "3D planet", drawn as the planet: a sphere lit from the right,
// like a first-quarter moon. Its bright half (flat edge where day meets
// night, round on the other side) is the D; the night side stays dim. The
// surface (gold résumé north, teal open-source south, the blue equator and
// their districts) turns across the whole globe.
import React, { useId } from "react";

const R = 8; // sphere radius in a 16 × 16 box
const TERMINATOR = 7.6; // x of the day/night line: the D's straight edge

// One turn's worth of surface (16 units wide); drawn twice so it can loop.
function Surface({ x }) {
  return (
    <g transform={`translate(${x} 0)`}>
      {/* meridians */}
      {[2, 7.3, 12.6].map((m) => (
        <rect key={m} x={m} y="0" width="0.6" height="16" fill="#000" opacity="0.16" />
      ))}
      {/* northern districts: résumé towers */}
      <rect x="3.6" y="3.4" width="1.2" height="2.8" rx="0.3" fill="#fff3d6" />
      <rect x="9.2" y="2.6" width="1.2" height="3.6" rx="0.3" fill="#fff3d6" />
      <rect x="13.8" y="4.2" width="1" height="2" rx="0.3" fill="#fff3d6" />
      {/* southern districts: one per language */}
      <circle cx="4.4" cy="11" r="1.1" fill="#5b6fd6" />
      <circle cx="8.8" cy="12.6" r="1" fill="#f0b65a" />
      <circle cx="12.6" cy="10.6" r="1.2" fill="#c0653a" />
    </g>
  );
}

export default function PlanetD() {
  const id = useId().replace(/:/g, "");
  const u = (name) => `url(#${id}-${name})`;
  return (
    <svg className="planet-d" viewBox="0 0 16 16" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-globe`}>
          <circle cx={R} cy={R} r={R} />
        </clipPath>
        <linearGradient id={`${id}-n`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3a3" />
          <stop offset="1" stopColor="#c08a3a" />
        </linearGradient>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fdcc0" />
          <stop offset="1" stopColor="#1d6b5c" />
        </linearGradient>
        {/* night: dark up to the terminator, with a thin soft edge */}
        <linearGradient id={`${id}-night`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#03050c" stopOpacity="0.88" />
          <stop offset={(TERMINATOR - 0.25) / 16} stopColor="#03050c" stopOpacity="0.82" />
          <stop offset={(TERMINATOR + 0.25) / 16} stopColor="#03050c" stopOpacity="0" />
        </linearGradient>
        {/* roundness on the day side: bright towards the light, darker at the limb */}
        <radialGradient id={`${id}-shade`} cx="0.62" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </radialGradient>
      </defs>
      <g clipPath={u("globe")}>
        <rect x="0" y="0" width="16" height="8" fill={u("n")} />
        <rect x="0" y="8" width="16" height="8" fill={u("s")} />
        <g className="planet-d-spin">
          <Surface x={0} />
          <Surface x={16} />
        </g>
        <rect x="0" y="7.3" width="16" height="1.4" fill="#4fd8ff" />
        <rect x="0" y="0" width="16" height="16" fill={u("shade")} />
        <rect x="0" y="0" width="16" height="16" fill={u("night")} />
      </g>
      {/* a faint rim so the night side still reads as part of a sphere */}
      <circle cx={R} cy={R} r={R - 0.3} fill="none" stroke="#7fdcc0" strokeOpacity="0.28" strokeWidth="0.6" />
    </svg>
  );
}
