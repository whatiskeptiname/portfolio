// Traffic rules, shared by the other cars on the road and your autopilot.
// Pure, so it's testable; the scene animates and draws it.
//
// Traffic lights stand at every T-junction where a district's spur meets the
// equator highway. Each has three approaches — highway eastbound, highway
// westbound (the "main" road) and the spur (the "side" road) — with a stop
// line on the left-hand lane, since traffic keeps left. The main road and
// the side road take turns: green, amber, a moment of all-red, then the
// other's turn. Junctions run offset from each other, so they don't all
// change at once.
//
// trafficCap() turns the rules into a speed limit for one vehicle right now:
// stop (front bumper behind the line) for a red, or an amber you can still
// stop for; keep a safe gap behind whoever is ahead in your lane; don't pull
// out in front of a car crossing your path; give way to cars already on a
// roundabout. decideOvertake() lets a car stuck behind a slower one pass it
// when the other lane is clear. carsOverlap() is the hard safety net: cars
// are rectangles, and none is ever allowed to move into another.

import { AUTOPILOT } from "./autopilot";
import { HIGHWAY_HALF_WIDTH, wrapDelta } from "./layout";
import { highwayJunctions } from "./junctions";

// Each approach gets its own green in turn — eastbound, westbound, then each
// side road — followed by amber and a moment of all-red, so only one stream
// is ever in the junction and nothing can tangle in the middle. The highway
// gets the longer greens.
const TIMING = { main: 6, side: 4.5, amber: 1.8, clear: 1.3 };
const greenFor = (group) => (group === "east" || group === "west" ? TIMING.main : TIMING.side);
export const SIGNAL_CYCLE = 2 * TIMING.main + TIMING.side + 3 * (TIMING.amber + TIMING.clear); // a plain T-junction
const STOP_GAP = 1.5; // stop line this far before the junction's flared kerbs
const BRAKE = 6; // comfortable deceleration for planning stops (units/s²)
export const CAR_LENGTH = 4.3;
export const CAR_WIDTH = 1.9;
const HALF_L = CAR_LENGTH / 2;
const HALF_W = CAR_WIDTH / 2;
const LANE = Math.abs(AUTOPILOT.lane);
export const PROBE = 26; // how far ahead (units) a car checks its path is clear

/**
 * True if two cars (rectangles CAR_LENGTH × CAR_WIDTH, plus `margin` all
 * round, at { x, z, yaw }) overlap — separating-axis test in the plane.
 */
export function carsOverlap(a, b, width, margin = 0) {
  const dx = wrapDelta(b.x - a.x, width);
  const dz = b.z - a.z;
  if (dx * dx + dz * dz > (CAR_LENGTH + CAR_WIDTH + 2 * margin) ** 2) return false;
  const axes = [a.yaw, b.yaw].flatMap((yaw) => [
    [-Math.sin(yaw), -Math.cos(yaw)], // forward
    [Math.cos(yaw), -Math.sin(yaw)], // right
  ]);
  const extent = (yaw, [ax, az]) => {
    const f = [-Math.sin(yaw), -Math.cos(yaw)];
    const r = [Math.cos(yaw), -Math.sin(yaw)];
    return (HALF_L + margin) * Math.abs(f[0] * ax + f[1] * az) + (HALF_W + margin) * Math.abs(r[0] * ax + r[1] * az);
  };
  return axes.every((axis) => Math.abs(dx * axis[0] + dz * axis[1]) < extent(a.yaw, axis) + extent(b.yaw, axis));
}

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * @returns {{ id, x, offset, approaches: { x, z, dir: [number, number], group: "main" | "side" }[] }[]}
 *   (x, z) of each approach is the stop line's middle, on the lane that
 *   approaches it; `dir` the direction of travel there.
 */
