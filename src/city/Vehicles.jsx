// src/city/Vehicles.jsx — the car and the drone: models, physics (in plane
// space, so collisions reuse the layout) and the chase camera that follows
// whichever one you're controlling around the planet.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BILLBOARD_RADIUS, BUILDING_RADIUS, HIGHWAY_HALF_WIDTH, bridgeElevation, collides, surfaceAt, worldDistance, wrapDelta } from "../lib/layout";
import { crossPole, eastStretch, frameAt } from "../lib/globe";
import { sunlightAt, surfaceMatrix } from "./globe3d";
import { TRANSFORM_SECONDS, TransformRig } from "./Transform";
import { flightController, keysToSticks, stepQuad } from "../lib/quad";
import { freshBattery, isLow, stepBattery, swapBattery } from "../lib/battery";
import { pidReset } from "../lib/pid";
import { Cockpit } from "./Cockpit";
import { audio } from "./audio";
import { followRoute, planToHighway, posesAhead, routeSpeeds } from "../lib/routing";
import { DRONE_VIEW, groundOf, perceive } from "../lib/perception";
import { cruisePoses, describeDecision, planSpeeds } from "../lib/decision";
import { chooseAvoidance, clearanceAhead, localObstacles, shiftPoses } from "../lib/avoid";
import { laneAhead } from "../lib/lanes";
import { carsOverlap, decideOvertake, noteWaiting, trafficCap, trafficTime } from "../lib/traffic";
import { terrainAt } from "../lib/terrain";
import { AUTOPILOT, DRONE_ALT, CAR_GRIP, CAR_LIMITS, NO_INPUT, autopilotInput, hasInput, keysToInput, settleToLimit, unstickInput } from "../lib/autopilot";

export const CAR_RADIUS = 1.3;
export const DRONE_RADIUS = 1.4;
export const DRONE_MAX_ALT = 60;

const forwardOf = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
const tilt = new THREE.Matrix4();
const tiltEuler = new THREE.Euler();

// --- physics -----------------------------------------------------------------

const CAR = { maxReverse: -9, accel: 18, brake: 30, drag: 1.4, steer: 1.9 };
// The handbrake: rear wheels locked — moderate braking, and a slide.
const HANDBRAKE = { decel: 9, yawBoost: 1.8, rejoin: 1.6 };

// The surface sets the pace: flat out on the equator highway, brisk on roads,
// a careful crawl across grass (with less grip and more drag).
function driveCar(layout, c, k, delta) {
  const surface = surfaceAt(layout, c.x, c.z);
  c.surface = surface;
  const traction = CAR_GRIP[surface];
  const v = c.speed;
  // What the pedals are doing, for the inputs readout.
  c.pedal = null;
  // Holding the brake (the autopilot stopped at a light, or slowing): the
  // foot brake, analog when the autopilot's PIDs set it. At rest it holds
  // the car there — no creeping, no rolling back.
  c.holding = Boolean(k.brake) && !k.up;
  if (c.holding) {
    c.speed = Math.sign(v) * Math.max(0, Math.abs(v) - CAR.brake * Math.max(0.2, k.brakeLevel ?? 1) * delta);
    c.pedal = Math.abs(v) < 0.3 ? "hold" : "brake";
  } else if (k.up) {
    // Rolling backwards, the accelerator brings it to a stop first.
    c.speed += (v < 0 ? CAR.brake : CAR.accel * traction * (k.throttle ?? 1)) * delta;
    if (v < -0.3) c.pedal = "brake";
  } else if (k.down) {
    // S: the brake while rolling forward; once stopped, reverse.
    if (v > 0.3) {
      c.speed = Math.max(0, v - CAR.brake * delta);
      c.pedal = "brake";
    } else {
      c.speed -= CAR.accel * traction * 0.6 * delta;
      c.pedal = "reverse";
    }
  } else c.speed *= Math.exp(-CAR.drag * (surface === "grass" ? 1.8 : 1) * delta);
  // The handbrake (Space) locks the rear wheels: it slows the car, less
  // sharply than the foot brake, and the back loses its grip.
  const handbrake = Boolean(k.handbrake);
  if (handbrake) {
    c.speed = Math.sign(c.speed) * Math.max(0, Math.abs(c.speed) - HANDBRAKE.decel * delta);
    c.pedal = c.pedal === "reverse" ? "reverse" : "handbrake";
  }
  // An autopilot told to ignore speed limits drives as fast as the car will go.
  const reckless = (c.auto || c.route) && c.pilot?.limits === false;
  c.speed = Math.max(CAR.maxReverse, settleToLimit(c.speed, reckless ? CAR_LIMITS.highway * 1.2 : CAR_LIMITS[surface], delta));
  if (Math.abs(c.speed) < 0.05) c.speed = 0;

  // Steering scales with speed and flips in reverse, like a real car. With
  // the rear wheels locked it turns harder (the back swings out).
  c.steer = THREE.MathUtils.lerp(c.steer, k.steer, 1 - Math.exp(-10 * delta));
  const grip = Math.min(1, Math.abs(c.speed) / 6) * Math.sign(c.speed);
  const sliding = handbrake && Math.abs(c.speed) > 4;
  c.yaw += c.steer * CAR.steer * grip * (sliding ? HANDBRAKE.yawBoost : 1) * delta;
  // Where it's actually going lags where it points while the rear slides;
  // the tyres pull it back into line once they grip again. The sideways
  // scrub costs speed.
  // (After a jump — "unstuck", a transformation — it simply points the way it goes.)
  if (c.travelYaw == null || (!handbrake && Math.abs(Math.atan2(Math.sin(c.yaw - c.travelYaw), Math.cos(c.yaw - c.travelYaw))) > 1.2)) c.travelYaw = c.yaw;
  const rejoin = sliding ? HANDBRAKE.rejoin : 14;
  let slip = Math.atan2(Math.sin(c.yaw - c.travelYaw), Math.cos(c.yaw - c.travelYaw));
  c.travelYaw += slip * (1 - Math.exp(-rejoin * delta));
  slip = Math.atan2(Math.sin(c.yaw - c.travelYaw), Math.cos(c.yaw - c.travelYaw));
  c.slip = slip;
  if (Math.abs(slip) > 0.05) c.speed *= Math.exp(-Math.abs(Math.sin(slip)) * 1.6 * delta);
  moveWithSliding(layout, c, c.speed * delta, CAR_RADIUS, 0, true, c.speed >= 0 ? c.travelYaw : c.yaw);
}

// A racing quad: quick, twitchy, and happiest going fast.
const DRONE = { maxSpeed: 42, accel: 38, drag: 1.1, yawRate: 2.8, climb: 18 };

