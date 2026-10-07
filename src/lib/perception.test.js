import { describe, expect, it } from "vitest";
import { canSee, perceive, VIEW } from "./perception";

const EAST = -Math.PI / 2;
const me = { x: 0, z: 0, yaw: EAST };
const W = 1000;

describe("what the driver sees", () => {
  it("looks all round, out to its view distance", () => {
    expect(canSee(me, 40, 0, W)).toBe(true); // ahead
    expect(canSee(me, -40, 0, W)).toBe(true); // behind
    expect(canSee(me, 0, 40, W)).toBe(true); // to the side
    expect(canSee(me, VIEW.range + 5, 0, W)).toBe(false); // too far
    expect(canSee(me, VIEW.range + 5, 0, W, VIEW.range + 20)).toBe(true); // a longer view distance
  });

  it("can't see through a building or another car", () => {
    const wall = [{ x: 20, z: 0, r: 2.5 }];
    expect(canSee(me, 40, 0, W, 60, wall)).toBe(false); // hidden behind it
    expect(canSee(me, 40, 10, W, 60, wall)).toBe(true); // off to one side of it
    expect(canSee(me, 15, 0, W, 60, wall)).toBe(true); // in front of it
  });

  it("filters the world down to what's in sight", () => {
    const front = { x: 10, z: 0, yaw: EAST };
    const hidden = { x: 40, z: 0, yaw: EAST }; // far off, right behind `front`
    const aside = { x: 40, z: 12, yaw: EAST };
    const seen = perceive(me, {
      others: [front, hidden, aside, { x: 200, z: 0, yaw: 0 }],
      // Lights stand high: the car in front doesn't hide one, a building does.
      signals: [{ id: 0, approaches: [{ x: 30, z: 0.2 }, { x: 0, z: 45 }] }],
      buildings: [{ x: 0, z: 30 }],
      towns: [{ x: 0, z: 200, radius: 10 }],
      width: W,
    });
    expect(seen.others).toEqual([front, aside]);
    // Right next to it, it notices a car even if another one blocks the view.
    const tucked = { x: 6, z: 2.5, yaw: EAST };
    expect(perceive(me, { others: [{ x: 3, z: 1.2, yaw: EAST }, tucked], width: W }).others).toContain(tucked);
    expect(seen.signals[0].approaches).toEqual([{ x: 30, z: 0.2 }]); // the one behind the building is hidden
    expect(seen.towns).toHaveLength(0);
    expect(perceive({ ...me, viewRange: 300 }, { towns: [{ x: 0, z: 200, radius: 10 }], width: W }).towns).toHaveLength(1);
    expect(perceive({ ...me, viewRange: 20 }, { others: [front, aside], width: W }).others).toEqual([front]);
    // Close by, you see past the car in front (over it, between cars)…
    expect(perceive(me, { others: [front, { x: 20, z: 0, yaw: EAST }], width: W }).others).toHaveLength(2);
  });
});

import { visibleArea } from "./perception";

describe("noticing obstacles, and the area it can see", () => {
  it("notices the trees, buildings and billboards around it, but not ones hidden behind a building", () => {
    const seen = perceive(me, {
      trees: [{ x: 10, z: 3, scale: 1 }, { x: 0, z: 40, scale: 1 }],
      buildings: [{ x: 0, z: 25, height: 10, rotation: 0 }],
      billboards: [{ x: -12, z: -4, rotation: 0 }],
      width: W,
    });
    const kinds = seen.obstacles.map((o) => o.kind).sort();
    expect(kinds).toEqual(["billboard", "building", "tree"]); // the tree behind the building is hidden
  });

  it("maps how far it can see in every direction, cut short by whatever's in the way", () => {
    const reach = visibleArea(me, [{ x: 20, z: 0, r: 2 }], W, 60, 8); // a blocker straight ahead (east)
    expect(reach[0]).toBeCloseTo(18, 0); // ahead: stopped at the blocker
    expect(reach[4]).toBe(60); // behind: clear to the view distance
  });
});

describe("over the rise of the ground", () => {
  const hill = (x) => (x > 30 && x < 40 ? 3 : 0); // a ridge across the way ahead
  const ground = (x) => hill(x);
  it("can't see a car beyond a crest, but can see a tall light over it", () => {
    expect(canSee(me, 60, 0, W, 150, [], { ground, eye: 1.2, top: 1.4 })).toBe(false);
    expect(canSee(me, 20, 0, W, 150, [], { ground, eye: 1.2, top: 1.4 })).toBe(true);
    expect(canSee(me, 60, 0, W, 150, [], { ground, eye: 1.2, top: 12 })).toBe(true);
  });

  it("stops the eye-level view where the ground rises to meet it", () => {
    const reach = visibleArea(me, [], W, 150, 8, ground, 1.2);
    expect(reach[0]).toBeGreaterThan(29);
    expect(reach[0]).toBeLessThan(32); // ahead: up against the ridge
    expect(reach[4]).toBe(150); // behind: all the way
  });

  it("sees between 10 m and 500 m", () => {
    expect(VIEW.min).toBe(10);
    expect(VIEW.max).toBe(500);
  });
});

import { DRONE_VIEW } from "./perception";

describe("the drone's camera cone", () => {
  it("sees ahead within the cone and close by all round, nothing else", () => {
    const others = [
      { x: 40, z: 5, yaw: 0 }, // ahead, inside the cone
      { x: 20, z: 40, yaw: 0 }, // off to the side
      { x: -30, z: 0, yaw: 0 }, // behind
      { x: -1.5, z: 1.2, yaw: 0 }, // right beside it
    ];
    const seen = perceive(me, { others, width: W, cone: DRONE_VIEW }).others;
    expect(seen).toEqual([others[0], others[3]]);
  });
});
