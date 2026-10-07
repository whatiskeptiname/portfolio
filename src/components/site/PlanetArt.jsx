// Illustration for the "equator" band: the two-tone planet (résumé north,
// open source south) beside the black hole, drawn from the same data as the
// 3D world.
import React from "react";
import { cityGroups, languageColor } from "../../data";

export default function PlanetArt() {
  const north = cityGroups.filter((g) => g.side === "north");
  const south = cityGroups.filter((g) => g.side !== "north");
  const cx = 250;
  const cy = 170;
  const r = 110;

  // Little towers along each hemisphere's limb, one per district.
  const towers = (groups, sign) =>
    groups.map((g, i) => {
      const t = (i + 0.5) / groups.length;
      const a = Math.PI * (sign < 0 ? 1.12 + t * 0.76 : 0.12 + t * 0.76);
      const h = sign < 0 ? 16 + (g.projects.length % 4) * 4 : 8 + Math.min(g.projects.length, 14);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const deg = (a * 180) / Math.PI + 90;
      return (
        <rect
          key={g.language}
          x={x - 3.5}
          y={y - h}
          width="7"
          height={h}
          rx="1.5"
          fill={sign < 0 ? "#fff3d6" : languageColor(g.language, 70)}
          transform={`rotate(${deg} ${x} ${y})`}
        />
      );
    });

  return (
    <svg className="planet-art" viewBox="0 0 520 340" role="img" aria-label="A two-tone planet beside a black hole">
      <defs>
        <radialGradient id="pa-north" cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffe3a3" />
          <stop offset="1" stopColor="#a8762c" />
        </radialGradient>
        <radialGradient id="pa-south" cx="40%" cy="20%" r="90%">
          <stop offset="0" stopColor="#9be3c6" />
          <stop offset="1" stopColor="#1d6b5c" />
        </radialGradient>
        <linearGradient id="pa-disk" x1="0" x2="1">
          <stop offset="0" stopColor="#ff6a1a" stopOpacity="0" />
          <stop offset="0.35" stopColor="#ffb057" />
          <stop offset="0.5" stopColor="#fff4dc" />
          <stop offset="0.65" stopColor="#ffb057" />
          <stop offset="1" stopColor="#ff6a1a" stopOpacity="0" />
        </linearGradient>
        <filter id="pa-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <clipPath id="pa-planet">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>

      {/* Black hole, upper left: lensed halo, disk, shadow */}
      <g transform="translate(92 70)">
        <ellipse rx="58" ry="52" fill="none" stroke="url(#pa-disk)" strokeWidth="7" filter="url(#pa-glow)" opacity="0.8" />
        <ellipse rx="86" ry="13" fill="none" stroke="url(#pa-disk)" strokeWidth="9" filter="url(#pa-glow)" />
        <circle r="30" fill="#000" />
        <circle r="31.5" fill="none" stroke="#ffd59a" strokeWidth="1.5" opacity="0.9" />
        <path d="M -86 0 A 86 13 0 0 0 86 0" fill="none" stroke="url(#pa-disk)" strokeWidth="5" />
      </g>

      {towers(north, -1)}
      {towers(south, 1)}
      <g clipPath="url(#pa-planet)">
        <rect x={cx - r} y={cy - r} width={r * 2} height={r} fill="url(#pa-north)" />
        <rect x={cx - r} y={cy} width={r * 2} height={r} fill="url(#pa-south)" />
        <rect x={cx - r} y={cy - 5} width={r * 2} height="10" fill="#4fd8ff" />
        <rect x={cx - r} y={cy - 5} width={r * 2} height="10" fill="#4fd8ff" filter="url(#pa-glow)" />
        {/* Terminator shading, lit from the black hole */}
        <circle cx={cx + 70} cy={cy + 50} r={r * 1.25} fill="#03040b" opacity="0.28" />
      </g>
      <text x={cx} y={cy - 40} textAnchor="middle" className="pa-label north">RÉSUMÉ</text>
      <text x={cx} y={cy + 52} textAnchor="middle" className="pa-label south">OPEN SOURCE</text>
    </svg>
  );
}
