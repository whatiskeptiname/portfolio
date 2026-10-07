// Pure, deterministic layout for the 3D planet. Same input + seed → same
// world, so it doesn't reshuffle on every reload and can be unit tested.
//
// Everything is laid out on a plane that src/lib/globe.js wraps onto a
// sphere: x is longitude (wrapping every `width`), z is latitude (north is
// -z). Groups with side "north" (the résumé) form a ring of districts in the
// northern hemisphere, the rest (GitHub) a ring in the southern one.
//
// Roads are polylines: a highway along the equator (the hemisphere divide),
// a winding spur from every district down to it, and country lanes between
// neighbouring districts. A river meanders from pole to pole through the
// widest gap between districts; bridges sit wherever a road crosses it.

import { buildTerrain } from "./terrain";

export const ROAD_HALF_WIDTH = 3.5;
export const HIGHWAY_HALF_WIDTH = 4.5;
export const RIVER_HALF_WIDTH = 4.2; // average; it narrows and widens along its course
export const BUILDING_SIZE = 4;
export const BUILDING_RADIUS = Math.SQRT2 * (BUILDING_SIZE / 2); // circumscribed
export const TREE_RADIUS = 0.8;
export const BILLBOARD_RADIUS = 1.6;
const MIN_BUILDING_GAP = 7.5; // centre-to-centre, leaves room to drive between
// Each district centre is a roundabout: roads end under its asphalt ring
// (radius PLAZA_RADIUS - 0.5), round a coloured island with the district sign.
export const PLAZA_RADIUS = 7.5;
export const ROUNDABOUT_ISLAND = 3.2;
// Roads start this far from a town's centre — deep enough under the ring that
// their square ends (corners included) are hidden by it.
const ROAD_START = PLAZA_RADIUS - 2.5;
const RING_GAP = 44; // between neighbouring districts along a ring
const POLAR_MARGIN = 24; // drivable land beyond the outermost district
const MAX_LATITUDE = 1.15; // radians; keeps districts away from the poles
const POLE_CAP = 44; // the sea and mountain regions round each pole (plane units)
// Longitude (radians) of each ring's first district. Slightly west of the
// opening view so the first résumé district sits in the black hole's light.
const START_LONGITUDE = -0.45;
const SAMPLE_STEP = 2.5; // polyline resolution
const SPUR_TAIL = 8; // straight run of each spur into the highway

export function createRng(seed) {
  let a = hashString(String(seed));
  return function mulberry32() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Stable hue in [0, 1) per language, spread around the colour wheel.
export function languageHue(language) {
  return (hashString(language) % 360) / 360;
}

export function buildingHeight(stars) {
  return 5 + Math.log2(stars + 1) * 4;
}

export function clusterRadius(count) {
  return Math.max(9, Math.sqrt(count) * 4.4 + PLAZA_RADIUS);
}

// --- geometry ------------------------------------------------------------------

/** Shortest x difference on a world that wraps every `width`. */
export function wrapDelta(dx, width) {
  return dx - width * Math.round(dx / width);
}

export function distanceToSegment(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / len2));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

function polyline(points, extra = {}) {
  let length = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  points.forEach(([x, z], i) => {
    if (i) length += Math.hypot(x - points[i - 1][0], z - points[i - 1][1]);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  });
  return { ...extra, points, length, bbox: { minX, maxX, minZ, maxZ } };
}

/** Distance from (px, pz) to a polyline, or Infinity if further than `limit`. Wrap-aware. */
function polyDistance(width, px, pz, line, limit = Infinity) {
  const { minX, maxX, minZ, maxZ } = line.bbox;
  if (pz < minZ - limit || pz > maxZ + limit) return Infinity;
  let best = Infinity;
  for (const shift of [0, width, -width]) {
    const x = px + shift;
    if (x < minX - limit || x > maxX + limit) continue;
    const pts = line.points;
    for (let i = 1; i < pts.length; i++) {
      const d = distanceToSegment(x, pz, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      if (d < best) best = d;
    }
  }
  return best <= limit ? best : Infinity;
}

function bezier(p0, p1, p2, p3, step = SAMPLE_STEP) {
  const approx = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) + Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
  const n = Math.max(4, Math.ceil(approx / step));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return out;
}

function segmentIntersection(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a[0] + t * r[0], z: a[1] + t * r[1], dir: r };
}