export function placeSignals(world) {
  const lane = Math.abs(AUTOPILOT.lane);
  // Spurs meeting the highway close together (one from each side, say) form
  // one crossroads under one set of lights.
  const joins = highwayJunctions(world, { fillet: 4 }).sort((a, b) => a.x - b.x);
  const clusters = [];
  for (const j of joins) {
    const last = clusters.at(-1);
    if (last && Math.abs(wrapDelta(j.x - last.at(-1).x, world.width)) < 24) last.push(j);
    else clusters.push([j]);
  }
  // Across the date line, the last cluster may join the first.
  if (clusters.length > 1 && Math.abs(wrapDelta(clusters[0][0].x - clusters.at(-1).at(-1).x, world.width)) < 24) {
    clusters[0].unshift(...clusters.pop());
  }
  return clusters.map((list, id) => {
    const xs = list.map((j) => list[0].x + wrapDelta(j.x - list[0].x, world.width));
    const reach = (j) => world.roads[j.roadId].halfWidth + 4 + STOP_GAP; // half the mouth, plus a gap
    const west = Math.min(...xs.map((x, i) => x - reach(list[i])));
    const east = Math.max(...xs.map((x, i) => x + reach(list[i])));
    const groups = ["east", "west", ...list.map((_, k) => `side${k}`)];
    // All-red long enough for a car that just ran the amber to get across.
    const clear = Math.max(TIMING.clear, (east - west) / 8);
    const cycle = groups.reduce((sum, g) => sum + greenFor(g) + TIMING.amber + clear, 0);
    return {
      id,
      x: wrapDelta((west + east) / 2, world.width),
      halfSpan: (east - west) / 2 - STOP_GAP, // the junction box, between the stop lines
      groups,
      clear,
      cycle,
      offset: hash(id + 1) * cycle,
      approaches: [
        // Eastbound keeps to the north lane, westbound to the south.
        { x: wrapDelta(west, world.width), z: -lane, dir: [1, 0], group: "east" },
        { x: wrapDelta(east, world.width), z: lane, dir: [-1, 0], group: "west" },
        // Down each spur toward the highway: travel (0, -s), whose left is (-s, 0).
        ...list.map((j, k) => ({
          x: wrapDelta(j.x - j.side * lane, world.width),
          z: j.side * (HIGHWAY_HALF_WIDTH + 4 + STOP_GAP),
          dir: [0, -j.side],
          group: `side${k}`,
        })),
      ],
    };
  });
}

/** "green" | "amber" | "red" for one group of approaches at time `t` (seconds). */
export function signalColor(signal, group, t) {
  // Actuated lights (stepSignals) run on their own state, not the clock.
  if (signal.state) {
    const { phase, group: g } = signal.state;
    if (g !== group) return "red";
    return phase === "green" ? "green" : phase === "amber" ? "amber" : "red";
  }
  const cycle = signal.cycle ?? SIGNAL_CYCLE;
  let u = (((t + signal.offset) % cycle) + cycle) % cycle;
  const clear = signal.clear ?? TIMING.clear;
  for (const g of signal.groups ?? ["east", "west", "side0"]) {
    const green = greenFor(g);
    if (u < green + TIMING.amber + clear) {
      if (g !== group) return "red";
      return u < green ? "green" : u < green + TIMING.amber ? "amber" : "red";
    }
    u -= green + TIMING.amber + clear;
  }
  return "red";
}

/**
 * The fastest `self` may go right now under the rules (Infinity if nothing
 * applies). `self` and `others` are { x, z, yaw, speed } (vehicle yaw:
 * forward is -z at 0); others in the air (alt > 1.5) are ignored.
 * `towns` (the layout's cities) enables giving way at roundabouts; `path`
 * (poses { x, z, yaw, d } every unit ahead, see posesAhead in lib/routing)
 * is where the car is about to drive — straight on if not given. Pass an
 * object as `why` to have it filled with the limit's cause: { kind
 * ("red" | "amber" | "box" | "car" | "crossing" | "oncoming" | "roundabout"),
 * label, x, z, distance, room (how far before it must be down to `theirs`),
 * other (the car, if one), cap }.
 */
