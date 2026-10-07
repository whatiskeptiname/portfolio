import { describe, expect, it } from "vitest";
import { createLayout, createRng, roadDistance, worldDistance } from "./layout";
import { buildRoadGraph } from "./routing";
import { CAR_LENGTH, carsOverlap, placeSignals, signalColor } from "./traffic";
import { createTraffic, stepTraffic } from "./trafficSim";

const group = (language, count, side = "south") => ({
  language,
  side,
  projects: Array.from({ length: count }, (_, i) => ({ name: `${language}-${i}`, stars: 0 })),
});
const layout = createLayout(
  [group("Work", 6, "north"), group("Learning", 4, "north"), group("Community", 2, "north"), group("C++", 10), group("Python", 5), group("HTML", 3)],
  "traffic-sim"
);
const graph = buildRoadGraph(layout);

describe("traffic", () => {
  it("drives around for two minutes: on the roads, through red lights never, into each other never — and overtakes", () => {
    const rng = createRng("cars");
    const sigs = placeSignals(layout); // fresh, actuated lights
    const redFor = new Map(); // how long each approach has been red
    const cars = createTraffic(layout, 18, rng);
    expect(cars.length).toBe(18);
    const dt = 1 / 20;
    let travelled = 0;
    let offRoad = 0;
    let redRuns = 0;
    let crashes = 0;
    let overtakes = 0;
    const wasOut = new Map();
    // Where each car's front bumper was relative to each stop line, last step.
    const before = new Map();
    for (let step = 0, t = 0; step < 120 / dt; step++, t += dt) {
      stepTraffic(cars, { world: layout, graph, signals: sigs, t, random: rng, driveSignals: true }, dt);
      for (const car of cars) {
        travelled += car.speed * dt;
        const out = (car.laneShift ?? 0) > 3;
        if (out && !wasOut.get(car.id)) overtakes++;
        wasOut.set(car.id, out);
        const inTown = layout.cities.some((c) => worldDistance(layout, c.x, c.z, car.x, car.z) < 10);
        if (!inTown) {
          const off = Math.min(...layout.roads.map((r) => roadDistance(layout, car.x, car.z, r) - r.halfWidth));
          if (off > 1.5) offRoad++;
        }
        const fx = -Math.sin(car.yaw);
        const fz = -Math.cos(car.yaw);
        for (const s of sigs) {
          s.approaches.forEach((ap, k) => {
            const dx = ((ap.x - car.x + layout.width * 1.5) % layout.width) - layout.width / 2;
            const dz = ap.z - car.z;
            const nose = dx * fx + dz * fz - CAR_LENGTH / 2; // front bumper to the line
            const side = Math.abs(dx * fz - dz * fx);
            const key = `${car.id}:${s.id}:${k}`;
            const aligned = ap.dir[0] * fx + ap.dir[1] * fz > 0.7 && side < 4.5;
            const was = before.get(key);
            // Crossing a line that has been red for longer than the amber + all-red: a red run.
            if (aligned && was != null && was > 0.1 && nose <= 0 && (redFor.get(`${s.id}:${k}`) ?? 0) > 1.5) redRuns++;
            before.set(key, aligned ? nose : null);
          });
        }
      }
      for (const s of sigs) {
        s.approaches.forEach((ap, k) => {
          const key = `${s.id}:${k}`;
          redFor.set(key, signalColor(s, ap.group, t) === "red" ? (redFor.get(key) ?? 0) + dt : 0);
        });
      }
      for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) if (carsOverlap(cars[i], cars[j], layout.width)) crashes++;
      }
    }
    const average = travelled / cars.length / 120;
    expect(average).toBeGreaterThan(3); // they get somewhere (allowing for red lights)
    expect(offRoad / (cars.length * (120 / dt))).toBeLessThan(0.01);
    expect(redRuns).toBe(0);
    expect(crashes).toBe(0);
    expect(overtakes).toBeGreaterThan(0);
  }, 60000);

  it("never gets stuck for long, even when busy", () => {
    const rng = createRng("busy");
    const sigs = placeSignals(layout);
    const cars = createTraffic(layout, 24, rng);
    const dt = 1 / 20;
    const still = new Map();
    let longest = 0;
    let crashes = 0;
    let stoppedTime = 0;
    for (let step = 0, t = 0; step < 150 / dt; step++, t += dt) {
      stepTraffic(cars, { world: layout, graph, signals: sigs, t, random: rng, driveSignals: true }, dt);
      for (const car of cars) {
        const s = car.speed < 0.3 ? (still.get(car.id) ?? 0) + dt : 0;
        if (car.speed < 0.3) stoppedTime += dt;
        still.set(car.id, s);
        longest = Math.max(longest, s);
      }
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) if (carsOverlap(cars[i], cars[j], layout.width)) crashes++;
    }
    expect(crashes).toBe(0);
    // At most about a light cycle and a half (just missed the green, queued behind others).
    // Actuated lights: no one waits more than about one full round of greens.
    const cycle = Math.max(...sigs.map((s) => s.cycle));
    expect(longest).toBeLessThan(cycle * 1.6);
    expect(stoppedTime / (cars.length * 150)).toBeLessThan(0.35); // traffic keeps flowing
  }, 60000);
});
