// Route planning for "Go to": instead of teleporting, the autopilot drives
// there. The car follows the road network — every road vertex is a node,
// consecutive vertices are joined, each spur's end joins the highway, the
// highway closes round the planet, and road ends at the same town join
// across the roundabout — found with Dijkstra. The drone just flies straight.
// Pure, so it's testable.

import { PLAZA_RADIUS, ROUNDABOUT_ISLAND, inWater, worldDistance, wrapDelta } from "./layout";
import { AUTOPILOT, wrapAngle, yawToward } from "./autopilot";
import { pathClear } from "./avoid";
import { pidDrive } from "./pid";

/** Road graph: nodes [{ x, z }] and adjacency lists [[{ to, w }]]. */
export function buildRoadGraph(world) {
  const nodes = [];
  const edges = [];
  const add = (x, z) => {
    nodes.push({ x, z });
    edges.push([]);
    return nodes.length - 1;
  };
  const link = (a, b) => {
    const w = worldDistance(world, nodes[a].x, nodes[a].z, nodes[b].x, nodes[b].z);
    edges[a].push({ to: b, w });
    edges[b].push({ to: a, w });
  };
  const ids = new Map(); // road id -> node ids
  for (const road of world.roads) {
    const list = road.points.map(([x, z]) => add(x, z));
    for (let i = 1; i < list.length; i++) link(list[i - 1], list[i]);
    if (road.closed) link(list.at(-1), list[0]);
    ids.set(road.id, list);
  }
  const highway = world.roads.find((r) => r.kind === "highway");
  const hw = highway ? ids.get(highway.id) : [];
  const ends = new Map(world.cities.map((c) => [c.id, []]));
  for (const road of world.roads) {
    if (road.kind === "highway") continue;
    const list = ids.get(road.id);
    if (ends.has(road.from)) ends.get(road.from).push(list[0]);
    if (road.to != null && ends.has(road.to)) ends.get(road.to).push(list.at(-1));
    if (road.kind === "spur" && hw.length) {
      // Join the highway at its nearest vertex.
      const end = nodes[list.at(-1)];
      let best = hw[0];
      for (const h of hw) if (Math.abs(wrapDelta(nodes[h].x - end.x, world.width)) < Math.abs(wrapDelta(nodes[best].x - end.x, world.width))) best = h;
      link(list.at(-1), best);
    }
  }
  // Across each roundabout (planRoute turns these hops into a drive round the ring).
  for (const [cityId, list] of ends) {
    for (const n of list) nodes[n].town = cityId;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) link(list[i], list[j]);
  }
  return { nodes, edges };
}

/** True if the straight line from a to b crosses water you can't drive through. */
export function waterBetween(world, ax, az, bx, bz) {
  const dx = wrapDelta(bx - ax, world.width);
  const dz = bz - az;
  const n = Math.ceil(Math.hypot(dx, dz) / 0.8);
  for (let k = 1; k < n; k++) if (inWater(world, ax + (dx * k) / n, az + (dz * k) / n, 0.6)) return true;
  return false;
}

/** The nearest road point it can drive straight to — preferably nothing in the way, at least no water — else simply the nearest. */
function nearestDryNode(world, graph, from) {
  const order = graph.nodes
    .map((n, i) => [worldDistance(world, n.x, n.z, from.x, from.z), i])
    .sort((p, q) => p[0] - q[0])
    .slice(0, 60);
  // A clear run if there is one; else at least no water in between (trees it can steer round).
  for (const [, i] of order) if (pathClear(world, from.x, from.z, graph.nodes[i].x, graph.nodes[i].z)) return i;
  for (const [, i] of order) if (!waterBetween(world, from.x, from.z, graph.nodes[i].x, graph.nodes[i].z)) return i;
  return order[0][1];
}

