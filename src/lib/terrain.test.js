import { describe, expect, it } from "vitest";
import { createLayout } from "./layout";
import { TERRAIN_AMPLITUDE, terrainAt } from "./terrain";

const group = (language, count, side = "south") => ({
  language,
  side,
  projects: Array.from({ length: count }, (_, i) => ({ name: `${language}-${i}`, stars: 0 })),
});
const layout = createLayout(
  [group("Work", 6, "north"), group("Learning", 4, "north"), group("C++", 10), group("Python", 5), group("HTML", 3)],
  "terrain",
  { billboards: [{ id: "a" }] }
);

describe("terrain", () => {
  it("rolls into small hills and hollows out in the country", () => {
    let lo = 0;
    let hi = 0;
    for (let x = -layout.width / 2; x < layout.width / 2; x += 3) {
      for (let z = -layout.bounds.halfZ; z < layout.bounds.halfZ; z += 3) {
        const h = terrainAt(layout, x, z);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
    }
    expect(hi).toBeGreaterThan(0.5);
    expect(lo).toBeLessThan(-0.5);
    expect(Math.max(hi, -lo)).toBeLessThan(TERRAIN_AMPLITUDE * 2);
  });

  it("keeps towns level, and gives roads and the river only gentle swells — no sharp bumps", () => {
    for (const c of layout.cities) expect(terrainAt(layout, c.x, c.z)).toBe(0);
    for (const b of layout.buildings) expect(Math.abs(terrainAt(layout, b.x, b.z))).toBeLessThan(0.02);
    let rises = 0;
    for (const line of [...layout.roads, layout.river]) {
      const pts = line.points;
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1];
        const [bx, bz] = pts[i];
        const len = Math.hypot(bx - ax, bz - az);
        // Grade along the road stays gentle…
        expect(Math.abs(terrainAt(layout, bx, bz) - terrainAt(layout, ax, az)) / len).toBeLessThan(0.08);
        // …and the ground is level across it (no camber from hills).
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        const w = (line.halfWidth ?? 3) * 0.9;
        expect(Math.abs(terrainAt(layout, bx + nx * w, bz + nz * w) - terrainAt(layout, bx - nx * w, bz - nz * w))).toBeLessThan(0.35);
        rises = Math.max(rises, Math.abs(terrainAt(layout, bx, bz)));
      }
    }
    expect(rises).toBeGreaterThan(0.4); // the highway and roads do rise and dip
    expect(terrainAt(layout, 10, layout.bounds.halfZ + 5)).toBe(0);
  });

  it("is smooth and wraps seamlessly round the planet", () => {
    const z = layout.bounds.halfZ * 0.8;
    const w = layout.width;
    expect(terrainAt(layout, w / 2 - 0.01, z)).toBeCloseTo(terrainAt(layout, -w / 2 + 0.01, z), 1);
    for (let x = 0; x < 200; x += 0.5) expect(Math.abs(terrainAt(layout, x + 0.5, z) - terrainAt(layout, x, z))).toBeLessThan(0.4);
  });
});
