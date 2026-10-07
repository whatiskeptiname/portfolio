import { describe, expect, it } from "vitest";
import { createLayout, worldDistance } from "./layout";
import { buildRoadGraph, followRoute, nextTourStop, planRoute, smoothPath, speedProfile } from "./routing";

const group = (language, count, side = "south") => ({
  language,
  side,
  projects: Array.from({ length: count }, (_, i) => ({ name: `${language}-${i}`, stars: 0 })),
});
const layout = createLayout(
  [group("Work", 6, "north"), group("Learning", 4, "north"), group("Community", 2, "north"), group("C++", 10), group("Python", 5), group("HTML", 3)],
  "routing"
);
const graph = buildRoadGraph(layout);

describe("go-to routing", () => {
  it("drives by road from the highway to any district's spur", () => {
    const from = { x: 10, z: -1.9 };
    for (const city of layout.cities) {
      const route = planRoute(layout, graph, from, city, "car");
      expect(route.kind).toBe("road");
      // No jumps: consecutive points are close together (roads are finely sampled).
      for (let i = 2; i < route.points.length; i++) {
        const [x0, z0] = route.points[i - 1];
        const [x1, z1] = route.points[i];
        expect(Math.hypot(x1 - x0, z1 - z0)).toBeLessThan(16);
      }
      const [ex, ez] = route.points.at(-1);
      expect(worldDistance(layout, ex, ez, city.x, city.z)).toBeLessThan(city.radius + 20);
    }
  }, 30000);

  it("goes from one district to another through the road network", () => {
    const [a, b] = [layout.cities[0], layout.cities.at(-1)];
    const spur = layout.roads.find((r) => r.kind === "spur" && r.from === a.id);
    const route = planRoute(layout, graph, { x: spur.points[3][0], z: spur.points[3][1] }, b, "car");
    expect(route.length).toBeGreaterThan(worldDistance(layout, a.x, a.z, b.x, b.z) * 0.9);
  });

  it("flies the drone along the roads, the same way the car would go", () => {
    const from = { x: 10, z: -1.9, yaw: -Math.PI / 2 };
    const drone = planRoute(layout, graph, from, layout.cities[0], "drone");
    const car = planRoute(layout, graph, from, layout.cities[0], "car");
    expect(drone.kind).toBe("road");
    expect(drone.points).toEqual(car.points);
  });

  it("steers along the route and stops at the end", () => {
    const route = { kind: "road", points: [[0, 0], [50, 0]] };
    const s = { x: 0, z: 0, yaw: -Math.PI / 2, speed: 0, alt: 0, autoSpeed: 10 };
    const { input, done } = followRoute(s, route, "car", layout);
    expect(input.up).toBe(true);
    expect(done).toBe(false);
    // Keeps left: heading east, the target is pulled north (negative z), so it steers left (+).
    expect(input.steer).toBeGreaterThan(0);
    const end = followRoute({ ...s, x: 49, speed: 0 }, { ...route, i: 1 }, "car", layout);
    expect(end.done).toBe(true);
  });
});

// A stripped-down copy of the drone's flight model (src/city/Vehicles.jsx),
// enough to check the autopilot actually gets it somewhere.
function flySim(s, k, dt) {
  if (k.up) s.speed += 38 * dt;
  else if (k.down) s.speed -= 38 * dt;
  else s.speed *= Math.exp(-1.1 * dt);
  s.speed = Math.max(-21, Math.min(42, s.speed));
  s.steer += (k.steer - s.steer) * (1 - Math.exp(-8 * dt));
  s.yaw += s.steer * 2.8 * dt;
  const climb = (k.ascend ? 1 : 0) - (k.descend ? 1 : 0);
  s.alt = Math.max(0, s.alt + climb * 18 * dt);
  s.x += -Math.sin(s.yaw) * s.speed * dt;
  s.z += -Math.cos(s.yaw) * s.speed * dt;
}

