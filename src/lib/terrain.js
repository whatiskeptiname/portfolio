// Gentle terrain: the planet isn't a perfect sphere. Two layers:
//  - swells: long, low undulations (wavelengths of 100+ units) everywhere —
//    roads, the equator highway and the river rise and dip with them — but
//    easing out to level ground in and around every town;
//  - hills: smaller rolling hills and hollows out in open country only,
//    flattening out under roads, the river and towns, so no road ever gets
//    a sharp bump.
// Both fade out before the polar sea and mountains. Built once into a grid;
// the scene lifts everything placed on the surface by terrainAt()
// (see setGround in src/city/globe3d.js). Pure, so it's testable.

import { HIGHWAY_HALF_WIDTH, wrapDelta } from "./layout";

export const TERRAIN_AMPLITUDE = 1.8; // tallest hill / deepest hollow, roughly
export const SWELL_AMPLITUDE = 1.4; // the long undulations roads ride over
const TOWN_MARGIN = 40; // distance over which swells ease out to a level town
const CELL = 2; // grid spacing (plane units)
const FLAT_MARGIN = 9; // distance over which the ground rises from flat features

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * @param {object} world   layout (roads, cities, river, bounds, width)
 * @param {() => number} rng
 */
export function buildTerrain(world, rng) {
  const { width } = world;
  const { halfZ } = world.bounds;
  const cols = Math.ceil(width / CELL);
  const rows = Math.ceil((2 * halfZ) / CELL) + 1;
  const z0 = -halfZ;
  // Distance from each cell to the nearest flat feature's edge.
  const flat = new Float32Array(cols * rows).fill(FLAT_MARGIN);
  const towns = new Float32Array(cols * rows).fill(TOWN_MARGIN);
  const stamp = (x, z, inner, field = flat, margin = FLAT_MARGIN) => {
    const reach = inner + margin;
    const c0 = Math.floor((x - reach) / CELL);
    const c1 = Math.ceil((x + reach) / CELL);
    const r0 = Math.max(0, Math.floor((z - reach - z0) / CELL));
    const r1 = Math.min(rows - 1, Math.ceil((z + reach - z0) / CELL));
    for (let r = r0; r <= r1; r++) {
      const cz = z0 + r * CELL;
      for (let c = c0; c <= c1; c++) {
        const col = ((c % cols) + cols) % cols;
        const d = Math.hypot(c * CELL - x, cz - z) - inner;
        const i = r * cols + col;
        if (d < field[i]) field[i] = Math.max(0, d);
      }
    }
  };
  const along = (points, halfWidth) => {
    for (let i = 0; i < points.length; i++) {
      const w = Array.isArray(halfWidth) ? halfWidth[i] : halfWidth;
      stamp(points[i][0], points[i][1], w);
      // Fill between samples so long segments don't leave gaps.
      if (i) {
        const [ax, az] = points[i - 1];
        const [bx, bz] = points[i];
        const n = Math.floor(Math.hypot(bx - ax, bz - az) / 1.5);
        for (let k = 1; k < n; k++) stamp(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, w);
      }
    }
  };
  for (const road of world.roads) {
    if (road.kind === "highway") continue; // a straight band: handled analytically below
    along(road.points, road.halfWidth + 1.5);
  }
  along(world.river.points, world.river.widths.map((w) => w + 2));
  for (const c of world.cities) {
    stamp(c.x, c.z, c.radius + 3);
    stamp(c.x, c.z, c.radius + 3, towns, TOWN_MARGIN);
  }
  for (const b of world.billboards ?? []) stamp(b.x, b.z, 3);

  // Hills: a few wave trains, each wrapping round the planet seamlessly
  // (a whole number of wavelengths east–west).
  const waves = Array.from({ length: 6 }, (_, i) => {
    const wavelength = 26 + i * 9 + rng() * 10;
    return {
      kx: (Math.round(width / wavelength) * 2 * Math.PI) / width,
      kz: ((rng() - 0.5) * 2 * Math.PI) / wavelength,
      phase: rng() * Math.PI * 2,
      amp: TERRAIN_AMPLITUDE * (0.5 - i * 0.05),
    };
  });
  // Swells: long wavelengths only, so a road over them just rises and falls.
  const swells = Array.from({ length: 3 }, (_, i) => {
    const wavelength = 110 + i * 45 + rng() * 30;
    return {
      kx: (Math.max(1, Math.round(width / wavelength)) * 2 * Math.PI) / width,
      kz: ((rng() - 0.5) * 2 * Math.PI) / wavelength,
      phase: rng() * Math.PI * 2,
      amp: SWELL_AMPLITUDE * [0.5, 0.32, 0.18][i],
    };
  });
  const data = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const z = z0 + r * CELL;
    const poles = smooth(halfZ, halfZ - 12, Math.abs(z));
    const swellPoles = smooth(halfZ, halfZ - 40, Math.abs(z)); // a long fade: the river runs through it
    const country = poles * smooth(HIGHWAY_HALF_WIDTH + 1, HIGHWAY_HALF_WIDTH + 1 + FLAT_MARGIN, Math.abs(z));
    for (let c = 0; c < cols; c++) {
      const x = c * CELL;
      let h = 0;
      for (const w of waves) h += w.amp * Math.sin(w.kx * x + w.kz * z + w.phase) * Math.cos(w.kx * 0.37 * x - w.kz * 1.7 * z + w.phase * 0.5);
      const i = r * cols + c;
      let swell = 0;
      for (const w of swells) swell += w.amp * Math.sin(w.kx * x + w.kz * z + w.phase);
      data[i] = h * country * smooth(1, FLAT_MARGIN, flat[i]) + swell * swellPoles * smooth(0, TOWN_MARGIN, towns[i]);
    }
  }
  return { cell: CELL, cols, rows, z0, data };
}

/** Ground height at plane (x, z): 0 on roads, in towns and by water. */
export function terrainAt(world, x, z) {
  const t = world.terrain;
  if (!t) return 0;
  const fz = (z - t.z0) / t.cell;
  if (fz <= 0 || fz >= t.rows - 1) return 0;
  const fx = ((((wrapDelta(x, world.width) % world.width) + world.width) % world.width) / t.cell) % t.cols;
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fz);
  const c1 = (c0 + 1) % t.cols;
  const u = fx - c0;
  const v = fz - r0;
  const at = (r, c) => t.data[r * t.cols + c];
  return (at(r0, c0) * (1 - u) + at(r0, c1) * u) * (1 - v) + (at(r0 + 1, c0) * (1 - u) + at(r0 + 1, c1) * u) * v;
}
