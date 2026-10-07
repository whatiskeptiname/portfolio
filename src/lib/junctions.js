// Where roads meet a town's roundabout, the road mouth flares out to the ring
// with curved kerbs (fillets) on both sides, the way real roundabout entries
// do. Each fillet is an arc of radius `fillet` that just touches the road
// edge and the ring's outer circle; the asphalt between them is filled in.
// Pure plane geometry, so it's testable; the scene drapes it on the planet.

import { wrapDelta } from "./layout";

/**
 * @param {object} world   layout from createLayout
 * @param {{ ring: number, fillet?: number, steps?: number }} opts
 *   ring: the roundabout's outer radius; fillet: kerb arc radius.
 * @returns {{ cityId, x, z, mouths: { angle, halfAngle }[], fillets: { area: number[][], kerb: number[][] }[] }[]}
 *   mouths: where the ring edge line should open (angle ± halfAngle, radians,
 *   measured with atan2(dz, dx)); fillets: `area` is a closed outline to fill,
 *   `kerb` the arc itself (for the edge line).
 */
export function roundaboutJunctions(world, { ring, fillet = 3, steps = 10 }) {
  const ends = new Map(world.cities.map((c) => [c.id, []]));
  for (const road of world.roads) {
    if (road.kind === "highway") continue;
    if (ends.has(road.from)) ends.get(road.from).push({ road, point: road.points[0] });
    if (road.to != null && ends.has(road.to)) ends.get(road.to).push({ road, point: road.points.at(-1) });
  }

  return world.cities.map((city) => {
    const mouths = [];
    const fillets = [];
    for (const { road, point } of ends.get(city.id)) {
      const ux0 = wrapDelta(point[0] - city.x, world.width);
      const uz0 = point[1] - city.z;
      const len = Math.hypot(ux0, uz0) || 1;
      const u = [ux0 / len, uz0 / len]; // out along the road
      const v = [-u[1], u[0]]; // across it
      const w = road.halfWidth;
      // Fillet centre: (w + f) off the road axis and (ring + f) from the town centre.
      const along = Math.sqrt(Math.max(0, (ring + fillet) ** 2 - (w + fillet) ** 2));
      const at = (a, b) => [city.x + u[0] * a + v[0] * b, city.z + u[1] * a + v[1] * b];
      let halfAngle = 0;
      for (const side of [1, -1]) {
        const c = [along, side * (w + fillet)]; // in (along, across) coordinates
        const t1 = [along, side * w]; // touches the road edge
        const k = ring / (ring + fillet);
        const t2 = [c[0] * k, c[1] * k]; // touches the ring
        // Arc from t1 to t2 around c, the short way.
        const a1 = Math.atan2(t1[1] - c[1], t1[0] - c[0]);
        let a2 = Math.atan2(t2[1] - c[1], t2[0] - c[0]);
        let delta = a2 - a1;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        const arc = [];
        for (let i = 0; i <= steps; i++) {
          const a = a1 + (delta * i) / steps;
          arc.push([c[0] + Math.cos(a) * fillet, c[1] + Math.sin(a) * fillet]);
        }
        a2 = a1 + delta;
        // Where the road edge itself crosses the ring.
        const e = [Math.sqrt(Math.max(0, ring * ring - w * w)), side * w];
        // Back along the ring from t2 to e, closing the shape.
        const ringBack = [];
        const r2 = Math.atan2(t2[1], t2[0]);
        const re = Math.atan2(e[1], e[0]);
        for (let i = 1; i < 4; i++) {
          const a = r2 + ((re - r2) * i) / 4;
          ringBack.push([Math.cos(a) * ring, Math.sin(a) * ring]);
        }
        const area = [e, ...arc, ...ringBack].map(([a, b]) => at(a, b));
        fillets.push({ area, kerb: arc.map(([a, b]) => at(a, b)) });
        halfAngle = Math.max(halfAngle, Math.abs(Math.atan2(t2[1], t2[0])));
      }
      mouths.push({ angle: Math.atan2(u[1], u[0]), halfAngle });
    }
    return { cityId: city.id, x: city.x, z: city.z, mouths, fillets };
  });
}

/**
 * The parts of a circle not covered by any mouth, as [start, end] angle
 * pairs (end > start) — where the ring's edge line should be drawn.
 */
export function openArcs(mouths) {
  if (!mouths.length) return [[0, Math.PI * 2]];
  const TAU = Math.PI * 2;
  const gaps = mouths
    .map((m) => [((m.angle - m.halfAngle) % TAU + TAU) % TAU, m.halfAngle * 2])
    .sort((a, b) => a[0] - b[0]);
  const arcs = [];
  for (let i = 0; i < gaps.length; i++) {
    const [start, size] = gaps[i];
    const end = start + size;
    const next = i + 1 < gaps.length ? gaps[i + 1][0] : gaps[0][0] + TAU;
    if (next > end) arcs.push([end, next]);
  }
  return arcs;
}

/**
 * Where each spur meets the equator highway it flares the same way, with a
 * curved kerb on each side running from the spur's edge into the highway's.
 * Spurs arrive at right angles, so each fillet is a quarter circle.
 * @returns {{ roadId, cityId, x, side: 1 | -1, from: number, to: number, fillets: { area, kerb }[] }[]}
 *   side: which highway edge it opens (+1 south, -1 north, by plane z);
 *   from/to: the plane-x span where that edge's line should open.
 */
export function highwayJunctions(world, { fillet = 4, steps = 10 } = {}) {
  const highway = world.roads.find((r) => r.kind === "highway");
  if (!highway) return [];
  const H = highway.halfWidth;
  return world.roads
    .filter((r) => r.kind === "spur")
    .map((road) => {
      const [x, z] = road.points.at(-1);
      const before = road.points.at(-2) ?? [x, z - 1];
      const side = Math.sign(before[1] - z) || 1; // the spur comes in from this side
      const w = road.halfWidth;
      const fillets = [-1, 1].map((dir) => {
        // Centre: off the spur edge by `fillet`, off the highway edge by `fillet`.
        const cx = x + dir * (w + fillet);
        const cz = side * (H + fillet);
        const kerb = [];
        for (let i = 0; i <= steps; i++) {
          // From the spur edge (pointing back at the spur) round to the highway edge.
          const a = (Math.PI / 2) * (i / steps);
          kerb.push([cx - dir * fillet * Math.cos(a), cz - side * fillet * Math.sin(a)]);
        }
        const corner = [x + dir * w, side * H];
        return { area: [corner, ...kerb], kerb };
      });
      return { roadId: road.id, cityId: road.from, x, side, from: x - w - fillet, to: x + w + fillet, fillets };
    });
}

/**
 * Splits a straight run of plane x from `start` to `end` around the given
 * [from, to] gaps; returns the solid stretches as [a, b] pairs.
 */
export function openRuns(start, end, gaps) {
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  const runs = [];
  let cursor = start;
  for (const [a, b] of sorted) {
    if (a > cursor) runs.push([cursor, Math.min(a, end)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < end) runs.push([cursor, end]);
  return runs;
}