function flyDrone(layout, d, k, delta, altKeys = {}) {
  if (k.up) d.speed += DRONE.accel * delta;
  else if (k.down) d.speed -= DRONE.accel * delta;
  else d.speed *= Math.exp(-DRONE.drag * delta);
  d.speed = THREE.MathUtils.clamp(d.speed, -DRONE.maxSpeed * 0.5, DRONE.maxSpeed);

  // Drones can turn on the spot.
  d.steer = THREE.MathUtils.lerp(d.steer, k.steer, 1 - Math.exp(-8 * delta));
  d.yaw += d.steer * DRONE.yawRate * delta;

  // Altitude hold: the drone climbs or descends to the altitude you've set
  // (− / + steps it, Space / Shift move it smoothly; 0 lands). Right after
  // converting from the car it lifts off to at least a few metres.
  // On autopilot it also climbs over whatever is in its path (d.avoidAlt).
  const target = Math.max(holdAltitude(d, altKeys, delta), d.avoidAlt ?? 0);
  const wanted = THREE.MathUtils.clamp((target - d.alt) * 1.6, -DRONE.climb, DRONE.climb);
  d.climb = THREE.MathUtils.lerp(d.climb, wanted, 1 - Math.exp(-5 * delta));
  const nextAlt = THREE.MathUtils.clamp(d.alt + d.climb * delta, 0, DRONE_MAX_ALT);
  // Don't descend into a roof (or the river).
  if (nextAlt > d.alt || !collides(layout, d.x, d.z, DRONE_RADIUS * 0.6, nextAlt)) d.alt = nextAlt;
  else d.climb = 0;

  if (d.alt > 0.05 || d.speed !== 0) moveWithSliding(layout, d, d.speed * delta, DRONE_RADIUS, d.alt);
  if (d.alt <= 0.05) d.speed *= Math.exp(-6 * delta); // landed: skids
  // Keep the realistic model's state in step, so switching modes is seamless.
  const [fx, fz] = forwardOf(d.yaw);
  Object.assign(d, { vx: fx * d.speed, vz: fz * d.speed, vy: d.climb, qpitch: 0, qroll: 0, qthrottle: undefined });
  d.realistic = false;
}

/** Moves the drone's target altitude with Space / Shift held, and returns it. */
function holdAltitude(d, keys, delta) {
  let target = d.droneAltTarget ?? DRONE_ALT.fallback;
  if (keys.up) target += 12 * delta;
  if (keys.down) target -= 12 * delta;
  if (d.takeoff > 0) target = Math.max(target, 4); // just transformed: lift off
  if (d.alt >= 3.9) d.takeoff = 0;
  d.droneAltTarget = THREE.MathUtils.clamp(target, DRONE_ALT.min, DRONE_ALT.max);
  return d.droneAltTarget;
}

/**
 * The realistic drone (lib/quad): the sticks tilt the thrust and the physics
 * does the rest. Here: moving it through the world without flying through
 * roofs, trees or billboards — on contact it stops dead against the thing.
 */
function flyQuad(layout, d, sticks, delta) {
  const before = d.alt;
  const [dx, dz] = stepQuad(d, sticks, delta);
  d.realistic = true;
  d.climb = d.vy;
  // Don't sink into a roof.
  if (d.alt < before && collides(layout, d.x, d.z, DRONE_RADIUS * 0.6, d.alt)) {
    d.alt = before;
    d.vy = 0;
  }
  const stretch = eastStretch(layout.radius, d.z);
  const nx = d.x + dx * stretch;
  const nz = d.z + dz;
  if (!collides(layout, nx, nz, DRONE_RADIUS, d.alt)) {
    d.x = nx;
    d.z = nz;
  } else if (!collides(layout, nx, d.z, DRONE_RADIUS, d.alt)) {
    d.x = nx;
    d.vz = 0;
  } else if (!collides(layout, d.x, nz, DRONE_RADIUS, d.alt)) {
    d.z = nz;
    d.vx = 0;
  } else {
    d.bump = (d.bump ?? 0) + 1;
    d.bumpStrength = Math.hypot(d.vx, d.vz) / 12;
    d.vx *= -0.2;
    d.vz *= -0.2;
  }
  crossPole(layout.radius, d);
}

/**
 * What the driver sees, refreshed ten times a second (a driver's reaction
 * time) rather than every frame — line of sight against every tree and
 * building is the costliest thing it does.
 */
function lookAround(s, world) {
  const now = performance.now();
  if (!s._seen || now - s._seenAt > 100 || s._seenFor !== world.cone) {
    s._seen = perceive(s, world);
    s._seenAt = now;
    s._seenFor = world.cone;
  }
  return s._seen;
}

/** Draws `throttle` from the drone's pack for `delta` s; returns the share of power left. */
function drawPower(d, throttle, delta) {
  d.battery ??= freshBattery();
  return stepBattery(d.battery, d.alt > 0.05 || throttle > 0.1 ? throttle : 0, delta);
}

/**
 * On autopilot with a low pack: land where it is, swap the pack (a couple of
 * seconds on the ground), then carry on. Returns true while it's doing that
 * (it has flown the drone itself this frame).
 */
function batteryRun(layout, d, delta, auto) {
  d.battery ??= freshBattery();
  if (!auto || (!isLow(d.battery) && !d.swapping)) return false;
  if (!d.swapping) d.swapping = { landed: 0 };
  const sticks = flightController(d, { speed: 0, steer: 0, alt: 0 });
  sticks.throttle *= drawPower(d, sticks.throttle, delta);
  flyQuad(layout, d, sticks, delta);
  d.controls = { ...d.controls, sticks };
  if (d.drive) d.drive = { ...d.drive, poses: null, decision: { action: d.alt > 0.1 ? "Landing" : "Battery swap", reason: "Battery low", tone: "slow", note: null, distance: null, focus: null } };
  if (d.alt < 0.1 && Math.hypot(d.vx ?? 0, d.vz ?? 0) < 0.8) {
    d.swapping.landed += delta;
    d.batteryNote = "Swapping the battery…";
    d.batteryNoteAt = performance.now();
    if (d.swapping.landed > 2.5) {
      swapBattery(d.battery);
      d.swapping = null;
      d.batteryNote = "Fresh battery — taking off";
      d.batteryNoteAt = performance.now();
      d.takeoff = 4;
    }
  } else {
    d.batteryNote = "Battery low — landing to swap it";
    d.batteryNoteAt = performance.now();
  }
  return true;
}

// Nearest spot on the ground where the car fits, spiralling out from (x, z).
function landingSpot(layout, x, z) {
  if (!collides(layout, x, z, CAR_RADIUS)) return { x, z };
  for (let r = 2; r < 60; r += 1.5) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (!collides(layout, px, pz, CAR_RADIUS)) return { x: px, z: pz };
    }
  }
  return { x: layout.spawn.x, z: layout.spawn.z };
}

/**
 * The one vehicle. `type` ("car" | "drone") picks the model and physics.
 * When nobody's driving it, the autopilot cruises it slowly east along the
 * equator highway (`state.auto`); any drive key takes over, and it hands
 * back after AUTOPILOT.idleSeconds without input.
 * Switching plays a Transformers-style transformation where it stands (see
 * Transform.jsx): the car rebuilds itself into a drone and lifts off; the drone
 * glides down to the nearest free ground and rebuilds itself into the car.
 * `state` is a ref shared with the camera, minimap and HUD:
 * { x, z, yaw, speed, steer, alt, climb, takeoff, transform }, where
 * `transform` is the transformation progress 0..1 (null when not transforming).
 */
