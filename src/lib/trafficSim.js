// The other cars on the planet. Each picks a district at random, plans a
// route there (lib/routing), and drives it by the same rules as your
// autopilot: keeping left, slowing for bends, stopping at red lights and
// keeping a safe gap behind the car in front (lib/traffic) — then picks
// another. Pure, so it's testable; src/city/Traffic.jsx draws them.

import { PLAZA_RADIUS, wrapDelta, worldDistance } from "./layout";
import { AUTOPILOT } from "./autopilot";
import { followRoute, nextTourStop, planRoute, posesAhead, routeStraight } from "./routing";
import { carsOverlap, decideOvertake, hasPriority, noteWaiting, stepSignals, trafficCap } from "./traffic";
import { groundOf, perceive } from "./perception";

const CAR = { accel: 10, brake: 24, drag: 0.6, steerRate: 1.9 };
const THINK_EVERY = 0.1; // seconds between a car's decisions

/**
 * Puts `count` cars on the roads, spread out, each in its left-hand lane.
 * @returns {{ id, x, z, yaw, speed, steer, cruise, hue, braking, tour, route }[]}
 */
export function createTraffic(world, count, rng) {
  const cars = [];
  const roads = world.roads.filter((r) => r.points.length > 2);
  const total = roads.reduce((s, r) => s + r.length, 0);
  for (let tries = 0; cars.length < count && tries < count * 60; tries++) {
    // A road, weighted by length; a point along it; a direction.
    let pick = rng() * total;
    const road = roads.find((r) => (pick -= r.length) <= 0) ?? roads[0];
    const i = 1 + Math.floor(rng() * (road.points.length - 2));
    const forward = rng() < 0.5;
    const [ax, az] = road.points[forward ? i - 1 : i + 1];
    const [bx, bz] = road.points[i];
    const dx = wrapDelta(bx - ax, world.width);
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const lane = Math.abs(AUTOPILOT.lane);
    const x = wrapDelta(bx + (dz / len) * lane, world.width); // left of travel: (dz, -dx)
    const z = bz - (dx / len) * lane;
    if (world.cities.some((c) => worldDistance(world, c.x, c.z, x, z) < PLAZA_RADIUS + 4)) continue;
    if (cars.some((c) => worldDistance(world, c.x, c.z, x, z) < 14)) continue;
    cars.push({
      id: cars.length,
      x,
      z,
      yaw: Math.atan2(-dx, -dz),
      speed: 0,
      steer: 0,
      alt: 0,
      cruise: 8 + rng() * 9, // 32–68 km/h: some dawdle, some hurry
      hue: rng(),
      braking: false,
      tour: { visited: new Set(), last: null },
      route: null,
    });
  }
  return cars;
}

/**
 * Advances every car by `dt` seconds. `player` (if any) is treated as one
 * more car to keep a gap from.
 */