describe("drone autopilot", () => {
  it("flies a Go-to trip to the district and stops there", () => {
    const city = layout.cities[2];
    const s = { x: 0, z: 0, yaw: -Math.PI / 2, speed: 0, steer: 0, alt: 2, autoSpeed: 12 };
    const route = planRoute(layout, graph, s, city, "drone");
    let done = false;
    let maxAlt = 0;
    let worst = 0;
    for (let t = 0; t < 400 && !done; t += 1 / 30) {
      const trip = followRoute(s, route, "drone", layout);
      flySim(s, trip.input, 1 / 30);
      worst = Math.max(worst, Math.min(...route.points.map(([x, z]) => Math.hypot(x - s.x, z - s.z))));
      maxAlt = Math.max(maxAlt, s.alt);
      done = trip.done;
    }
    expect(done).toBe(true);
    const [ex, ez] = route.points.at(-1);
    expect(worldDistance(layout, s.x, s.z, ex, ez)).toBeLessThan(8); // at the end of the road route
    expect(maxAlt).toBeGreaterThan(15); // cruises above the rooftops
    // …and it followed the road, not a straight line: never far off the route.
    expect(worst).toBeLessThan(6);
  });

  it("cruises the equator at the set speed and height", async () => {
    const { autopilotInput, AUTOPILOT } = await import("./autopilot");
    const s = { x: 0, z: 6, yaw: 0.3, speed: 0, steer: 0, alt: 0, autoSpeed: 10 };
    for (let t = 0; t < 30; t += 1 / 30) flySim(s, autopilotInput(s, "drone"), 1 / 30);
    expect(Math.abs(s.z)).toBeLessThan(1);
    expect(Math.abs(s.speed - 10)).toBeLessThan(2.5);
    expect(Math.abs(s.alt - AUTOPILOT.droneAlt)).toBeLessThan(1.5);
    expect(s.x).toBeGreaterThan(100); // heading east
  });
});

describe("car Go-to", () => {
  it("drives the whole route by road and stops at the district", async () => {
    const { roadDistance } = await import("./layout");
    const city = layout.cities.at(-1);
    const s = { x: 10, z: -1.9, yaw: -Math.PI / 2, speed: 0, steer: 0, alt: 0, autoSpeed: 15 };
    const route = planRoute(layout, graph, s, city, "car");
    let done = false;
    let worst = 0;
    for (let t = 0; t < 400 && !done; t += 1 / 30) {
      const trip = followRoute(s, route, "car", layout);
      const k = trip.input;
      if (k.up) s.speed += (s.speed < 0 ? 30 : 18) / 30;
      else if (k.down) s.speed -= (s.speed > 0 ? 30 : 18) / 30;
      else s.speed *= Math.exp(-1.4 / 30);
      s.steer += (k.steer - s.steer) * (1 - Math.exp(-10 / 30));
      s.yaw += (s.steer * 1.9 * Math.min(1, Math.abs(s.speed) / 6) * Math.sign(s.speed)) / 30;
      s.x += (-Math.sin(s.yaw) * s.speed) / 30;
      s.z += (-Math.cos(s.yaw) * s.speed) / 30;
      worst = Math.max(worst, Math.min(...layout.roads.map((r) => roadDistance(layout, s.x, s.z, r) - r.halfWidth)));
      done = trip.done;
    }
    expect(done).toBe(true);
    expect(worst).toBeLessThan(2); // never wanders far off the tarmac
  });
});

describe("autopilot tour of all roads", () => {
  it("visits every district once per round, in a random order — not just the nearest", () => {
    const rounds = [];
    for (const seed of [0.1, 0.5, 0.9]) {
      let k = seed;
      const random = () => (k = (k * 9301 + 0.49297) % 1);
      const tour = { visited: new Set(), last: null };
      const seen = layout.cities.map(() => nextTourStop(layout, { x: 0, z: 0 }, tour, random).id);
      expect(new Set(seen).size).toBe(layout.cities.length);
      const again = nextTourStop(layout, { x: 0, z: 0 }, tour, random);
      expect(again.id).not.toBe(seen.at(-1));
      rounds.push(seen.join());
    }
    expect(new Set(rounds).size).toBeGreaterThan(1); // the order varies
  });

  it("drives through each town's roundabout without stopping", () => {
    const city = layout.cities[0];
    const route = planRoute(layout, graph, { x: 10, z: -1.9 }, city, "car", { through: true });
    const [ex, ez] = route.points.at(-1);
    expect(worldDistance(layout, ex, ez, city.x, city.z)).toBeLessThan(8);
    const near = followRoute({ x: ex, z: ez, yaw: 0, speed: 8, alt: 0 }, { ...route, i: route.points.length - 1 }, "car", layout);
    expect(near.done).toBe(true);
    expect(near.input.down).toBe(false);
  });
});

