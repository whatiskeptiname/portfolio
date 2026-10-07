// A realistic quadcopter, for the drone. Four motors give one thrust along
// the frame's "up"; to move, the drone tilts that thrust — pitch forward to
// fly forward, roll to slide sideways — and yaws to turn. The pilot (you,
// or the autopilot's flight controller below) works four sticks, as on a
// real radio, in "angle" mode (the usual self-levelling mode):
//   throttle 0…1   how hard the motors push (≈ HOVER to hold height)
//   pitch   −1…1   tilt nose down (+) to go forward, up (−) to brake/reverse
//   roll    −1…1   bank right (+) / left (−) to slide that way
//   yaw     −1…1   turn left (+) / right (−)
// Pure, so it's testable. 1 unit = 1 m, plane frame: forward is (−sin yaw,
// −cos yaw), right is (cos yaw, −sin yaw); alt is height above the ground.

export const QUAD = {
  g: 9.81,
  maxThrust: 2.6 * 9.81, // m/s² at full throttle: a 2.6:1 thrust-to-weight
  maxTilt: (40 * Math.PI) / 180, // full stick deflection
  tiltLag: 0.12, // s, how quickly the frame reaches the commanded angle
  yawRate: 2.6, // rad/s at full stick
  drag: 0.012, // quadratic horizontal drag (top speed ≈ 30 m/s at full tilt)
  vDrag: 0.05,
  maxAlt: 60,
};
/** Throttle that holds height when level. */
export const HOVER = QUAD.g / QUAD.maxThrust;

import { controllers, pid, pidStep } from "./pid";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Plane velocity split into forward and rightward components. */
export function bodyVelocity(s) {
  const fx = -Math.sin(s.yaw);
  const fz = -Math.cos(s.yaw);
  const vx = s.vx ?? 0;
  const vz = s.vz ?? 0;
  return { forward: vx * fx + vz * fz, right: vx * -fz + vz * fx };
}

/**
 * Advances the quad by `dt` seconds under `sticks`. Updates s.qpitch,
 * s.qroll (frame angles, rad), s.yaw, s.vx/s.vz (plane velocity), s.vy
 * (climb rate), s.alt, s.speed (forward speed), s.qthrottle. Returns the
 * plane displacement [dx, dz] for the caller to apply (it handles collisions
 * and the planet's east–west stretch).
 */
export function stepQuad(s, sticks, dt) {
  const throttle = clamp(sticks.throttle ?? HOVER, 0, 1);
  s.qthrottle = throttle;
  const k = 1 - Math.exp(-dt / QUAD.tiltLag);
  s.qpitch = (s.qpitch ?? 0) + (clamp(sticks.pitch ?? 0, -1, 1) * QUAD.maxTilt - (s.qpitch ?? 0)) * k;
  s.qroll = (s.qroll ?? 0) + (clamp(sticks.roll ?? 0, -1, 1) * QUAD.maxTilt - (s.qroll ?? 0)) * k;
  s.yaw += clamp(sticks.yaw ?? 0, -1, 1) * QUAD.yawRate * dt;

  // Thrust along the tilted frame's up: some forward, some sideways, the rest up.
  const a = throttle * QUAD.maxThrust;
  const sp = Math.sin(s.qpitch);
  const cp = Math.cos(s.qpitch);
  const sr = Math.sin(s.qroll);
  const cr = Math.cos(s.qroll);
  const aForward = a * sp * cr;
  const aRight = a * sr;
  const aUp = a * cp * cr - QUAD.g;
  const fx = -Math.sin(s.yaw);
  const fz = -Math.cos(s.yaw);
  let vx = (s.vx ?? 0) + (fx * aForward - fz * aRight) * dt;
  let vz = (s.vz ?? 0) + (fz * aForward + fx * aRight) * dt;
  let vy = (s.vy ?? 0) + aUp * dt;
  // Air resistance.
  const v = Math.hypot(vx, vz);
  const slow = 1 / (1 + QUAD.drag * v * dt);
  vx *= slow;
  vz *= slow;
  vy *= 1 / (1 + QUAD.vDrag * Math.abs(vy) * dt);

  let alt = (s.alt ?? 0) + vy * dt;
  if (alt <= 0) {
    // On the ground: it sits there; skids to a stop.
    alt = 0;
    vy = Math.max(0, vy);
    const grip = Math.exp(-6 * dt);
    vx *= grip;
    vz *= grip;
  }
  if (alt > QUAD.maxAlt) {
    alt = QUAD.maxAlt;
    vy = Math.min(0, vy);
  }
  Object.assign(s, { vx, vz, vy, alt });
  s.speed = bodyVelocity(s).forward;
  return [vx * dt, vz * dt];
}