// --- layout ----------------------------------------------------------------

/**
 * @param {{language: string, side?: "north"|"south", kind?: string, unit?: string,
 *          projects: {name: string, stars: number, weight?: number, category?: string}[]}[]} groups
 * @param {string} seed
 * @param {{ billboards?: { id: string }[] }} [extras] things to place along roads
 * @returns {{ radius, width, cities, buildings, roads, river, bridges, billboards, trees, bounds, spawn }}
 */
export function createLayout(groups, seed = "portfolio", extras = {}) {
  const rng = createRng(seed);
  const rings = {
    north: groups.filter((g) => g.side === "north"),
    south: groups.filter((g) => g.side !== "north"),
  };

  // Ring latitudes (as plane z) sit clear of the equator highway.
  const ringInfo = Object.entries(rings).map(([side, list]) => {
    const radii = list.map((g) => clusterRadius(g.projects.length));
    const maxR = radii.length ? Math.max(...radii) : 0;
    const z = (HIGHWAY_HALF_WIDTH + maxR + 26) * (side === "north" ? -1 : 1);
    const need = radii.reduce((s, r) => s + 2 * r + RING_GAP, 0);
    return { side, list, radii, maxR, z, need };
  });

  // Planet radius: each ring must fit around its latitude circle (which
  // shrinks by cos(lat)), and the outer edge must stay off the poles.
  const outer = Math.max(...ringInfo.map((r) => Math.abs(r.z) + r.maxR + POLAR_MARGIN));
  let radius = Math.max(outer / MAX_LATITUDE, 70);
  for (let i = 0; i < 8; i++) {
    for (const r of ringInfo) {
      if (r.list.length) radius = Math.max(radius, r.need / (2 * Math.PI * Math.cos(r.z / radius)));
    }
  }
  const halfX = Math.PI * radius;
  const width = 2 * halfX;
  // Land runs up to a fixed distance short of each pole, where the sea and
  // the mountains take over.
  const halfZ = Math.max(outer, (Math.PI / 2) * radius - POLE_CAP);
  const dist = (ax, az, bx, bz) => Math.hypot(wrapDelta(ax - bx, width), az - bz);

  // Spread each ring's districts all the way round, spaced by their size,
  // starting at START_LONGITUDE.
  let id = 0;
  const cities = [];
  for (const info of ringInfo) {
    const scale = width / Math.max(info.need, 1);
    let cursor = 0;
    info.list.forEach((g, i) => {
      const span = (2 * info.radii[i] + RING_GAP) * scale;
      const centre = i === 0 ? 0 : cursor + span / 2;
      cursor = i === 0 ? span / 2 : cursor + span;
      cities.push({
        id: id++,
        side: info.side,
        ringIndex: i,
        language: g.language,
        kind: g.kind ?? "repos",
        unit: g.unit ?? "project",
        hue: languageHue(g.language),
        x: wrapDelta(START_LONGITUDE * radius + centre + (rng() - 0.5) * 4, width),
        z: info.z + (rng() - 0.5) * 6,
        radius: info.radii[i],
        projects: g.projects,
      });
    });
  }

  const river = makeRiver({ cities, width, halfZ, rng, dist, radius });
  const sea = makeSea({ halfZ, radius, width, rng, mouthX: river.points.at(-1)[0] });
  const { mountainEdge } = polarZones(halfZ, radius);
  const roads = makeRoads({ cities, width, halfZ, rng, dist });
  const bridges = findBridges(roads, river, width);

  const world = {
    radius,
    width,
    cities,
    roads,
    river,
    sea,
    mountains: { edge: mountainEdge },
    bridges,
    bounds: { halfX, halfZ },
    buildings: [],
    billboards: [],
    trees: [],
  };
  world.buildings = cities.flatMap((city) => placeBuildings(world, city, rng));
  world.billboards = placeBillboards(world, extras.billboards ?? [], rng);
  world.trees = plantTrees(world, rng);
  world.terrain = buildTerrain(world, rng);

  // Start on the first northern district's spur road, so the first thing you
  // see is the résumé.
  const spur = roads.find((r) => r.kind === "spur" && cities[r.from].side === "north") ?? roads.find((r) => r.kind === "spur");
  world.spawn = spur ? pointAlong(spur, 0.45) : { x: 0, z: -HIGHWAY_HALF_WIDTH * 3, yaw: 0 };
  return world;
}

