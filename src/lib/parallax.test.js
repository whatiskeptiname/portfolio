import { describe, expect, it } from "vitest";
import { restingOffset, rubber, settled, springStep } from "./parallax";

describe("the background's motion", () => {
  it("rests in step with how far down the page you are", () => {
    expect(restingOffset(0, 1000, 90)).toBe(0);
    expect(restingOffset(500, 1000, 90)).toBe(45);
    expect(restingOffset(1000, 1000, 90)).toBe(90);
    // Overscroll (negative or past the end) doesn't move the resting point.
    expect(restingOffset(-40, 1000, 90)).toBe(0);
    expect(restingOffset(1200, 1000, 90)).toBe(90);
    expect(restingOffset(10, 0, 90)).toBe(0);
  });

  it("the spring overshoots a little, then settles on the target", () => {
    let s = { pos: 0, vel: 0 };
    let peak = 0;
    for (let i = 0; i < 300; i++) {
      s = springStep(s, 100, 16);
      peak = Math.max(peak, s.pos);
    }
    expect(peak).toBeGreaterThan(100); // the bounce
    expect(peak).toBeLessThan(130); // but a soft one
    expect(settled(s, 100)).toBe(true);
  });

  it("gives the same motion at 30 and 120 frames a second", () => {
    let a = { pos: 0, vel: 0 };
    let b = { pos: 0, vel: 0 };
    for (let i = 0; i < 30; i++) a = springStep(a, 100, 1000 / 30);
    for (let i = 0; i < 120; i++) b = springStep(b, 100, 1000 / 120);
    expect(a.pos).toBeCloseTo(b.pos, 0);
  });

  it("stretches easily at first and never past its limit", () => {
    expect(rubber(0, 50)).toBe(0);
    expect(rubber(10, 50)).toBeGreaterThan(7);
    expect(rubber(10000, 50)).toBeLessThan(50);
    expect(rubber(-10000, 50)).toBeGreaterThan(-50);
    expect(rubber(30, 0)).toBe(0);
  });
});
