// Driving input, from the keyboard or from the autopilot that cruises the
// equator highway when nobody's driving. Inputs are plain objects so the
// physics doesn't care where they came from:
// { up, down: boolean, steer: -1..1 (left +), ascend, descend: boolean }

import { pidDrive } from "./pid";

export const AUTOPILOT = {
  // Traffic keeps left, as in Nepal: heading east, the left-hand lane is the
  // northern one (plane z < 0).
  lane: -1.9,
  carSpeed: 7,
  droneSpeed: 9,
  droneAlt: 10,
  lookAhead: 14,
  idleSeconds: 45, // hands back to the autopilot after this long without input
  nearEquator: 8, // only re-engages by itself if the vehicle is this close to the highway
};

// Speed display and the car's surface-dependent top speeds (plane units/s).
export const KMH_PER_UNIT = 4;
export const CAR_LIMITS = { highway: 150 / KMH_PER_UNIT, road: 90 / KMH_PER_UNIT, paved: 70 / KMH_PER_UNIT, grass: 45 / KMH_PER_UNIT };
export const CAR_GRIP = { highway: 1, road: 1, paved: 0.9, grass: 0.6 }; // acceleration multiplier
export const GEAR_SPAN = 7.5;

/** 0 = neutral, -1 = reverse, else 1..6. */
export function gearOf(speed) {
  if (speed < -0.2) return -1;
  if (Math.abs(speed) < 0.2) return 0;
  return Math.min(6, Math.floor(speed / GEAR_SPAN) + 1);
}

/**
 * Where the speed goes this frame when it's above the surface's limit: bleed
 * it off smoothly (rolling off the highway onto grass slows you, it doesn't
 * stop you dead).
 */
export function settleToLimit(speed, limit, delta) {
  if (speed <= limit) return speed;
  return speed - (speed - limit) * Math.min(1, 2.2 * delta);
}

export const NO_INPUT = Object.freeze({ up: false, down: false, steer: 0, ascend: false, descend: false });

export function keysToInput(keys) {
  // (Arrow keys mirror W/S/A/D here; the realistic drone reads them apart.)
  return {
    up: keys.has("up") || keys.has("arrowUp"),
    down: keys.has("down") || keys.has("arrowDown"),
    steer: (keys.has("left") || keys.has("arrowLeft") ? 1 : 0) - (keys.has("right") || keys.has("arrowRight") ? 1 : 0),
    ascend: keys.has("ascend"),
    descend: keys.has("descend"),
  };
}

export function hasInput(input) {
  return input.up || input.down || input.steer !== 0 || input.ascend || input.descend;
}

export function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Vehicle yaw that points from the vehicle toward a plane direction (dx, dz). */
export function yawToward(dx, dz) {
  return Math.atan2(-dx, -dz);
}

/** The drone's altitude hold, in plane units (= metres): 0 lands. */
export const DRONE_ALT = { min: 0, max: 60, fallback: 12, step: 2 };

/** The autopilot cruise speed the settings panel offers, in km/h. */
export const AUTO_SPEED = { min: 20, max: 150, fallback: 30 };

/** A saved cruise speed (km/h), clamped to the range, or the fallback. */
export function parseAutoSpeed(raw) {
  const v = Number(raw);
  if (raw == null || raw === "" || !Number.isFinite(v)) return AUTO_SPEED.fallback;
  return Math.min(AUTO_SPEED.max, Math.max(AUTO_SPEED.min, Math.round(v)));
}

/**
 * Cruise east along the equator: aim at a point a little ahead on the lane,
 * hold a gentle speed (or `s.autoSpeed`, set from the settings panel), and
 * (for the drone) a steady altitude.
 */
