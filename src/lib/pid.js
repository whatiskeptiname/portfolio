// A PID controller: output = kp·error + ki·∫error + kd·d(error)/dt, with
// the integral clamped (anti-windup) and the output limited. The derivative
// is taken on the measurement, not the error, so a jump in the setpoint
// doesn't kick the output. State lives in a plain object, so it can sit on
// the vehicle's state and survive between frames. Pure, so it's testable.

/** A fresh controller with these gains and limits. */
export function pid({ kp = 1, ki = 0, kd = 0, min = -1, max = 1, iMax = Infinity } = {}) {
  return { kp, ki, kd, min, max, iMax, i: 0, last: null };
}

/**
 * One step: drive `measured` toward `setpoint` over `dt` seconds. Returns
 * the clamped output. While the output is pinned at a limit, the integral
 * stops growing in that direction (so it doesn't wind up).
 */
export function pidStep(c, setpoint, measured, dt) {
  const error = setpoint - measured;
  const d = c.last == null || dt <= 0 ? 0 : -(measured - c.last) / dt;
  c.last = measured;
  const unclamped = c.kp * error + c.ki * c.i + c.kd * d;
  const out = Math.max(c.min, Math.min(c.max, unclamped));
  // Anti-windup: integrate only when not saturated, or when it unwinds.
  if (out === unclamped || Math.sign(error) !== Math.sign(unclamped)) {
    c.i = Math.max(-c.iMax, Math.min(c.iMax, c.i + error * dt));
  }
  return out;
}

/** Forget the history (after a manual takeover, say). */
export function pidReset(c) {
  c.i = 0;
  c.last = null;
  return c;
}

/**
 * A set of controllers kept on the vehicle's state under `name`, created on
 * first use. The car and the drone each have their own set (the same
 * vehicle state carries on through a transformation).
 */
export function controllers(s, name, make) {
  s._pid ??= {};
  s._pid[name] ??= make();
  return s._pid[name];
}

/**
 * The car's autopilot controllers: speed → throttle/brake, and a heading
 * correction added to the geometric steering.
 */
export const carControllers = () => ({
  speed: pid({ kp: 0.35, ki: 0.12, kd: 0.02, min: -1, max: 1, iMax: 6 }),
  steer: pid({ kp: 0.9, ki: 0.05, kd: 0.12, min: -0.6, max: 0.6, iMax: 2 }),
});

/**
 * Speed and heading through the PIDs: analog `throttle` and `brake` (0…1)
 * for the speed, and the steering with its correction — plus the on/off
 * `up`/`down` a simpler physics model can use. `dt` from s.dt (the frame).
 */
export function pidDrive(s, target, ffSteer, headingError) {
  const c = controllers(s, "car", carControllers);
  const dt = s.dt ?? 1 / 60;
  const out = pidStep(c.speed, target, s.speed ?? 0, dt);
  const steer = Math.max(-1, Math.min(1, ffSteer + pidStep(c.steer, 0, -headingError, dt)));
  return {
    throttle: Math.max(0, out),
    brakeLevel: Math.max(0, -out),
    up: out > 0.03,
    down: out < -0.1 || (target < 0.3 && (s.speed ?? 0) > 0.3),
    steer,
  };
}
