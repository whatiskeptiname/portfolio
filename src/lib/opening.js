import { PLANET_DAY_SECONDS } from "./clock";

// Where the camera starts: with the planet and the black hole on screen together,
// wherever the clock has put the black hole, and the planet as big as that allows.
//
// The black hole is far away, so from near the planet it can only be on screen
// when you look roughly towards it: the planet is seen against the light, as a
// lit crescent with the city lights on its night side. Of the views that frame
// both, this picks the one with the biggest planet, favouring more of it lit.

/** The picture's shift (a lens shift, not a camera move), in fractions of the screen. */
export const VIEW_SHIFT = { x: 0.17, y: -0.22 };

const FOV = 50;
const TAN = Math.tan((FOV / 2) * (Math.PI / 180));
const AIR = 1.13; // the planet's glow, in radii
const HOLE_REACH = 1.4; // the black hole and its bright inner ring, in hole radii
// Room left for the toolbar above and the controls below, as fractions of half the
// screen. A tall screen also keeps the minimap's corner clear.
const TOP = 0.76;
const TOP_TALL = 0.55;
const BOTTOM = 0.84;
// The black hole moves round the sky as the planet's clock runs (a day every
// PLANET_DAY_SECONDS); the opening keeps it in frame for a few seconds after the page opens.
// A tall screen has so little room across that it gets less, or the planet would
// have to shrink a long way.
export const staysFor = (aspect) => ((aspect >= 1 ? 6 : 2.5) / PLANET_DAY_SECONDS) * Math.PI * 2;
const DEG = Math.PI / 180;

const place = (azimuth, elevation, distance) => [
  distance * Math.cos(elevation) * Math.sin(azimuth),
  distance * Math.sin(elevation),
  distance * Math.cos(elevation) * Math.cos(azimuth),
];

/** A point's position on screen from a camera looking at the planet's centre: tangents, plus depth. */
function project(camera, point) {
  const length = Math.hypot(...camera);
  const f = camera.map((c) => -c / length);
  const flat = Math.hypot(f[0], f[2]);
  const r = [-f[2] / flat, 0, f[0] / flat];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const d = point.map((p, i) => p - camera[i]);
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  return { x: (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / z, y: (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / z, z };
}

/** The picture's shift for a screen shape: sideways when wide, downwards when tall. */
export const shiftFor = (aspect) => (aspect >= 1 ? { x: VIEW_SHIFT.x, y: 0 } : { x: 0, y: VIEW_SHIFT.y });

/** Are the planet and the black hole both fully on screen, and not in front of each other? */
export function bothInFrame(camera, sun, holeDistance, aspect, holeRadius) {
  const halfW = TAN * aspect;
  const shift = shiftFor(aspect);
  const centre = { x: shift.x * 2 * halfW, y: shift.y * 2 * TAN };
  const planet = Math.tan(Math.asin(Math.min(0.99, AIR / Math.hypot(...camera))));
  const top = aspect >= 1 ? TOP : TOP_TALL;
  const inside = (x, y, r) => Math.abs(x) + r <= halfW * 0.97 && y + r <= TAN * top && y - r >= -TAN * BOTTOM;
  if (!inside(centre.x, centre.y, planet)) return false;
  const hole = project(camera, sun.map((s) => s * holeDistance));
  if (hole.z <= 0) return false;
  const reach = (HOLE_REACH * holeRadius) / hole.z;
  if (!inside(hole.x + centre.x, hole.y + centre.y, reach)) return false;
  return Math.hypot(hole.x, hole.y) > planet + reach;
}

/** The sun direction `angle` radians further on in the planet's day (it drifts west). */
export function sunLater(sun, angle) {
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  return [sun[0] * c + sun[2] * s, sun[1], -sun[0] * s + sun[2] * c];
}

/** The opening camera position, in planet radii, for a sun direction and a screen shape. */
export function openingCamera(sun, holeDistance, aspect, holeRadius) {
  const azimuth = Math.atan2(sun[0], sun[2]);
  const later = sunLater(sun, staysFor(aspect));
  let best = null;
  for (let away = 40; away <= 180; away += 4) {
    for (const side of [1, -1]) {
      for (let elevation = -10; elevation <= 30; elevation += 5) {
        for (let d = 2.2; d <= 14; d += 0.1) {
          const camera = place(azimuth + side * away * DEG, elevation * DEG, d);
          if (!bothInFrame(camera, sun, holeDistance, aspect, holeRadius)) continue;
          if (!bothInFrame(camera, later, holeDistance, aspect, holeRadius)) continue;
          const facing = camera.reduce((n, c, i) => n + c * sun[i], 0) / d;
          const score = (1 / d) * (0.35 + (1 + facing) / 2);
          if (!best || score > best.score) best = { score, camera };
          break; // nearer is better: no need to look further out from here
        }
      }
    }
  }
  return best ? best.camera : place(azimuth + Math.PI, 15 * DEG, 6);
}
