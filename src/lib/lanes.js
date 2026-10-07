// Lane recognition: which lane the car is in, and where its edges run
// ahead — the drivable strip it should keep to. Traffic keeps left, so on a
// two-way road its lane runs from the road's centre line out to the left-
// hand edge; on a roundabout it's the ring between the island and the outer
// kerb. Pure, so it's testable; the driver view draws it.

import { PLAZA_RADIUS, ROUNDABOUT_ISLAND, wrapDelta } from "./layout";

const NAMES = { highway: "Equator highway", spur: "Side road", lane: "Country lane" };

/** The nearest point on `road`'s centre line to (x, z), its distance, and the road's direction there. */
export function closestOnRoad(world, road, x, z) {
  const pts = road.points;
  let best = null;
  for (let i = 1; i < pts.length; i++) {
    const ax = wrapDelta(pts[i - 1][0] - x, world.width);
    const az = pts[i - 1][1] - z;
    const bx = ax + (pts[i][0] - pts[i - 1][0]);
    const bz = az + (pts[i][1] - pts[i - 1][1]);
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1e-9;
    const t = Math.max(0, Math.min(1, -(ax * dx + az * dz) / len2));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(px, pz);
    if (!best || d < best.d) {
      const len = Math.sqrt(len2);
      best = { x: x + px, z: z + pz, d, tx: dx / len, tz: dz / len };
    }
  }
  return best;
}

/**
 * The lane at (x, z) for a car heading (fx, fz): { kind: "road" | "ring",
 * label, left: [x, z], right: [x, z] (the lane's two edges, across from
 * here), wrongWay: true if the car is in the other lane } — or null off-road.
 */
export function laneAt(world, x, z, fx, fz) {
  // On a roundabout: the ring.
  for (const town of world.cities) {
    const ox = wrapDelta(x - town.x, world.width);
    const oz = z - town.z;
    const d = Math.hypot(ox, oz);
    if (d < PLAZA_RADIUS - 0.3 && d > ROUNDABOUT_ISLAND) {
      const ux = ox / d;
      const uz = oz / d;
      const outer = PLAZA_RADIUS - 0.5;
      const inner = ROUNDABOUT_ISLAND + 0.35;
      // Going round clockwise (traffic keeping left), the outside is on our left.
      return {
        kind: "ring",
        label: `Roundabout · ${town.language}`,
        left: [town.x + ux * outer, town.z + uz * outer],
        right: [town.x + ux * inner, town.z + uz * inner],
        wrongWay: false,
      };
    }
  }
  // On a road: the nearest one whose surface we're on.
  let best = null;
  for (const road of world.roads) {
    const c = closestOnRoad(world, road, x, z);
    if (c && c.d <= road.halfWidth + 0.3 && (!best || c.d < best.c.d)) best = { road, c };
  }
  if (!best) return null;
  const { road, c } = best;
  // The road's direction, the way we're going; left of travel is (dz, -dx).
  const sign = c.tx * fx + c.tz * fz >= 0 ? 1 : -1;
  const lx = c.tz * sign;
  const lz = -c.tx * sign;
  const w = road.halfWidth;
  const side = wrapDelta(x - c.x, world.width) * lx + (z - c.z) * lz; // + = left of the centre line
  return {
    kind: "road",
    label: NAMES[road.kind] ?? "Road",
    left: [c.x + lx * w, c.z + lz * w],
    right: [c.x, c.z],
    wrongWay: side < -0.3,
  };
}

/**
 * The lane along the car's path ahead (poses as from lib/routing posesAhead
 * or lib/decision cruisePoses): its edges every `step` metres out to
 * `distance`, stopping where the path leaves the road.
 * @returns {{ label, wrongWay, offRoad, left: number[][], right: number[][] }}
 */
export function laneAhead(world, s, poses = [], { step = 2, distance = 40 } = {}) {
  const here = laneAt(world, s.x, s.z, -Math.sin(s.yaw), -Math.cos(s.yaw));
  const out = { label: here?.label ?? "Off-road", wrongWay: here?.wrongWay ?? false, offRoad: !here, left: [], right: [] };
  if (!here) return out;
  out.left.push(here.left);
  out.right.push(here.right);
  let next = step;
  for (const p of poses) {
    if (p.d < next) continue;
    if (p.d > distance) break;
    const lane = laneAt(world, p.x, p.z, -Math.sin(p.yaw), -Math.cos(p.yaw));
    if (!lane) break;
    out.left.push(lane.left);
    out.right.push(lane.right);
    next = p.d + step;
  }
  return out;
}
