// The sums behind the cars' sounds, kept pure so they can be tested; the
// synthesis itself is in src/city/audio.js.
//
// - An engine's note is its firing rate: a four-cylinder, four-stroke engine
//   fires twice a revolution, so at 3,000 rpm it's 100 pulses a second. The
//   revs climb through each gear and drop at the shift.
// - Sound fades with distance (roughly the inverse square law, softened up
//   close), so a car you're beside is loud, one down the road is faint and
//   one seen from orbit is silent.
// - A car coming toward you sounds higher, and lower once it's gone past (the
//   Doppler effect); it's heard from the side it's on.

export const SPEED_OF_SOUND = 343; // m/s
export const HEARING = 60; // m: beyond this a car is silent

/** Engine revs at `speed` (m/s), climbing through each gear of `gearSpan` m/s. */
export function engineRpm(speed, gearSpan, idle = 850) {
  const v = Math.abs(speed);
  const gear = Math.min(5, Math.floor(v / gearSpan));
  const inGear = Math.min(1.15, (v - gear * gearSpan) / gearSpan);
  return idle + inGear * 3600 + gear * 250;
}

/** The pitch of the exhaust pulses (Hz) at `rpm`. */
export const firingRate = (rpm) => rpm / 30;

/**
 * How loud a sound is at distance `d` (m), 0–1: full within `near`, then
 * falling off like the inverse square law, and gone by `far`.
 */
export function audibility(d, near = 6, far = HEARING) {
  if (d >= far) return 0;
  const k = 1 / (1 + Math.max(0, d - near) ** 2 / (near * near));
  // Fade the last stretch to nothing, so a car doesn't cut out at the edge.
  const edge = Math.min(1, (far - d) / (far * 0.25));
  return k * edge;
}

/**
 * How a car `source` sounds to a listener: loudness, Doppler pitch ratio and
 * stereo position (−1 left … 1 right of the way the listener faces).
 * Both have x, z (m) and a velocity vx, vz (m/s); the listener also a yaw.
 * `width` wraps x round the planet.
 */
export function heard(listener, source, width = Infinity) {
  let dx = source.x - listener.x;
  if (Number.isFinite(width)) dx -= width * Math.round(dx / width);
  const dz = source.z - listener.z;
  const d = Math.hypot(dx, dz);
  const ux = d > 1e-6 ? dx / d : 0;
  const uz = d > 1e-6 ? dz / d : 0;
  // Positive when the gap is opening (moving apart): the pitch drops.
  const away = (source.vx - listener.vx) * ux + (source.vz - listener.vz) * uz;
  const doppler = SPEED_OF_SOUND / (SPEED_OF_SOUND + Math.max(-150, Math.min(150, away)));
  // The listener's right: forward is (−sin yaw, −cos yaw), so right is (cos yaw, −sin yaw).
  const pan = Math.max(-1, Math.min(1, ux * Math.cos(listener.yaw) - uz * Math.sin(listener.yaw)));
  return { distance: d, gain: audibility(d), doppler, pan };
}

/** The `n` cars nearest `listener` within hearing, nearest first. */
export function nearestCars(cars, listener, n, width = Infinity) {
  const out = [];
  for (const car of cars) {
    let dx = car.x - listener.x;
    if (Number.isFinite(width)) dx -= width * Math.round(dx / width);
    const d = Math.hypot(dx, car.z - listener.z);
    if (d < HEARING) out.push({ car, d });
  }
  return out
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((o) => o.car);
}
