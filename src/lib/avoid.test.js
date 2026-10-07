import { describe, expect, it } from "vitest";
import { createLayout } from "./layout";
import { chooseAvoidance, clearanceAhead, localObstacles, pathClear, poseBlocked, shiftPoses } from "./avoid";

const group = (language, count, side = "south") => ({
  language,
  side,
  projects: Array.from({ length: count }, (_, i) => ({ name: `${language}-${i}`, stars: 0 })),
});
const base = createLayout([group("Work", 4, "north"), group("C++", 6)], "avoid");
// A clear patch of country to put our own tree in.
const world = { ...base, trees: [], buildings: [], billboards: [] };
const EAST = -Math.PI / 2;
const z0 = 30;
const x0 = base.river.points[0][0] + 80;
const straight = Array.from({ length: 30 }, (_, k) => ({ x: x0 + k + 1, z: z0, yaw: EAST, d: k + 1 }));

describe("steering round obstacles", () => {
  it("drives straight on when nothing's in the way", () => {
    expect(chooseAvoidance(world, straight, 0, [])).toEqual({ shift: 0, blocked: null, avoided: null });
  });

  it("shifts sideways round a tree in the way, just enough to clear it", () => {
    const w = { ...world, trees: [{ x: x0 + 8, z: z0, scale: 1 }] };
    const obstacles = localObstacles(w, x0, z0);
    expect(poseBlocked(w, obstacles, straight[7])).toMatchObject({ kind: "tree" });
    const { shift, blocked } = chooseAvoidance(w, straight, 0, obstacles);
    expect(blocked).toBeNull();
    expect(Math.abs(shift)).toBeGreaterThan(1);
    expect(Math.abs(shift)).toBeLessThan(3);
    expect(shiftPoses(straight, shift).every((p) => !poseBlocked(w, obstacles, p))).toBe(true);
  });

  it("says what's in the way when there's no way round", () => {
    const wall = Array.from({ length: 13 }, (_, i) => ({ x: x0 + 8, z: z0 - 6 + i, scale: 1.2 }));
    const w = { ...world, trees: wall };
    const { blocked } = chooseAvoidance(w, straight, 0, localObstacles(w, x0, z0));
    expect(blocked).toMatchObject({ kind: "tree" });
    expect(blocked.d).toBeLessThan(9);
  });

  it("checks a straight dash across country for trees and water", () => {
    const w = { ...world, trees: [{ x: x0 + 10, z: z0, scale: 1 }] };
    expect(pathClear(w, x0, z0, x0 + 20, z0)).toBe(false);
    expect(pathClear(w, x0, z0 + 6, x0 + 20, z0 + 6)).toBe(true);
    const [rx, rz] = base.river.points[Math.floor(base.river.points.length / 3)];
    expect(pathClear(world, rx - 15, rz, rx + 15, rz)).toBe(false); // across the river
  });
});

describe("the drone flying over things", () => {
  it("climbs to clear a building in its path, not one off to the side", () => {
    const w = { ...world, buildings: [{ x: x0 + 15, z: z0, height: 20 }] };
    expect(clearanceAhead(w, x0, z0, EAST)).toBeGreaterThan(20);
    expect(clearanceAhead(w, x0, z0 + 15, EAST)).toBe(0);
    expect(clearanceAhead(w, x0, z0, -EAST)).toBe(0); // flying away from it
  });

  it("knows how high the mountains are", () => {
    expect(clearanceAhead(base, 0, base.mountains.edge - 10, Math.PI)).toBeGreaterThan(15); // heading south into them
  });
});