// The car's own physics (src/city/Vehicles.jsx driveCar), minus collisions.
import { CAR_GRIP, CAR_LIMITS as LIMITS, settleToLimit } from "./autopilot";
import { roadDistance, surfaceAt } from "./layout";

function driveSim(s, k, dt) {
  const surface = surfaceAt(layout, s.x, s.z);
  const traction = CAR_GRIP[surface];
  if (k.up) s.speed += (s.speed < 0 ? 30 : 18 * traction) * dt;
  else if (k.down) s.speed -= (s.speed > 0 ? 30 : 18 * traction) * dt;
  else s.speed *= Math.exp(-1.4 * (surface === "grass" ? 1.8 : 1) * dt);
  s.speed = Math.max(-9, settleToLimit(s.speed, LIMITS[surface], dt));
  s.steer += (k.steer - s.steer) * (1 - Math.exp(-10 * dt));
  const grip = Math.min(1, Math.abs(s.speed) / 6) * Math.sign(s.speed);
  const before = s.yaw;
  s.yaw += s.steer * 1.9 * grip * dt;
  s.turned = (s.turned ?? 0) + Math.abs(s.yaw - before);
  s.x += -Math.sin(s.yaw) * s.speed * dt;
  s.z += -Math.cos(s.yaw) * s.speed * dt;
}
const limitAt = (x, z) => LIMITS[surfaceAt(layout, x, z)];

function runTrip(s, route, seconds = 600) {
  const dt = 1 / 30;
  let worst = -Infinity;
  for (let t = 0; t < seconds; t += dt) {
    const trip = followRoute(s, route, "car", layout, limitAt);
    if (trip.done) return { done: true, worst, t };
    driveSim(s, trip.input, dt);
    // The roundabout, including the flared mouths where roads meet it (kerb radius 3).
    const nearTown = layout.cities.some((c) => worldDistance(layout, s.x, s.z, c.x, c.z) < 7 + 3);
    if (!nearTown) worst = Math.max(worst, Math.min(...layout.roads.map((r) => roadDistance(layout, s.x, s.z, r) - r.halfWidth)));
  }
  return { done: false, worst };
}

