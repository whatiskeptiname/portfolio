import { describe, expect, it } from "vitest";
import { createLayout, roadDistance, wrapDelta } from "./layout";
import { CAR_LENGTH, carsOverlap, decideOvertake, placeGiveWays, placeSignals, signalColor, trafficCap } from "./traffic";

const group = (language, count, side = "south") => ({
  language,
  side,
  projects: Array.from({ length: count }, (_, i) => ({ name: `${language}-${i}`, stars: 0 })),
});
const layout = createLayout([group("Work", 6, "north"), group("Learning", 4, "north"), group("C++", 10), group("Python", 5)], "traffic");
const signals = placeSignals(layout);
const EAST = -Math.PI / 2;

describe("traffic lights", () => {
  it("stand only at crossroads; every other side road gives way to the highway", () => {
    const spurs = layout.roads.filter((r) => r.kind === "spur").length;
    const sides = signals.flatMap((s) => s.approaches.filter((a) => a.group.startsWith("side")));
    // Every spur either has a light (at a crossroads) or a give-way line (a T-junction).
    expect(sides.length + placeGiveWays(layout).length).toBe(spurs);
    for (const s of signals) {
      // A crossroads: side roads from both sides of the highway.
      const zs = s.approaches.filter((a) => a.group.startsWith("side")).map((a) => Math.sign(a.z));
      expect(zs).toContain(-1);
      expect(zs).toContain(1);
    }
    // A map whose side roads all join from one side has no lights at all.
    const oneSided = createLayout([group("Work", 6, "north"), group("Learning", 4, "north")], "one-sided");
    expect(placeSignals(oneSided)).toHaveLength(0);
    expect(placeGiveWays(oneSided)).toHaveLength(oneSided.roads.filter((r) => r.kind === "spur").length);
    for (const s of signals) {
      expect(s.approaches.filter((a) => a.group === "east" || a.group === "west")).toHaveLength(2);
      for (const ap of s.approaches) {
        const onRoad = layout.roads.some((r) => roadDistance(layout, ap.x, ap.z, r) < r.halfWidth);
        expect(onRoad).toBe(true);
      }
    }
  });

  it("gives green to one approach at a time, so nothing tangles in the junction", () => {
    for (const s of signals) {
      const greens = Object.fromEntries(s.groups.map((g) => [g, 0]));
      for (let t = 0; t < s.cycle; t += 0.25) {
        const lit = s.groups.filter((g) => signalColor(s, g, t) !== "red");
        expect(lit.length).toBeLessThanOrEqual(1);
        for (const g of s.groups) if (signalColor(s, g, t) === "green") greens[g]++;
      }
      for (const g of s.groups) expect(greens[g]).toBeGreaterThan(0);
      for (const g of s.groups.filter((g) => g.startsWith("side"))) expect(greens.east).toBeGreaterThan(greens[g]); // the highway gets the longer green
      // Each light changes every few seconds: no green lasts longer than 6 s.
      let run = 0;
      let longestGreen = 0;
      for (let t = 0; t < s.cycle * 2; t += 0.1) {
        run = signalColor(s, "east", t) === "green" ? run + 0.1 : 0;
        longestGreen = Math.max(longestGreen, run);
      }
      expect(longestGreen).toBeLessThan(6.2);
    }
  });
});

