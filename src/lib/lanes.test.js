import { describe, expect, it } from "vitest";
import { HIGHWAY_HALF_WIDTH, PLAZA_RADIUS, createLayout } from "./layout";
import { laneAhead, laneAt } from "./lanes";

const group = (language, count, side = "south") => ({
  language,
  side,
  projects: Array.from({ length: count }, (_, i) => ({ name: `${language}-${i}`, stars: 0 })),
});
const layout = createLayout([group("Work", 4, "north"), group("C++", 6)], "lanes");
const EAST = [1, 0];

describe("lane recognition", () => {
  it("finds the left-hand lane of the highway, centre line to kerb", () => {
    const lane = laneAt(layout, 10, -1.9, ...EAST);
    expect(lane.label).toMatch(/highway/i);
    expect(lane.right[1]).toBeCloseTo(0, 1); // the centre line
    expect(lane.left[1]).toBeCloseTo(-HIGHWAY_HALF_WIDTH, 1); // the north kerb: on our left heading east
    expect(lane.wrongWay).toBe(false);
  });

  it("knows when it's in the other lane, and when it's off the road", () => {
    expect(laneAt(layout, 10, 1.9, ...EAST).wrongWay).toBe(true);
    // Heading west in that lane is right.
    expect(laneAt(layout, 10, 1.9, -1, 0).wrongWay).toBe(false);
    expect(laneAt(layout, 10, 30, ...EAST)).toBeNull();
  });

  it("on a roundabout, the lane is the ring", () => {
    const town = layout.cities[0];
    const lane = laneAt(layout, town.x + 5, town.z, 0, 1);
    expect(lane.kind).toBe("ring");
    expect(Math.hypot(lane.left[0] - town.x, lane.left[1] - town.z)).toBeCloseTo(PLAZA_RADIUS - 0.5, 1);
  });

  it("traces the lane's edges along the path ahead, until the path leaves the road", () => {
    const poses = Array.from({ length: 40 }, (_, k) => ({ x: 10 + k + 1, z: -1.9, yaw: -Math.PI / 2, d: k + 1 }));
    const ahead = laneAhead(layout, { x: 10, z: -1.9, yaw: -Math.PI / 2 }, poses);
    expect(ahead.left.length).toBeGreaterThan(10);
    expect(ahead.left.every(([, z]) => Math.abs(z + HIGHWAY_HALF_WIDTH) < 0.2)).toBe(true);
    const offRoad = laneAhead(layout, { x: 10, z: 30, yaw: 0 }, []);
    expect(offRoad.offRoad).toBe(true);
    expect(offRoad.label).toBe("Off-road");
  });
});
