// What a driver can see. Every decision the autopilot (and the other cars)
// makes is based only on this: it looks all round (360°), out to its view
// distance, but only sees what's in direct line of sight from its eyes —
// a building, a tree, another car or the rise of the ground in the way hides
// whatever is behind it. Anything right next to it (within VIEW.aware) it
// always notices, as a driver (or parking sensors) would. 1 unit = 1 m.
// Pure, so it's testable.

import { BILLBOARD_RADIUS, BUILDING_RADIUS, TREE_RADIUS, bridgeElevation, wrapDelta } from "./layout";
import { terrainAt } from "./terrain";

// `range`: how far it sees by default (min…max for the setting). `aware`:
// always noticed this close. `over`: closer than this you see between and
// over other cars (only buildings block the view); further away, cars hide
// what's behind them too. `eye`: the driver's eye height above the road.
export const VIEW = { range: 150, min: 10, max: 500, aware: 8, over: 25, eye: 1.2 };
/** The drone's camera: a cone ahead, and close-up awareness all round. */
export const DRONE_VIEW = { halfAngle: (40 * Math.PI) / 180, near: 2.5 };
const CAR_SIZE = 1.5; // a car blocks sight lines within this radius of its centre
// How tall things are, for sight lines over the rise of the ground.
const TOPS = { car: 1.4, light: 4.5, tree: 3.5, billboard: 6.6 };

/** The height of the road surface (terrain, plus bridge decks) at (x, z). */
export const groundOf = (world) => (x, z) => terrainAt(world, x, z) + bridgeElevation(world, x, z);

/** Does the segment from a to b pass within `r` of point c? (All in the car's unwrapped frame.) */
function blocks(ax, az, bx, bz, cx, cz, r) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = ((cx - ax) * dx + (cz - az) * dz) / len2;
  if (t <= 0.02 || t >= 0.98) return false; // the ends themselves don't hide anything
  const px = ax + dx * t - cx;
  const pz = az + dz * t - cz;
  return px * px + pz * pz < r * r;
}

/**
 * Can the driver of `self` see (x, z)? Within `range`, with nothing in
 * `blockers` ({ x, z, r }) on the straight line between them — and, given
 * `sight` { ground(x, z), eye, top } (absolute heights), with the ground
 * nowhere rising above the line from its eyes to the top of the thing.
 */
export function canSee(self, x, z, width, range = VIEW.range, blockers = [], sight = null) {
  const dx = wrapDelta(x - self.x, width);
  const dz = z - self.z;
  const d2 = dx * dx + dz * dz;
  if (d2 > range * range) return false;
  for (const b of blockers) {
    const bx = wrapDelta(b.x - self.x, width);
    const bz = b.z - self.z;
    if (blocks(0, 0, dx, dz, bx, bz, b.r)) return false;
  }
  if (sight) {
    const d = Math.sqrt(d2);
    const n = Math.ceil(d / Math.max(1.5, d / 40));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const line = sight.eye + (sight.top - sight.eye) * t;
      if (sight.ground(self.x + dx * t, self.z + dz * t) > line) return false;
    }
  }
  return true;
}

/**
 * What the driver of `self` can see right now: the other cars, the traffic
 * lights (approach by approach), the towns (roundabouts) and the obstacles
 * near it — all within its view distance and in direct line of sight.
 * `ground` (see groundOf) adds the rise of the land; `range` defaults to
 * self.viewRange.
 */