export function trafficCap(self, { others = [], signals = [], t = 0, width, towns = [], path, why, lights = true, box = true }) {
  // Cars already on a roundabout or inside a signalled junction have right
  // of way over cars outside it, so junctions always clear.
  const zoneOf = (c) => {
    for (const town of towns) if (Math.hypot(wrapDelta(c.x - town.x, width), c.z - town.z) < 7.6) return `town${town.id}`;
    for (const sig of signals) {
      if (Math.abs(wrapDelta(c.x - sig.x, width)) < (sig.halfSpan ?? 9) && Math.abs(c.z) < HIGHWAY_HALF_WIDTH + 4) return `sig${sig.id}`;
    }
    return null;
  };
  const myZone = zoneOf(self);
  const fx = -Math.sin(self.yaw);
  const fz = -Math.cos(self.yaw);
  const v = Math.max(0, self.speed);
  let cap = Infinity;
  let reason = null;
  // Records the tightest limit so far, and what caused it (for `why`).
  // `room`: how far it can go before it must have slowed to `theirs`.
  const bind = (c, detail) => {
    if (c < cap) {
      cap = c;
      reason = detail;
    }
  };
  const stopIn = (d) => (d <= 0 ? 0 : Math.sqrt(2 * BRAKE * d));
  const local = (x, z) => {
    const dx = wrapDelta(x - self.x, width);
    const dz = z - self.z;
    return [dx * fx + dz * fz, dx * fz - dz * fx]; // ahead, to the left
  };

  // Traffic lights: the front bumper stays behind the line.
  for (const sig of signals) {
    for (const ap of sig.approaches) {
      if (ap.dir[0] * fx + ap.dir[1] * fz < 0.7) continue; // not facing us
      const [ahead, side] = local(ap.x, ap.z);
      const toLine = ahead - HALF_L - 0.4; // from the front of the car, with a little room
      // Already over the line (or not in our lanes — the overtaking lane counts): carry on.
      if (toLine < -0.6 || ahead > 80 || Math.abs(side) > LANE * 2 + 1) continue;
      const color = signalColor(sig, ap.group, t);
      // Box junction: even on green, don't enter unless the junction is
      // clear — or the only cars in it are moving off ahead of us our way.
      if (box && toLine < 12 && !myZone) {
        const blocked = others.some((o) => {
          if (o === self || (o.alt ?? 0) > 1.5 || zoneOf(o) !== `sig${sig.id}`) return false;
          const sameWay = -Math.sin(o.yaw) * fx + -Math.cos(o.yaw) * fz > 0.7;
          return !sameWay || o.speed < 2;
        });
        if (blocked) {
          bind(stopIn(toLine), { kind: "box", label: "Junction not clear", x: ap.x, z: ap.z, distance: ahead, room: toLine, theirs: 0 });
          continue;
        }
      }
      if (color === "green" || !lights) continue;
      // Amber: stop if we comfortably can, otherwise carry on through.
      if (color === "amber" && (v * v) / (2 * BRAKE * 1.6) > toLine) continue;
      bind(stopIn(toLine), {
        kind: color,
        label: color === "red" ? "Red light" : "Amber light",
        x: ap.x,
        z: ap.z,
        dir: ap.dir,
        distance: ahead,
        room: toLine,
        theirs: 0,
      });
    }
  }

  // Other cars. Sweep our own rectangle forward along the path we're about
  // to drive (`path`: poses every unit ahead, from the route; or straight on)
  // and find the first place it would touch someone — the same rectangles
  // the no-overlap safety net uses, so the two always agree. That one test
  // covers the car ahead, a car crossing our path, and one coming head-on.
  const poses = path ?? Array.from({ length: PROBE }, (_, k) => ({ x: self.x + fx * (k + 1), z: self.z + fz * (k + 1), yaw: self.yaw, d: k + 1 }));
  for (const o of others) {
    if (o === self || (o.alt ?? 0) > 1.5) continue;
    const [ahead, side] = local(o.x, o.z);
    if (ahead < -CAR_LENGTH * 2 || ahead > 60 || Math.abs(side) > 30) continue;
    const ofx = -Math.sin(o.yaw);
    const ofz = -Math.cos(o.yaw);
    const along = ofx * fx + ofz * fz;
    const sameWay = along > 0.3;
    // Right behind us in our lane? Not in our way — it waits for us (and a
    // path curving right round a roundabout mustn't wait for it).
    if (ahead < 0 && along > 0.7 && Math.abs(side) < 1.5) continue;
    const inQueueAhead = sameWay && ahead > CAR_LENGTH * 0.5 && Math.abs(side) < 1.2;
    // In the junction (or on the roundabout) and they're not? Our right of
    // way — unless they're simply the car ahead of us in our lane.
    if (myZone && !inQueueAhead && zoneOf(o) !== myZone) continue;
    // Two cars each waiting for the other? After a moment whoever has waited
    // longest goes (usually the one already in the junction), ties to you,
    // then the lower-numbered car. Never applied to the car simply ahead of
    // us in our lane — that's a queue. And never *into* it (the overlap
    // safety net) — only past it.
    if (!inQueueAhead && (self.waiting ?? 0) > 2 && o.speed < 0.5 && goesFirst(self, o)) continue;
    let hit = null;
    for (const p of poses) {
      if (carsOverlap(p, o, width, 0.3)) {
        hit = p.d;
        break;
      }
    }
    const what = sameWay
      ? { kind: "car", label: o.speed < 0.5 ? "Stopped car ahead" : "Following car ahead" }
      : along < -0.3
        ? { kind: "oncoming", label: "Oncoming car in our path" }
        : { kind: "crossing", label: "Car crossing our path" };
    if (hit != null) {
      const room = hit - 1.3; // stop a little short of where we'd touch
      const theirs = sameWay ? Math.max(0, o.speed) * along : 0;
      bind(room <= 0 ? 0 : Math.sqrt(theirs * theirs + 2 * BRAKE * room), { ...what, other: o, x: o.x, z: o.z, distance: ahead, room, theirs });
    } else if (sameWay && Math.abs(side) < 2.1 && ahead > 0) {
      // Further up our lane than the sweep reaches: keep a following gap.
      const gap = ahead - CAR_LENGTH - 2.2;
      const theirs = Math.max(0, o.speed) * along;
      bind(gap <= 0 ? 0 : Math.sqrt(theirs * theirs + 2 * BRAKE * gap), { ...what, other: o, x: o.x, z: o.z, distance: ahead, room: gap, theirs });
    }
  }

  // Roundabouts: give way to anyone already going round.
  for (const town of towns) {
    const [ahead, side] = local(town.x, town.z);
    const d = Math.hypot(ahead, side);
    // Already at the mouth (nose on the ring)? Committed: go on in.
    if (d < 7.6 + HALF_L + 0.5 || d > 18) continue;
    // About to drive onto this ring? From the planned path if we have one
    // (a car just leaving has the town ahead-ish but isn't going back in).
    const entering = path
      ? path.some((p) => p.d < 12 && Math.hypot(wrapDelta(p.x - town.x, width), p.z - town.z) < 7.6)
      : ahead > d * 0.6;
    if (!entering) continue;
    // Like a mini-roundabout: one car on the ring at a time, the rest wait
    // at their entries — so the ring can never lock up in a circle.
    const busy = others.some(
      (o) => o !== self && (o.alt ?? 0) <= 1.5 && Math.hypot(wrapDelta(o.x - town.x, width), o.z - town.z) < 7.6
    );
    // Wait a couple of units back from the ring, clear of cars coming off it.
    if (busy) {
      const room = d - 7.8 - HALF_L - 2.5;
      bind(stopIn(room), { kind: "roundabout", label: "Giving way at the roundabout", x: town.x, z: town.z, distance: d, room, theirs: 0, town });
    }
  }
  if (why) {
    for (const k of Object.keys(why)) delete why[k];
    if (reason) Object.assign(why, reason, { cap });
  }
  return cap;
}

