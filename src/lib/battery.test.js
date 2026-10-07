import { describe, expect, it } from "vitest";
import { BATTERY, available, freshBattery, isLow, restVolts, stepBattery, swapBattery } from "./battery";

describe("the drone's battery", () => {
  it("sags the moment the throttle goes up, and recovers when it comes off", () => {
    const b = freshBattery();
    stepBattery(b, 0.35, 0.01);
    const hover = b.volts;
    stepBattery(b, 1, 0.01);
    expect(b.volts).toBeLessThan(hover - 1); // a big instant sag at full throttle
    stepBattery(b, 0.35, 0.01);
    expect(b.volts).toBeCloseTo(hover, 0);
  });

  it("drains continuously — faster at high throttle — and gets low within minutes", () => {
    const gentle = freshBattery();
    const hard = freshBattery();
    for (let t = 0; t < 60; t += 0.1) {
      stepBattery(gentle, 0.35, 0.1);
      stepBattery(hard, 0.8, 0.1);
    }
    expect(hard.charge).toBeLessThan(gentle.charge);
    expect(gentle.charge).toBeLessThan(1);
    const b = freshBattery();
    let t = 0;
    while (!isLow(b) && t < 1200) {
      stepBattery(b, 0.45, 0.5);
      t += 0.5;
    }
    expect(t).toBeGreaterThan(60);
    expect(t).toBeLessThan(600);
  });

  it("loses power when nearly flat, and a swap restores it", () => {
    const b = freshBattery();
    b.charge = BATTERY.empty;
    expect(available(b)).toBeLessThan(0.5);
    expect(restVolts(0.02)).toBeLessThan(13);
    swapBattery(b);
    expect(b.charge).toBe(1);
    expect(available(b)).toBe(1);
    expect(b.swaps).toBe(1);
  });
});
