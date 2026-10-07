import { describe, expect, it } from "vitest";
import { HOVER, QUAD, bodyVelocity, flightController, keysToSticks, stepQuad } from "./quad";

const quad = (over = {}) => ({ x: 0, z: 0, yaw: -Math.PI / 2, alt: 10, vx: 0, vz: 0, vy: 0, ...over });
const fly = (s, sticksFor, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) {
    const [dx, dz] = stepQuad(s, typeof sticksFor === "function" ? sticksFor(s) : sticksFor, dt);
    s.x += dx;
    s.z += dz;
  }
  return s;
};

describe("quadcopter physics", () => {
  it("hovers at the hover throttle, climbs above it, sinks below", () => {
    expect(fly(quad(), { throttle: HOVER }, 3).alt).toBeCloseTo(10, 0);
    expect(fly(quad(), { throttle: 0.7 }, 2).alt).toBeGreaterThan(14);
    expect(fly(quad(), { throttle: 0.2 }, 1.5).alt).toBeLessThan(7);
  });

  it("flies forward by pitching, sideways by rolling, and turns by yawing", () => {
    const fwd = fly(quad(), { throttle: HOVER / Math.cos(QUAD.maxTilt * 0.5), pitch: 0.5 }, 3);
    expect(fwd.x).toBeGreaterThan(10); // east, the way it faces
    expect(Math.abs(fwd.z)).toBeLessThan(1);
    const side = fly(quad(), { throttle: HOVER / Math.cos(QUAD.maxTilt * 0.5), roll: 0.5 }, 3);
    expect(side.z).toBeGreaterThan(10); // right of east is south (+z)
    const turn = fly(quad(), { throttle: HOVER, yaw: 1 }, 1);
    expect(turn.yaw).toBeCloseTo(-Math.PI / 2 + QUAD.yawRate, 1);
  });

  it("can't fly through the ground", () => {
    const s = fly(quad({ alt: 2 }), { throttle: 0 }, 3);
    expect(s.alt).toBe(0);
  });
});

describe("the flight controller", () => {
  it("holds a speed and a height, and turns with a banked, slip-free turn", () => {
    const s = fly(quad({ alt: 4 }), (q) => flightController(q, { speed: 15, steer: 0, alt: 12 }), 10);
    expect(Math.abs(s.alt - 12)).toBeLessThan(1);
    expect(Math.abs(bodyVelocity(s).forward - 15)).toBeLessThan(1.5);
    // Into a turn: banked the right way, little sideslip.
    let roll = 0;
    fly(s, (q) => {
      const st = flightController(q, { speed: 15, steer: 0.5, alt: 12 });
      roll = q.qroll;
      return st;
    }, 3);
    expect(roll).toBeLessThan(-0.1); // turning left: banked left
    expect(Math.abs(bodyVelocity(s).right)).toBeLessThan(2);
    expect(Math.abs(s.alt - 12)).toBeLessThan(1.5);
  });

  it("comes to a hover when asked to stop", () => {
    const s = fly(quad({ vx: 20 }), (q) => flightController(q, { speed: 0, alt: 10 }), 6);
    expect(Math.hypot(s.vx, s.vz)).toBeLessThan(1);
  });
});

describe("manual (mode 2) keys", () => {
  it("throttle stays where you leave it; the right stick springs back", () => {
    const s = quad();
    keysToSticks(s, new Set(["up"]), 1);
    const held = keysToSticks(s, new Set(), 0.1);
    expect(held.throttle).toBeGreaterThan(HOVER + 0.3);
    expect(keysToSticks(s, new Set(["arrowUp", "arrowLeft"]), 0.1)).toMatchObject({ pitch: 1, roll: -1 });
    expect(keysToSticks(s, new Set(), 0.1)).toMatchObject({ pitch: 0, roll: 0 });
  });
});
