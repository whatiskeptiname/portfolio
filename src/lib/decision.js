// What the autopilot is doing right now, and why — for the driver panel and
// the real-time plan drawn in front of the car. Pure, so it's testable.

import { AUTOPILOT } from "./autopilot";

const BRAKE = 6; // as lib/traffic plans stops

/** Colours for the decision tones, shared by the driver panel and the 3D markers. */
export const TONES = { stop: "#ff3b5c", slow: "#ffb020", go: "#3cf0ff", info: "#9fb3c8" };

/**
 * Plane units → a distance a driver reads. 1 unit = 1 m: a car is 4.3 m long
 * and the speedometer's km/h agree (lib/autopilot KMH_PER_UNIT).
 */
export const metres = (d) => (d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.max(0, Math.round(d))} m`);

/**
 * @param {object} s       vehicle state (speed, laneShift, overtakeNote)
 * @param {object} limits  { target, traffic (lib/traffic's why), route (route.why), manual }
 * @returns {{ action, reason, note, tone: "go" | "slow" | "stop" | "info", distance, focus }}
 *   focus: what caused it, to mark in the world ({ kind, x, z, other? }).
 */
export function describeDecision(s, { target = Infinity, traffic = null, route = null, manual = false } = {}) {
  if (manual) return { action: "You're driving", reason: "Autopilot takes over when you let go", note: null, tone: "info", distance: null, focus: null };
  const speed = Math.max(0, s.speed ?? 0);
  // Which limit is the binding one: traffic (if it's what set the target), else the route's.
  const cause = traffic?.kind && traffic.cap <= target + 0.05 ? traffic : route;
  const stopping = cause && cause.theirs === 0 && target < 0.5;
  let action;
  let tone;
  if (speed < 0.5 && target < 0.6) {
    action = cause?.kind === "red" || cause?.kind === "amber" ? "Waiting" : cause?.kind === "roundabout" || cause?.kind === "box" ? "Giving way" : "Stopped";
    tone = "stop";
  } else if (stopping || (target < speed - 1.5 && target < 1)) {
    action = "Stopping";
    tone = "stop";
  } else if (target < speed - 1.5) {
    action = "Slowing";
    tone = "slow";
  } else if (cause?.kind === "car" && cause.theirs > 0) {
    action = "Following";
    tone = "slow";
  } else if (target > speed + 1.5) {
    action = "Accelerating";
    tone = "go";
  } else {
    action = "Cruising";
    tone = "go";
  }
  const note = s.overtakeNote ?? null;
  // Overtaking manoeuvres take the headline.
  if (note && /^Overtaking/.test(note)) [action, tone] = ["Overtaking", "go"];
  else if (note && /^Aborting/.test(note)) [action, tone] = ["Aborting overtake", "slow"];
  else if (note === "Pulling back in") [action, tone] = ["Pulling back in", "go"];
  const reason = cause?.label ?? null;
  const distance = cause?.distance != null ? metres(cause.distance) : null;
  return {
    action,
    reason: action === "Cruising" && cause?.kind === "cruise" ? null : reason,
    note: note && !/^(Overtaking|Aborting|Pulling)/.test(note) ? note : action.startsWith("Abort") ? note.replace(/^Aborting overtake: /, "") : null,
    tone,
    distance: action === "Cruising" ? null : distance,
    focus: cause && cause.x != null ? { kind: cause.kind, x: cause.x, z: cause.z, other: cause.other, town: cause.town, dir: cause.dir } : null,
  };
}

/**
 * The speed the car means to do at each pose of its real-time plan: the
 * route's own speed profile (bends, limits; `base`, one per pose), held down
 * by the binding traffic limit — a stop at `room` (the plan ends there), or
 * matching the car ahead's speed `theirs` by `room`.
 * @returns {{ speeds: number[], stopAt: number | null }} stopAt: distance along the plan
 */
export function planSpeeds(poses, base, traffic) {
  const speeds = [];
  let stopAt = null;
  for (let k = 0; k < poses.length; k++) {
    const d = poses[k].d;
    let v = base[k];
    if (traffic?.room != null && traffic.cap != null) {
      const theirs = traffic.theirs ?? 0;
      if (theirs <= 0 && d > Math.max(0, traffic.room)) {
        stopAt = Math.max(0, traffic.room);
        break;
      }
      // Following a car: the plan only goes as far as its tail.
      if (theirs > 0 && traffic.other && d > traffic.room + 1.5) break;
      v = Math.min(v, Math.sqrt(theirs * theirs + 2 * BRAKE * Math.max(0, traffic.room - d)));
    }
    speeds.push(v);
  }
  return { speeds, stopAt };
}

/**
 * The plan when cruising the equator (no route): along the highway lane
 * ahead, easing across from wherever the car is (overtaking shifts it).
 */
export function cruisePoses(s, distance = 40) {
  const laneZ = AUTOPILOT.lane + (s.laneShift ?? 0);
  const poses = [];
  let px = s.x;
  let pz = s.z;
  for (let d = 1; d <= distance; d++) {
    const x = s.x + d;
    const z = laneZ + (s.z - laneZ) * Math.exp(-d / 6);
    poses.push({ x, z, yaw: Math.atan2(-(x - px), -(z - pz)), d });
    [px, pz] = [x, z];
  }
  return poses;
}
