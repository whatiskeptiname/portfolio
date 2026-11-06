// Where the camera starts: with the planet and the black hole on screen together,
// wherever the clock has put the black hole.
//
// On a wide screen the camera stands off to one side of the black hole, so the
// planet is about half lit and the black hole sits beside it. A tall screen has no
// room beside the planet, so the camera looks up past the black hole from behind and
// below it, which puts the black hole above a sunlit planet. Either way it starts as close
// as it can with both still in frame.

/** The picture's shift (a lens shift, not a camera move), in fractions of the screen. */
export const VIEW_SHIFT = { x: 0.17, y: -0.14 };

const FOV = 50;
const TAN = Math.tan((FOV / 2) * (Math.PI / 180));
const SIDE = { offset: (103 * Math.PI) / 180, elevation: (18 * Math.PI) / 180, from: 3.4, to: 9.5 };
const BEHIND = { offset: (-6 * Math.PI) / 180, elevation: (-20 * Math.PI) / 180, to: 13 };
const AIR = 1.13; // the planet's glow, in radii
const HOLE_REACH = 0.5; // the black hole and most of its disc, in radii
// Room left for the toolbar above and the controls below, as fractions of half the screen.
const TOP = 0.76;
const BOTTOM = 0.84;

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
export function bothInFrame(camera, sun, holeDistance, aspect) {
  const halfW = TAN * aspect;
  const shift = shiftFor(aspect);
  const centre = { x: shift.x * 2 * halfW, y: shift.y * 2 * TAN };
  const planet = Math.tan(Math.asin(Math.min(0.99, AIR / Math.hypot(...camera))));
  const inside = (x, y, r) => Math.abs(x) + r <= halfW * 0.97 && y + r <= TAN * TOP && y - r >= -TAN * BOTTOM;
  if (!inside(centre.x, centre.y, planet)) return false;
  const hole = project(camera, sun.map((s) => s * holeDistance));
  if (hole.z <= 0) return false;
  const reach = HOLE_REACH / hole.z;
  if (!inside(hole.x + centre.x, hole.y + centre.y, reach)) return false;
  return Math.hypot(hole.x, hole.y) > planet + reach;
}

/** The opening camera position, in planet radii, for a sun direction and a screen shape. */
export function openingCamera(sun, holeDistance, aspect) {
  const azimuth = Math.atan2(sun[0], sun[2]);
  const search = ({ offset, elevation, from, to }) => {
    for (let d = from; d <= to; d += 0.1) {
      const camera = place(azimuth + offset, elevation, d);
      if (bothInFrame(camera, sun, holeDistance, aspect)) return camera;
    }
    return null;
  };
  const behind = { ...BEHIND, from: holeDistance + 2.4 };
  return (aspect >= 1 && search(SIDE)) || search(behind) || place(azimuth + BEHIND.offset, BEHIND.elevation, BEHIND.to);
}
