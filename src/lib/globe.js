// Maps the flat layout plane onto a sphere. The layout (and the car/drone
// physics) stay 2D; only rendering goes through this projection.
//
// x → longitude (x / R radians, wrapping every 2πR), z → latitude (-z / R,
// so the river at z = 0 is the equator and north is -z). This is an
// equirectangular projection: distances are true north–south and along the
// equator, and shrink east–west by cos(latitude) toward the poles.

export function lonLat(R, x, z) {
  return { lon: x / R, lat: -z / R };
}

/** Point on the sphere (radius R + h) for plane coordinates (x, z). */
export function toSphere(R, x, z, h = 0) {
  const lon = x / R;
  const lat = -z / R;
  const r = R + h;
  const cl = Math.cos(lat);
  return [r * cl * Math.sin(lon), r * Math.sin(lat), r * cl * Math.cos(lon)];
}

/**
 * Local frame at (x, z): `east` (+x in the plane), `up` (surface normal) and
 * `south` (+z in the plane). east × up = south, so it's right-handed and a
 * plane object's (x, y, z) axes map straight onto (east, up, south).
 */
export function frameAt(R, x, z) {
  const lon = x / R;
  const lat = -z / R;
  const sl = Math.sin(lat);
  const cl = Math.cos(lat);
  const so = Math.sin(lon);
  const co = Math.cos(lon);
  return {
    up: [cl * so, sl, cl * co],
    east: [co, 0, -so],
    south: [sl * so, -cl, sl * co],
  };
}

/** How much one plane unit east is stretched on the sphere at plane z. */
export function eastScale(R, z) {
  return Math.cos(z / R);
}

/** Wraps a plane x into [-πR, πR). */
export function wrapX(R, x) {
  const w = 2 * Math.PI * R;
  return ((((x + Math.PI * R) % w) + w) % w) - Math.PI * R;
}

/**
 * Carries a vehicle over a pole. Past the north pole (z < -πR/2) you come out
 * on the opposite meridian (x + πR) heading the other way in plane terms
 * (yaw + π) — on the sphere you just keep going straight. Same for the south.
 */
export function crossPole(R, s) {
  const pole = (Math.PI / 2) * R;
  if (s.z < -pole || s.z > pole) {
    s.z = (s.z < 0 ? -2 : 2) * pole - s.z;
    s.x = wrapX(R, s.x + Math.PI * R);
    s.yaw += Math.PI;
    return true;
  }
  return false;
}

/** Keeps east–west speed true on the sphere: plane x stretches by 1/cos(lat). */
export function eastStretch(R, z) {
  return 1 / Math.max(0.04, Math.cos(z / R));
}