/** Position and heading (vehicle yaw: forward is -z at 0) a fraction `t` along a road. */
export function pointAlong(road, t) {
  const pts = road.points;
  let target = road.length * t;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1];
    const [x1, z1] = pts[i];
    const seg = Math.hypot(x1 - x0, z1 - z0);
    if (target <= seg || i === pts.length - 1) {
      const f = seg ? Math.min(1, target / seg) : 0;
      return { x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, yaw: Math.atan2(-(x1 - x0), -(z1 - z0)) };
    }
    target -= seg;
  }
  return { x: pts[0][0], z: pts[0][1], yaw: 0 };
}

// The black hole always sits a little north of the equator, so the north
// polar region faces it and the south looks away. Round the south pole rise
// mountains; over the north pole lies a small sea dotted with islands. The
// river tumbles off the mountains as a waterfall, meanders north across the
// equator through the longitude furthest from every district, and runs
// straight out into the sea.
export const MOUNTAIN_HEIGHT = 16; // flying higher than this clears the peaks
export const BRIDGE_HEIGHT = 2.4; // how high bridge decks arch over the water
export const WATERFALL_HEIGHT = 9; // where the river leaps off the cliff

/** Where the poles' scenery starts: the mountains' foot (south) and the shore (north), as plane |z|. */
function polarZones(halfZ, radius) {
  const pole = (Math.PI / 2) * radius;
  return { mountainEdge: halfZ + (pole - halfZ) * 0.25, shore: halfZ + (pole - halfZ) * 0.35, pole };
}

function makeSea({ halfZ, radius, width, rng, mouthX }) {
  const { shore, pole } = polarZones(halfZ, radius);
  const islands = [];
  for (let tries = 0; islands.length < 3 && tries < 200; tries++) {
    const z = -(shore + (pole - shore) * (0.3 + rng() * 0.45));
    const x = (rng() - 0.5) * width;
    const r = 2.5 + rng() * 2;
    const rx = r / Math.max(0.15, Math.cos(z / radius)); // round on the globe
    const dx = (ax, bx) => Math.abs(wrapDelta(ax - bx, width));
    if (dx(x, mouthX) < rx + 12 && z > -(shore + 10)) continue; // keep the river mouth open
    if (islands.some((o) => Math.hypot(dx(o.x, x) / Math.max(o.rx / o.r, rx / r), o.z - z) < o.r + r + 4)) continue;
    islands.push({ x, z, r, rx });
  }
  return { shore, islands };
}

function makeRiver({ cities, width, halfZ, rng, dist, radius }) {
  const half = width / 2;
  let x0 = 0;
  let clearance = -Infinity;
  for (let i = 0; i < 360; i++) {
    const x = -half + (i / 360) * width;
    const c = Math.min(...cities.map((city) => Math.abs(wrapDelta(x - city.x, width)) - city.radius), Infinity);
    if (c > clearance) {
      clearance = c;
      x0 = x;
    }
  }

  // It leaps off a cliff in the mountains' foothills and runs out into the sea.
  const { mountainEdge, shore } = polarZones(halfZ, radius);
  const source = { x: x0, z: mountainEdge + 3, height: WATERFALL_HEIGHT };
  const mouthZ = -(shore + 5);

  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const p3 = rng() * Math.PI * 2;
  const span = source.z - mouthZ;
  const build = (amp) => {
    const points = [];
    const widths = [];
    // In flow order: from the waterfall (south) to the sea (north).
    for (let z = source.z; z >= mouthZ - 0.01; z -= SAMPLE_STEP) {
      const t = (source.z - z) / span; // 0 at the falls, 1 at the mouth
      const envelope = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      points.push([x0 + envelope * amp * (0.65 * Math.sin(z * 0.045 + p1) + 0.35 * Math.sin(z * 0.11 + p2)), z]);
      // Narrow below the falls, broadening downstream, opening wide into the sea.
      const delta = Math.max(0, (t - 0.9) / 0.1);
      widths.push(RIVER_HALF_WIDTH * (0.6 + 0.55 * t) * (1 + delta * 1.2) + 1.1 * Math.sin(z * 0.07 + p3));
    }
    return { points, widths };
  };
  let amp = Math.max(0, Math.min(clearance * 0.5, 20));
  let shape = build(amp);
  const clear = ({ points, widths }) =>
    points.every(([x, z], i) => cities.every((c) => dist(c.x, c.z, x, z) > c.radius + widths[i] + 4));
  while (amp > 0.5 && !clear(shape)) {
    amp *= 0.8;
    shape = build(amp);
  }
  return polyline(shape.points, { widths: shape.widths, maxHalfWidth: Math.max(...shape.widths), source });
}