export function perceive(
  self,
  { others = [], signals = [], towns = [], buildings = [], trees = [], billboards = [], width, ground = null, range = self.viewRange ?? VIEW.range, cone = null }
) {
  const dist = (o) => Math.hypot(wrapDelta(o.x - self.x, width), o.z - self.z);
  // With a `cone` ({ halfAngle, near }) — the drone's camera — it only sees
  // ahead, within the cone, plus anything within `near` all round.
  const fx = -Math.sin(self.yaw);
  const fz = -Math.cos(self.yaw);
  const inCone = (o) => {
    if (!cone) return true;
    const dx = wrapDelta(o.x - self.x, width);
    const dz = o.z - self.z;
    const d = Math.hypot(dx, dz);
    return d < cone.near || (dx * fx + dz * fz) / (d || 1) > Math.cos(cone.halfAngle);
  };
  const near = (o, extra = 0) => dist(o) < range + extra && inCone(o);
  const eye = ground ? ground(self.x, self.z) + (self.alt ?? 0) + VIEW.eye : 0;
  const over = (x, z, height) => (ground ? { ground, eye, top: ground(x, z) + height } : null);
  // Only things that could be in the way.
  const walls = buildings.filter((b) => near(b, 5)).map((b) => ({ x: b.x, z: b.z, r: BUILDING_RADIUS * 0.85 }));
  const cars = others.filter((o) => o !== self && (o.alt ?? 0) <= 1.5 && near(o, 2));
  const carWalls = (skip) => cars.filter((c) => c !== skip).map((c) => ({ x: c.x, z: c.z, r: CAR_SIZE }));
  return {
    others: others.filter((o) => {
      if (o === self || !near(o)) return false;
      const d = dist(o);
      if (d < VIEW.aware) return true;
      const top = (o.alt ?? 0) + TOPS.car;
      return canSee(self, o.x, o.z, width, range, d < VIEW.over ? walls : [...walls, ...carWalls(o)], over(o.x, o.z, top));
    }),
    // Lights stand high on poles: cars don't hide them, buildings and hills do.
    signals: signals
      .map((s) => ({ ...s, approaches: s.approaches.filter((ap) => inCone(ap) && canSee(self, ap.x, ap.z, width, range, walls, over(ap.x, ap.z, TOPS.light))) }))
      .filter((s) => s.approaches.length),
    towns: towns.filter((c) => dist(c) < range + c.radius && inCone(c)),
    // Could it see a car-height thing at (x, z)? (For checking the road ahead is clear.)
    canSeePoint: (x, z) => canSee(self, x, z, width, range, [...walls, ...carWalls()], over(x, z, TOPS.car)),
    // The things in the way it notices: buildings, trees and billboards in
    // view, out to OBSTACLE_RANGE (or its view distance, if shorter).
    obstacles: [
      ...buildings.map((b) => ({ kind: "building", x: b.x, z: b.z, r: BUILDING_RADIUS, h: b.height, yaw: b.rotation, ref: b })),
      ...trees.map((t) => ({ kind: "tree", x: t.x, z: t.z, r: TREE_RADIUS * t.scale, h: TOPS.tree * t.scale, ref: t })),
      ...billboards.map((b) => ({ kind: "billboard", x: b.x, z: b.z, r: BILLBOARD_RADIUS, h: TOPS.billboard, yaw: b.rotation, ref: b })),
    ].filter(
      (o) =>
        dist(o) < Math.min(range, OBSTACLE_RANGE) &&
        inCone(o) &&
        canSee(
          self,
          o.x,
          o.z,
          width,
          range,
          walls.filter((w) => Math.hypot(wrapDelta(w.x - o.x, width), w.z - o.z) > 0.01),
          over(o.x, o.z, o.h)
        )
    ),
    range,
  };
}

/** How far (m) it notices obstacles — trees and buildings matter close by. */
export const OBSTACLE_RANGE = 45;

/**
 * Exactly what it can see, at eye level: how far each of `rays` sight lines
 * (evenly round, from straight ahead) reaches before something blocks it —
 * `blockers` ({ x, z, r } circles), or, given `ground` and `eye` (absolute
 * eye height), the ground rising up to eye level. For drawing the area it sees.
 */
export function visibleArea(self, blockers, width, range, rays = 120, ground = null, eye = 0) {
  const out = new Float32Array(rays);
  const near = blockers
    .map((b) => ({ x: wrapDelta(b.x - self.x, width), z: b.z - self.z, r: b.r }))
    .filter((b) => b.x * b.x + b.z * b.z < (range + b.r) ** 2 && b.x * b.x + b.z * b.z > b.r * b.r);
  const step = Math.max(1, range / 120);
  for (let i = 0; i < rays; i++) {
    const a = self.yaw + (i / rays) * Math.PI * 2;
    const dx = -Math.sin(a);
    const dz = -Math.cos(a);
    let reach = range;
    for (const b of near) {
      // Ray–circle: first hit along the ray.
      const along = b.x * dx + b.z * dz;
      if (along <= 0) continue;
      const off2 = b.x * b.x + b.z * b.z - along * along;
      if (off2 >= b.r * b.r) continue;
      const hit = along - Math.sqrt(b.r * b.r - off2);
      if (hit > 0 && hit < reach) reach = hit;
    }
    // The ground rising to eye level (a hill, a crest, a bridge ramp).
    if (ground) {
      for (let d = step; d < reach; d += step) {
        if (ground(self.x + dx * d, self.z + dz * d) >= eye) {
          reach = d;
          break;
        }
      }
    }
    out[i] = reach;
  }
  return out;
}
