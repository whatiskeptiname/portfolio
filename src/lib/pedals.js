// Pedals and cruise control, for driving the car by hand.
//
// The keys work like your feet. Holding W is holding your foot on the
// accelerator — just touching it (10%) to start with. Hold Shift as well and you press
// it gradually deeper, as far as you like (up to the floor); let go of Shift
// and your foot stays where it is; let go of W and your foot comes off, back
// to nothing. S (the brake) and Space (the handbrake) work the same way.
//
// Cruise control (L) locks the speed you're doing (taking over from the
// autopilot, if it was driving): the car holds it on its own while you steer.
// Pressing the accelerator still speeds you up, and it comes back to the set
// speed when you let go; the brake or the handbrake cancels it, as in a real
// car.

export const PEDAL_REST = 0.1; // where your foot goes when you press the key
export const PEDAL_RATE = 0.5; // of full travel a second, deeper, while Shift is held
export const NO_PEDALS = { throttle: 0, brake: 0, handbrake: 0 };

/**
 * Where each pedal is this frame.
 * @param {{ throttle: number, brake: number, handbrake: number }} feet  where they were
 * @param {{ throttle?: boolean, brake?: boolean, handbrake?: boolean }} held  which keys are down
 * @param {boolean} deeper  Shift is held
 * @param {number} dt  seconds
 */
export function pressPedals(feet, held, deeper, dt) {
  const out = { ...NO_PEDALS };
  for (const pedal of Object.keys(out)) {
    if (!held[pedal]) continue;
    const was = feet?.[pedal] > 0 ? feet[pedal] : PEDAL_REST;
    out[pedal] = Math.min(1, was + (deeper ? PEDAL_RATE * dt : 0));
  }
  return out;
}

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