describe("rules of the road", () => {
  const sig = signals[0];
  const east = sig.approaches[0];
  const redFor = (group) => {
    for (let t = 0; t < sig.cycle; t += 0.1) if (signalColor(sig, group, t) === "red" && signalColor(sig, group, t + 2) === "red") return t;
    return 0;
  };
  const greenFor = (group) => {
    for (let t = 0; t < sig.cycle; t += 0.1) if (signalColor(sig, group, t) === "green") return t;
    return 0;
  };

  it("stops for a red light with the front bumper behind the line", () => {
    const t = redFor("east");
    const front = CAR_LENGTH / 2;
    const far = trafficCap({ x: east.x - 40, z: east.z, yaw: EAST, speed: 15 }, { signals, t, width: layout.width });
    const near = trafficCap({ x: east.x - front - 3, z: east.z, yaw: EAST, speed: 5 }, { signals, t, width: layout.width });
    // Centre still well short of the line, but the nose is at it: stop.
    const noseAtLine = trafficCap({ x: east.x - front - 0.3, z: east.z, yaw: EAST, speed: 0 }, { signals, t, width: layout.width });
    expect(far).toBeLessThan(25);
    expect(near).toBeLessThan(far);
    expect(noseAtLine).toBe(0);
    // Already over the line when it turned red: clear the junction.
    expect(trafficCap({ x: east.x + 1, z: east.z, yaw: EAST, speed: 8 }, { signals, t, width: layout.width })).toBe(Infinity);
  });

  it("goes on green, and ignores lights for the other direction", () => {
    const green = trafficCap({ x: east.x - 3, z: east.z, yaw: EAST, speed: 10 }, { signals, t: greenFor("east"), width: layout.width });
    expect(green).toBe(Infinity);
    // Westbound past the eastbound stop line (other lane, other way): nothing to stop for here.
    const west = trafficCap({ x: east.x + 2, z: -east.z, yaw: -EAST, speed: 10 }, { signals: [{ ...sig, approaches: [east] }], t: redFor("east"), width: layout.width });
    expect(west).toBe(Infinity);
  });

  it("keeps a safe gap behind the car in front, and ignores oncoming traffic", () => {
    const me = { x: 0, z: -1.9, yaw: EAST, speed: 15 };
    const close = trafficCap(me, { others: [{ x: 5, z: -1.9, yaw: EAST, speed: 0 }], width: layout.width });
    const further = trafficCap(me, { others: [{ x: 30, z: -1.9, yaw: EAST, speed: 0 }], width: layout.width });
    const oncoming = trafficCap(me, { others: [{ x: 10, z: 1.9, yaw: -EAST, speed: 10 }], width: layout.width });
    const moving = trafficCap(me, { others: [{ x: 20, z: -1.9, yaw: EAST, speed: 12 }], width: layout.width });
    expect(close).toBe(0);
    expect(further).toBeGreaterThan(close);
    expect(oncoming).toBe(Infinity);
    expect(moving).toBeGreaterThan(12);
  });
});

describe("cars as rectangles", () => {
  const W = layout.width;
  it("overlap only when their bodies do", () => {
    const a = { x: 0, z: 0, yaw: EAST };
    expect(carsOverlap(a, { x: CAR_LENGTH - 0.2, z: 0, yaw: EAST }, W)).toBe(true); // nose to tail
    expect(carsOverlap(a, { x: CAR_LENGTH + 0.2, z: 0, yaw: EAST }, W)).toBe(false);
    expect(carsOverlap(a, { x: 0, z: 1.8, yaw: EAST }, W)).toBe(true); // side by side, touching
    expect(carsOverlap(a, { x: 0, z: 3.8, yaw: -EAST }, W)).toBe(false); // passing in the other lane
    expect(carsOverlap(a, { x: 3.0, z: 1.5, yaw: 0 }, W)).toBe(true); // T-bone
  });

  it("brakes for a car crossing its path, and gives way at roundabouts", () => {
    const me = { x: 0, z: -1.9, yaw: EAST, speed: 10 };
    const crossing = trafficCap(me, { others: [{ x: 9, z: -1.9, yaw: 0, speed: 6 }], width: W });
    expect(crossing).toBeLessThan(10);
    const clear = trafficCap(me, { others: [{ x: 9, z: -12, yaw: 0, speed: 6 }], width: W });
    expect(clear).toBe(Infinity);
    const town = layout.cities[0];
    const entering = { x: town.x, z: town.z - 11, yaw: Math.PI, speed: 6 }; // heading south into it (+z)
    const onRing = { x: town.x + 4, z: town.z - 5, yaw: EAST, speed: 5 };
    expect(trafficCap(entering, { others: [onRing], width: W, towns: [town] })).toBeLessThan(6);
    expect(trafficCap(entering, { others: [], width: W, towns: [town] })).toBe(Infinity);
  });
});