/** Who goes first in a stand-off: the one that has waited longer; ties to you (no id), then the lower-numbered car. */
function goesFirst(a, b) {
  const wa = a.waiting ?? 0;
  const wb = b.waiting ?? 0;
  if (Math.abs(wa - wb) > 0.5) return wa > wb;
  return (a.id ?? -1) < (b.id ?? -1);
}

/** Keeps `waiting` (seconds held to a crawl by the rules) up to date; call once per step after trafficCap. */
export function noteWaiting(self, cap, dt) {
  self.waiting = Math.abs(self.speed) < 0.6 && cap < 2 ? (self.waiting ?? 0) + dt : 0;
}

const OVERTAKE_SHIFT = LANE * 2; // from the middle of our lane to the middle of the other
const SHIFT_RATE = 2.4; // units per second, sideways

/**
 * Overtaking, decided from what the driver can see (`others`, `signals`,
 * `towns` should be what lib/perception says is in view). A car stuck
 * behind a slower one pulls out into the other lane only when, for the whole
 * length the pass will take:
 *   - the road stays straight (`straightFor(distance)`, from the caller),
 *   - there's no junction or roundabout coming up,
 *   - it can see far enough ahead to be sure,
 *   - no oncoming car will arrive before it's done, and
 *   - the next lane is clear — ahead, and behind in the mirror.
 * It passes, then pulls back in once there's room. If something appears
 * coming the other way (or the road starts to bend) it aborts: drops back
 * behind the slow car and pulls in. Updates self.laneShift (sideways offset
 * to the right, eased), self.boost (speed factor) and self.overtakeNote (what
 * it's doing or why it's holding back). `dt` in seconds.
 */
