// Where the street lamps go. Pure, so it's testable; the scene draws them.
//
// Lamps line every road a little outside the kerb, their arms reaching out
// over the carriageway: both sides of the equator highway (staggered), one
// side of the spurs and lanes (the left, the side traffic keeps to). They
// stay off other roads, out of the water (except on bridges, where they
// stand on the raised deck), and clear of buildings, billboards and towns,
// which have their own glowing roundabout islands.

import { BUILDING_RADIUS, BILLBOARD_RADIUS, bridgeElevation, inRiver, roadDistance, worldDistance } from "./layout";

const KERB_GAP = 0.9;

/**
 * @param {object} world   layout from createLayout
 * @param {{ spacing?: number, highwaySpacing?: number }} [opts]
 * @returns {{ x: number, z: number, h: number, dx: number, dz: number }[]}
 *   (x, z): the post; h: ground (deck) height there; (dx, dz): unit plane
 *   direction the arm reaches, toward the road's centre line.
 */
export function placeLamps(world, { spacing = 16, highwaySpacing = 13 } = {}) {
  const lamps = [];
  const free = (x, z) => {
    if (world.roads.some((r) => roadDistance(world, x, z, r, r.halfWidth + 0.4) !== Infinity)) return false;
    if (world.cities.some((c) => worldDistance(world, c.x, c.z, x, z) < c.radius + 2.5)) return false;
    if (world.buildings.some((b) => worldDistance(world, b.x, b.z, x, z) < BUILDING_RADIUS + 1)) return false;
    if (world.billboards.some((b) => worldDistance(world, b.x, b.z, x, z) < BILLBOARD_RADIUS + 1.5)) return false;
    if (lamps.some((l) => worldDistance(world, l.x, l.z, x, z) < 5)) return false;
    return true;
  };

  for (const road of world.roads) {
    const highway = road.kind === "highway";
    const step = highway ? highwaySpacing : spacing;
    const sides = highway ? [1, -1] : [1];
    const pts = road.points;
    sides.forEach((side, k) => {
      // Walk the road by arc length, dropping a lamp every `step`; the two
      // highway sides are staggered by half a step.
      let next = step / 2 + (k * step) / 2;
      for (let i = 1; i < pts.length; i++) {
        const [x0, z0] = pts[i - 1];
        const [x1, z1] = pts[i];
        const seg = Math.hypot(x1 - x0, z1 - z0);
        if (!seg) continue;
        const tx = (x1 - x0) / seg;
        const tz = (z1 - z0) / seg;
        // Left of travel along the polyline is (tz, -tx).
        const ox = tz * side;
        const oz = -tx * side;
        for (; next < seg; next += step) {
          const x = x0 + tx * next + ox * (road.halfWidth + KERB_GAP);
          const z = z0 + tz * next + oz * (road.halfWidth + KERB_GAP);
          const h = bridgeElevation(world, x, z);
          if (h < 0.5 && inRiver(world, x, z, 1)) continue;
          if (!free(x, z)) continue;
          lamps.push({ x, z, h, dx: -ox, dz: -oz });
        }
        next -= seg;
      }
    });
  }
  return lamps;
}
