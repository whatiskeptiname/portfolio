import { describe, expect, it } from "vitest";
import { NO_PEDALS, PEDAL_REST, cruiseThrottle, pressPedals } from "./pedals";

const DT = 1 / 60;
function hold(feet, held, deeper, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += DT) feet = pressPedals(feet, held, deeper, DT);
  return feet;
}

describe("pedals", () => {
  it("presses a pedal lightly while its key is held, and lets it off with the key", () => {
    let feet = hold(NO_PEDALS, { throttle: true }, false, 1);
    expect(feet).toEqual({ throttle: PEDAL_REST, brake: 0, handbrake: 0 });
    feet = pressPedals(feet, {}, false, DT);
    expect(feet).toEqual(NO_PEDALS);
  });

  it("goes gradually deeper while Shift is held, stays put when Shift is let go, and stops at the floor", () => {
    let feet = hold(NO_PEDALS, { throttle: true }, true, 0.4);
    expect(feet.throttle).toBeCloseTo(PEDAL_REST + 0.2, 1);
    const deeper = feet.throttle;
    feet = hold(feet, { throttle: true }, false, 1);
    expect(feet.throttle).toBe(deeper);
    feet = hold(feet, { throttle: true }, true, 5);
    expect(feet.throttle).toBe(1);
  });

  it("starts from the light touch again on the next press", () => {
    let feet = hold(NO_PEDALS, { brake: true }, true, 2);
    expect(feet.brake).toBe(1);
    feet = pressPedals(feet, {}, false, DT);
    feet = pressPedals(feet, { brake: true }, false, DT);
    expect(feet.brake).toBe(PEDAL_REST);
  });

  it("works each pedal on its own", () => {
    const feet = hold(NO_PEDALS, { throttle: true, handbrake: true }, true, 0.4);
    expect(feet.throttle).toBeGreaterThan(PEDAL_REST);
    expect(feet.handbrake).toBeGreaterThan(PEDAL_REST);
    expect(feet.brake).toBe(0);
  });
});

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
