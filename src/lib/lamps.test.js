import { describe, expect, it } from "vitest";
import { HIGHWAY_HALF_WIDTH, createLayout, inRiver, roadDistance, worldDistance } from "./layout";
import { placeLamps } from "./lamps";

const group = (language, count, side = "south") => ({
  language,
  side,
  projects: Array.from({ length: count }, (_, i) => ({ name: `${language}-${i}`, stars: 0 })),
});
const layout = createLayout(
  [group("Work", 6, "north"), group("Learning", 4, "north"), group("Community", 2, "north"), group("C++", 10), group("Python", 5), group("HTML", 3)],
  "lamps",
  { billboards: [{ id: "a" }, { id: "b" }] }
);
const lamps = placeLamps(layout);

describe("street lamps", () => {
  it("lights both sides of the highway and the side roads", () => {
    expect(lamps.filter((l) => l.z < -HIGHWAY_HALF_WIDTH && l.z > -HIGHWAY_HALF_WIDTH - 2).length).toBeGreaterThan(10);
    expect(lamps.filter((l) => l.z > HIGHWAY_HALF_WIDTH && l.z < HIGHWAY_HALF_WIDTH + 2).length).toBeGreaterThan(10);
    expect(lamps.filter((l) => Math.abs(l.z) > HIGHWAY_HALF_WIDTH + 4).length).toBeGreaterThan(5);
  });

  it("stands beside roads, never on one, in the water or in a building", () => {
    for (const l of lamps) {
      const toRoad = Math.min(...layout.roads.map((r) => roadDistance(layout, l.x, l.z, r) - r.halfWidth));
      expect(toRoad).toBeGreaterThan(0.3);
      expect(toRoad).toBeLessThan(1.5);
      if (l.h < 0.5) expect(inRiver(layout, l.x, l.z)).toBe(false);
      for (const b of layout.buildings) expect(worldDistance(layout, b.x, b.z, l.x, l.z)).toBeGreaterThan(3);
      expect(Math.hypot(l.dx, l.dz)).toBeCloseTo(1);
    }
  });

  it("reaches each arm out over its road", () => {
    for (const l of lamps) {
      const near = Math.min(...layout.roads.map((r) => roadDistance(layout, l.x + l.dx * 1.5, l.z + l.dz * 1.5, r) - r.halfWidth));
      expect(near).toBeLessThan(0);
    }
  });
});