function nearestNode(world, graph, x, z, filter) {
  let best = 0;
  let bestD = Infinity;
  graph.nodes.forEach((n, i) => {
    if (filter && !filter(n)) return;
    const d = worldDistance(world, n.x, n.z, x, z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function dijkstra(graph, from, to) {
  const n = graph.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[from] = 0;
  // Small graph (~1–2k nodes): a binary heap keeps it quick.
  const heap = [[0, from]];
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const order = []; // nodes in the order the search settled them (for the visualisation)
  while (heap.length) {
    const [d, u] = pop();
    if (done[u]) continue;
    done[u] = 1;
    order.push(u);
    if (u === to) break;
    for (const { to: v, w } of graph.edges[u]) {
      if (d + w < dist[v]) {
        dist[v] = d + w;
        prev[v] = u;
        push([dist[v], v]);
      }
    }
  }
  if (dist[to] === Infinity) return null;
  const path = [];
  for (let u = to; u !== -1; u = prev[u]) path.push(u);
  return { path: path.reverse(), order };
}

/**
 * Plans a trip to `city` from (x, z).
 * Car: along roads to the district's spur, stopping a little way up it
 * (where "Go to" used to drop you). Drone: straight there.
 * @returns {{ kind: "road" | "air", points: number[][], cityId, length }}
 */
export function planRoute(world, graph, from, city, type, { through = false } = {}) {
  const spur = world.roads.find((r) => r.kind === "spur" && r.from === city.id);
  // The drone follows the roads too (flown at its own altitude); only a
  // district with no road gets a straight flight.
  if (!spur) {
    const points = [[from.x, from.z], [from.x + wrapDelta(city.x - from.x, world.width), city.z]];
    return { kind: "air", points, cityId: city.id, through, length: worldDistance(world, from.x, from.z, city.x, city.z) };
  }
  // The stop: a fifth of the way down the spur from the town — or, passing
  // through on a tour, the roundabout's edge (the next leg goes round it).
  const stopIndex = through ? Math.min(1, spur.points.length - 1) : Math.max(1, Math.round((spur.points.length - 1) * 0.2));
  const [sx, sz] = spur.points[stopIndex];
  // Starting at (or just outside) a town, set off from its roundabout.
  const startTown = world.cities.find((c) => worldDistance(world, c.x, c.z, from.x, from.z) < PLAZA_RADIUS + 6);
  // On the open road, start from the nearest road point a little ahead, so
  // the route carries on the way we're going (no sideways jog onto it).
  const fx = from.yaw != null ? -Math.sin(from.yaw) : 0;
  const fz = from.yaw != null ? -Math.cos(from.yaw) : 0;
  const ahead = (n) => {
    const dx = wrapDelta(n.x - from.x, world.width);
    const dz = n.z - from.z;
    return dx * fx + dz * fz > 1.5 && Math.hypot(dx, dz) < 10;
  };
  // Never set off across the river: only start from road points it can
  // reach in a straight line without crossing water.
  // (A clear run is best; trees can be steered round, water can't.)
  const clear = (n) => pathClear(world, from.x, from.z, n.x, n.z);
  let a;
  if (startTown) a = nearestNode(world, graph, from.x, from.z, (n) => n.town === startTown.id);
  else {
    a = nearestNode(world, graph, from.x, from.z, from.yaw != null ? (n) => ahead(n) && clear(n) : clear);
    if (!ahead(graph.nodes[a]) || !clear(graph.nodes[a])) a = nearestDryNode(world, graph, from);
  }
  const onRoad = !startTown && from.yaw != null && ahead(graph.nodes[a]);
  const b = nearestNode(world, graph, sx, sz);
  const search = dijkstra(graph, a, b) ?? { path: [a, b], order: [a, b] };
  const { path } = search;
  // Unwrap x so the polyline is continuous across the date line.
  // Built along the road centre lines (unwrapped round the planet from the
  // vehicle), then shifted into the left-hand lane and started at the vehicle.
  const points = [[from.x, from.z]];
  if (onRoad) points.push([from.x + wrapDelta(graph.nodes[a].x - from.x, world.width), graph.nodes[a].z]);
  const push = (x, z) => {
    const [px] = points.at(-1);
    points.push([px + wrapDelta(x - px, world.width), z]);
  };
  // Round a town's roundabout, clockwise (as traffic keeping left goes),
  // from angle a0 to angle a1 — a full lap if they're the same.
  const RING = (ROUNDABOUT_ISLAND + PLAZA_RADIUS - 0.5) / 2 - 0.7; // + the keep-left offset ≈ mid-ring
  const roundabout = (town, a0, a1) => {
    let sweep = (((a1 - a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (sweep < 0.35) sweep += 2 * Math.PI;
    const n = Math.ceil(sweep / 0.3);
    for (let k = 1; k <= n; k++) {
      const a = a0 + (sweep * k) / n;
      push(town.x + Math.cos(a) * RING, town.z + Math.sin(a) * RING);
    }
  };
  const angleOf = (town, x, z) => Math.atan2(z - town.z, wrapDelta(x - town.x, world.width));
  const node = (i) => graph.nodes[i];

  let k = 0;
  // Starting in a town: drive round to whichever road the path leaves by.
  if (startTown && node(path[0]).town === startTown.id) {
    while (k + 1 < path.length && node(path[k + 1]).town === startTown.id) k++;
    const exit = node(path[k]);
    const heading = from.yaw ?? 0;
    const fx = -Math.sin(heading);
    const fz = -Math.cos(heading);
    // The exit road's direction out of town.
    const out = [wrapDelta(exit.x - startTown.x, world.width), exit.z - startTown.z];
    // Already heading out along it? Then just go; otherwise round the ring.
    if (fx * out[0] + fz * out[1] < 0 || worldDistance(world, startTown.x, startTown.z, from.x, from.z) < PLAZA_RADIUS - 1) {
      roundabout(startTown, angleOf(startTown, from.x, from.z), angleOf(startTown, exit.x, exit.z));
    }
  }
  for (; k < path.length; k++) {
    const here = node(path[k]);
    const next = k + 1 < path.length ? node(path[k + 1]) : null;
    push(here.x, here.z);
    // Passing through a town: from the road end we came in on, round the
    // ring to the road end we leave by (skipping any ends in between).
    if (next && here.town != null && next.town === here.town) {
      let j = k + 1;
      while (j + 1 < path.length && node(path[j + 1]).town === here.town) j++;
      const town = world.cities[here.town];
      const out = node(path[j]);
      roundabout(town, angleOf(town, here.x, here.z), angleOf(town, out.x, out.z));
      k = j - 1;
    }
  }
  // Keep left: the route runs down the middle of the left-hand lane, from
  // exactly where the vehicle is now.
  const centre = points.slice(1).filter((p, i, list) => !i || Math.hypot(p[0] - list[i - 1][0], p[1] - list[i - 1][1]) > 0.05);
  const laned = [points[0], ...keepLeft(centre, Math.abs(AUTOPILOT.lane))];
  // Round off every corner (junctions, roundabout entries, the way onto the
  // route), so the path — and the car following it — turns in smooth curves.
  const smooth = smoothPath(laned);
  points.length = 0;
  points.push(...smooth);
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  // The junctions the search looked at, in order — the planner's "thinking".
  const explored = search.order.map((i) => [graph.nodes[i].x, graph.nodes[i].z]);
  return { kind: "road", laned: true, points, cityId: city.id, through, length, explored };
}

/** Shifts a polyline `offset` to the left of its direction of travel. */
export function keepLeft(points, offset) {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    return [p[0] + (dz / len) * offset, p[1] - (dx / len) * offset]; // left of travel: (dz, -dx)
  });
}

/**
 * Resamples a polyline to even `spacing` and smooths it with a Gaussian of
 * width `sigma` along its length, which turns every corner into a curve of
 * radius ≈ 1.2·sigma. Past the ends the end points repeat, and the first and
 * last points themselves stay exactly where they are.
 */
export function smoothPath(points, { spacing = 1, sigma = 2.6 } = {}) {
  if (points.length < 3) return points.map((p) => [...p]);
  // 1. Even spacing.
  const even = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const [x0, z0] = points[i - 1];
    const [x1, z1] = points[i];
    const len = Math.hypot(x1 - x0, z1 - z0);
    let d = spacing - carry;
    for (; d <= len; d += spacing) even.push([x0 + ((x1 - x0) * d) / len, z0 + ((z1 - z0) * d) / len]);
    carry = len - (d - spacing);
  }
  const last = points.at(-1);
  if (Math.hypot(even.at(-1)[0] - last[0], even.at(-1)[1] - last[1]) > 1e-6) even.push(last);
  // 2. Gaussian smoothing.
  const n = even.length;
  const K = Math.ceil((3 * sigma) / spacing);
  const weights = Array.from({ length: K + 1 }, (_, k) => Math.exp(-((k * spacing) ** 2) / (2 * sigma * sigma)));
  return even.map((p, i) => {
    if (i === 0 || i === n - 1) return [...p];
    let x = 0;
    let z = 0;
    let w = 0;
    for (let j = -K; j <= K; j++) {
      const q = even[Math.min(n - 1, Math.max(0, i + j))]; // past the ends, the end point repeats
      x += q[0] * weights[Math.abs(j)];
      z += q[1] * weights[Math.abs(j)];
      w += weights[Math.abs(j)];
    }
    return [x / w, z / w];
  });
}

/**
 * The next district on an autopilot tour of the whole planet: any district
 * not yet visited this round, picked at random (never the one just left), so
 * every district comes up in a different order each round — near or far.
 * `tour` is { visited: Set<cityId>, last: cityId | null }, updated here.
 */
export function nextTourStop(world, from, tour, random = Math.random) {
  let options = world.cities.filter((c) => !tour.visited.has(c.id) && c.id !== tour.last);
  if (!options.length) {
    tour.visited.clear();
    options = world.cities.filter((c) => c.id !== tour.last);
  }
  if (!options.length) return null;
  const pick = options[Math.min(options.length - 1, Math.floor(random() * options.length))];
  tour.visited.add(pick.id);
  tour.last = pick.id;
  return pick;
}

// How each vehicle handles, for the route follower (see src/city/Vehicles.jsx):
// the car's yaw rate is steer × 1.9 rad/s, scaled down below 6 units/s; the
// drone turns at up to 2.8 rad/s at any speed. `brake` is a comfortable
// deceleration to plan with (well under what the vehicles can do).
const HANDLING = {
  car: { yawRate: 1.9, fullGripSpeed: 6, brake: 9, minSpeed: 2.5 },
  // (The drone banks into turns, so it plans as if it turned at ~1.2 rad/s.)
  drone: { yawRate: 1.2, fullGripSpeed: 0, brake: 8, minSpeed: 2 },
};

/** Distance from (px, pz) to segment a→b in the plane, and how far along it the foot lies. */
function project(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1e-6;
  const along = Math.max(0, Math.min(len, ((px - ax) * dx + (pz - az) * dz) / len));
  return { d: Math.hypot(ax + (dx * along) / len - px, az + (dz * along) / len - pz), along, len };
}

/**
 * Autopilot input that follows `route` (keeping its progress in route.i).
 *  - Progress: the vehicle is matched to the nearest of the next few route
 *    segments, so cutting a corner or a route that doubles back (a U-turn
 *    at a roundabout) never loses its place.
 *  - Steering: pure pursuit — aim at a point a speed-dependent distance
 *    ahead, turn that into a path curvature, and that into steering for the
 *    vehicle's actual turn rate. The car keeps left of the centre line.
 *  - Speed: looks down the route for bends (and, via `limitAt`, slower
 *    roads) and brakes in time, so it slows *before* a turn instead of
 *    sailing past it or circling. Eases to a stop at the end unless the
 *    route is just one leg of a tour (`route.through`).
 * @param {(x: number, z: number) => number} [limitAt] speed limit there, if any
 * @param {number} [cap] the most the traffic rules allow right now (see lib/traffic)
 * @returns {{ input, done }}
 */
export function followRoute(s, route, type, world, limitAt, cap = Infinity) {
  const pts = route.points;
  const H = HANDLING[type] ?? HANDLING.car;
  // The vehicle's position, unwrapped to be near the route's own x.
  const unwrapNear = (x) => x + wrapDelta(s.x - x, world.width);

  // 1. Progress.
  route.i = Math.min(route.i ?? 0, pts.length - 2);
  let best = null;
  for (let j = route.i; j < Math.min(pts.length - 1, route.i + 30); j++) {
    const p = project(unwrapNear(pts[j][0]), s.z, pts[j], pts[j + 1]);
    // Prefer staying on the current segment unless a later one is clearly closer.
    if (!best || p.d < best.d - 0.25) best = { ...p, j };
  }
  route.i = best.j;
  if (best.along >= best.len - 1e-6 && route.i < pts.length - 2) route.i++;
  const seglen = (k) => Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
  const start = { i: best.j, along: best.along }; // where we are, along the route
  let remaining = best.len - best.along;
  for (let k = best.j + 1; k < pts.length - 1; k++) remaining += seglen(k);
  route.remaining = remaining; // for the HUD
  if (route.through && remaining < 2.5) return { input: { up: true, down: false, steer: 0, ascend: false, descend: false }, done: true };
  if (remaining < (type === "car" ? 2.5 : 4)) {
    return { input: { up: false, down: s.speed > 0.2, steer: 0, ascend: false, descend: false }, done: Math.abs(s.speed) < 0.5 };
  }

  // Walks `dist` further along the route from `start`; returns the point and the direction there.
  const walk = (dist) => {
    let k = start.i;
    let left = dist + start.along;
    while (k < pts.length - 2 && left > seglen(k)) {
      left -= seglen(k);
      k++;
    }
    const len = seglen(k) || 1e-6;
    const t = Math.min(left, len);
    const dir = [(pts[k + 1][0] - pts[k][0]) / len, (pts[k + 1][1] - pts[k][1]) / len];
    return { p: [pts[k][0] + dir[0] * t, pts[k][1] + dir[1] * t], dir };
  };

  // 2. Steering (pure pursuit).
  const speed = Math.max(Math.abs(s.speed), 1);
  const look = Math.min(remaining, type === "car" ? Math.max(5, Math.min(16, 3 + speed * 0.45)) : Math.max(8, Math.min(22, 4 + speed * 0.5)));
  const { p: aim, dir } = walk(look);
  // Routes are laid out in the lane already; overtaking shifts out to the right.
  // (and steering round an obstacle shifts it too).
  const lane = (type === "car" && route.kind === "road" && !route.laned ? Math.abs(AUTOPILOT.lane) : 0) - (s.laneShift ?? 0) - (s.avoidShift ?? 0);
  const tx = aim[0] + dir[1] * lane; // keep left of the direction of travel
  const tz = aim[1] - dir[0] * lane;
  route.aim = [tx, tz]; // where it's steering for (shown by the route visualisation)
  const dx = wrapDelta(tx - s.x, world.width);
  const dz = tz - s.z;
  const alpha = wrapAngle(yawToward(dx, dz) - s.yaw); // + = target to the left
  const dist = Math.max(1, Math.hypot(dx, dz));
  const curvature = (2 * Math.sin(alpha)) / dist; // the arc through the target
  const grip = H.fullGripSpeed ? Math.min(1, speed / H.fullGripSpeed) : 1;
  let steer = (curvature * speed) / (H.yawRate * grip);
  // Target behind us: turn hard toward it (pure pursuit can't see past 90°) —
  // but brake first, or a fast car swings wide.
  if (Math.abs(alpha) > Math.PI / 2) steer = speed > H.minSpeed + 1.5 ? 0 : Math.sign(alpha);
  steer = Math.max(-1, Math.min(1, steer));

  // 3. Speed: the most we can carry into each bend ahead and still brake in
  // time. Each limit is recorded with its cause in route.why (for the
  // driver panel): the cruise speed, a bend, a slower road, turning round,
  // arriving, or traffic.
  const cruise = (s.autoSpeed ?? (type === "car" ? AUTOPILOT.carSpeed : AUTOPILOT.droneSpeed)) * (s.boost ?? 1); // a little extra while overtaking
  let target = cruise;
  let why = { kind: "cruise", label: s.boost > 1 ? "Overtaking speed" : "Cruise speed" };
  const limit = (v, reason) => {
    if (v < target - 1e-6) {
      target = v;
      why = reason;
    }
  };
  const horizon = Math.min(remaining, (cruise * cruise) / (2 * H.brake) + 12);
  const step = 3;
  let prev = walk(0).dir;
  for (let d = step; d <= horizon; d += step) {
    const here = walk(d);
    const turn = Math.abs(wrapAngle(Math.atan2(here.dir[1], here.dir[0]) - Math.atan2(prev[1], prev[0])));
    prev = here.dir;
    const room = Math.max(0, d - step);
    if (turn > 0.02 && s.pilot?.bends !== false) {
      const bend = (0.6 * H.yawRate * step) / turn; // v = ω·r, r ≈ step / turn (with a margin)
      limit(Math.sqrt(bend * bend + 2 * H.brake * room), { kind: "bend", label: turn > 0.35 ? "Sharp bend ahead" : "Bend ahead", distance: d, x: here.p[0], z: here.p[1] });
    }
    if (limitAt) {
      const v = limitAt(here.p[0], here.p[1]);
      limit(Math.sqrt(v * v + 2 * H.brake * room), { kind: "limit", label: `Speed limit ${Math.round(v * 4)} km/h`, distance: d, x: here.p[0], z: here.p[1] });
    }
  }
  // Pointing the wrong way: crawl round (a tight turn), don't charge off.
  if (Math.abs(alpha) > 1.2) limit(H.minSpeed, { kind: "turn", label: "Turning round" });
  // Ease to a stop at the end — or, passing through a town, to roundabout speed.
  const endSpeed = route.through ? 6 : 0;
  const [ex, ez] = pts.at(-1);
  limit(Math.sqrt(endSpeed * endSpeed + 2 * H.brake * 0.6 * remaining), {
    kind: route.through ? "town" : "arrive",
    label: route.through ? "Entering a town" : "Arriving",
    distance: remaining,
    x: ex,
    z: ez,
  });
  // Traffic (a red light, the car in front) can bring it right down to a stop.
  limit(cap, { kind: "traffic", label: "Traffic" });
  if (cap >= H.minSpeed) target = Math.max(H.minSpeed, target);
  route.why = why;
  route.target = target;

  // The drone holds the altitude you've set; without one, it cruises high and comes down to arrive.
  const cruiseAlt = s.droneAltTarget ?? (remaining > 30 || route.through ? 20 : 10);
  // The car's speed and steering go through its PID controllers (the drone
  // flies route.target through its flight controller instead).
  const drive = type === "car" ? pidDrive(s, target, steer, alpha) : { up: s.speed < target - 0.3, down: s.speed > target + 1, steer };
  return {
    input: {
      ...drive,
      ascend: type === "drone" && s.alt < cruiseAlt - 0.5,
      descend: type === "drone" && s.alt > cruiseAlt + 1,
    },
    done: false,
  };
}

/**
 * The speed the autopilot means to do at each point of `route`, by the same
 * rules followRoute drives by: the cruise speed, capped by each bend's
 * radius and by `limitAt` (road speed limits), then a backward pass so it
 * brakes in time for each, and easing to a stop (or roundabout speed) at the
 * end. For colouring the route by intended speed.
 * @returns {number[]} one speed per route point
 */
export function speedProfile(route, type, cruise, limitAt) {
  const H = HANDLING[type] ?? HANDLING.car;
  const pts = route.points;
  const n = pts.length;
  const caps = new Array(n).fill(cruise);
  const seg = (i) => Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  for (let i = 1; i < n - 1; i++) {
    const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    const b = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
    const turn = Math.abs(wrapAngle(b - a));
    const len = (seg(i - 1) + seg(i)) / 2;
    if (turn > 0.02) caps[i] = Math.min(caps[i], Math.max(H.minSpeed, (0.6 * H.yawRate * len) / turn));
    if (limitAt) caps[i] = Math.min(caps[i], limitAt(pts[i][0], pts[i][1]));
  }
  caps[n - 1] = route.through ? Math.min(cruise, 6) : 0;
  // Brake in time: v² ≤ v_next² + 2·a·d, working back from the end.
  for (let i = n - 2; i >= 0; i--) caps[i] = Math.min(caps[i], Math.sqrt(caps[i + 1] ** 2 + 2 * H.brake * 0.6 * seg(i)));
  return caps;
}

/** speedProfile, cached on the route (recomputed if the cruise speed changes). */
export function routeSpeeds(route, type, cruise, limitAt) {
  const key = `${type}:${cruise}`;
  if (route._speedsKey !== key) {
    route._speeds = speedProfile(route, type, cruise, limitAt);
    route._speedsKey = key;
  }
  return route._speeds;
}

/** Colour for a planned speed: red where it brakes, amber, cyan at full cruise. Returns [r, g, b] 0..1. */
export function speedColor(v, cruise) {
  const f = Math.max(0, Math.min(1, v / Math.max(cruise, 1e-6)));
  const stops = [
    [0, [1, 0.23, 0.36]],
    [0.5, [1, 0.69, 0.13]],
    [0.8, [0.6, 1, 0.35]],
    [1, [0.24, 0.94, 1]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (f <= t1) {
      const k = (f - t0) / (t1 - t0);
      return c0.map((c, j) => c + (c1[j] - c) * k);
    }
  }
  return stops.at(-1)[1];
}

/** True if `route` runs roughly straight (heading within `tolerance` radians) for the next `distance` units. */
export function routeStraight(route, distance = 60, tolerance = 0.3) {
  const pts = route.points;
  let i = Math.min(route.i ?? 0, pts.length - 2);
  const heading = (k) => Math.atan2(pts[k + 1][1] - pts[k][1], pts[k + 1][0] - pts[k][0]);
  const start = heading(i);
  let travelled = 0;
  for (; i < pts.length - 1 && travelled < distance; i++) {
    if (Math.abs(wrapAngle(heading(i) - start)) > tolerance) return false;
    travelled += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  return travelled >= Math.min(distance, route.remaining ?? distance) - 1e-6;
}

/**
 * Where the car will be over the next `distance` units of its route: poses
 * { x, z, yaw, d } one unit apart, shifted right by its overtaking offset.
 * For lib/traffic's check that the path ahead is clear.
 */
export function posesAhead(route, s, width, distance = 26) {
  const pts = route.points;
  const shift = s.laneShift ?? 0;
  const out = [];
  // Route points are unwrapped round the planet; bring the car into their frame.
  const near = (j) => [pts[j][0] + wrapDelta(s.x - pts[j][0], width), s.z];
  // Start from the route point nearest the car (the progress marker can lag
  // a step behind), so the sweep never looks behind it.
  const from = Math.min(route.i ?? 0, pts.length - 1);
  let i = from;
  let best = Infinity;
  for (let j = from; j < Math.min(pts.length, from + 40); j++) {
    const [cx, cz] = near(j);
    const d = (pts[j][0] - cx) ** 2 + (pts[j][1] - cz) ** 2;
    if (d < best) {
      best = d;
      i = j;
    }
  }
  let [px, pz] = near(i);
  let d = 0;
  while (out.length < distance && i < pts.length - 1) {
    i++;
    const [x, z] = pts[i];
    const dx = x - pts[i - 1][0];
    const dz = z - pts[i - 1][1];
    const step = Math.hypot(x - px, z - pz);
    if (step < 0.5 && out.length) continue;
    d += step;
    const len = Math.hypot(dx, dz) || 1;
    // Right of travel: (-dz, dx).
    out.push({ x: x - (dz / len) * shift, z: z + (dx / len) * shift, yaw: Math.atan2(-dx, -dz), d, i });
    [px, pz] = [x, z];
  }
  return out.length ? out : undefined;
}

/**
 * Back onto the equator highway by road, from wherever the car is (off-road,
 * or across the river from it) — never straight across the water.
 */
export function planToHighway(world, graph, from) {
  const highway = world.roads.find((r) => r.kind === "highway");
  if (!highway) return null;
  const a = nearestDryNode(world, graph, from);
  const search = dijkstraToAny(graph, a, (n) => Math.abs(n.z) < 0.5);
  if (!search) return null;
  const points = [[from.x, from.z]];
  for (const i of search.path) {
    const [px] = points.at(-1);
    points.push([px + wrapDelta(graph.nodes[i].x - px, world.width), graph.nodes[i].z]);
  }
  // A little way along the highway, heading east (the way the cruise goes).
  const [lx] = points.at(-1);
  for (let k = 1; k <= 6; k++) points.push([lx + k * 2.5, 0]);
  const laned = [points[0], ...keepLeft(points.slice(1), Math.abs(AUTOPILOT.lane))];
  const smooth = smoothPath(laned);
  let length = 0;
  for (let i = 1; i < smooth.length; i++) length += Math.hypot(smooth[i][0] - smooth[i - 1][0], smooth[i][1] - smooth[i - 1][1]);
  return { kind: "road", laned: true, points: smooth, cityId: null, through: true, length, label: "the highway", explored: search.order.map((i) => [graph.nodes[i].x, graph.nodes[i].z]) };
}

/** Breadth-first-by-distance search to the nearest node matching `goal`. */
function dijkstraToAny(graph, from, goal) {
  const n = graph.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[from] = 0;
  const order = [];
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) return null;
    done[u] = 1;
    order.push(u);
    if (goal(graph.nodes[u])) {
      const path = [];
      for (let v = u; v !== -1; v = prev[v]) path.push(v);
      return { path: path.reverse(), order };
    }
    for (const { to, w } of graph.edges[u]) {
      if (dist[u] + w < dist[to]) {
        dist[to] = dist[u] + w;
        prev[to] = u;
      }
    }
  }
}
