// Cruise control, for driving the car by hand. L locks the speed you're
// doing (taking over from the autopilot, if it was driving): the car holds it
// on its own while you steer. Pressing the accelerator still speeds you up,
// and it comes back to the set speed when you let go; the brake or the
// handbrake cancels it, as in a real car.

/** Cruise control won't lock below this speed (m/s; about 10 km/h). */
export const CRUISE_MIN = 2.8;

/**
 * What cruise control does with the accelerator this frame to hold `target`
 * (m/s): press it in proportion to how far below it you are; hold it steady
 * just above; lift off to let the car slow when well over (say, after you
 * accelerated past it).
 * @returns {{ up: boolean, throttle: number }}
 */
export function cruiseThrottle(speed, target) {
  if (speed > target + 1) return { up: false, throttle: 0 };
  return { up: true, throttle: Math.min(1, Math.max(0, (target - speed) * 0.5)) };
}
