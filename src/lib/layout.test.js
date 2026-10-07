import { describe, expect, it } from "vitest";
import {
  BUILDING_RADIUS,
  PLAZA_RADIUS,
  ROUNDABOUT_ISLAND,
  BRIDGE_HEIGHT,
  bridgeElevation,
  collides,
  MOUNTAIN_HEIGHT,
  distanceToSegment,
  createLayout,
  createRng,
  inRiver,
  onIsland,
  HIGHWAY_HALF_WIDTH,
  pointAlong,
  riverDistance,
  surfaceAt,
  roadDistance,
  worldDistance,
  wrapDelta,
} from "./layout";

const group = (language, count, { stars = 0, side = "south" } = {}) => ({
  language,
  side,
  projects: Array.from({ length: count }, (_, i) => ({ name: `${language}-${i}`, stars })),
});

const sample = [
  group("Work", 6, { side: "north", stars: 20 }),
  group("Learning", 4, { side: "north" }),
  group("Community", 2, { side: "north" }),
  group("C++", 14),
  group("Jupyter Notebook", 6, { stars: 2 }),
  group("Python", 5),
  group("HTML", 3),
  group("JavaScript", 5),
  group("C", 1, { stars: 3 }),
  group("Other", 1),
];
const total = sample.reduce((s, g) => s + g.projects.length, 0);

describe("createRng", () => {
  it("is deterministic per seed", () => {
    const a = createRng("x");
    const b = createRng("x");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(createRng("y")()).not.toBe(createRng("x")());
  });
});

it("wraps x differences the short way round", () => {
  expect(wrapDelta(90, 100)).toBe(-10);
  expect(wrapDelta(-60, 100)).toBe(40);
  expect(wrapDelta(20, 100)).toBe(20);
});