export function decideOvertake(self, { others = [], signals = [], towns = [], width, straight = true, straightFor, viewRange = 110 }, dt) {
  const fx = -Math.sin(self.yaw);
  const fz = -Math.cos(self.yaw);
  const local = (x, z) => {
    const dx = wrapDelta(x - self.x, width);
    const dz = z - self.z;
    return [dx * fx + dz * fz, dx * fz - dz * fx];
  };
  const isStraight = (d) => (straightFor ? straightFor(d) : straight);
  const cruise = self.autoSpeed ?? 8;
  const passSpeed = cruise * 1.3;
  const ground = others.filter((o) => o !== self && (o.alt ?? 0) <= 1.5);
  const heading = (o) => -Math.sin(o.yaw) * fx + -Math.cos(o.yaw) * fz;
  // The other lane is to our right (traffic keeps left): side ≈ −2·LANE.
  const inOtherLane = (side) => side < -1 && side > -OVERTAKE_SHIFT - 2.5;
  const oncomingWithin = (distance) =>
    ground.find((o) => {
      const [ahead, side] = local(o.x, o.z);
      return heading(o) < -0.5 && inOtherLane(side) && ahead > -6 && ahead < distance;
    });
  const nextLaneBusy = () =>
    ground.find((o) => {
      const [ahead, side] = local(o.x, o.z);
      if (heading(o) < 0.5 || !inOtherLane(side)) return false;
      // Ahead of us in that lane, or coming up behind faster than us.
      return (ahead > -CAR_LENGTH && ahead < 25) || (ahead <= -CAR_LENGTH && ahead > -35 && o.speed > self.speed + 1);
    });
  const junctionWithin = (distance) => {
    for (const sig of signals) {
      for (const ap of sig.approaches) {
        const [ahead, side] = local(ap.x, ap.z);
        if (ahead > -5 && ahead < distance && Math.abs(side) < 14) return "a junction";
      }
    }
    for (const c of towns) {
      const [ahead, side] = local(c.x, c.z);
      if (ahead > -c.radius && ahead < distance + c.radius && Math.abs(side) < c.radius + 12) return "a roundabout";
    }
    return null;
  };

  let o = self.overtake; // { target, since, aborting }
  let shiftTo = 0;
  self.boost = 1;
  self.overtakeNote = null;
  if (!o) {
    // The car we're stuck behind, if it's slow and close.
    const leader = ground
      .map((c) => ({ c, pos: local(c.x, c.z) }))
      .filter(({ c, pos: [ahead, side] }) => heading(c) > 0.5 && Math.abs(side) < 2.1 && ahead > 0 && ahead < CAR_LENGTH + 16)
      .sort((a, b) => a.pos[0] - b.pos[0])[0];
    if (leader && leader.c.speed < cruise - 2.5 && self.speed > 2) {
      // How far the pass will take, and how far oncoming traffic would come in that time.
      const gap = Math.max(0, leader.pos[0] - CAR_LENGTH);
      const passTime = (gap + 2 * CAR_LENGTH + 10) / Math.max(2, passSpeed - leader.c.speed);
      const passLength = passSpeed * passTime;
      const needClear = passLength + passTime * cruise; // the pass, plus how far oncoming traffic comes meanwhile
      let hold = null;
      if (!isStraight(passLength + 10)) hold = "the road bends ahead";
      else if (junctionWithin(passLength + 20)) hold = `${junctionWithin(passLength + 20)} ahead`;
      else if (needClear > viewRange) hold = "can't see far enough ahead";
      else if (oncomingWithin(needClear)) hold = "oncoming traffic";
      else if (nextLaneBusy()) hold = "a car in the next lane";
      if (hold) self.overtakeNote = `Can't overtake: ${hold}`;
      else {
        o = self.overtake = { target: leader.c, since: 0, aborting: false, passLength };
      }
    }
  }
  if (o) {
    o.since += dt;
    const [ahead] = local(o.target.x, o.target.z);
    const passed = ahead < -(CAR_LENGTH + 4);
    const roomToPullIn = !ground.some((c) => {
      const [a2, s2] = local(c.x, c.z);
      return heading(c) > 0.5 && Math.abs(s2) < 2.1 && a2 > -(CAR_LENGTH + 3) && a2 < CAR_LENGTH + 6;
    });
    if (!o.aborting) {
      // Something coming the other way, close — or the road starting to bend? Abort.
      const danger = oncomingWithin(25 + (self.speed + 12) * 2.5);
      if (danger) o.aborting = "oncoming traffic";
      else if (!isStraight(Math.max(20, (o.passLength ?? 40) * 0.5))) o.aborting = "the road bends";
      else if (o.since > 14) o.aborting = "taking too long";
    }
    if (passed && roomToPullIn && !o.aborting) {
      self.overtake = null;
      self.overtakeNote = "Pulling back in";
    } else if (o.aborting) {
      // Drop back behind the slow car, then pull in.
      const behind = ahead > CAR_LENGTH + 1;
      self.overtakeNote = `Aborting overtake: ${o.aborting}`;
      if (behind || ahead < -(CAR_LENGTH + 4)) self.overtake = null;
      else {
        shiftTo = OVERTAKE_SHIFT;
        self.boost = 0.55;
      }
    } else {
      shiftTo = OVERTAKE_SHIFT;
      self.boost = 1.3;
      self.overtakeNote = "Overtaking a slower car";
    }
  }
  const now = self.laneShift ?? 0;
  const step = SHIFT_RATE * dt;
  self.laneShift = Math.abs(shiftTo - now) <= step ? shiftTo : now + Math.sign(shiftTo - now) * step;
  if (!self.overtakeNote && self.laneShift > 0.05) self.overtakeNote = "Pulling back in";
  return self.laneShift;
}