describe("taking the turns", () => {
  for (const kmh of [30, 150]) {
    it(`reaches every district by road at ${kmh} km/h without missing turns or circling`, () => {
      for (const city of layout.cities) {
        const s = { x: 10, z: -1.9, yaw: -Math.PI / 2, speed: 0, steer: 0, alt: 0, autoSpeed: kmh / 4 };
        const route = planRoute(layout, graph, s, city, "car");
        const r = runTrip(s, route);
        expect(r.done, `${city.language} at ${kmh}`).toBe(true);
        // Tyres stay on the tarmac — give or take the shoulder, which a trip
        // starting the wrong way round needs: a car can't U-turn in 9 units.
        expect(r.worst, `${city.language} at ${kmh}`).toBeLessThan(2);
        // Total steering ≈ the route's own bends, not laps of a circle.
        expect(s.turned, `${city.language} at ${kmh}`).toBeLessThan(4 * Math.PI + route.points.length * 0.2);
      }
    });
  }

  it("handles any order of tour legs, near and far", () => {
    for (const seed of [0.13, 0.42, 0.77, 0.91]) {
      let k = seed;
      const random = () => (k = (k * 9301 + 0.49297) % 1);
      const tour = { visited: new Set(), last: null };
      const s = { x: 10, z: -1.9, yaw: -Math.PI / 2, speed: 0, steer: 0, alt: 0, autoSpeed: 25 };
      for (let leg = 0; leg < 6; leg++) {
        const city = nextTourStop(layout, s, tour, random);
        const r = runTrip(s, planRoute(layout, graph, s, city, "car", { through: true }));
        expect(r.done, `seed ${seed} leg ${leg} to ${city.language}`).toBe(true);
        expect(r.worst, `seed ${seed} leg ${leg} to ${city.language}`).toBeLessThan(leg ? 1.2 : 2);
      }
    }
  });

  it("chains tour legs through the roundabouts", () => {
    const tour = { visited: new Set(), last: null };
    const s = { x: 10, z: -1.9, yaw: -Math.PI / 2, speed: 0, steer: 0, alt: 0, autoSpeed: 20 };
    for (let leg = 0; leg < 4; leg++) {
      const city = nextTourStop(layout, s, tour, () => [0.7, 0.2, 0.95, 0.4][leg]); // far and near legs
      const route = planRoute(layout, graph, s, city, "car", { through: true });
      const r = runTrip(s, route);
      expect(r.done, `leg ${leg} to ${city.language}`).toBe(true);
      // Round the roundabouts, not across the verge (the first leg starts
      // facing the wrong way on the highway, so it may use the shoulder).
      expect(r.worst, `leg ${leg} to ${city.language}`).toBeLessThan(leg ? 1.2 : 2);
    }
  });
});

describe("route visualisation data", () => {
  it("records the junctions the search explored, starting where we are", () => {
    const route = planRoute(layout, graph, { x: 10, z: -1.9 }, layout.cities.at(-1), "car");
    expect(route.explored.length).toBeGreaterThan(route.points.length / 2);
    const [ex, ez] = route.explored[0];
    expect(worldDistance(layout, ex, ez, 10, -1.9)).toBeLessThan(5);
  });

  it("plans to slow for bends and towns and stop at the end, cruising on the straights", () => {
    const route = planRoute(layout, graph, { x: 10, z: -1.9 }, layout.cities[0], "car");
    const v = speedProfile(route, "car", 30, (x, z) => LIMITS[surfaceAt(layout, x, z)]);
    expect(v).toHaveLength(route.points.length);
    expect(v.at(-1)).toBe(0);
    expect(Math.max(...v)).toBeGreaterThan(20); // flat out somewhere
    expect(Math.min(...v.slice(0, -1))).toBeLessThan(15); // braking somewhere
    for (let i = 1; i < v.length; i++) {
      const d = Math.hypot(route.points[i][0] - route.points[i - 1][0], route.points[i][1] - route.points[i - 1][1]);
      expect(v[i - 1] ** 2 - v[i] ** 2).toBeLessThanOrEqual(2 * 9 * 0.6 * d + 1e-6); // never brakes harder than planned
    }
  });
});

describe("smooth turns", () => {
  it("rounds a right-angle corner into a curve and keeps the ends", () => {
    const corner = [[0, 0], [20, 0], [20, 20]];
    const path = smoothPath(corner);
    expect(path[0]).toEqual([0, 0]);
    expect(path.at(-1)).toEqual([20, 20]);
    // Heading changes gradually: no more than ~0.45 rad per unit step.
    let sharpest = 0;
    for (let i = 2; i < path.length; i++) {
      const a = Math.atan2(path[i - 1][1] - path[i - 2][1], path[i - 1][0] - path[i - 2][0]);
      const b = Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0]);
      sharpest = Math.max(sharpest, Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))));
    }
    expect(sharpest).toBeLessThan(0.45);
    // …but still hugs the corner (cuts it by a little, not a lot).
    const cut = Math.min(...path.map(([x, z]) => Math.hypot(x - 20, z)));
    expect(cut).toBeGreaterThan(0.5);
    expect(cut).toBeLessThan(3);
  });

  it("gives every planned road route smooth turns", () => {
    for (const city of layout.cities) {
      const route = planRoute(layout, graph, { x: 10, z: -1.9, yaw: -Math.PI / 2 }, city, "car");
      const p = route.points;
      for (let i = 2; i < p.length; i++) {
        const a = Math.atan2(p[i - 1][1] - p[i - 2][1], p[i - 1][0] - p[i - 2][0]);
        const b = Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0]);
        const step = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        if (step > 0.3) expect(Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)))).toBeLessThan(0.6);
      }
    }
  });
});