export function Vehicle({ layout, state, type, keys, active, onMove, onArrive, planTour, replan, traffic, signals = [], graph, view, mirror = true }) {
  const root = useRef();
  const body = useRef();
  const wheels = useRef([]);
  const frontPivots = useRef([]);
  const rotors = useRef([]);
  const headlight = useRef();
  const spin = useRef(0);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const prevType = useRef(type);
  const morph = useRef(null); // { to, from: {x, z, alt}, target: {x, z} }
  // The road's speed limit at a point, so trips brake for slower roads ahead.
  const limitAt = useMemo(() => (x, z) => CAR_LIMITS[surfaceAt(layout, x, z)], [layout]);
  // The height of the road surface, for sight lines over hills and crests.
  const groundFn = useMemo(() => groundOf(layout), [layout]);
  const progress = useRef(0);
  const [transforming, setTransforming] = useState(null); // target type while transforming
  // Warm-up: for the first second, the transformation rig and both vehicle
  // models are drawn once at microscopic size, so their shaders (and shadow
  // shaders) are compiled at load — not in the middle of the first
  // transformation, where compiling them froze the frame.
  const [warm, setWarm] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setWarm(false), 1200);
    return () => clearTimeout(id);
  }, []);
  const warmProgress = useRef(0.5);
  const warmRefs = useRef({ wheels: { current: [] }, pivots: { current: [] }, light: { current: null }, rotors: { current: [] } });

  // A drone opened straight from a link takes off by itself.
  useEffect(() => {
    if (type === "drone") state.current.takeoff = 4;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start a transformation when the type changes.
  useEffect(() => {
    if (prevType.current === type) return;
    prevType.current = type;
    const s = state.current;
    morph.current = {
      to: type,
      from: { x: s.x, z: s.z, alt: s.alt },
      target: type === "car" ? landingSpot(layout, s.x, s.z) : { x: s.x, z: s.z },
    };
    progress.current = 0;
    s.transform = 0;
    s.speed = 0;
    s.climb = 0;
    s.takeoff = 0;
    s.resume = true; // re-plan any trip for the new vehicle (road vs air) once it's done
    setTransforming(type);
    audio.transform(type === "drone", TRANSFORM_SECONDS);
  }, [type, layout, state]);

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const s = state.current;
    s.dt = delta; // for the autopilot's PID controllers
    const R = layout.radius;
    const m = morph.current;

    if (m) {
      // Transforming: no driving. Becoming a car, first glide down onto the
      // landing spot; becoming a drone, stay put until it's done.
      progress.current = Math.min(1, progress.current + delta / TRANSFORM_SECONDS);
      const t = progress.current;
      s.transform = t;
      if (m.to === "car") {
        const k = THREE.MathUtils.smootherstep(t, 0, 0.4);
        s.x = m.from.x + wrapDelta(m.target.x - m.from.x, layout.width) * k;
        s.z = THREE.MathUtils.lerp(m.from.z, m.target.z, k);
        s.alt = THREE.MathUtils.lerp(m.from.alt, 0, k);
      }
      if (t >= 1) {
        morph.current = null;
        s.transform = null;
        if (m.to === "drone") s.takeoff = 4;
        setTransforming(null);
      }
    } else {
      const user = active ? keysToInput(keys.current) : NO_INPUT;
      const nowMs = performance.now();
      const manual = hasInput(user);
      // "Auto mode": cruising/touring (s.auto) or on a "Go to" trip (s.route).
      const autopilotOn = s.auto || Boolean(s.route);
      if (manual) {
        s.lastInput = nowMs;
        // You're driving: no autopilot overtaking manoeuvre in progress.
        s.overtake = null;
        s.laneShift = 0;
        s.boost = 1;
        // Taking the wheel in auto mode only overrides it while you drive;
        // let go and it picks up again from wherever you are.
        if (autopilotOn) s.resume = true;
      } else if (
        !autopilotOn &&
        nowMs - (s.lastInput ?? 0) > AUTOPILOT.idleSeconds * 1000
      ) {
        s.auto = true; // nobody's driving: back to the autopilot
      }

      let input = user;
      if (manual || !(s.auto || s.route)) {
        s.drive = {
          poses: null,
          seen: [],
          decision: { action: "You're driving", reason: s.auto || s.route ? "The autopilot carries on when you let go" : "Autopilot off — press P", tone: "info", note: null, distance: null, focus: null },
        };
      }
      if (!manual && (s.auto || s.route)) {
        // Back from a manual detour (or a transformation): re-plan from here.
        if (s.resume) {
          s.resume = false;
          s.stuckFor = 0;
          s.reverseFor = 0;
          if (s.route && replan) s.route = replan(s, type, s.route);
        }
        // Touring all roads: always on the way to the next district.
        if (s.auto && s.autoMode === "roads" && !s.route && planTour) s.route = planTour(s, type);
        // Cruising the equator but off the highway (or across the river from
        // it)? Get back to it by road — never straight across the water.
        if (s.auto && s.autoMode !== "roads" && !s.route && type === "car" && graph && Math.abs(s.z) > HIGHWAY_HALF_WIDTH + 2) {
          const back = planToHighway(layout, graph, s);
          if (back) s.route = { ...back, label: "the highway" };
        }
        // Decide from what the driver can see: the rules of the road (red
        // lights, a safe gap to the car ahead, giving way at roundabouts and
        // to crossing cars) and whether it's safe to overtake a slow car.
        let cap = Infinity;
        const why = {};
        let seen = { others: [], signals: [], towns: [] };
        // The stretch it's about to drive: along the route, or along the equator lane.
        const path = s.route ? posesAhead(s.route, s, layout.width, 45) : cruisePoses(s, 40);
        if (type === "drone") {
          // The drone looks round too (from up where it is), though it flies over the traffic.
          seen = lookAround(s, {
            others: traffic?.current ?? [],
            signals,
            towns: layout.cities,
            buildings: layout.buildings,
            trees: layout.trees,
            billboards: layout.billboards,
            width: layout.width,
            ground: groundFn,
            cone: DRONE_VIEW, // its camera looks ahead; up close it senses all round
          });
        }
        if (type === "car") {
          seen = lookAround(s, {
            others: traffic?.current ?? [],
            signals,
            towns: layout.cities,
            buildings: layout.buildings,
            trees: layout.trees,
            billboards: layout.billboards,
            width: layout.width,
            ground: groundFn,
          });
          // What it's told to ignore (the autopilot settings page) it simply doesn't consider.
          const p = s.pilot ?? {};
          const rules = {
            ...seen,
            others: p.cars === false ? [] : seen.others,
            towns: p.roundabouts === false ? [] : seen.towns,
            lights: p.lights !== false,
            box: p.junctions !== false,
            t: trafficTime(),
            width: layout.width,
            path,
            why,
          };
          if (p.overtaking !== false) decideOvertake(s, rules, delta);
          else Object.assign(s, { overtake: null, laneShift: 0, boost: 1, overtakeNote: null });
          cap = trafficCap(s, rules);
          // Anything in the way off the road (a tree, a building, the river)?
          // Steer round it — or, if there's no way round, stop short of it.
          const obstacles = p.obstacles === false ? [] : localObstacles(layout, s.x, s.z, 30);
          const avoid = p.obstacles === false ? { shift: 0, blocked: null, avoided: null } : chooseAvoidance(layout, path, s.avoidShift ?? 0, obstacles);
          const step = 3 * delta;
          const now = s.avoidShift ?? 0;
          s.avoidShift = Math.abs(avoid.shift - now) <= step ? avoid.shift : now + Math.sign(avoid.shift - now) * step;
          const what = { tree: "a tree", building: "a building", billboard: "a billboard", water: "the river" }[avoid.avoided?.kind] ?? "an obstacle";
          if (avoid.avoided) s.avoiding = what;
          s.avoidNote = Math.abs(s.avoidShift) > 0.3 ? `Steering round ${s.avoiding ?? what}` : null;
          if (avoid.blocked) {
            const room = avoid.blocked.d - 2.4;
            const stop = room <= 0 ? 0 : Math.sqrt(12 * room);
            if (stop < cap) {
              cap = stop;
              for (const k of Object.keys(why)) delete why[k];
              const name = { tree: "Tree", building: "Building", billboard: "Billboard", water: "River" }[avoid.blocked.kind] ?? "Something";
              Object.assign(why, { kind: "obstacle", label: `${name} in the way`, x: avoid.blocked.x, z: avoid.blocked.z, distance: avoid.blocked.d, room, theirs: 0, cap, obstacle: avoid.blocked });
            }
          }
          noteWaiting(s, cap, delta);
        }
        // (Only one controller per frame drives the PIDs: the route follower
        // on a trip or tour, the equator cruise otherwise — running both
        // fed one PID two different errors and scrambled its steering.)
        if (!s.route) input = autopilotInput(s, type, cap);
        let routeWhy = null;
        let target = Math.min(cap, (s.autoSpeed ?? AUTOPILOT.carSpeed) * (s.boost ?? 1));
        if (s.route) {
          // A tour leg, or a "Go to" trip (which hands back the wheel on arrival).
          const route = s.route;
          const trip = followRoute(s, route, type, layout, type === "car" && s.pilot?.limits !== false ? limitAt : undefined, cap);
          input = trip.input;
          routeWhy = route.why;
          target = route.target ?? target;
          if (trip.done) {
            const leg = route.through;
            s.route = null;
            if (!leg) {
              s.lastInput = nowMs;
              onArrive?.();
            }
          }
        }
        // What it's doing and why, and the plan it's following right now.
        const traffic_ = why.kind ? why : null;
        const cruise = (s.autoSpeed ?? AUTOPILOT.carSpeed) * (s.boost ?? 1);
        const base = path ? path.map((p) => (s.route && p.i != null ? Math.min(cruise, routeSpeeds(s.route, type, s.autoSpeed ?? AUTOPILOT.carSpeed, type === "car" && s.route.kind === "road" ? limitAt : undefined)[p.i] * (s.boost ?? 1)) : cruise)) : [];
        if (!s.overtakeNote && s.avoidNote) s.overtakeNote = s.avoidNote;
        s.drive = {
          poses: shiftPoses(path, s.avoidShift ?? 0),
          obstacles: seen.obstacles ?? [],
          // The lane it's in, and its edges along the way ahead.
          lane: type === "car" ? laneAhead(layout, s, path ?? [], { distance: Math.min(40, seen.range ?? 40) }) : null,
          ...planSpeeds(path ?? [], base, traffic_),
          cruise,
          decision: describeDecision(s, { target, traffic: traffic_, route: routeWhy }),
          seen: seen.others,
          seenSignals: seen.signals,
          seenLights: seen.signals.reduce((n, g) => n + g.approaches.length, 0),
          range: seen.range,
        };
        // Pinned against something (a building, the river bank)? Back off and
        // try another line — and if that keeps failing, re-plan from here.
        if (s.pilot?.unstick !== false) input = unstickInput(s, input, type, delta);
        if ((s.reversals ?? 0) >= 3) {
          s.reversals = 0;
          if (s.route?.cityId != null) s.resume = true;
          else s.route = null; // cruising: re-joins the highway by road
        }
      }
      // The drone on autopilot: climb over anything in its path, easing off
      // while it gains height so it doesn't fly into the side of it.
      if (type === "drone") {
        const auto = !manual && (s.auto || s.route) && s.pilot?.obstacles !== false;
        s.avoidAlt = auto ? clearanceAhead(layout, s.x, s.z, s.yaw, 12 + Math.abs(s.speed) * 1.2) : 0;
        if (auto && s.avoidAlt > s.alt + 1.5) {
          input = { ...input, up: false, down: s.speed > 3 };
          s.drive = s.drive && { ...s.drive, decision: { ...s.drive.decision, action: "Climbing", reason: `Clearing an obstacle · ${Math.round(s.avoidAlt)} m`, tone: "slow" } };
        }
      }
      // Stopped, or about to, with nowhere to go yet: hold the brake (not coast in neutral).
      if (!manual && (s.auto || s.route) && type === "car" && !input.up && !input.reverse && Math.abs(s.speed) < 1.5 && (s.drive?.decision?.tone === "stop" || input.down)) {
        input = { ...input, down: false, brake: true, brakeLevel: 1 };
      }
      s.throttle = input.up ? 1 : 0;
      // The controls actually going to the vehicle this frame (shown by the inputs panel).
      s.controls = { ...input, by: !manual && (s.auto || s.route) ? "autopilot" : "you" };
      s.traffic = traffic?.current ?? []; // other cars, for collisions
      if (type === "car") {
        // Your keys: S brakes, then reverses; Space is the handbrake. The
        // autopilot slows with the foot brake, and only reverses to get unstuck.
        if (manual || !(s.auto || s.route)) {
          input = { ...input, handbrake: user.ascend };
          if (s._pid?.car) pidReset(s._pid.car.speed) && pidReset(s._pid.car.steer); // fresh when the autopilot takes over again
        }
        // (Backing off to get unstuck: gently, no faster than 3 m/s.)
        else input = { ...input, brake: input.brake || (input.down && !input.reverse), down: Boolean(input.reverse) && s.speed > -3 };
        driveCar(layout, s, input, delta);
        // Which pedal is really in use, for the inputs readout.
        s.controls = { ...s.controls, pedal: s.pedal, brakeLevel: input.brakeLevel, handbrake: input.handbrake };
      } else if (!manual && (s.auto || s.route) && batteryRun(layout, s, delta, true)) {
        // (batteryRun has just landed it to swap the pack — nothing else to do.)
      } else if (!manual && (s.auto || s.route)) {
        // The autopilot flies the realistic drone through a flight controller:
        // the speed it wants, its turn, and the height to hold (climbing over
        // anything in the way) become throttle, pitch, roll and yaw.
        const want = s.route ? (s.route.target ?? s.autoSpeed ?? AUTOPILOT.droneSpeed) : Math.min(s.autoSpeed ?? AUTOPILOT.droneSpeed, input.down && !input.up ? Math.max(0, s.speed - 2) : Infinity);
        const climbing = (s.avoidAlt ?? 0) > s.alt + 1.5;
        holdAltitude(s, {}, delta);
        const sticks = flightController(s, {
          speed: climbing ? Math.min(want, 2) : want,
          steer: input.steer,
          alt: Math.max(s.droneAltTarget ?? AUTOPILOT.droneAlt, s.avoidAlt ?? 0),
        });
        sticks.throttle *= drawPower(s, sticks.throttle, delta);
        flyQuad(layout, s, sticks, delta);
        input = { ...input, sticks };
      } else if (s.droneMode === "realistic") {
        const sticks = keysToSticks(s, keys.current, delta);
        sticks.throttle *= drawPower(s, sticks.throttle, delta);
        flyQuad(layout, s, sticks, delta);
        input = { ...input, sticks };
      } else {
        // Arcade: estimate the throttle it takes to fly like this.
        const est = 0.38 + 0.3 * Math.min(1, Math.abs(s.speed) / DRONE.maxSpeed) + Math.max(0, (s.climb ?? 0) / DRONE.climb) * 0.3;
        const power = drawPower(s, s.alt > 0.05 ? est : 0, delta);
        if (power < 0.6) s.droneAltTarget = Math.max(0, (s.droneAltTarget ?? 0) - 6 * delta); // flat: it sinks
        flyDrone(layout, s, input, delta, { up: user.ascend, down: user.descend });
      }
      if (input.sticks) s.controls = { ...s.controls, sticks: input.sticks };
    }
    s.x = wrapDelta(s.x, layout.width);
    // Ride over the rolling country and up and over the arched bridges.
    const ground = bridgeElevation(layout, s.x, s.z) + terrainAt(layout, s.x, s.z);
    s.ground = THREE.MathUtils.lerp(s.ground ?? 0, ground, 1 - Math.exp(-20 * delta));

    const hover = !m && type === "drone" && s.alt > 0.3 ? Math.sin(clock.elapsedTime * 3.1) * 0.08 : 0;
    // s.ground includes the terrain (the chase camera needs it); surfaceMatrix
    // adds the terrain itself, so pass only what's above it.
    surfaceMatrix(R, s.x, s.z, s.ground - terrainAt(layout, s.x, s.z) + s.alt + hover, s.yaw, matrix);
    // On the ground, tilt with the slope of the land under the wheels.
    const grounded = type === "car" || s.alt < 0.3;
    const [fx, fz] = forwardOf(s.yaw);
    const slope = (dx, dz) => (terrainAt(layout, s.x + dx, s.z + dz) - terrainAt(layout, s.x - dx, s.z - dz)) / 2;
    const k = 1 - Math.exp(-10 * delta);
    s.pitch = THREE.MathUtils.lerp(s.pitch ?? 0, grounded ? Math.atan(slope(fx * 1.2, fz * 1.2) / 1.2) : 0, k);
    s.roll = THREE.MathUtils.lerp(s.roll ?? 0, grounded ? Math.atan(slope(-fz * 0.9, fx * 0.9) / 0.9) : 0, k);
    if (Math.abs(s.pitch) + Math.abs(s.roll) > 1e-4) matrix.multiply(tilt.makeRotationFromEuler(tiltEuler.set(s.pitch, 0, s.roll)));
    s.worldMatrix = matrix; // the vehicle's exact pose, for the first-person camera
    root.current.matrix.copy(matrix);
    root.current.matrixWorldNeedsUpdate = true;

    if (m && headlight.current) headlight.current.intensity = 0; // mid-transformation
    if (!m && body.current) {
      if (type === "car") {
        // Off-road judder.
        const rough = s.surface === "grass" ? Math.min(1, Math.abs(s.speed) / 8) : 0;
        const t = clock.elapsedTime;
        body.current.position.y = rough * (Math.sin(t * 38) * 0.025 + Math.sin(t * 61) * 0.012);
        body.current.rotation.z = rough * Math.sin(t * 23) * 0.012;
        body.current.rotation.x = rough * Math.sin(t * 17) * 0.01;
        spin.current -= (s.speed * delta) / 0.42;
        wheels.current.forEach((w) => w && (w.rotation.x = spin.current));
        frontPivots.current.forEach((p) => p && (p.rotation.y = s.steer * 0.45));
        // Headlights come on by themselves on the night side.
        if (headlight.current) headlight.current.intensity = sunlightAt(R, s.x, s.z) < 0.06 ? 80 : 0;
      } else {
        if (headlight.current) headlight.current.intensity = 0; // the drone has no headlight
        if (s.realistic) {
          // The real attitude: nose down to fly forward, banked into the roll.
          body.current.rotation.x = -(s.qpitch ?? 0);
          body.current.rotation.z = -(s.qroll ?? 0);
        } else {
          // Racing quads pitch hard into the direction of travel and bank into turns.
          body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, -(s.speed / DRONE.maxSpeed) * 0.6, 0.12);
          body.current.rotation.z = THREE.MathUtils.lerp(body.current.rotation.z, s.steer * 0.45, 0.12);
        }
        // The FPV camera is mounted on the frame: it pitches and banks with it.
        s.bodyPitch = body.current.rotation.x;
        s.bodyRoll = body.current.rotation.z;
        const rpm = s.alt > 0.05 || active ? 40 + 60 * (s.qthrottle ?? 0.5) : 0;
        rotors.current.forEach((r, i) => {
          if (!r) return;
          r.rotation.y += (i % 2 ? 1 : -1) * rpm * delta;
          // Props blur into discs when spinning.
          const [blades, blur] = r.children;
          if (blades) blades.visible = rpm === 0;
          if (blur) blur.visible = rpm > 0;
        });
      }
    }
    if (active) onMove?.(s, s.alt);
  });

  return (
    <group ref={root} matrixAutoUpdate={false}>
      {/* The car's headlight: always in the scene (dimmed to nothing for the
          drone) — adding or removing a light makes three.js recompile every
          material, which froze the transformation and switching views. */}
      <Headlight light={headlight} />
      {warm && (
        <group scale={0.0005} position-y={-0.5}>
          <TransformRig progress={warmProgress} toDrone />
          <TransformRig progress={warmProgress} toDrone={false} />
          <CarModel wheels={warmRefs.current.wheels} frontPivots={warmRefs.current.pivots} />
          <DroneModel rotors={warmRefs.current.rotors} />
        </group>
      )}
      {transforming ? (
        <TransformRig key={transforming} progress={progress} toDrone={transforming === "drone"} />
      ) : type === "car" ? (
        <group ref={body} key="car">
          {/* From the driver's seat, the cockpit (with its own bonnet and wing
              mirrors) replaces the outside shell, which would cut through it. */}
          {view !== "fpv" && <CarModel wheels={wheels} frontPivots={frontPivots} />}
          {view === "fpv" && <Cockpit state={state} mirror={mirror} />}
        </group>
      ) : (
        <group ref={body} key="drone" position-y={0.22}>
          {/* In first person you're the camera on its nose: hide the frame. */}
          {view !== "fpv" && <DroneModel rotors={rotors} />}
        </group>
      )}
    </group>
  );
}