/**
 * The autopilot's flight controller: turns what it wants — a forward
 * `speed` (m/s), a turn rate `steer` (−1…1, as the yaw stick) and a height
 * `alt` — into the four sticks, the way a real flight controller's position
 * and altitude hold do: pitch to reach the speed, roll to cancel sideslip and
 * bank into the turn, throttle to hold height (compensating for the tilt).
 */
export function flightController(s, { speed = 0, steer = 0, alt = 10 }) {
  const c = controllers(s, "drone", droneControllers);
  const dt = s.dt ?? 1 / 60;
  const { forward, right } = bodyVelocity(s);
  // Speed → pitch: the steady tilt that balances drag at the target speed
  // (feed-forward), plus the speed PID.
  const cruise = Math.atan2(QUAD.drag * speed * Math.abs(speed), QUAD.g) / QUAD.maxTilt;
  const pitch = clamp(cruise + pidStep(c.speed, speed, forward, dt), -1, 1);
  // Coordinated turn: bank so the thrust supplies the centripetal pull — so
  // no faster a turn than the frame can bank for at this speed.
  const maxTurn = (QUAD.g * Math.tan(QUAD.maxTilt * 0.85)) / Math.max(3, Math.abs(forward));
  const yawRate = clamp(steer * QUAD.yawRate, -maxTurn, maxTurn);
  const bank = Math.atan2(forward * yawRate, QUAD.g); // turning left (+) needs a left (−) bank
  // …and the slip PID cancels any sideways drift.
  const roll = clamp(-bank / QUAD.maxTilt + pidStep(c.slip, 0, right, dt), -1, 1);
  // Altitude hold: height → climb rate (P), climb rate → thrust (PID),
  // compensating for the thrust lost to tilt.
  const climb = clamp((alt - (s.alt ?? 0)) * 1.2, -6, 8);
  const accel = pidStep(c.climb, climb, s.vy ?? 0, dt);
  const tilt = Math.cos(s.qpitch ?? 0) * Math.cos(s.qroll ?? 0);
  const throttle = clamp((QUAD.g + accel) / (QUAD.maxThrust * Math.max(0.5, tilt)), 0, 1);
  return { throttle, pitch, roll, yaw: yawRate / QUAD.yawRate };
}

/** The drone's flight-controller PIDs (pitch from speed, roll from slip, thrust from climb rate). */
export const droneControllers = () => ({
  speed: pid({ kp: 0.14, ki: 0.04, kd: 0.01, min: -1, max: 1, iMax: 8 }),
  slip: pid({ kp: 0.45, ki: 0.08, kd: 0.03, min: -0.6, max: 0.6, iMax: 4 }),
  climb: pid({ kp: 2.5, ki: 0.6, kd: 0.1, min: -9, max: 16, iMax: 6 }),
});

/**
 * Manual realistic flying from the keyboard, mode 2 (as on a real radio):
 * left stick — W/S throttle up/down (it stays where you leave it, like a real
 * throttle stick), A/D yaw; right stick — ↑/↓ pitch, ←/→ roll (springing back
 * to level when let go). `keys` is the set of control names.
 */
export function keysToSticks(s, keys, dt) {
  let throttle = s.manualThrottle ?? HOVER;
  if (keys.has("up") && !keys.has("arrowUp")) throttle += 0.35 * dt;
  if (keys.has("down") && !keys.has("arrowDown")) throttle -= 0.35 * dt;
  if (keys.has("ascend")) throttle += 0.35 * dt;
  if (keys.has("descend")) throttle -= 0.35 * dt;
  throttle = clamp(throttle, 0, 1);
  s.manualThrottle = throttle;
  return {
    throttle,
    yaw: (keys.has("left") ? 1 : 0) - (keys.has("right") ? 1 : 0),
    pitch: (keys.has("arrowUp") ? 1 : 0) - (keys.has("arrowDown") ? 1 : 0),
    roll: (keys.has("arrowRight") ? 1 : 0) - (keys.has("arrowLeft") ? 1 : 0),
  };
}
