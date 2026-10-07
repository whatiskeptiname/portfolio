// three.js helpers for putting plane-space things onto the planet.
import * as THREE from "three";
import { frameAt, toSphere } from "../lib/globe";

export const SPACE_COLOR = "#020309";
export const RIVER_COLOR = "#6fb7dc";
export const SEA_COLOR = "#3f8fc9"; // the river deepens to this at its mouth

/** Black hole distance from the planet's centre, in planet radii. */
export const BLACK_HOLE_DISTANCE = 2.48;

/**
 * Unit vector from the planet's centre toward the black hole — the only sun.
 * It moves: <SunClock> in CityExplorer updates it every frame from the
 * planet clock, and everything that cares about light reads it live.
 */
export const SUN_DIRECTION = new THREE.Vector3(-0.955, 0.286, 0.016);

/** How far the starry sky has turned (radians about the planet's axis) — it turns with the sun. */
export const SKY_ROTATION = { y: 0 };

// The ground's height above the perfect sphere at plane (x, z) — the terrain
// (src/lib/terrain.js), set once the layout exists. Everything placed with
// the helpers below sits on it: `h` is always measured from the ground.
let ground = () => 0;
export function setGround(fn) {
  ground = fn ?? (() => 0);
}
export function groundAt(x, z) {
  return ground(x, z);
}
/** toSphere, `h` above the (bumpy) ground rather than the perfect sphere. */
export function onGround(R, x, z, h = 0) {
  return toSphere(R, x, z, h + ground(x, z));
}

export function blackHolePosition(R, out = new THREE.Vector3()) {
  return out.copy(SUN_DIRECTION).multiplyScalar(R * BLACK_HOLE_DISTANCE);
}

/** How directly the black hole shines on the surface at plane (x, z): >0 day, <0 night. */
export function sunlightAt(R, x, z) {
  const [ux, uy, uz] = frameAt(R, x, z).up;
  return ux * SUN_DIRECTION.x + uy * SUN_DIRECTION.y + uz * SUN_DIRECTION.z;
}

const _east = new THREE.Vector3();
const _up = new THREE.Vector3();
const _south = new THREE.Vector3();
const _rot = new THREE.Matrix4();

/**
 * World matrix for an object standing at plane (x, z), `h` above the surface,
 * turned `yaw` about its local up. Plane-space children (x, y, z) map onto
 * (east, up, south) so models built for the flat world just work.
 */
export function surfaceMatrix(R, x, z, h = 0, yaw = 0, out = new THREE.Matrix4()) {
  const { east, up, south } = frameAt(R, x, z);
  _east.fromArray(east);
  _up.fromArray(up);
  _south.fromArray(south);
  out.makeBasis(_east, _up, _south);
  out.setPosition(...onGround(R, x, z, h));
  if (yaw) out.multiply(_rot.makeRotationY(yaw));
  return out;
}

export function surfacePoint(R, x, z, h = 0, out = new THREE.Vector3()) {
  return out.fromArray(onGround(R, x, z, h));
}

/**
 * A ribbon along a plane polyline (a road or the river), draped over the
 * sphere. `halfWidth` and the height `h` are each a number or one value per
 * point (bridges lift road decks); v runs along the length (`uvPerUnit`
 * repeats per unit), u across.
 */
export function ribbonGeometry(R, points, halfWidth, h, uvPerUnit) {
  const positions = [];
  const uvs = [];
  const indices = [];
  // Several vertices across, so a wide ribbon follows the curve of the planet
  // instead of cutting a flat chord through it (which would let crossing
  // layers poke through each other).
  const maxWidth = Array.isArray(halfWidth) ? Math.max(...halfWidth) : halfWidth;
  const cols = Math.max(2, Math.ceil((maxWidth * 2) / 1.5) + 1);
  let along = 0;
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let tx = next[0] - prev[0];
    let tz = next[1] - prev[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    if (i) along += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    const w = Array.isArray(halfWidth) ? halfWidth[i] : halfWidth;
    const hi = Array.isArray(h) ? h[i] : h;
    // Perpendicular (left of travel) in the plane.
    const px = -tz;
    const pz = tx;
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const side = u * 2 - 1;
      positions.push(...onGround(R, points[i][0] + px * w * side, points[i][1] + pz * w * side, hi));
      uvs.push(u, along * uvPerUnit);
    }
    if (i < points.length - 1) {
      for (let c = 0; c < cols - 1; c++) {
        const a = i * cols + c;
        const b = a + cols;
        indices.push(a, a + 1, b, a + 1, b + 1, b); // counter-clockwise from above
      }
    }
  }
  return finish(positions, uvs, indices);
}

