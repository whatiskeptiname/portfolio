// The motion of the background layer behind the landing page: it follows the
// scroll on a spring, so it trails a little and settles with a small bounce, and
// at the top or bottom of the page it stretches like rubber when you keep
// pulling, then springs back. Pure, so it can be tested; LifeBackground.jsx
// uses it.

export const SPRING = { stiffness: 90, damping: 11 }; // damping ratio ≈ 0.58: one soft overshoot

/** One step of a damped spring pulling `pos` towards `target`, over `dt` milliseconds. */
export function springStep({ pos, vel }, target, dt, { stiffness, damping } = SPRING) {
  // Small fixed substeps keep it stable whatever the frame rate.
  const steps = Math.max(1, Math.ceil(dt / 8));
  const h = dt / steps / 1000;
  let p = pos;
  let v = vel;
  for (let i = 0; i < steps; i++) {
    v += (stiffness * (target - p) - damping * v) * h;
    p += v * h;
  }
  return { pos: p, vel: v };
}

/** How far a pull of `pull` pixels actually stretches: easy at first, never past `limit`. */
export function rubber(pull, limit) {
  if (!limit) return 0;
  return Math.sign(pull) * limit * (1 - 1 / (Math.abs(pull) / limit + 1));
}

export const settled = ({ pos, vel }, target) => Math.abs(pos - target) < 0.05 && Math.abs(vel) < 0.05;

/** Where the layer rests for a scroll position: through `travel` pixels over the whole page. */
export function restingOffset(scrollY, scrollable, travel) {
  if (scrollable <= 0) return 0;
  return (Math.min(Math.max(scrollY, 0), scrollable) / scrollable) * travel;
}