describe("overtaking", () => {
  const W = layout.width;
  const slow = () => ({ x: 12, z: -1.9, yaw: EAST, speed: 3 });

  it("pulls out past a slow car when the other lane is clear, and back in after", () => {
    const me = { x: 0, z: -1.9, yaw: EAST, speed: 8, autoSpeed: 12 };
    const lead = slow();
    for (let i = 0; i < 20; i++) decideOvertake(me, { others: [lead], width: W }, 0.1);
    expect(me.laneShift).toBeGreaterThan(3); // out in the other lane
    expect(me.boost).toBeGreaterThan(1);
    // Now well past it: pull back in.
    me.x = 30;
    for (let i = 0; i < 30; i++) decideOvertake(me, { others: [lead], width: W }, 0.1);
    expect(me.laneShift).toBe(0);
  });

  it("goes when nothing is coming within 15 m, and holds for oncoming traffic or lights", () => {
    const close = { x: 12, z: 1.9, yaw: -EAST, speed: 12 };
    const a = { x: 0, z: -1.9, yaw: EAST, speed: 8, autoSpeed: 12 };
    for (let i = 0; i < 20; i++) decideOvertake(a, { others: [slow(), close], width: W }, 0.1);
    expect(a.laneShift).toBe(0);
    expect(a.overtakeNote).toMatch(/oncoming/);
    const far = { x: 20, z: 1.9, yaw: -EAST, speed: 0 }; // parked clear of the 15 m
    const b = { x: 0, z: -1.9, yaw: EAST, speed: 8, autoSpeed: 12 };
    decideOvertake(b, { others: [slow(), far], width: W }, 0.1);
    expect(b.overtake).toBeTruthy();
    const east = signals[0].approaches[0];
    const c = { x: east.x - 40, z: -1.9, yaw: EAST, speed: 8, autoSpeed: 12 };
    for (let i = 0; i < 20; i++) decideOvertake(c, { others: [{ ...slow(), x: east.x - 28 }], signals, width: W }, 0.1);
    expect(c.laneShift).toBe(0);
  });

  it("needs 15 m of the other lane in clear view", () => {
    const blind = { x: 0, z: -1.9, yaw: EAST, speed: 8, autoSpeed: 12 };
    // Something (a building, a hill) hides the lane from 10 m on.
    const hidden = (x) => x < 10;
    for (let i = 0; i < 10; i++) decideOvertake(blind, { others: [slow()], width: W, canSeePoint: hidden }, 0.1);
    expect(blind.laneShift).toBe(0);
    expect(blind.overtakeNote).toMatch(/can't see 15 m/);
    const short = { x: 0, z: -1.9, yaw: EAST, speed: 8, autoSpeed: 12 };
    decideOvertake(short, { others: [slow()], width: W, range: 10 }, 0.1);
    expect(short.overtake).toBeFalsy();
    const clear = { x: 0, z: -1.9, yaw: EAST, speed: 8, autoSpeed: 12 };
    decideOvertake(clear, { others: [slow()], width: W, canSeePoint: () => true }, 0.1);
    expect(clear.overtake).toBeTruthy();
  });

  it("doesn't pass a car that's queueing", () => {
    const me = { x: 0, z: -1.9, yaw: EAST, speed: 8, autoSpeed: 12 };
    for (let i = 0; i < 10; i++) decideOvertake(me, { others: [{ ...slow(), speed: 0.5 }], width: W }, 0.1);
    expect(me.laneShift).toBe(0);
    expect(me.overtakeNote).toMatch(/queueing/);
  });
});

describe("overtaking, by what the driver sees", () => {
  const W = layout.width;
  const slow = () => ({ x: 12, z: -1.9, yaw: EAST, speed: 3 });
  const me = () => ({ x: 0, z: -1.9, yaw: EAST, speed: 8, autoSpeed: 12 });
  const run = (car, ctx, steps = 15) => {
    for (let i = 0; i < steps; i++) decideOvertake(car, { width: W, ...ctx }, 0.1);
    return car;
  };

  it("holds back for a car in the next lane — ahead, or coming up behind in the mirror", () => {
    const beside = run(me(), { others: [slow(), { x: 8, z: 1.9, yaw: EAST, speed: 8 }] });
    expect(beside.laneShift).toBe(0);
    expect(beside.overtakeNote).toMatch(/next lane/);
    const comingUp = run(me(), { others: [slow(), { x: -15, z: 1.9, yaw: EAST, speed: 16 }] });
    expect(comingUp.laneShift).toBe(0);
  });

  it("re-plans mid-pass: commits when it will finish before an oncoming car arrives", () => {
    const car = run(me(), { others: [slow()] }, 10);
    car.x = 14; // just past the slow car's tail
    car.speed = 14;
    decideOvertake(car, { width: W, others: [slow(), { x: 90, z: 1.9, yaw: -EAST, speed: 12 }] }, 0.1);
    expect(car.overtakeNote).toMatch(/Overtaking · oncoming \d+ m/);
    expect(car.boost).toBeGreaterThan(1.3); // hurrying to finish
  });

  it("aborting, it drops back behind the slow car before pulling in — and goes again once clear", () => {
    const car = run(me(), { others: [slow()] }, 10);
    car.x = 11; // alongside the slow car
    decideOvertake(car, { width: W, others: [slow(), { x: 30, z: 1.9, yaw: -EAST, speed: 14 }] }, 0.1);
    expect(car.overtakeNote).toMatch(/Aborting/);
    expect(car.boost).toBeLessThan(1); // easing off to tuck in behind
    expect(car.laneShift).toBeGreaterThan(0); // still out until it's behind
    // The oncoming car turned off: carry on with the pass.
    decideOvertake(car, { width: W, others: [slow()] }, 0.1);
    expect(car.overtake?.aborting).toBeFalsy();
    expect(car.overtakeNote).toMatch(/Overtaking/);
  });
});

import { stepSignals } from "./traffic";

describe("smart (actuated) traffic lights", () => {
  const fresh = () => placeSignals(layout)[0];
  const queueAt = (ap, n = 1) =>
    Array.from({ length: n }, (_, i) => ({ x: ap.x - ap.dir[0] * (3 + i * 7), z: ap.z - ap.dir[1] * (3 + i * 7), yaw: Math.atan2(-ap.dir[0], -ap.dir[1]), speed: 0 }));
  const run = (sig, cars, seconds) => {
    for (let t = 0; t < seconds; t += 0.1) stepSignals([sig], cars, 0.1, layout.width);
  };

  it("rests on the highway when nobody's waiting", () => {
    const sig = fresh();
    run(sig, [], 60);
    expect(signalColor(sig, "east", 0)).toBe("green");
  });

  it("turns green for a side road with a car waiting once the highway's had its turn, and skips empty ones", () => {
    const sig = fresh();
    const side = sig.approaches.find((a) => a.group.startsWith("side"));
    // The highway has priority: it keeps green for its minimum first.
    run(sig, queueAt(side), 8);
    expect(signalColor(sig, side.group, 0)).toBe("red");
    run(sig, queueAt(side), 7);
    expect(signalColor(sig, side.group, 0)).toBe("green");
    for (const g of sig.groups.filter((g) => g !== side.group)) expect(signalColor(sig, g, 0)).toBe("red");
  });

  it("holds the green while its queue keeps coming, but not forever", () => {
    const sig = fresh();
    const east = sig.approaches.find((a) => a.group === "east");
    const side = sig.approaches.find((a) => a.group.startsWith("side"));
    run(sig, [...queueAt(east, 3), ...queueAt(side)], 8);
    expect(signalColor(sig, "east", 0)).toBe("green"); // still serving the busier highway
    run(sig, [...queueAt(east, 3), ...queueAt(side)], 12);
    expect(signalColor(sig, "east", 0)).not.toBe("green"); // the side road gets its turn
  });
});

import { HIGHWAY_LANE, HIGHWAY_LANE_WIDTH } from "./layout";

describe("lane discipline on the highway", () => {
  const W = layout.width;
  const LEFT = -HIGHWAY_LANE; // heading east: the left (cruising) lane, north of the centre line
  const RIGHT = -(HIGHWAY_LANE - HIGHWAY_LANE_WIDTH); // the overtaking lane beside it

  it("never passes a slower car on its left: stays behind it", () => {
    const me = { x: 0, z: LEFT, yaw: EAST, speed: 20 };
    const slow = { x: 12, z: RIGHT, yaw: EAST, speed: 8 };
    const why = {};
    const cap = trafficCap(me, { others: [slow], width: W, why });
    expect(cap).toBeLessThan(13);
    expect(why.label).toBe("Not passing on the left");
    // Overtaking in the right lane ourselves, a car to our left is fair game…
    expect(trafficCap({ ...me, z: RIGHT, laneShift: HIGHWAY_LANE_WIDTH }, { others: [{ ...slow, z: LEFT }], width: W })).toBe(Infinity);
    // …and off the highway the rule doesn't apply (no second lane our way).
    expect(trafficCap({ ...me, z: -60 }, { others: [{ ...slow, z: -60 + HIGHWAY_LANE_WIDTH }], width: W })).toBe(Infinity);
  });

  it("passes a line of slow cars in one go, rather than weaving between them", () => {
    const passed = { x: -10, z: LEFT, yaw: EAST, speed: 8 };
    const next = { x: 12, z: LEFT, yaw: EAST, speed: 8 };
    // (A slow driver, below highway pace: it belongs in the service lane, so it passes and returns.)
    const overtaking = () => ({ x: 0, z: RIGHT, yaw: EAST, speed: 13, autoSpeed: 14, laneShift: HIGHWAY_LANE_WIDTH, overtake: { target: passed, since: 1, aborting: false } });
    const me = overtaking();
    decideOvertake(me, { others: [passed, next], width: W }, 0.1);
    expect(me.overtake?.target).toBe(next);
    expect(me.laneShift).toBeCloseTo(HIGHWAY_LANE_WIDTH, 5);
    expect(me.overtakeNote).toMatch(/line/);
    // With nobody else up the lane, it pulls back in.
    const alone = overtaking();
    decideOvertake(alone, { others: [passed], width: W }, 0.1);
    expect(alone.overtake).toBeNull();
  });
});

import { HIGHWAY_HALF_WIDTH } from "./layout";
import { signalPostOffset } from "./traffic";

describe("stop lines and posts", () => {
  it("span every lane going their way — both on the highway — with the post on the verge", () => {
    for (const s of signals) {
      for (const ap of s.approaches) {
        // Left of travel is (dz, -dx) for dir (dx, dz): kerb side.
        const [dx, dz] = ap.dir;
        const along = (k) => [ap.x + dz * k, ap.z - dx * k];
        if (ap.group === "east" || ap.group === "west") {
          // Both lane centres of the carriageway lie on the line, and it runs kerb to centre line.
          for (const lane of [HIGHWAY_LANE, HIGHWAY_LANE - HIGHWAY_LANE_WIDTH]) {
            expect(Math.abs(Math.abs(ap.z) - lane)).toBeLessThanOrEqual(ap.half);
          }
          expect(ap.half * 2).toBeCloseTo(HIGHWAY_HALF_WIDTH, 5);
        }
        // The post stands off the road surface.
        const [px, pz] = along(signalPostOffset(ap));
        const onRoad = layout.roads.some((r) => roadDistance(layout, px, pz, r, r.halfWidth) !== Infinity);
        expect(onRoad).toBe(false);
      }
    }
  });
});

import { FAST_LANE_SPEED } from "./traffic";

describe("lanes by speed on the highway", () => {
  const W = layout.width;
  const SERVICE = -HIGHWAY_LANE; // heading east: the left lane
  // Somewhere on the highway clear of every junction.
  const x0 = (() => {
    for (let x = -W / 2; x < W / 2; x += 5) {
      if (signals.every((s) => Math.abs(((x - s.x + W / 2) % W + W) % W - W / 2) > 90)) return x;
    }
    return 0;
  })();
  const run = (car, others = [], steps = 40, extra = {}) => {
    for (let i = 0; i < steps; i++) decideOvertake(car, { others, signals, width: W, ...extra }, 0.1);
    return car;
  };

  it("moves to the right (fast) lane once at a highway cruising speed", () => {
    const car = run({ x: x0, z: SERVICE, yaw: EAST, speed: 20, autoSpeed: 20 });
    expect(car.fastLane).toBe(true);
    expect(car.laneShift).toBeCloseTo(HIGHWAY_LANE_WIDTH, 5);
  });

  it("keeps a slow driver, or one well below its cruise, in the left (service) lane", () => {
    expect(run({ x: x0, z: SERVICE, yaw: EAST, speed: 12, autoSpeed: FAST_LANE_SPEED - 2 }).laneShift).toBe(0);
    expect(run({ x: x0, z: SERVICE, yaw: EAST, speed: 8, autoSpeed: 22 }).laneShift).toBe(0);
  });

  it("moves back to the service lane to let a faster car by, or before turning off", () => {
    const fast = () => ({ x: x0, z: SERVICE + HIGHWAY_LANE_WIDTH, yaw: EAST, speed: 18, autoSpeed: 18, laneShift: HIGHWAY_LANE_WIDTH, fastLane: true });
    const behind = { x: x0 - 12, z: SERVICE + HIGHWAY_LANE_WIDTH, yaw: EAST, speed: 26 };
    expect(run(fast(), [behind], 20).fastLane).toBe(false);
    expect(run(fast(), [], 40, { exitAhead: true }).laneShift).toBe(0);
  });

  it("only changes lane when the lane is clear, and not near a junction", () => {
    const blocker = { x: x0 + 3, z: SERVICE + HIGHWAY_LANE_WIDTH, yaw: EAST, speed: 20 };
    expect(run({ x: x0, z: SERVICE, yaw: EAST, speed: 20, autoSpeed: 20 }, [blocker], 5).fastLane).toBeFalsy();
    const near = { x: signals[0].x - 25, z: SERVICE, yaw: EAST, speed: 20, autoSpeed: 20 };
    expect(run(near, [], 5).fastLane).toBeFalsy();
  });
});

describe("give way to the highway", () => {
  const W = layout.width;
  const one = createLayout([group("Work", 6, "north"), group("Learning", 4, "north")], "one-sided");
  const gw = placeGiveWays(one)[0];
  // A car coming down the side road toward the line, 6 m short of it.
  const yaw = Math.atan2(-gw.dir[0], -gw.dir[1]);
  const car = () => ({ x: gw.x - gw.dir[0] * 9, z: gw.z - gw.dir[1] * 9, yaw, speed: 5 });
  const eastbound = (dx, speed) => ({ x: gw.jx - dx, z: -HIGHWAY_LANE, yaw: EAST, speed });

  it("waits at the line while a highway car is coming, and goes when the gap is safe", () => {
    const why = {};
    const coming = trafficCap(car(), { others: [eastbound(40, 20)], giveWays: [gw], width: W, why }); // 2 s away
    expect(coming).toBeLessThan(10); // slowing to stop at the line, 6 m on
    expect(why.kind).toBe("giveway");
    expect(trafficCap(car(), { others: [eastbound(200, 20)], giveWays: [gw], width: W })).toBe(Infinity); // 10 s away
    expect(trafficCap(car(), { others: [{ ...eastbound(-30, 20) }], giveWays: [gw], width: W })).toBe(Infinity); // gone past
  });

  it("never makes highway traffic stop for it", () => {
    const highway = eastbound(30, 20);
    expect(trafficCap(highway, { others: [car()], giveWays: [gw], width: W })).toBe(Infinity);
  });
});

import { keepLeft } from "./routing";
import { laneOffsetAt } from "./layout";

describe("give-way lines sit on the lane coming to the highway", () => {
  it("a car driving down the side road in its lane crosses the line at its middle", () => {
    const one = createLayout([group("Work", 6, "north"), group("Learning", 4, "north")], "one-sided");
    for (const gw of placeGiveWays(one)) {
      const spur = one.roads.find((r) => r.kind === "spur" && Math.abs(wrapDelta(r.points.at(-1)[0] - gw.jx, one.width)) < 6);
      // The spur runs from its district to the highway: shift it into the
      // left-hand lane for that direction, just as routes do.
      const lane = keepLeft(spur.points, (p) => laneOffsetAt(p[1]));
      const i = lane.findIndex(([, z]) => Math.sign(z - gw.z) !== Math.sign(lane[0][1] - gw.z));
      const [x0, z0] = lane[i - 1];
      const [x1, z1] = lane[i];
      const x = x0 + ((gw.z - z0) / (z1 - z0)) * (x1 - x0);
      expect(Math.abs(wrapDelta(x - gw.x, one.width))).toBeLessThan(0.6);
    }
  });
});