export function stepTraffic(cars, { world, graph, signals, t, player, random = Math.random, driveSignals = false }, dt) {
  const others = player ? [...cars, player] : cars;
  // (In the scene the lights are stepped once per frame by <TrafficLights>.)
  if (driveSignals) stepSignals(signals, others, dt, world.width);
  const ground = (world._ground ??= groundOf(world)); // the rise of the land, for sight lines
  for (const car of cars) {
    // Stuck for a while, and not just waiting at a red? Change plan: head
    // somewhere it can reach by carrying straight on (the turn it wanted may
    // be the very thing that's jammed).
    if (car.route && (car.stuck ?? 0) > 10) {
      car.route = nextLeg(car, world, graph, random, true) ?? car.route;
      car.stuck = 0;
    }
    if (!car.route) {
      car.route = nextLeg(car, world, graph, random);
      if (!car.route) continue;
    }
    // Thinking — what it can see, the rules, overtaking, the route — happens
    // about ten times a second (a driver's reaction time), staggered across
    // the cars; the physics below runs every frame on its latest decision.
    car.sinceThought = (car.sinceThought ?? random() * THINK_EVERY) + dt;
    if (car.sinceThought >= THINK_EVERY || !car.input) {
      const tdt = Math.min(car.sinceThought, 0.25);
      car.sinceThought = 0;
      car.autoSpeed = car.cruise;
      car.dt = tdt; // for its PID controllers
      // Decide from what the driver can see.
      const seen = perceive(car, { others, signals, towns: world.cities, buildings: world.buildings, width: world.width, ground });
      const rules = { ...seen, t, width: world.width, path: posesAhead(car.route, car, world.width) };
      decideOvertake(car, rules, tdt);
      const why = {};
      const cap = trafficCap(car, { ...rules, why });
      // Waiting for a car that's physically stuck on us? We're what's in its
      // way: back off straight to let it through.
      if (why.other?.blockedBy === car && Math.abs(car.speed) < 0.5 && !(car.reverseFor > 0)) {
        car.reverseFor = 1.4;
        car.reverseStraight = true;
      }
      if (!(car.blocked > 0)) noteWaiting(car, cap, tdt);
      // Held up by other cars (not by a light)?
      const byLights = trafficCap(car, { signals: seen.signals, t, width: world.width });
      car.stuck = Math.abs(car.speed) < 0.3 && byLights > 1 ? (car.stuck ?? 0) + tdt : 0;
      const trip = followRoute(car, car.route, "car", world, undefined, cap);
      car.input = trip.input;
      if (trip.done) car.route = null;
    }
    let input = car.input;
    // Wedged against another car for a few seconds? Back up a little on
    // opposite lock to let things untangle (never into anyone behind).
    if (car.reverseFor > 0) {
      car.reverseFor -= dt;
      input = { up: false, down: false, reverse: true, steer: car.reverseStraight ? 0 : -Math.sign(input.steer || 1) };
    }
    const before = { x: car.x, z: car.z, yaw: car.yaw };
    drive(car, input, dt);
    car.x = wrapDelta(car.x, world.width);
    // The safety net: never move (or turn) into another car. If two ever do
    // overlap, only moves that separate them are allowed.
    const hit = others.find(
      (o) =>
        o !== car &&
        (o.alt ?? 0) <= 1.5 &&
        carsOverlap(car, o, world.width, 0.05) &&
        (!carsOverlap(before, o, world.width, 0.05) || dist(world, car, o) <= dist(world, before, o))
    );
    if (hit) {
      Object.assign(car, before);
      car.speed = 0;
      car.blocked = (car.blocked ?? 0) + dt;
      car.waiting = (car.waiting ?? 0) + dt; // held up: it gets priority to clear
      car.blockedBy = hit;
      // Nose to nose with a car that's stuck on us too? The one without
      // priority backs off (straight back) to let the other through; anyone
      // wedged for long backs off regardless.
      const mutual = hit.blockedBy === car && (hit.blocked ?? 0) > 0;
      const yields = mutual ? !hasPriority(car, hit) : car.blocked > 4;
      if (yields && car.blocked > 1 && !(car.reverseFor > 0)) {
        car.reverseFor = 1.6;
        car.reverseStraight = mutual;
        car.blocked = 0;
      }
    } else {
      car.blocked = 0;
      car.blockedBy = null;
    }
  }
}

/**
 * The next leg of a car's tour: a random district, preferring one it can
 * head for without turning round on the open road.
 */
function nextLeg(car, world, graph, random, straightOn = false) {
  let fallback = null;
  for (let tries = 0; tries < (straightOn ? 12 : 6); tries++) {
    const city = nextTourStop(world, car, car.tour, random);
    if (!city) return null;
    const route = planRoute(world, graph, car, city, "car", { through: true });
    const ok = straightOn ? routeStraight(route, 14, 0.5) : !turnsBack(route, car);
    if (ok) return route;
    fallback ??= route;
  }
  return straightOn ? null : fallback;
}

/** Does the route's first stretch head back the way the car is facing? (Not counting going round a roundabout.) */
function turnsBack(route, car) {
  const fx = -Math.sin(car.yaw);
  const fz = -Math.cos(car.yaw);
  const pts = route.points;
  const k = Math.min(pts.length - 1, 8);
  const dx = pts[k][0] - pts[0][0];
  const dz = pts[k][1] - pts[0][1];
  const len = Math.hypot(dx, dz) || 1;
  return (dx * fx + dz * fz) / len < -0.2;
}

const dist = (world, a, b) => Math.hypot(wrapDelta(a.x - b.x, world.width), a.z - b.z);

function drive(car, k, dt) {
  car.braking = k.down;
  if (k.reverse) car.speed = Math.max(-2.5, car.speed - CAR.accel * dt); // only to get unwedged
  // Analog throttle and brake from the PID controllers, where given.
  else if (k.up) car.speed += CAR.accel * (k.throttle ?? 1) * dt;
  else if (k.down) car.speed = Math.max(0, car.speed - CAR.brake * Math.max(0.25, k.brakeLevel ?? 1) * dt);
  else car.speed *= Math.exp(-CAR.drag * dt);
  if (Math.abs(car.speed) < 0.05 && !k.up && !k.reverse) car.speed = 0;
  car.steer += (k.steer - car.steer) * (1 - Math.exp(-10 * dt));
  const grip = Math.max(-1, Math.min(1, car.speed / 6));
  car.yaw += car.steer * CAR.steerRate * grip * dt;
  car.x += -Math.sin(car.yaw) * car.speed * dt;
  car.z += -Math.cos(car.yaw) * car.speed * dt;
}