function makeRoads({ cities, width, halfZ, rng, dist }) {
  const roads = [];
  const add = (kind, from, to, points, halfWidth = ROAD_HALF_WIDTH) =>
    roads.push(polyline(points, { id: roads.length, kind, from, to, halfWidth, closed: kind === "highway" }));

  // 1. The equator highway, all the way round.
  const n = Math.ceil(width / 3);
  add("highway", null, null, Array.from({ length: n + 1 }, (_, i) => [-width / 2 + (i / n) * width, 0]), HIGHWAY_HALF_WIDTH);

  // Keeps a curve away from districts other than the ones it connects.
  const avoids = (points, ends) =>
    points.every(([x, z]) => cities.every((c) => ends.includes(c.id) || dist(c.x, c.z, x, z) > c.radius + ROAD_HALF_WIDTH + 2));

  // 2. A winding spur from each district down to the highway. It leaves the
  //    roundabout dead straight (radially), meets the highway at a right
  //    angle, and makes its S-bend in between by landing a little to one side.
  for (const c of cities) {
    const dirZ = -Math.sign(c.z); // toward the equator
    const p0 = [c.x, c.z + dirZ * ROAD_START];
    let points;
    for (let attempt = 0; attempt < 6; attempt++) {
      const swing = (rng() < 0.5 ? 1 : -1) * (7 + rng() * 8 * (1 - attempt / 6));
      // The S-bend ends a little short of the highway; the last stretch runs
      // dead straight into it, so the junction's flared kerbs line up.
      const p3 = [c.x + swing, -dirZ * (HIGHWAY_HALF_WIDTH + SPUR_TAIL)];
      const dz = p3[1] - p0[1];
      const p1 = [p0[0], p0[1] + dz * 0.45];
      const p2 = [p3[0], p3[1] - dz * 0.45];
      const steps = Math.ceil((HIGHWAY_HALF_WIDTH + SPUR_TAIL) / SAMPLE_STEP);
      const tail = Array.from({ length: steps }, (_, i) => [p3[0], i === steps - 1 ? 0 : p3[1] * (1 - (i + 1) / steps)]);
      points = [...bezier(p0, p1, p2, p3), ...tail];
      if (avoids(points, [c.id])) break;
    }
    add("spur", c.id, null, points);
  }

  // 3. Country lanes between neighbouring districts, bowing away from the
  //    equator so they don't just shadow the highway.
  for (const side of ["north", "south"]) {
    const ring = cities.filter((c) => c.side === side).sort((a, b) => a.ringIndex - b.ringIndex);
    if (ring.length < 2) continue;
    const count = ring.length === 2 ? 1 : ring.length; // close the loop unless that doubles the only lane
    const pole = side === "north" ? -1 : 1;
    for (let i = 0; i < count; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const bx = a.x + wrapDelta(b.x - a.x, width);
      const dx = bx - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      let points = null;
      for (let attempt = 0; attempt < 8 && !points; attempt++) {
        // Each end leaves its roundabout radially, angled toward the pole so
        // the lane bows away from the highway; the curve bends in between.
        const lean = (0.25 + rng() * 0.45) * (1 - attempt / 8);
        const leave = (vx, vz) => {
          const sx = vx * Math.cos(lean);
          const sz = vz * Math.cos(lean) + pole * Math.sin(lean);
          const l = Math.hypot(sx, sz);
          return [sx / l, sz / l];
        };
        const [ax, az] = leave(dx / d, dz / d);
        const [bxDir, bzDir] = leave(-dx / d, -dz / d);
        const p0 = [a.x + ax * ROAD_START, a.z + az * ROAD_START];
        const p3 = [bx + bxDir * ROAD_START, b.z + bzDir * ROAD_START];
        const reach = d * (0.28 + rng() * 0.12);
        const p1 = [p0[0] + ax * reach, p0[1] + az * reach];
        const p2 = [p3[0] + bxDir * reach, p3[1] + bzDir * reach];
        const candidate = bezier(p0, p1, p2, p3);
        const inBounds = candidate.every(([, z]) => Math.abs(z) < halfZ - 8);
        if (inBounds && avoids(candidate, [a.id, b.id])) points = candidate;
      }
      if (points) add("lane", a.id, b.id, points);
    }
  }
  return roads;
}