export function autopilotInput(s, type, cap = Infinity) {
  // Heading east, overtaking shifts us right: toward +z (south).
  const lane = type === "car" ? AUTOPILOT.lane + (s.laneShift ?? 0) + (s.avoidShift ?? 0) : 0;
  const desired = yawToward(AUTOPILOT.lookAhead, lane - s.z);
  const err = wrapAngle(desired - s.yaw);
  // The chosen cruise speed, or less if traffic (lights, the car ahead) says so.
  const target = Math.min(cap, (s.autoSpeed ?? (type === "car" ? AUTOPILOT.carSpeed : AUTOPILOT.droneSpeed)) * (s.boost ?? 1));
  // The car through its PID controllers; the drone's speed is flown by its flight controller.
  const drive =
    type === "car"
      ? pidDrive(s, target, Math.max(-1, Math.min(1, err * 1.6)), err)
      : { up: s.speed < target - 0.3, down: s.speed > target + 2, steer: Math.max(-1, Math.min(1, err * 2.2)) };
  return {
    ...drive,
    // Hold the drone's set altitude (the vehicle does this itself too).
    ascend: type === "drone" && s.alt < (s.droneAltTarget ?? AUTOPILOT.droneAlt) - 0.5,
    descend: type === "drone" && s.alt > (s.droneAltTarget ?? AUTOPILOT.droneAlt) + 1,
  };
}

const STUCK_SECONDS = 1.1; // pushing on without moving this long means stuck
const REVERSE_SECONDS = 1.6;

/**
 * Wraps an autopilot input so a vehicle that's pinned against something
 * backs off and tries another line: if it has been asking to go forward but
 * barely moving for a moment, it reverses for a while on opposite lock —
 * which swings a car's nose toward where it wants to go — and then carries
 * on. A drone also climbs while it backs away. Keeps its bookkeeping on `s`
 * (stuckFor, reverseFor, reverseSteer); `delta` is in seconds.
 */
export function unstickInput(s, input, type, delta) {
  if (s.reverseFor > 0) {
    s.reverseFor -= delta;
    return { up: false, down: true, reverse: true, steer: s.reverseSteer, ascend: type === "drone", descend: false };
  }
  if (input.up && Math.abs(s.speed) < 0.8) s.stuckFor = (s.stuckFor ?? 0) + delta;
  else s.stuckFor = 0;
  if (Math.abs(s.speed) > 4) s.reversals = 0; // moving freely again
  if (s.stuckFor > STUCK_SECONDS) {
    s.stuckFor = 0;
    s.reverseFor = REVERSE_SECONDS;
    s.reversals = (s.reversals ?? 0) + 1; // the vehicle re-plans if this keeps happening
    const want = Math.sign(input.steer) || 1;
    // Reversing flips a car's steering; a drone turns the same either way.
    s.reverseSteer = type === "car" ? -want : want;
  }
  return input;
}

/**
 * What the autopilot pays attention to — each can be switched off in its
 * settings page, and it then simply ignores that element of the world.
 */
export const PILOT_RULES = [
  { key: "lights", label: "Traffic lights", hint: "Stops at red and amber" },
  { key: "junctions", label: "Junction boxes", hint: "Won't enter a junction that isn't clear" },
  { key: "cars", label: "Other cars", hint: "Keeps its distance, gives way to crossing traffic" },
  { key: "roundabouts", label: "Roundabouts", hint: "Gives way to cars already on the ring" },
  { key: "obstacles", label: "Trees, buildings & water", hint: "Steers round them off the road" },
  { key: "overtaking", label: "Overtaking", hint: "Passes slow cars when it's safe" },
  { key: "bends", label: "Bends", hint: "Slows down for corners" },
  { key: "limits", label: "Speed limits", hint: "Keeps to each road's limit" },
  { key: "unstick", label: "Getting unstuck", hint: "Backs off and retries when pinned" },
];
export const PILOT_DEFAULTS = Object.fromEntries(PILOT_RULES.map((r) => [r.key, true]));

/** Saved rule settings (JSON), with anything missing or invalid set to on. */
export function parsePilotRules(raw) {
  let saved = {};
  try {
    saved = JSON.parse(raw) ?? {};
  } catch {
    saved = {};
  }
  return Object.fromEntries(PILOT_RULES.map((r) => [r.key, typeof saved[r.key] === "boolean" ? saved[r.key] : true]));
}