/** Seconds on the shared traffic clock (the lights, the cars and your autopilot all agree). */
export const trafficTime = () => performance.now() / 1000;

// Vehicle-actuated control: green goes where cars are waiting.
const ACTUATED = { minGreen: 3, maxMain: 12, maxSide: 7, detect: 45, gap: 2.5 };

/** Is anyone inside `sig`'s junction box? */
function boxOccupied(sig, cars, width) {
  return cars.some((c) => (c.alt ?? 0) <= 1.5 && Math.abs(wrapDelta(c.x - sig.x, width)) < (sig.halfSpan ?? 9) && Math.abs(c.z) < HIGHWAY_HALF_WIDTH + 4);
}

/** Who goes first when two cars are stuck on each other (see goesFirst). */
export function hasPriority(a, b) {
  return goesFirst(a, b);
}

/** How many cars are queued at, or coming up to, `ap`'s stop line. */
export function approachDemand(ap, cars, width) {
  let n = 0;
  for (const c of cars) {
    if ((c.alt ?? 0) > 1.5) continue;
    const fx = -Math.sin(c.yaw);
    const fz = -Math.cos(c.yaw);
    if (fx * ap.dir[0] + fz * ap.dir[1] < 0.7) continue; // not heading this way
    const dx = wrapDelta(ap.x - c.x, width);
    const dz = ap.z - c.z;
    const upstream = dx * ap.dir[0] + dz * ap.dir[1]; // how far before the line
    const lateral = Math.abs(dx * ap.dir[1] - dz * ap.dir[0]);
    if (upstream > -1 && upstream < ACTUATED.detect && lateral < 4.5) n++;
  }
  return n;
}