// Tries the full move, then each axis alone (so you slide along walls), else
// bumps back. East–west plane motion is stretched by 1/cos(latitude) so the
// speed on the sphere stays true all the way to the poles, which you can
// drive straight over.
function moveWithSliding(layout, s, distance, radius, height, isCar = false, heading = s.yaw) {
  const [fx, fz] = forwardOf(heading);
  const dx = fx * distance * eastStretch(layout.radius, s.z);
  const dz = fz * distance;
  // Other cars are solid too (only moving toward one is blocked, so you can
  // never get trapped if one ends up overlapping you).
  const traffic = height < 1.5 ? (s.traffic ?? []) : [];
  const near = (c, x, z) => Math.hypot(wrapDelta(c.x - x, layout.width), c.z - z);
  // The car is long: test a circle at its nose and one at its tail against
  // buildings, trees and the river, and its whole rectangle against other cars.
  const [hx, hz] = forwardOf(s.yaw);
  const ends = isCar ? [1.25, -1.25] : [0];
  const hitsWorld = (x, z) => ends.some((o) => collides(layout, x + hx * o, z + hz * o, isCar ? 1.0 : radius, height));
  const hitsCar = (x, z) =>
    traffic.some((c) =>
      isCar
        ? carsOverlap({ x, z, yaw: s.yaw }, c, layout.width, 0.05) &&
          (!carsOverlap(s, c, layout.width, 0.05) || near(c, x, z) < near(c, s.x, s.z))
        : near(c, x, z) < radius + 1.7 && near(c, x, z) < near(c, s.x, s.z)
    );
  const blocked = (x, z) => hitsWorld(x, z) || hitsCar(x, z);
  // Glancing off something: try the move deflected a little either way, so
  // the car slides round a tree or along a wall instead of jamming on it.
  const deflected = () => {
    const stretch = eastStretch(layout.radius, s.z);
    for (const turn of [0.35, -0.35, 0.7, -0.7]) {
      const a = s.yaw + turn;
      const ddx = -Math.sin(a) * distance * Math.cos(turn) * stretch;
      const ddz = -Math.cos(a) * distance * Math.cos(turn);
      if (!blocked(s.x + ddx, s.z + ddz)) return [ddx, ddz];
    }
    return null;
  };
  let glance;
  if (!blocked(s.x + dx, s.z + dz)) {
    s.x += dx;
    s.z += dz;
  } else if (isCar && (glance = deflected())) {
    s.x += glance[0];
    s.z += glance[1];
    s.speed *= 0.92;
  } else if (!blocked(s.x + dx, s.z)) {
    s.x += dx;
    s.speed *= 0.9;
  } else if (!blocked(s.x, s.z + dz)) {
    s.z += dz;
    s.speed *= 0.9;
  } else {
    // Bumped into something: bounce back, and let the audio know how hard.
    s.bump = (s.bump ?? 0) + 1;
    s.bumpStrength = Math.abs(s.speed) / 12;
    s.speed *= -0.25;
  }
  crossPole(layout.radius, s);
}

