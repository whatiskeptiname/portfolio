// The planet's clock: your system clock, sped up so a whole planet day
// passes in a few minutes. Everyone sees the same planet time at the same
// real moment, and it carries on across reloads.

export const PLANET_DAY_SECONDS = 240; // one full day/night cycle, in real seconds
export const SPEEDUP = 86400 / PLANET_DAY_SECONDS;
export const SUN_DECLINATION = 0.29; // radians; the black hole sits a little north of the equator

/** Real seconds since local midnight. */
export function secondsOfDay(date) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;
}

/** Planet time of day in hours [0, 24), at the reference ("noon") longitude. */
export function planetHours(date) {
  return ((secondsOfDay(date) * SPEEDUP) % 86400) / 3600;
}

/**
 * Longitude (radians) the black hole is over. At planet noon it's over
 * `noonLongitude`; the planet turns east, so the sun drifts west.
 */
export function sunLongitude(hours, noonLongitude) {
  return noonLongitude - ((hours - 12) / 24) * Math.PI * 2;
}

/** Unit vector toward the black hole, in the planet's frame. */
export function sunDirection(hours, noonLongitude, declination = SUN_DECLINATION) {
  const lon = sunLongitude(hours, noonLongitude);
  const c = Math.cos(declination);
  return [c * Math.sin(lon), Math.sin(declination), c * Math.cos(lon)];
}

/** Local solar time (hours) at a given longitude, for the HUD. */
export function localHours(hours, noonLongitude, longitude) {
  const h = hours + ((longitude - noonLongitude) / (Math.PI * 2)) * 24;
  return ((h % 24) + 24) % 24;
}

export function formatHours(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Planet time for a time-of-day mode: "cycle" runs the clock as usual;
 * "day" and "night" hold it at local noon or midnight wherever the viewer is
 * (at `viewerLongitude`), so the black hole stays overhead — or far below.
 */
export function hoursForMode(mode, date, noonLongitude, viewerLongitude) {
  if (mode !== "day" && mode !== "night") return planetHours(date);
  const local = mode === "day" ? 12 : 0;
  const h = local - ((viewerLongitude - noonLongitude) / (Math.PI * 2)) * 24;
  return ((h % 24) + 24) % 24;
}

/** Moves `from` toward `to` round the 24-hour dial (the short way), by at most `step` hours. */
export function approachHours(from, to, step) {
  let d = to - from;
  d = ((((d + 12) % 24) + 24) % 24) - 12;
  const next = from + Math.max(-step, Math.min(step, d));
  return ((next % 24) + 24) % 24;
}
