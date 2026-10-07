import { describe, expect, it } from "vitest";
import { createLayout, HIGHWAY_HALF_WIDTH, roadDistance, worldDistance } from "./layout";
import { placeStreetSigns } from "./signs";

const group = (language, count, side = "south") => ({
  language,
  side,
  projects: Array.from({ length: count }, (_, i) => ({ name: `${language}-${i}`, stars: 0 })),
});
const layout = createLayout(
  [group("Work", 6, "north"), group("Learning", 4, "north"), group("Community", 2, "north"), group("C++", 10), group("Python", 5), group("HTML", 3)],
  "signs",
  { billboards: [{ id: "a" }, { id: "b" }] }
);
const signs = placeStreetSigns(layout);
const byKind = (k) => signs.filter((s) => s.kind === k);

describe("street signs", () => {
  it("puts exit signs before district turn-offs, in both directions", () => {
    const exits = byKind("exit");
    expect(exits.length).toBeGreaterThanOrEqual(layout.cities.length); // some may be dropped near the river
    for (const e of exits) {
      expect(Math.abs(e.z)).toBeCloseTo(HIGHWAY_HALF_WIDTH + 1.4);
      expect(["↖", "↗"]).toContain(e.arrow);
    }
    // Traffic keeps left: eastbound signs (yaw -π/2) stand on the north (left-hand) side.
    for (const e of exits.filter((e) => Math.abs(e.yaw + Math.PI / 2) < 1e-6)) expect(e.z).toBeLessThan(0);
  });

  it("posts speed limits on the highway and the turn-offs", () => {
    const speeds = byKind("speed");
    expect(speeds.some((s) => s.text === "150")).toBe(true);
    expect(speeds.some((s) => s.text === "90")).toBe(true);
  });

  it("numbers the equator with route shields", () => {
    const shields = byKind("shield");
    expect(shields.length).toBeGreaterThan(4);
    expect(shields.every((s) => /^\d+°[EW]?$/.test(s.text))).toBe(true);
  });

  it("guides lane traffic to the next district with a distance", () => {
    const guides = byKind("guide");
    expect(guides.length).toBeGreaterThan(0);
    for (const g of guides) {
      expect(layout.cities.map((c) => c.language)).toContain(g.text);
      expect(g.sub).toMatch(/\d+(\.\d)? (m|km)/);
    }
  });

  it("stands every sign just off its road, never on it or in a building", () => {
    for (const s of signs) {
      const toRoad = Math.min(...layout.roads.map((r) => roadDistance(layout, s.x, s.z, r) - r.halfWidth));
      expect(toRoad).toBeGreaterThan(0.5);
      expect(toRoad).toBeLessThan(2.5);
      for (const b of layout.buildings) expect(worldDistance(layout, b.x, b.z, s.x, s.z)).toBeGreaterThan(4);
    }
  });
});
