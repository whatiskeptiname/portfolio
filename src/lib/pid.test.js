import { describe, expect, it } from "vitest";
import { pid, pidReset, pidStep } from "./pid";

// A first-order plant with a constant disturbance (drag): v' = 8·u − 0.5·v − 1.
function simulate(c, setpoint, seconds, dt = 1 / 60) {
  let v = 0;
  let maxOver = 0;
  for (let t = 0; t < seconds; t += dt) {
    const u = pidStep(c, setpoint, v, dt);
    v += (8 * u - 0.5 * v - 1) * dt;
    maxOver = Math.max(maxOver, v - setpoint);
  }
  return { v, maxOver };
}

describe("PID", () => {
  it("a proportional-only controller leaves a steady error; the integral removes it", () => {
    const p = simulate(pid({ kp: 0.3, min: -1, max: 1 }), 10, 30);
    const pi = simulate(pid({ kp: 0.3, ki: 0.15, min: -1, max: 1, iMax: 10 }), 10, 30);
    expect(Math.abs(p.v - 10)).toBeGreaterThan(0.5);
    expect(Math.abs(pi.v - 10)).toBeLessThan(0.1);
  });

  it("doesn't wind up while saturated, so it doesn't overshoot wildly", () => {
    const r = simulate(pid({ kp: 0.3, ki: 0.4, min: 0, max: 1, iMax: 50 }), 14, 40);
    expect(r.maxOver).toBeLessThan(2);
  });

  it("damps with the derivative, and can be reset", () => {
    const c = pid({ kp: 1, kd: 0.5 });
    pidStep(c, 1, 0, 0.1);
    expect(pidStep(c, 1, 0.5, 0.1)).toBeLessThan(0.5); // rising fast: the D term holds back
    pidReset(c);
    expect(c.i).toBe(0);
    expect(c.last).toBeNull();
  });
});

import { controllers } from "./pid";

describe("controller sets on a vehicle", () => {
  it("keeps the car's and the drone's apart (one vehicle state, both forms)", () => {
    const s = {};
    const car = controllers(s, "car", () => ({ speed: pid() }));
    const drone = controllers(s, "drone", () => ({ climb: pid() }));
    expect(car).not.toBe(drone);
    expect(drone.climb).toBeDefined();
    expect(controllers(s, "car", () => ({}))).toBe(car); // kept between frames
  });
});