// Wherever a road crosses the river, there's a bridge.
function findBridges(roads, river, width) {
  const bridges = [];
  const rp = river.points;
  for (const road of roads) {
    const pts = road.points;
    for (let i = 1; i < pts.length; i++) {
      for (const shift of [0, width, -width]) {
        const a = [pts[i - 1][0] + shift, pts[i - 1][1]];
        const b = [pts[i][0] + shift, pts[i][1]];
        if (Math.max(a[0], b[0]) < river.bbox.minX || Math.min(a[0], b[0]) > river.bbox.maxX) continue;
        for (let j = 1; j < rp.length; j++) {
          const hit = segmentIntersection(a, b, rp[j - 1], rp[j]);
          if (!hit) continue;
          // Ignore a second hit right next to one we already have (shared vertex).
          if (bridges.some((br) => br.roadId === road.id && Math.hypot(br.x - hit.x, br.z - hit.z) < 3)) continue;
          bridges.push({
            roadId: road.id,
            x: wrapDelta(hit.x, width),
            z: hit.z,
            angle: Math.atan2(hit.dir[0], hit.dir[1]),
            halfWidth: road.halfWidth,
            span: river.widths[j] * 2 + 4,
          });
        }
      }
    }
  }
  return bridges;
}

function nearAnyRoad(world, x, z, extra) {
  return world.roads.some((r) => polyDistance(world.width, x, z, r, r.halfWidth + extra) !== Infinity);
}

/** True on one of the sea's islands (shrunk by `margin`). */
export function onIsland(world, x, z, margin = 0) {
  return (world.sea?.islands ?? []).some((l) => {
    const dx = wrapDelta(x - l.x, world.width) / Math.max(0.1, l.rx - margin * (l.rx / l.r));
    const dz = (z - l.z) / Math.max(0.1, l.r - margin);
    return dx * dx + dz * dz < 1;
  });
}

function inSea(world, x, z, margin = 0) {
  return z < -world.sea.shore + margin && !onIsland(world, x, z, margin);
}

function nearRiver(world, x, z, extra) {
  return inSea(world, x, z, extra) || polyDistance(world.width, x, z, world.river, world.river.maxHalfWidth + extra) !== Infinity;
}

function placeBuildings(world, city, rng) {
  const clear = (x, z) => !nearAnyRoad(world, x, z, BUILDING_RADIUS + 0.5) && !nearRiver(world, x, z, BUILDING_RADIUS + 1);
  const count = city.projects.length;
  let radius = city.radius;
  for (let attempt = 0; ; attempt++) {
    const spots = [];
    let tries = 0;
    while (spots.length < count && tries < count * 200) {
      tries++;
      const angle = rng() * Math.PI * 2;
      // Clear of the roundabout and its flared road mouths (kerbs reach ~1 unit past the ring).
      const inner = PLAZA_RADIUS + 1.5 + BUILDING_RADIUS;
      const r = inner + Math.sqrt(rng()) * Math.max(0, radius - inner - BUILDING_RADIUS);
      const x = city.x + Math.cos(angle) * r;
      const z = city.z + Math.sin(angle) * r;
      if (!spots.every(([px, pz]) => Math.hypot(px - x, pz - z) >= MIN_BUILDING_GAP)) continue;
      if (clear(x, z)) spots.push([x, z]);
    }
    if (spots.length === count || attempt > 20) {
      city.radius = radius;
      return spots.map(([x, z], i) => {
        const project = city.projects[i];
        return {
          id: `${city.id}:${project.name}`,
          cityId: city.id,
          project,
          kind: city.kind,
          x,
          z,
          height: buildingHeight(project.weight ?? project.stars) + rng() * 1.5,
          // Door (+z face) points at the plaza.
          rotation: Math.atan2(city.x - x, city.z - z),
          hue: project.category ? languageHue(project.category) : city.hue,
          lightness: 0.55 + rng() * 0.2,
        };
      });
    }
    radius *= 1.1;
  }
}

