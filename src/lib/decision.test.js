import { describe, expect, it } from "vitest";
import { cruisePoses, describeDecision, metres, planSpeeds } from "./decision";

describe("the driver panel", () => {
  it("says it's waiting at a red light, with how far", () => {
    const d = describeDecision({ speed: 0 }, { target: 0, traffic: { kind: "red", label: "Red light", cap: 0, distance: 4, room: 0.5, theirs: 0, x: 1, z: 2 } });
    expect(d.action).toBe("Waiting");
    expect(d.reason).toBe("Red light");
    expect(d.distance).toBe("4 m");
    expect(d.tone).toBe("stop");
    expect(d.focus).toMatchObject({ kind: "red", x: 1, z: 2 });
  });

  it("says it's stopping for a stopped car, following a moving one, slowing for a bend", () => {
    expect(describeDecision({ speed: 9 }, { target: 0, traffic: { kind: "car", label: "Stopped car ahead", cap: 0, distance: 9, room: 3, theirs: 0 } }).action).toBe("Stopping");
    expect(describeDecision({ speed: 7 }, { target: 7, traffic: { kind: "car", label: "Following car ahead", cap: 7, distance: 12, room: 4, theirs: 6.5 } }).action).toBe("Following");
    const bend = describeDecision({ speed: 14 }, { target: 8, route: { kind: "bend", label: "Bend ahead", distance: 20 } });
    expect([bend.action, bend.reason]).toEqual(["Slowing", "Bend ahead"]);
  });

  it("headlines overtaking, and explains why it's holding back", () => {
    expect(describeDecision({ speed: 10, overtakeNote: "Overtaking a slower car" }, { target: 12 }).action).toBe("Overtaking");
    const held = describeDecision(
      { speed: 4, overtakeNote: "Can't overtake: oncoming traffic" },
      { target: 4, traffic: { kind: "car", label: "Following car ahead", cap: 4, distance: 8, room: 2, theirs: 4 } }
    );
    expect(held.action).toBe("Following");
    expect(held.note).toBe("Can't overtake: oncoming traffic");
    expect(describeDecision({ speed: 3 }, { manual: true }).action).toBe("You're driving");
  });
});

describe("the real-time plan", () => {
  const poses = Array.from({ length: 30 }, (_, k) => ({ x: k + 1, z: 0, d: k + 1 }));
  const base = poses.map(() => 12);

  it("ends where it means to stop, slowing all the way", () => {
    const { speeds, stopAt } = planSpeeds(poses, base, { cap: 8, room: 10, theirs: 0 });
    expect(stopAt).toBe(10);
    expect(speeds).toHaveLength(10);
    for (let k = 1; k < speeds.length; k++) expect(speeds[k]).toBeLessThanOrEqual(speeds[k - 1]);
  });

  it("carries on at the car ahead's speed when following, up to its tail", () => {
    const { speeds, stopAt } = planSpeeds(poses, base, { cap: 9, room: 6, theirs: 5 });
    expect(stopAt).toBeNull();
    expect(speeds.at(-1)).toBeCloseTo(5);
    const behind = planSpeeds(poses, base, { cap: 9, room: 6, theirs: 5, other: {} });
    expect(behind.speeds.length).toBeLessThan(10);
  });

  it("cruising the equator, eases into the lane ahead", () => {
    const p = cruisePoses({ x: 0, z: 3, laneShift: 0 }, 30);
    expect(p[0].z).toBeGreaterThan(p.at(-1).z);
    expect(p.at(-1).z).toBeCloseTo(-1.9, 0);
    expect(metres(150)).toBe("150 m");
    expect(metres(1500)).toBe("1.5 km");
  });
});
