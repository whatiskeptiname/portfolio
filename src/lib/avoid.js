// Steering round things in the way — trees, buildings, billboards, water —
// for the autopilot off the beaten track (on roads there's nothing to hit,
// but off-road, heading back to the highway or after you've let go of the
// wheel, there is). Looks along the stretch it's about to drive; if it's
// blocked, tries shifting sideways (smallest shift first, either side) until
// the way past is clear. Pure, so it's testable.

import { BILLBOARD_RADIUS, BUILDING_RADIUS, MOUNTAIN_HEIGHT, TREE_RADIUS, inWater, wrapDelta } from "./layout";

const NOSE = 1.25; // the car's two collision circles, along its length
const BODY = 1.05; // their radius, with a little clearance
const LOOK = 16; // how far ahead (units) it checks
const SHIFTS = [0, 1.2, -1.2, 2.4, -2.4, 3.6, -3.6, 4.8, -4.8];

/** Trees, buildings and billboards within `radius` of (x, z): { kind, x, z, r }. */
export function localObstacles(world, x, z, radius = 30) {
  const near = (o) => Math.hypot(wrapDelta(o.x - x, world.width), o.z - z) < radius;
  return [
    ...world.trees.filter(near).map((t) => ({ kind: "tree", x: t.x, z: t.z, r: TREE_RADIUS * t.scale })),
    ...world.buildings.filter(near).map((b) => ({ kind: "building", x: b.x, z: b.z, r: BUILDING_RADIUS })),
    ...world.billboards.filter(near).map((b) => ({ kind: "billboard", x: b.x, z: b.z, r: BILLBOARD_RADIUS })),
  ];
}

/** What a car at pose { x, z, yaw } would hit: an obstacle, { kind: "water" }, or null. */
export function poseBlocked(world, obstacles, p) {
  const fx = -Math.sin(p.yaw);
  const fz = -Math.cos(p.yaw);
  for (const o of [NOSE, 0, -NOSE]) {
    const x = p.x + fx * o;
    const z = p.z + fz * o;
    for (const ob of obstacles) if (Math.hypot(wrapDelta(ob.x - x, world.width), ob.z - z) < ob.r + BODY) return ob;
    if (inWater(world, x, z, 0.6)) return { kind: "water", x, z, r: 0 };
  }
  return null;
}

/** The poses shifted `shift` to the right of their heading. */
export function shiftPoses(poses, shift) {
  if (!shift) return poses;
  return poses.map((p) => ({ ...p, x: p.x + Math.cos(p.yaw) * shift, z: p.z - Math.sin(p.yaw) * shift }));
}

/**
 * Picks a sideways shift (right +) that keeps the stretch ahead clear,
 * preferring none, then the one closest to the current shift.
 * @returns {{ shift, blocked: null | { kind, x, z, d }, avoided: null | { kind, x, z, d } }}
 *   blocked: what's in the way if no shift clears it (stop short of it);
 *   avoided: what's on the straight path (what the shift steers round).
 */
export function chooseAvoidance(world, poses, current = 0, obstacles = []) {
  const ahead = (poses ?? []).filter((p) => p.d <= LOOK);
  if (!ahead.length) return { shift: 0, blocked: null, avoided: null };
  const firstHit = (shift) => {
    for (const p of shiftPoses(ahead, shift)) {
      const hit = poseBlocked(world, obstacles, p);
      if (hit) return { ...hit, d: p.d };
    }
    return null;
  };
  // Straight down the middle if that's clear now; otherwise the nearest clear shift.
  const order = [...SHIFTS].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : Math.abs(a - current) - Math.abs(b - current) || Math.abs(a) - Math.abs(b)));
  const avoided = firstHit(0);
  for (const shift of order) if (!firstHit(shift)) return { shift, blocked: null, avoided };
  return { shift: current, blocked: firstHit(current) ?? avoided, avoided };
}

/** True if a car can drive straight from a to b without hitting anything or going in the water. */
export function pathClear(world, ax, az, bx, bz) {
  const dx = wrapDelta(bx - ax, world.width);
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  const obstacles = localObstacles(world, ax + dx / 2, az + dz / 2, len / 2 + 4);
  const yaw = Math.atan2(-dx, -dz);
  const n = Math.ceil(len / 0.8);
  for (let k = 1; k < n; k++) {
    if (poseBlocked(world, obstacles, { x: ax + (dx * k) / n, z: az + (dz * k) / n, yaw })) return false;
  }
  return true;
}

/**
 * For the drone: how high it must be to clear everything along its heading
 * over the next `distance` metres — buildings, trees, billboards, the polar
 * mountains — with `margin` to spare. 0 if the way is clear at any height.
 */
export function clearanceAhead(world, x, z, yaw, distance = 30, margin = 3) {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  let need = 0;
  const near = (o, r) => {
    const dx = wrapDelta(o.x - x, world.width);
    const dz = o.z - z;
    const ahead = dx * fx + dz * fz;
    if (ahead < -2 || ahead > distance) return false;
    return Math.abs(dx * fz - dz * fx) < r + 2.5; // within the drone's swept width
  };
  for (const b of world.buildings) if (near(b, BUILDING_RADIUS)) need = Math.max(need, b.height + margin);
  for (const t of world.trees) if (near(t, TREE_RADIUS * t.scale)) need = Math.max(need, 4.5 * t.scale + margin);
  for (const b of world.billboards) if (near(b, BILLBOARD_RADIUS)) need = Math.max(need, 7 + margin);
  // The mountains round the south pole.
  if (world.mountains) {
    for (let d = 0; d <= distance; d += 5) if (z + fz * d > world.mountains.edge - 2) need = Math.max(need, MOUNTAIN_HEIGHT + margin);
  }
  return need;
}