/**
 * Advances every actuated signal by `dt` seconds given where the cars are.
 * Each runs green → amber → all-red clearance, and picks the next approach
 * with cars waiting (skipping empty ones). A green lasts at least minGreen,
 * is extended while cars keep arriving, and ends early when its queue has
 * cleared and someone else is waiting — or at its maximum if they are. With
 * no traffic anywhere it rests on the highway.
 */
export function stepSignals(signals, cars, dt, width) {
  for (const sig of signals) {
    const demand = Object.fromEntries(sig.groups.map((g) => [g, 0]));
    for (const ap of sig.approaches) demand[ap.group] += approachDemand(ap, cars, width);
    const st = (sig.state ??= { group: sig.groups[0], phase: "green", time: 0, idle: 0 });
    st.time += dt;
    const waitingElsewhere = sig.groups.some((g) => g !== st.group && demand[g] > 0);
    if (st.phase === "green") {
      const max = st.group.startsWith("side") ? ACTUATED.maxSide : ACTUATED.maxMain;
      st.idle = demand[st.group] > 0 ? 0 : st.idle + dt; // time since the last car came along
      const done = st.idle > ACTUATED.gap || st.time > max;
      if (st.time > ACTUATED.minGreen && waitingElsewhere && done) Object.assign(st, { phase: "amber", time: 0 });
    } else if (st.phase === "amber") {
      if (st.time > TIMING.amber) Object.assign(st, { phase: "clear", time: 0 });
    } else if (st.time > (sig.clear ?? TIMING.clear) && (st.time > (sig.clear ?? TIMING.clear) + 6 || !boxOccupied(sig, cars, width))) {
      // (All-red holds until the junction itself is empty — a slow car still
      // crossing gets out before anyone else is let in — up to 6 s more.)
      // Next: the following approach in turn that has cars waiting, else rest on the highway.
      const i = sig.groups.indexOf(st.group);
      const order = sig.groups.map((_, k) => sig.groups[(i + 1 + k) % sig.groups.length]);
      const next = order.find((g) => demand[g] > 0) ?? sig.groups[0];
      Object.assign(st, { group: next, phase: "green", time: 0, idle: 0 });
    }
  }
}