/**
 * A flat ring (annulus) between `inner` and `outer` around (cx, cz), draped
 * over the sphere. With `dashes`, only every other arc segment is kept
 * (dashed lane markings).
 */
export function annulusGeometry(R, cx, cz, inner, outer, h, segments = 64, dashes = 0) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const steps = dashes ? dashes * 2 * 3 : segments;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    for (const r of [inner, outer]) {
      positions.push(...onGround(R, cx + Math.cos(a) * r, cz + Math.sin(a) * r, h));
      uvs.push(i / steps, r === inner ? 0 : 1);
    }
    if (i < steps && (!dashes || Math.floor(i / 3) % 2 === 0)) {
      const k = i * 2;
      // Counter-clockwise from above (angle runs from +x toward +z).
      indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  return finish(positions, uvs, indices);
}

/** Part of a ring, from angle `start` to `end` (radians), draped over the sphere. */
export function arcBandGeometry(R, cx, cz, inner, outer, h, start, end, steps = 24) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + ((end - start) * i) / steps;
    for (const r of [inner, outer]) {
      positions.push(...onGround(R, cx + Math.cos(a) * r, cz + Math.sin(a) * r, h));
      uvs.push(i / steps, r === inner ? 0 : 1);
    }
    if (i < steps) {
      const k = i * 2;
      indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  return finish(positions, uvs, indices);
}

/**
 * A flat shape from a plane outline (fanned from its first point), draped
 * over the sphere and wound so it faces up whichever way the outline runs.
 */
export function outlineGeometry(R, outline, h) {
  let area = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x1, z1] = outline[i];
    const [x2, z2] = outline[(i + 1) % outline.length];
    area += x1 * z2 - x2 * z1;
  }
  // Facing up (+y) means negative signed area in (x, z), as for the rings.
  const pts = area > 0 ? [outline[0], ...outline.slice(1).reverse()] : outline;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (const [x, z] of pts) {
    positions.push(...onGround(R, x, z, h));
    uvs.push(0, 0);
  }
  for (let i = 1; i < pts.length - 1; i++) indices.push(0, i, i + 1);
  return finish(positions, uvs, indices);
}

/** A flat disc of `radius` centred on (cx, cz), draped over the sphere. */
export function discGeometry(R, cx, cz, radius, h, segments = 48, rings = 4, radiusX = radius) {
  const positions = [...onGround(R, cx, cz, h)];
  const uvs = [0.5, 0.5];
  const indices = [];
  for (let ring = 1; ring <= rings; ring++) {
    const r = (radius * ring) / rings;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      positions.push(...onGround(R, cx + Math.cos(a) * r * (radiusX / radius), cz + Math.sin(a) * r, h));
      uvs.push(0.5 + (Math.cos(a) * ring) / rings / 2, 0.5 + (Math.sin(a) * ring) / rings / 2);
    }
  }
  const at = (ring, s) => (ring === 0 ? 0 : 1 + (ring - 1) * segments + (s % segments));
  for (let ring = 0; ring < rings; ring++) {
    for (let s = 0; s < segments; s++) {
      if (ring === 0) indices.push(0, at(1, s + 1), at(1, s));
      else indices.push(at(ring, s), at(ring, s + 1), at(ring + 1, s), at(ring, s + 1), at(ring + 1, s + 1), at(ring + 1, s));
    }
  }
  return finish(positions, uvs, indices);
}

function finish(positions, uvs, indices) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * True when the straight line from the camera to `point` isn't blocked by the
 * planet (a sphere of radius R at the origin). Works for things floating
 * above the surface too, unlike a simple horizon test.
 */
export function visibleFrom(point, camera, R) {
  const c = camera.position;
  const dx = point.x - c.x;
  const dy = point.y - c.y;
  const dz = point.z - c.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  // Closest approach of the segment camera→point to the planet's centre.
  const t = Math.max(0, Math.min(1, -(c.x * dx + c.y * dy + c.z * dz) / len2));
  const px = c.x + dx * t;
  const py = c.y + dy * t;
  const pz = c.z + dz * t;
  // Slightly under R so things standing on the surface still count as visible.
  return t >= 0.999 || px * px + py * py + pz * pz > (R - 0.5) * (R - 0.5);
}