describe("createLayout", () => {
  const layout = createLayout(sample, "seed");
  const onAnyRoad = (x, z) => layout.roads.some((r) => roadDistance(layout, x, z, r, r.halfWidth) !== Infinity);

  it("is deterministic", () => {
    expect(createLayout(sample, "seed")).toEqual(layout);
  });

  it("puts north groups in the northern hemisphere and the rest in the south", () => {
    for (const c of layout.cities) {
      expect(c.side === "north" ? c.z < 0 : c.z > 0).toBe(true);
      expect(Math.abs(c.x)).toBeLessThanOrEqual(layout.bounds.halfX);
    }
  });

  it("wraps the world around a sphere: width is the equator", () => {
    expect(layout.width).toBeCloseTo(2 * Math.PI * layout.radius);
    expect(layout.bounds.halfZ / layout.radius).toBeLessThan(Math.PI / 2);
  });

  it("runs a highway right round the equator", () => {
    const highway = layout.roads.filter((r) => r.kind === "highway");
    expect(highway).toHaveLength(1);
    expect(highway[0].points.every(([, z]) => z === 0)).toBe(true);
    expect(highway[0].length).toBeCloseTo(layout.width);
  });

  it("gives every district a winding spur that reaches the highway", () => {
    for (const c of layout.cities) {
      const spur = layout.roads.find((r) => r.kind === "spur" && r.from === c.id);
      expect(spur).toBeDefined();
      expect(spur.points.at(-1)[1]).toBe(0);
      expect(worldDistance(layout, spur.points[0][0], spur.points[0][1], c.x, c.z)).toBeLessThan(c.radius);
      // Not a straight line: it bends visibly away from the chord between its ends.
      const [a, b] = [spur.points[0], spur.points.at(-1)];
      const bend = Math.max(...spur.points.map(([x, z]) => distanceToSegment(x, z, a[0], a[1], b[0], b[1])));
      expect(bend).toBeGreaterThan(1);
    }
  });

  it("brings every road into its town's roundabout straight on (radially)", () => {
    const radialError = (road, atStart, city) => {
      const pts = road.points;
      const [x0, z0] = atStart ? pts[0] : pts.at(-1);
      const [x1, z1] = atStart ? pts[2] : pts.at(-3);
      const out = [x1 - x0, z1 - z0];
      const radial = [wrapDelta(x0 - city.x, layout.width), z0 - city.z];
      const cos = (out[0] * radial[0] + out[1] * radial[1]) / (Math.hypot(...out) * Math.hypot(...radial));
      return Math.acos(Math.min(1, cos));
    };
    for (const road of layout.roads.filter((r) => r.kind !== "highway")) {
      expect(radialError(road, true, layout.cities[road.from])).toBeLessThan(0.15);
      if (road.kind === "lane") expect(radialError(road, false, layout.cities[road.to])).toBeLessThan(0.15);
      // …and starts under the roundabout's asphalt ring.
      const c = layout.cities[road.from];
      const d = worldDistance(layout, road.points[0][0], road.points[0][1], c.x, c.z);
      expect(d).toBeGreaterThan(ROUNDABOUT_ISLAND);
      expect(d).toBeLessThan(PLAZA_RADIUS - 0.5);
    }
    // Spurs meet the highway square on.
    for (const spur of layout.roads.filter((r) => r.kind === "spur")) {
      const [xa, za] = spur.points.at(-3);
      const [xb, zb] = spur.points.at(-1);
      expect(Math.abs(xb - xa)).toBeLessThan(Math.abs(zb - za) * 0.15);
    }
  });

  it("links neighbouring districts with lanes that stay in their hemisphere", () => {
    const lanes = layout.roads.filter((r) => r.kind === "lane");
    expect(lanes.length).toBeGreaterThan(0);
    for (const lane of lanes) {
      const side = layout.cities[lane.from].side;
      expect(lane.points.every(([, z]) => (side === "north" ? z < 0 : z > 0))).toBe(true);
    }
  });

  it("runs a river from a waterfall in the southern mountains straight into the northern sea, clear of every district", () => {
    const { river, sea, mountains } = layout;
    expect(river.lakes).toBeUndefined(); // no ponds: it leaps off the mountains
    expect(river.source.z).toBeGreaterThan(mountains.edge);
    expect(river.source.height).toBeGreaterThan(0);
    const [fx, fz] = river.points[0];
    expect(fx).toBeCloseTo(river.source.x);
    expect(fz).toBeCloseTo(river.source.z);
    // Flow order, ending out in the sea.
    expect(river.points.at(-1)[1]).toBeLessThan(-sea.shore);
    expect(river.points.every(([, z], i) => i === 0 || z < river.points[i - 1][1])).toBe(true);
    for (const [i, [x, z]] of river.points.entries()) {
      for (const c of layout.cities) expect(worldDistance(layout, c.x, c.z, x, z)).toBeGreaterThan(c.radius + river.widths[i]);
    }
  });

  it("keeps the sea small, round the north pole, with islands in it", () => {
    const { sea, bounds, mountains } = layout;
    const pole = (Math.PI / 2) * layout.radius;
    expect(sea.shore).toBeGreaterThan(bounds.halfZ);
    expect(pole - sea.shore).toBeLessThan((pole - bounds.halfZ) * 0.7);
    expect(mountains.edge).toBeGreaterThan(bounds.halfZ);
    expect(inRiver(layout, 0, -pole + 1) || onIsland(layout, 0, -pole + 1)).toBe(true);
    expect(collides(layout, 3, -(sea.shore + 1), 1.3) || onIsland(layout, 3, -(sea.shore + 1))).toBe(true);
    expect(sea.islands.length).toBeGreaterThan(0);
    for (const i of sea.islands) {
      expect(i.z).toBeLessThan(-sea.shore);
      expect(onIsland(layout, i.x, i.z)).toBe(true);
      expect(inRiver(layout, i.x, i.z)).toBe(false);
    }
  });

  it("raises small mountains round the south pole that only a high drone can cross", () => {
    const z = layout.mountains.edge + 2;
    expect(collides(layout, 0, z, 1.3)).toBe(true);
    expect(collides(layout, 0, z, 1.3, MOUNTAIN_HEIGHT + 1)).toBe(false);
    expect(MOUNTAIN_HEIGHT).toBeLessThan(20);
  });

  it("runs each spur dead straight into the highway", () => {
    for (const spur of layout.roads.filter((r) => r.kind === "spur")) {
      const end = spur.points.at(-1);
      expect(end[1]).toBeCloseTo(0);
      const tail = spur.points.filter(([, z]) => Math.abs(z) <= HIGHWAY_HALF_WIDTH + 8 + 1e-6);
      for (const [x] of tail) expect(x).toBeCloseTo(end[0]);
    }
  });

  it("arches bridge decks over the water and keeps other roads on the ground", () => {
    for (const b of layout.bridges) {
      expect(bridgeElevation(layout, b.x, b.z)).toBeGreaterThan(BRIDGE_HEIGHT * 0.9);
    }
    expect(bridgeElevation(layout, layout.cities[0].x, layout.cities[0].z)).toBe(0);
  });

  it("knows the surface underfoot", () => {
    expect(surfaceAt(layout, 10, 0)).toBe("highway");
    const spur = layout.roads.find((r) => r.kind === "spur");
    const mid = spur.points[Math.floor(spur.points.length / 2)];
    expect(surfaceAt(layout, mid[0], mid[1])).toBe("road");
    const city = layout.cities[0];
    expect(surfaceAt(layout, city.x, city.z)).toBe("road"); // the roundabout
    const b = layout.buildings[0];
    // Right next to a building, inside its district: paved.
    expect(surfaceAt(layout, b.x + 2.5, b.z)).toMatch(/paved|road/);
    expect(surfaceAt(layout, layout.river.points[5][0] + 14, layout.river.points[5][1])).toMatch(/grass|road/);
  });

  it("measures distance to the river", () => {
    const [x, z] = layout.river.points[10];
    expect(riverDistance(layout, x, z)).toBeCloseTo(0);
    expect(riverDistance(layout, x + 50, z, 20)).toBe(Infinity);
  });

  it("bridges every road–river crossing, including the highway", () => {
    expect(layout.bridges.length).toBeGreaterThan(0);
    const highwayBridge = layout.bridges.find((b) => layout.roads[b.roadId].kind === "highway");
    expect(highwayBridge).toBeDefined();
    expect(highwayBridge.z).toBeCloseTo(0);
  });

  it("places one building per project, apart, off roads and out of the river", () => {
    expect(layout.buildings).toHaveLength(total);
    expect(new Set(layout.buildings.map((b) => b.id)).size).toBe(total);
    for (const [i, a] of layout.buildings.entries()) {
      for (const r of layout.roads) expect(roadDistance(layout, a.x, a.z, r, r.halfWidth + BUILDING_RADIUS)).toBe(Infinity);
      expect(inRiver(layout, a.x, a.z, BUILDING_RADIUS)).toBe(false);
      for (const b of layout.buildings.slice(i + 1)) {
        expect(worldDistance(layout, a.x, a.z, b.x, b.z)).toBeGreaterThan(BUILDING_RADIUS * 2);
      }
    }
  });

  it("doesn't let districts overlap, even across the seam", () => {
    for (const [i, a] of layout.cities.entries()) {
      for (const b of layout.cities.slice(i + 1)) {
        expect(worldDistance(layout, a.x, a.z, b.x, b.z)).toBeGreaterThan(a.radius + b.radius);
      }
    }
  });

  it("spawns on a road in the northern (résumé) hemisphere, somewhere free", () => {
    expect(layout.spawn.z).toBeLessThan(0);
    expect(onAnyRoad(layout.spawn.x, layout.spawn.z)).toBe(true);
    expect(collides(layout, layout.spawn.x, layout.spawn.z, 1.3)).toBe(false);
  });

  it("blocks the river except on bridges, unless flying", () => {
    const bridge = layout.bridges[0];
    expect(collides(layout, bridge.x, bridge.z, 1.3)).toBe(false);
    // A point in the river away from any road:
    const wet = layout.river.points.find(([x, z]) => Math.abs(z) < layout.bounds.halfZ && !onAnyRoad(x, z) && layout.bridges.every((b) => worldDistance(layout, b.x, b.z, x, z) > 15));
    expect(collides(layout, wet[0], wet[1], 1.3)).toBe(true);
    expect(collides(layout, wet[0], wet[1], 1.3, 10)).toBe(false);
  });

  it("lets a high enough drone pass over buildings", () => {
    const b = layout.buildings[0];
    expect(collides(layout, b.x, b.z, 0.5)).toBe(true);
    expect(collides(layout, b.x, b.z, 0.5, b.height + 2)).toBe(false);
  });

  it("places billboards beside roads, clear of districts, the river and each other", () => {
    const boards = Array.from({ length: 9 }, (_, i) => ({ id: `b${i}` }));
    const withBoards = createLayout(sample, "seed", { billboards: boards });
    expect(withBoards.billboards).toHaveLength(9);
    for (const b of withBoards.billboards) {
      const toRoad = Math.min(...withBoards.roads.map((r) => roadDistance(withBoards, b.x, b.z, r) - r.halfWidth));
      expect(toRoad).toBeGreaterThan(0);
      expect(toRoad).toBeLessThan(4);
      expect(collides(withBoards, b.x, b.z, 0.1)).toBe(true); // solid
      expect(inRiver(withBoards, b.x, b.z, 1)).toBe(false);
      for (const c of withBoards.cities) expect(worldDistance(withBoards, c.x, c.z, b.x, b.z)).toBeGreaterThan(c.radius);
    }
  });

  it("uses weight for building height when given", () => {
    const l = createLayout([{ language: "Career", projects: [{ name: "a", stars: 0, weight: 40 }, { name: "b", stars: 0 }] }]);
    const [a, b] = l.buildings;
    expect(a.height).toBeGreaterThan(b.height + 15);
  });

  it("grows the planet when a ring gets crowded", () => {
    const crowded = createLayout(Array.from({ length: 24 }, (_, i) => group(`L${i}`, 4)), "s");
    expect(crowded.radius).toBeGreaterThan(layout.radius);
    for (const [i, a] of crowded.cities.entries()) {
      for (const b of crowded.cities.slice(i + 1)) {
        expect(worldDistance(crowded, a.x, a.z, b.x, b.z)).toBeGreaterThan(a.radius + b.radius);
      }
    }
  });

  it("finds points along a road with a heading", () => {
    const road = { points: [[0, 0], [0, -10]], length: 10 };
    const p = pointAlong(road, 0.5);
    expect(p.z).toBeCloseTo(-5);
    expect(p.yaw).toBeCloseTo(0); // heading north = -z = yaw 0
  });

  it("handles a single group and no groups", () => {
    expect(createLayout([group("Go", 2)]).buildings).toHaveLength(2);
    expect(createLayout([]).cities).toHaveLength(0);
  });
});
