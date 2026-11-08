import { describe, expect, it } from "vitest";
import { cruiseThrottle } from "./pedals";

describe("cruise control", () => {
  it("presses harder the further below the set speed, and holds steady at it", () => {
    expect(cruiseThrottle(10, 22)).toEqual({ up: true, throttle: 1 });
    const near = cruiseThrottle(21.5, 22);
    expect(near.up).toBe(true);
    expect(near.throttle).toBeGreaterThan(0);
    expect(near.throttle).toBeLessThan(0.5);
    expect(cruiseThrottle(22.5, 22)).toEqual({ up: true, throttle: 0 });
  });

  it("lifts off when well over, so the car slows back to it", () => {
    expect(cruiseThrottle(26, 22).up).toBe(false);
  });
});