// Billboards stand beside roads, facing traffic, spread round the planet.
function placeBillboards(world, items, rng) {
  if (!items.length) return [];
  const dist = (ax, az, bx, bz) => worldDistance(world, ax, az, bx, bz);
  const candidates = [];
  for (const road of world.roads) {
    const n = Math.max(1, Math.floor(road.length / 22));
    for (let i = 1; i < n; i++) {
      const p = pointAlong(road, i / n);
      // Road direction from the vehicle-yaw convention: forward = (-sin, -cos).
      const ux = -Math.sin(p.yaw);
      const uz = -Math.cos(p.yaw);
      for (const side of [1, -1]) {
        const px = -uz * side;
        const pz = ux * side;
        const off = road.halfWidth + 2.5;
        candidates.push({ x: wrapDelta(p.x + px * off, world.width), z: p.z + pz * off, rotation: Math.atan2(-px, -pz), key: rng() });
      }
    }
  }
  candidates.sort((a, b) => a.key - b.key);
  const placed = [];
  for (const c of candidates) {
    if (placed.length === items.length) break;
    const ok =
      Math.abs(c.z) < world.bounds.halfZ - 8 &&
      world.cities.every((city) => dist(city.x, city.z, c.x, c.z) > city.radius + 4) &&
      !nearAnyRoad(world, c.x, c.z, BILLBOARD_RADIUS) &&
      !nearRiver(world, c.x, c.z, BILLBOARD_RADIUS + 2) &&
      world.buildings.every((b) => dist(b.x, b.z, c.x, c.z) > BUILDING_RADIUS + BILLBOARD_RADIUS + 3) &&
      placed.every((p) => dist(p.x, p.z, c.x, c.z) > 30);
    if (ok) placed.push({ x: c.x, z: c.z, rotation: c.rotation, item: items[placed.length] });
  }
  return placed;
}

function plantTrees(world, rng) {
  const trees = [];
  const { halfX, halfZ } = world.bounds;
  const dist = (ax, az, bx, bz) => worldDistance(world, ax, az, bx, bz);
  const free = (x, z) =>
    Math.abs(z) < halfZ - 3 &&
    !nearAnyRoad(world, x, z, 2) &&
    !nearRiver(world, x, z, 1.5) &&
    world.buildings.every((b) => dist(b.x, b.z, x, z) > BUILDING_RADIUS + 2.5) &&
    world.billboards.every((b) => dist(b.x, b.z, x, z) > BILLBOARD_RADIUS + 2.5) &&
    trees.every((t) => dist(t.x, t.z, x, z) > 3);

  // A loose ring around each district…
  for (const city of world.cities) {
    const ringR = city.radius + 2.5;
    const count = Math.floor((2 * Math.PI * ringR) / 5);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng() * 0.2;
      const r = ringR + (rng() - 0.5) * 2;
      const x = wrapDelta(city.x + Math.cos(a) * r, world.width);
      const z = city.z + Math.sin(a) * r;
      if (free(x, z)) trees.push({ x, z, scale: 0.8 + rng() * 0.5 });
    }
  }
  // …a riverside woodland…
  for (let i = 0; i < world.river.points.length; i += 2) {
    const [rx, rz] = world.river.points[i];
    for (const side of [-1, 1]) {
      if (rng() < 0.45) continue;
      const x = wrapDelta(rx + side * (world.river.widths[i] + 2 + rng() * 5), world.width);
      if (free(x, rz)) trees.push({ x, z: rz, scale: 0.9 + rng() * 0.6 });
    }
  }
  // …and some countryside, thinning toward the poles where the projection
  // squeezes east–west distances.
  const target = trees.length + Math.round((halfX * halfZ) / 220);
  for (let tries = 0; trees.length < target && tries < target * 30; tries++) {
    const x = (rng() * 2 - 1) * halfX;
    const z = (rng() * 2 - 1) * halfZ;
    if (rng() > Math.cos(z / world.radius)) continue;
    const inCity = world.cities.some((c) => dist(c.x, c.z, x, z) < c.radius + 4);
    if (!inCity && free(x, z)) trees.push({ x, z, scale: 0.8 + rng() * 0.6 });
  }
  return trees;
}

