import { describe, expect, it } from "vitest";
import { createLayout, HIGHWAY_HALF_WIDTH, PLAZA_RADIUS, worldDistance } from "./layout";
import { highwayJunctions, openArcs, openRuns, roundaboutJunctions } from "./junctions";

const group = (language, count, side = "south") => ({
  language,
  side,
  projects: Array.from({ length: count }, (_, i) => ({ name: `${language}-${i}`, stars: 0 })),
});
const layout = createLayout(
  [group("Work", 6, "north"), group("Learning", 4, "north"), group("Community", 2, "north"), group("C++", 10), group("Python", 5), group("HTML", 3)],
  "junctions"
);
const RING = PLAZA_RADIUS - 0.5;
const FILLET = 3;
const junctions = roundaboutJunctions(layout, { ring: RING, fillet: FILLET });

describe("roundabout junctions", () => {
  it("has a mouth for every road end at every town, with two curved kerbs each", () => {
    for (const j of junctions) {
      const roadEnds = layout.roads.filter((r) => r.from === j.cityId || r.to === j.cityId).length;
      expect(j.mouths).toHaveLength(roadEnds);
      expect(j.fillets).toHaveLength(roadEnds * 2);
    }
  });

  it("makes each kerb arc touch the road edge at one end and the ring at the other", () => {
    for (const j of junctions) {
      for (const f of j.fillets) {
        const end = f.kerb.at(-1);
        expect(worldDistance(layout, end[0], end[1], j.x, j.z)).toBeCloseTo(RING, 5);
        // The start is outside the ring, out on the road edge.
        const start = f.kerb[0];
        expect(worldDistance(layout, start[0], start[1], j.x, j.z)).toBeGreaterThan(RING);
        // Every point of the arc stays between the ring and the fillet's reach.
        for (const [x, z] of f.kerb) {
          const d = worldDistance(layout, x, z, j.x, j.z);
          expect(d).toBeGreaterThan(RING - 1e-6);
          expect(d).toBeLessThan(RING + FILLET + 4);
        }
      }
    }
  });

  it("keeps every building clear of the flared kerbs", () => {
    for (const j of junctions) {
      for (const f of j.fillets) {
        for (const [x, z] of f.area) {
          for (const b of layout.buildings) expect(worldDistance(layout, b.x, b.z, x, z)).toBeGreaterThan(2.9);
        }
      }
    }
  });

  it("opens the ring's edge line only at road mouths", () => {
    const arcs = openArcs([
      { angle: 0, halfAngle: 0.3 },
      { angle: Math.PI, halfAngle: 0.3 },
    ]);
    expect(arcs).toHaveLength(2);
    for (const [a, b] of arcs) expect(b - a).toBeCloseTo(Math.PI - 0.6);
    expect(openArcs([])).toEqual([[0, Math.PI * 2]]);
  });
});

describe("highway junctions", () => {
  const joins = highwayJunctions(layout, { fillet: 4 });

  it("flares every spur into the highway on its own side", () => {
    expect(joins).toHaveLength(layout.roads.filter((r) => r.kind === "spur").length);
    for (const j of joins) {
      expect(j.side).toBe(Math.sign(layout.cities[j.cityId].z));
      expect(j.fillets).toHaveLength(2);
      for (const f of j.fillets) {
        const [sx, sz] = f.kerb[0];
        const [ex, ez] = f.kerb.at(-1);
        // Starts on the spur's edge, ends on the highway's edge.
        expect(Math.abs(Math.abs(sx - j.x) - 3.5)).toBeLessThan(1e-6);
        expect(Math.abs(ez)).toBeCloseTo(HIGHWAY_HALF_WIDTH);
        expect(Math.abs(sz)).toBeGreaterThan(HIGHWAY_HALF_WIDTH);
        expect(ex).toBeGreaterThanOrEqual(j.from - 1e-6);
        expect(ex).toBeLessThanOrEqual(j.to + 1e-6);
      }
    }
  });

  it("leaves the highway edge line solid except at the mouths", () => {
    expect(openRuns(0, 100, [[10, 20], [50, 60]])).toEqual([[0, 10], [20, 50], [60, 100]]);
    expect(openRuns(0, 10, [])).toEqual([[0, 10]]);
  });
});