// Side profile of the car (x along the length, front at -x), extruded across.
function profile(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return shape;
}

function extrudeAcross(shape, width, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2); // shape x → world z, so the front (-x) faces -z (forward)
  g.computeVertexNormals();
  return g;
}

function CarModel({ wheels, frontPivots }) {
  const geo = useMemo(() => {
    const body = profile([
      [-2.25, 0.32],
      [2.2, 0.32],
      [2.32, 0.62],
      [2.28, 0.98],
      [1.9, 1.08],
      [0.95, 1.1],
      [-0.85, 1.08],
      [-2.05, 0.92],
      [-2.32, 0.7],
    ]);
    const cabin = profile([
      [-0.85, 1.06],
      [1.25, 1.06],
      [1.05, 1.72],
      [0.75, 1.8],
      [-0.15, 1.8],
    ]);
    const spoiler = profile([
      [1.95, 1.18],
      [2.35, 1.22],
      [2.4, 1.32],
      [2.0, 1.3],
    ]);
    return {
      body: extrudeAcross(body, 2.1, 0.12),
      cabin: extrudeAcross(cabin, 1.8, 0.1),
      roof: extrudeAcross(
        profile([
          [-0.12, 1.78],
          [0.78, 1.78],
          [0.74, 1.86],
          [-0.08, 1.86],
        ]),
        1.82,
        0.04
      ),
      spoiler: extrudeAcross(spoiler, 1.9, 0.03),
    };
  }, []);

  return (
    <group>
      <mesh geometry={geo.body} castShadow receiveShadow>
        <meshPhysicalMaterial color="#e0283f" metalness={0.15} roughness={0.38} clearcoat={1} clearcoatRoughness={0.12} />
      </mesh>
      <mesh geometry={geo.cabin} castShadow>
        <meshPhysicalMaterial color="#1c2d3c" metalness={0.1} roughness={0.08} clearcoat={1} />
      </mesh>
      <mesh geometry={geo.roof} castShadow>
        <meshPhysicalMaterial color="#e0283f" metalness={0.15} roughness={0.38} clearcoat={1} />
      </mesh>
      <mesh geometry={geo.spoiler} castShadow>
        <meshStandardMaterial color="#1b1b1f" roughness={0.5} />
      </mesh>
      {/* Grille, lights and mirrors */}
      <mesh position={[0, 0.55, -2.46]}>
        <boxGeometry args={[1.1, 0.22, 0.06]} />
        <meshStandardMaterial color="#141414" metalness={0.6} roughness={0.4} />
      </mesh>
      {[-0.72, 0.72].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.8, -2.43]} rotation-x={-0.35}>
            <boxGeometry args={[0.5, 0.14, 0.12]} />
            <meshStandardMaterial color="#fff8e1" emissive="#fff1b0" emissiveIntensity={1.4} />
          </mesh>
          <mesh position={[x, 0.85, 2.47]}>
            <boxGeometry args={[0.5, 0.12, 0.06]} />
            <meshStandardMaterial color="#ff2d2d" emissive="#ff1a1a" emissiveIntensity={1.2} />
          </mesh>
          <mesh position={[Math.sign(x) * 1.2, 1.15, -0.75]}>
            <boxGeometry args={[0.18, 0.14, 0.26]} />
            <meshStandardMaterial color="#e0283f" metalness={0.15} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Rear: full-width light bar, bumper and plate */}
      <mesh position={[0, 0.98, 2.47]}>
        <boxGeometry args={[1.5, 0.07, 0.05]} />
        <meshStandardMaterial color="#ff3030" emissive="#ff1a1a" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0, 0.42, 2.45]}>
        <boxGeometry args={[2.05, 0.2, 0.12]} />
        <meshStandardMaterial color="#1b1b1f" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.66, 2.5]}>
        <boxGeometry args={[0.6, 0.16, 0.02]} />
        <meshStandardMaterial color="#f4f4f0" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>
      {/* Wheels: front pair in steering pivots */}
      {[
        [-1.02, -1.4, true],
        [1.02, -1.4, true],
        [-1.02, 1.42, false],
        [1.02, 1.42, false],
      ].map(([x, z, front], i) => (
        <group
          key={i}
          position={[x, 0.42, z]}
          ref={(el) => {
            if (front) frontPivots.current[i] = el;
          }}
        >
          <group
            ref={(el) => {
              wheels.current[i] = el;
            }}
          >
            <mesh rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.42, 0.42, 0.32, 20]} />
              <meshStandardMaterial color="#181818" roughness={0.9} />
            </mesh>
            <mesh rotation-z={Math.PI / 2} position-x={Math.sign(x) * 0.12}>
              <cylinderGeometry args={[0.27, 0.27, 0.1, 12]} />
              <meshStandardMaterial color="#c9ccd1" metalness={0.9} roughness={0.25} />
            </mesh>
            {/* Spokes, so you can see the wheels turn */}
            {[0, 1, 2].map((s) => (
              <mesh key={s} position-x={Math.sign(x) * 0.17} rotation-x={(s * Math.PI) / 3}>
                <boxGeometry args={[0.04, 0.48, 0.07]} />
                <meshStandardMaterial color="#8d939b" metalness={0.8} roughness={0.3} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}

// Always mounted (so lights never change count and force shader rebuilds);
// the vehicle sets its intensity depending on day or night.
function Headlight({ light }) {
  const target = useRef();
  return (
    <>
      <object3D ref={target} position={[0, 0, -14]} />
      <spotLight
        ref={(el) => {
          light.current = el;
          if (el && target.current) el.target = target.current;
        }}
        position={[0, 1, -2.5]}
        angle={0.55}
        penumbra={0.6}
        distance={40}
        intensity={0}
        color="#fff3c8"
      />
    </>
  );
}

// --- drone -------------------------------------------------------------------

// A 5" freestyle/racing FPV quad: carbon X frame, stacked plates on
// standoffs, a strapped LiPo on top, a tilted FPV camera up front, antennas
// out the back, tri-blade props and LED strips under the arms.
const CARBON = "#17181c";
const ANODISED = "#8a4dff";
const PROP = "#2fd6ff";

function DroneModel({ rotors }) {
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  return (
    <group>
      {/* Frame: two crossing arms and the bottom plate */}
      {[Math.PI / 4, -Math.PI / 4].map((a) => (
        <mesh key={a} rotation-y={a} castShadow>
          <boxGeometry args={[0.24, 0.06, 2.7]} />
          <meshStandardMaterial color={CARBON} roughness={0.45} metalness={0.3} />
        </mesh>
      ))}
      <mesh position-y={0.02} castShadow>
        <boxGeometry args={[0.72, 0.05, 1.15]} />
        <meshStandardMaterial color={CARBON} roughness={0.45} metalness={0.3} />
      </mesh>
      {/* Standoffs and top plate */}
      {[
        [-0.26, -0.42],
        [0.26, -0.42],
        [-0.26, 0.42],
        [0.26, 0.42],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.18, z]}>
          <cylinderGeometry args={[0.035, 0.035, 0.3, 8]} />
          <meshStandardMaterial color={ANODISED} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <mesh position-y={0.34} castShadow>
        <boxGeometry args={[0.62, 0.04, 0.95]} />
        <meshStandardMaterial color={CARBON} roughness={0.45} metalness={0.3} />
      </mesh>
      {/* Flight-controller stack glow between the plates */}
      <mesh position-y={0.17}>
        <boxGeometry args={[0.4, 0.12, 0.4]} />
        <meshStandardMaterial color="#0f3b2e" emissive="#18ff9c" emissiveIntensity={0.6} />
      </mesh>
      {/* LiPo battery, strapped on top */}
      <mesh position-y={0.52} castShadow>
        <boxGeometry args={[0.46, 0.3, 0.92]} />
        <meshStandardMaterial color="#ff4d2e" roughness={0.6} />
      </mesh>
      {[-0.22, 0.22].map((z) => (
        <mesh key={z} position={[0, 0.52, z]}>
          <boxGeometry args={[0.5, 0.34, 0.07]} />
          <meshStandardMaterial color="#111" roughness={0.9} />
        </mesh>
      ))}
      {/* FPV camera, tilted up for speed */}
      <group position={[0, 0.18, -0.6]} rotation-x={0.45}>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.26, 0.24]} />
          <meshStandardMaterial color="#ff8a00" roughness={0.5} />
        </mesh>
        <mesh position-z={-0.15} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.09, 0.1, 0.12, 16]} />
          <meshStandardMaterial color="#0b0b0d" metalness={0.6} roughness={0.2} />
        </mesh>
        <mesh position-z={-0.215} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.06, 0.06, 0.01, 16]} />
          <meshStandardMaterial color="#3a66ff" emissive="#2244ff" emissiveIntensity={0.6} metalness={0.9} roughness={0.05} />
        </mesh>
      </group>
      {/* Antennas: VTX "lollipop" and two receiver whips, out the back */}
      <group position={[0, 0.36, 0.5]} rotation-x={-0.6}>
        <mesh position-y={0.25}>
          <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position-y={0.52}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshStandardMaterial color="#ff4d2e" />
        </mesh>
      </group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.18, 0.3, 0.6]} rotation={[-0.9, 0, side * 0.6]}>
          <cylinderGeometry args={[0.012, 0.012, 0.45, 6]} />
          <meshStandardMaterial color="#f5f5f5" emissive="#ffffff" emissiveIntensity={0.2} />
        </mesh>
      ))}
      {/* Motors, props and LED strips at the arm tips */}
      {corners.map(([sx, sz], i) => (
        <group key={i} position={[sx * 0.95, 0, sz * 0.95]}>
          <mesh position-y={0.1} castShadow>
            <cylinderGeometry args={[0.15, 0.17, 0.16, 18]} />
            <meshStandardMaterial color="#2b2d33" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position-y={0.19}>
            <cylinderGeometry args={[0.15, 0.15, 0.03, 18]} />
            <meshStandardMaterial color={ANODISED} metalness={0.8} roughness={0.25} />
          </mesh>
          <group
            position-y={0.23}
            ref={(el) => {
              rotors.current[i] = el;
            }}
          >
            {/* Tri-blade prop (shown when idle)… */}
            <group>
              {[0, 1, 2].map((b) => (
                <group key={b} rotation-y={(b * Math.PI * 2) / 3}>
                  <mesh position-x={0.33} rotation-x={0.25}>
                    <boxGeometry args={[0.62, 0.015, 0.13]} />
                    <meshStandardMaterial color={PROP} transparent opacity={0.85} roughness={0.3} />
                  </mesh>
                </group>
              ))}
            </group>
            {/* …and its blur disc when spinning. */}
            <mesh visible={false}>
              <cylinderGeometry args={[0.66, 0.66, 0.01, 32]} />
              <meshStandardMaterial color={PROP} transparent opacity={0.22} depthWrite={false} />
            </mesh>
          </group>
          {/* LED strip under the arm: front green, back red (like nav lights) */}
          <mesh position={[-sx * 0.3, -0.05, -sz * 0.3]} rotation-y={Math.atan2(sx, sz)}>
            <boxGeometry args={[0.06, 0.03, 0.55]} />
            <meshStandardMaterial
              color={sz < 0 ? "#3dff8c" : "#ff2d6a"}
              emissive={sz < 0 ? "#3dff8c" : "#ff2d6a"}
              emissiveIntensity={2.2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// --- chase camera ---------------------------------------------------------------

// The driver's eyes in the car's frame (right-hand drive, as in Nepal), and
// the drone's nose camera (on the frame, tilted up like a racing quad's).
const DRIVER_EYE = [0.42, 1.62, 0.15]; // high, over a low dash: a clear view all round
const DRONE_CAM = { at: [0, 0.34, -0.55], uptilt: (25 * Math.PI) / 180 };

/**
 * Places the camera for the first-person view: in the driver's seat, leaning
 * into corners with a little road judder (more off-road) and a field of view
 * that opens up with speed; or on the drone's nose, pitched and banked with
 * the frame, wide-angle like an FPV camera. `o` carries the look-around drag.
 */
function firstPerson(camera, s, vehicle, o, f, delta, baseFov) {
  f.t += delta;
  const speed = Math.abs(s.speed ?? 0);
  f.m.copy(s.worldMatrix);
  let fov;
  if (vehicle === "car") {
    // Road feel: a fine buzz at speed, real judder on grass.
    const rough = s.surface === "grass" ? 0.035 : 0.004;
    const k = Math.min(1, speed / 25);
    const shake = rough * k;
    f.eye.set(
      DRIVER_EYE[0] + Math.sin(f.t * 41) * shake * 0.5,
      DRIVER_EYE[1] + Math.sin(f.t * 53 + 1.3) * shake + Math.sin(f.t * 2.1) * 0.006,
      DRIVER_EYE[2]
    );
    // Lean the head into the corner, plus wherever you're dragging to look.
    const yaw = (s.steer ?? 0) * 0.18 * Math.min(1, speed / 6) + o.yaw;
    const pitch = -0.1 + o.pitch * 0.8;
    f.dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    f.up.set(0, 1, 0);
    fov = 74 + Math.min(14, speed * 0.35); // vertical; wide, opening up with speed
  } else {
    // Mounted on the frame (which pitches into the direction of travel and
    // banks into turns), tilted up, so at speed the horizon sits level.
    f.r.makeRotationFromEuler(new THREE.Euler(s.bodyPitch ?? 0, 0, s.bodyRoll ?? 0, "XYZ"));
    f.m.multiply(new THREE.Matrix4().makeTranslation(0, 0.22, 0)).multiply(f.r);
    f.eye.set(...DRONE_CAM.at);
    const tilt = DRONE_CAM.uptilt + o.pitch * 0.6;
    f.dir.set(-Math.sin(o.yaw) * Math.cos(tilt), Math.sin(tilt), -Math.cos(o.yaw) * Math.cos(tilt));
    f.up.set(0, Math.cos(tilt), Math.sin(tilt));
    fov = 88; // vertical — a wide FPV lens
  }
  f.eye.applyMatrix4(f.m);
  f.dir.transformDirection(f.m);
  f.up.transformDirection(f.m);
  camera.position.copy(f.eye);
  camera.up.copy(f.up);
  camera.lookAt(f.eye.clone().add(f.dir));
  const want = fov ?? baseFov;
  if (Math.abs(camera.fov - want) > 0.05) {
    camera.fov = THREE.MathUtils.lerp(camera.fov, want, 1 - Math.exp(-4 * delta));
    camera.updateProjectionMatrix();
  }
}

const CHASE = {
  car: { distances: [10, 8, 6, 4.5, 3], height: 3, lift: 0.2, look: 1.2, eye: 13 },
  drone: { distances: [9, 7, 5, 3.5], height: 2.2, lift: 0.15, look: 0.4, eye: 7 },
};

/**
 * Follows `state` around the planet. Camera "up" is the local surface normal
 * so the horizon stays level wherever you are.
 *
 * view "chase": sits behind the vehicle, pulling in if a building is in the
 *   way; drag to glance around and it swings back behind you after a moment.
 * view "fpv": first person — from the driver's seat in the car (right-hand
 *   drive, in the cockpit), or through the drone's nose camera, tilted up as
 *   racing quads' are, pitching and banking with the frame, wide-angle. Drag
 *   to look around; it re-centres after a moment.
 * view "eye": a third-person orbit around the vehicle — drag to circle it,
 *   scroll to zoom; it stays where you leave it.
 */
export function ChaseCamera({ layout, state, vehicle, view = "chase", snap = false }) {
  const look = useRef(new THREE.Vector3());
  const snapped = useRef(!snap);
  const gl = useThree((s) => s.gl);
  const orbit = useRef({ yaw: 0, pitch: 0, zoom: 1, dragging: false, lastInput: 0 });
  const tmp = useMemo(
    () => ({
      up: new THREE.Vector3(),
      east: new THREE.Vector3(),
      south: new THREE.Vector3(),
      f: new THREE.Vector3(),
      p: new THREE.Vector3(),
      side: new THREE.Vector3(),
      dir: new THREE.Vector3(),
    }),
    []
  );

  // Pointer drag / wheel on the canvas steer the camera's orbit offsets.
  useEffect(() => {
    const el = gl.domElement;
    const o = orbit.current;
    let lastX = 0;
    let lastY = 0;
    const down = (e) => {
      o.dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const move = (e) => {
      if (!o.dragging) return;
      o.yaw -= (e.clientX - lastX) * 0.008;
      o.pitch = THREE.MathUtils.clamp(o.pitch + (e.clientY - lastY) * 0.005, -0.25, 1.2);
      lastX = e.clientX;
      lastY = e.clientY;
      o.lastInput = performance.now();
    };
    const up = () => {
      o.dragging = false;
      o.lastInput = performance.now();
    };
    const wheel = (e) => {
      o.zoom = THREE.MathUtils.clamp(o.zoom * Math.exp(e.deltaY * 0.001), 0.45, 3);
      o.lastInput = performance.now();
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("wheel", wheel, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl]);

  // Entering eye view starts from a pleasant three-quarter angle.
  useEffect(() => {
    const o = orbit.current;
    if (view === "eye") Object.assign(o, { yaw: 0.6, pitch: 0.35, zoom: 1 });
    else Object.assign(o, { yaw: 0, pitch: 0, zoom: 1 });
  }, [view]);

  // First person needs a near clipping plane close enough for the cockpit;
  // put the lens back as it was when leaving it.
  const camera = useThree((st) => st.camera);
  const lens = useRef(null);
  useEffect(() => {
    lens.current = { fov: camera.fov, near: camera.near };
    return () => {
      if (!lens.current) return;
      camera.fov = lens.current.fov;
      camera.near = lens.current.near;
      camera.updateProjectionMatrix();
    };
  }, [camera]);
  useEffect(() => {
    if (!lens.current) return;
    camera.near = view === "fpv" ? 0.04 : lens.current.near;
    if (view !== "fpv") camera.fov = lens.current.fov;
    camera.updateProjectionMatrix();
  }, [view, camera]);

  const fpv = useMemo(
    () => ({ m: new THREE.Matrix4(), r: new THREE.Matrix4(), eye: new THREE.Vector3(), dir: new THREE.Vector3(), up: new THREE.Vector3(), t: 0 }),
    []
  );

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const s = state.current;
    const o = orbit.current;
    const cfg = CHASE[vehicle];
    const R = layout.radius;
    const alt = (s.alt ?? 0) + (s.ground ?? 0);
    const [fx, fz] = forwardOf(s.yaw);

    // Mid-transformation the camera swings round to a three-quarter view and
    // pulls back a little, like a cut in the film.
    const tf = s.transform;
    const cine = tf == null ? 0 : Math.sin(Math.PI * tf);

    // Chase (and first-person) view drifts back to straight ahead once you let go.
    // (First person waits longer, so you can have a proper look around.)
    if ((view === "chase" || view === "fpv") && !o.dragging && performance.now() - o.lastInput > (view === "fpv" ? 4000 : 1200)) {
      const k = 1 - Math.exp(-3 * delta);
      o.yaw = THREE.MathUtils.lerp(o.yaw, 0, k);
      o.pitch = THREE.MathUtils.lerp(o.pitch, 0, k);
      o.zoom = THREE.MathUtils.lerp(o.zoom, 1, k);
    }

    // First person: rigidly mounted on the vehicle.
    if (view === "fpv" && s.worldMatrix && tf == null) {
      firstPerson(camera, s, vehicle, o, fpv, delta, lens.current?.fov ?? 50);
      return;
    }

    let dist;
    let rise;
    if (view === "eye") {
      dist = cfg.eye * o.zoom;
      rise = 0;
    } else {
      const blocked = (x, z) =>
        layout.buildings.some((b) => alt < b.height + 1 && worldDistance(layout, b.x, b.z, x, z) < BUILDING_RADIUS + 0.8) ||
        (alt < 7 && layout.billboards.some((b) => worldDistance(layout, b.x, b.z, x, z) < BILLBOARD_RADIUS + 0.5));
      const base =
        cfg.distances.find((d) => {
          for (const t of [0.35, 0.7, 1]) if (blocked(s.x - fx * d * t, s.z - fz * d * t)) return false;
          return true;
        }) ?? cfg.distances.at(-1);
      dist = base * o.zoom;
      rise = cfg.height + base * cfg.lift;
    }

    const { up, east, south } = frameAt(R, s.x, s.z);
    tmp.up.fromArray(up);
    tmp.east.fromArray(east);
    tmp.south.fromArray(south);
    // World forward from the plane heading (plane motion keeps true headings).
    tmp.f.copy(tmp.east).multiplyScalar(fx).addScaledVector(tmp.south, fz).normalize();
    const lon = s.x / R;
    const lat = -s.z / R;
    const r = R + alt;
    tmp.p.set(r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon));

    // Direction from the vehicle to the camera: behind it, turned by the
    // orbit yaw about "up" and raised by the pitch.
    dist *= 1 + 0.45 * cine;
    const basePitch = Math.atan2(rise, dist);
    const pitch = THREE.MathUtils.clamp(basePitch + o.pitch + 0.12 * cine, -0.2, 1.35);
    const yaw = o.yaw + 0.85 * cine;
    tmp.side.crossVectors(tmp.up, tmp.f); // vehicle's left
    tmp.dir
      .copy(tmp.f)
      .multiplyScalar(-Math.cos(yaw))
      .addScaledVector(tmp.side, Math.sin(yaw))
      .multiplyScalar(Math.cos(pitch))
      .addScaledVector(tmp.up, Math.sin(pitch))
      .normalize();
    const radius = Math.hypot(dist, rise);
    const desired = tmp.p.clone().addScaledVector(tmp.dir, radius);
    // Never dip below the ground.
    if (desired.length() < R + 1) desired.setLength(R + 1);

    const target =
      view === "eye"
        ? tmp.p.clone().addScaledVector(tmp.up, 1)
        : tmp.p.clone().addScaledVector(tmp.f, 6 * Math.cos(yaw) * (1 - cine)).addScaledVector(tmp.up, cfg.look + cine);
    if (!snapped.current) {
      // Opened straight into a vehicle (deep link): no fly-in.
      camera.position.copy(desired);
      camera.up.copy(tmp.up);
      look.current.copy(target);
      snapped.current = true;
    }
    const follow = o.dragging ? 12 : 4;
    camera.position.lerp(desired, 1 - Math.exp(-follow * delta));
    camera.up.lerp(tmp.up, 1 - Math.exp(-6 * delta)).normalize();
    look.current.lerp(target, 1 - Math.exp(-8 * delta));
    camera.lookAt(look.current);
  });
  return null;
}
