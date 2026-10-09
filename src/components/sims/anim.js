// Animation helpers for the case-study simulations.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Smooth 0→1 over [start, start + span] seconds of `t`. */
export const ease = (t, start = 0, span = 1) => {
  const x = clamp((t - start) / span);
  return x * x * (3 - 2 * x);
};

/** A deterministic pseudo-random stream (0..1), so scenes look the same every time. */
export function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