/** Plane distance on the wrapped world. */
export function worldDistance(world, ax, az, bx, bz) {
  return Math.hypot(wrapDelta(ax - bx, world.width), az - bz);
}

/** Distance from a point to the nearest road centreline (Infinity if beyond `limit`). */
export function roadDistance(world, x, z, road, limit = Infinity) {
  return polyDistance(world.width, x, z, road, limit);
}

/**
 * What's underfoot at (x, z): "highway" (the equator), "road" (spurs and
 * lanes), "paved" (district squares) or "grass" (everything else).
 */
export function surfaceAt(world, x, z) {
  if (Math.abs(z) <= HIGHWAY_HALF_WIDTH + 0.3) return "highway";
  for (const r of world.roads) {
    if (r.kind !== "highway" && polyDistance(world.width, x, z, r, r.halfWidth + 0.3) !== Infinity) return "road";
  }
  for (const c of world.cities) {
    const d = worldDistance(world, c.x, c.z, x, z);
    if (d < PLAZA_RADIUS - 0.5) return "road"; // the roundabout
    if (d < c.radius + 1.5) return "paved";
  }
  return "grass";
}

/**
 * Height of the road deck at (x, z): bridges arch up over the river, rising
 * smoothly from each bank. 0 away from bridges (and off their roads).
 */
export function bridgeElevation(world, x, z) {
  let h = 0;
  for (const b of world.bridges) {
    const ramp = b.span / 2 + 9;
    const d = worldDistance(world, b.x, b.z, x, z);
    if (d >= ramp) continue;
    const road = world.roads[b.roadId];
    if (roadDistance(world, x, z, road, road.halfWidth + 1.5) === Infinity) continue;
    h = Math.max(h, BRIDGE_HEIGHT * (0.5 + 0.5 * Math.cos((Math.PI * d) / ramp)));
  }
  return h;
}

/** Distance from (x, z) to the river's centre line (Infinity if beyond `limit`). */
export function riverDistance(world, x, z, limit = Infinity) {
  let d = polyDistance(world.width, x, z, world.river, limit);
  return d <= limit ? d : Infinity;
}

/** True if (x, z) is in the river (widened by `margin`). */
export function inRiver(world, x, z, margin = 0) {
  if (inSea(world, x, z, margin)) return true;
  const d = polyDistance(world.width, x, z, world.river, world.river.maxHalfWidth + margin);
  if (d === Infinity) return false;
  // Width varies along the course (which runs north–south): use the width
  // of the sample at the nearest latitude.
  let best = 0;
  let bestD = Infinity;
  world.river.points.forEach(([, pz], i) => {
    const dd = Math.abs(pz - z);
    if (dd < bestD) {
      bestD = dd;
      best = world.river.widths[i];
    }
  });
  return d < best + margin;
}

/**
 * True if a circle of `radius` at (x, z) hits a building, billboard, tree or
 * the river (except on a bridge). `height` lets flying things pass over
 * anything shorter than them. x wraps around the planet; the poles are open
 * (vehicles cross them with crossPole in src/lib/globe.js).
 */
/** True if (x, z) is water you can't drive on (the river, lakes, the sea) — bridges excepted. */
export function inWater(world, x, z, margin = 0) {
  if (!inRiver(world, x, z, margin)) return false;
  return !world.bridges.some((b) => {
    const road = world.roads[b.roadId];
    return worldDistance(world, b.x, b.z, x, z) < b.span && roadDistance(world, x, z, road, road.halfWidth - margin) !== Infinity;
  });
}

export function collides(world, x, z, radius, height = 0) {
  // The southern mountains: only something flying over the peaks gets through.
  if (z > world.mountains.edge - radius && height < MOUNTAIN_HEIGHT) return true;
  if (height < 1 && inWater(world, x, z, radius * 0.5)) return true;
  for (const b of world.buildings) {
    if (height < b.height + 1 && worldDistance(world, b.x, b.z, x, z) < BUILDING_RADIUS + radius) return true;
  }
  if (height < 7) {
    for (const b of world.billboards) {
      if (worldDistance(world, b.x, b.z, x, z) < BILLBOARD_RADIUS + radius) return true;
    }
  }
  if (height < 4.5) {
    for (const t of world.trees) {
      if (worldDistance(world, t.x, t.z, x, z) < TREE_RADIUS * t.scale + radius) return true;
    }
  }
  return false;
}