describe("routes in the lane", () => {
  it("start exactly where the car is and run down the left-hand lane", () => {
    const from = { x: 10, z: -1.9, yaw: -Math.PI / 2 }; // eastbound, in the north (left) lane
    const city = layout.cities.find((c) => c.x > 60) ?? layout.cities[0];
    const route = planRoute(layout, graph, from, city, "car");
    expect(route.points[0]).toEqual([10, -1.9]);
    expect(route.laned).toBe(true);
    // A little way along the highway (still heading east), it's in the eastbound lane.
    const onHighway = route.points.filter(([, z], i) => i > 8 && i < 30 && Math.abs(z) < 4.5);
    expect(onHighway.length).toBeGreaterThan(5);
    for (const [, z] of onHighway) expect(z).toBeCloseTo(-1.9, 0);
  });
});

import { inWater } from "./layout";
import { planToHighway, waterBetween } from "./routing";

describe("never into the river", () => {
  // A spot on the bank, across the water from the nearest bit of road.
  const bank = (() => {
    const pts = layout.river.points;
    for (let i = 10; i < pts.length - 10; i += 3) {
      const [x, z] = pts[i];
      const w = layout.river.widths[i];
      for (const side of [-1, 1]) {
        const p = { x: x + side * (w + 3), z, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2 }; // facing the water
        if (inWater(layout, p.x, p.z) || Math.abs(p.z) < 10) continue;
        const nearest = graph.nodes.reduce((a, n) => (worldDistance(layout, n.x, n.z, p.x, p.z) < worldDistance(layout, a.x, a.z, p.x, p.z) ? n : a));
        if (waterBetween(layout, p.x, p.z, nearest.x, nearest.z)) return p;
      }
    }
    return null;
  })();

  const dryAllTheWay = (route) => {
    for (let i = 1; i < route.points.length; i++) {
      const [ax, az] = route.points[i - 1];
      const [bx, bz] = route.points[i];
      if (waterBetween(layout, ax, az, bx, bz)) return false;
    }
    return true;
  };

  it("sets off by road on its own side of the river, not across it", () => {
    expect(bank).not.toBeNull();
    for (const city of layout.cities) expect(dryAllTheWay(planRoute(layout, graph, bank, city, "car")), city.language).toBe(true);
  });

  it("finds its way back to the highway by road", () => {
    const route = planToHighway(layout, graph, bank);
    expect(route).not.toBeNull();
    expect(dryAllTheWay(route)).toBe(true);
    expect(Math.abs(route.points.at(-1)[1])).toBeLessThan(3);
  });
});

import { flightController, stepQuad } from "./quad";

describe("the realistic drone on autopilot", () => {
  it("flies a road route through its flight controller, staying over the road", () => {
    const city = layout.cities[2];
    const s = { x: 10, z: -1.9, yaw: -Math.PI / 2, speed: 0, alt: 0, vx: 0, vz: 0, vy: 0, autoSpeed: 10, droneAltTarget: 12 };
    const route = planRoute(layout, graph, s, city, "drone");
    let done = false;
    let worst = 0;
    const dt = 1 / 30;
    for (let t = 0; t < 400 && !done; t += dt) {
      const trip = followRoute(s, route, "drone", layout);
      // What the route follower wants, flown through the sticks.
      const sticks = flightController(s, { speed: trip.input.down && !trip.input.up ? 0 : route.target ?? 10, steer: trip.input.steer, alt: 12 });
      const [dx, dz] = stepQuad(s, sticks, dt);
      s.x += dx;
      s.z += dz;
      if (t > 3) worst = Math.max(worst, Math.min(...route.points.map(([x, z]) => Math.hypot(x - s.x, z - s.z))));
      done = trip.done;
    }
    expect(done).toBe(true);
    expect(worst).toBeLessThan(8);
  });
});
