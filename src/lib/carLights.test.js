import { describe, expect, it } from "vitest";
import { BLINK_HZ, carLamps } from "./carLights";

const base = { steer: 0, speed: 10, shift: 0, braking: false, reversing: false, night: false, dt: 1 / 60 };
// Runs `seconds` of frames from time `from`, returning the last lamps and every frame's.
function drive(car, input, seconds, from = 0) {
  const frames = [];
  for (let t = from; t < from + seconds; t += 1 / 60) frames.push(carLamps(car, { ...base, ...input, t }));
  return frames;
}

describe("car lights", () => {
  it("runs dim headlights by day and full ones at night, with tail lights only at night", () => {
    expect(carLamps({}, { ...base, t: 0 })).toMatchObject({ head: 0.25, tail: 0.03, brake: 0 });
    expect(carLamps({}, { ...base, night: true, t: 0 })).toMatchObject({ head: 1, tail: 0.12 });
  });

  it("lights the brake lights only while braking, and the reverse lights only in reverse", () => {
    expect(carLamps({}, { ...base, braking: true, t: 0 })).toMatchObject({ tail: 1, brake: 1, reverse: 0 });
    expect(carLamps({}, { ...base, reversing: true, t: 0 })).toMatchObject({ brake: 0, reverse: 1 });
  });

  it("blinks the indicator on the side of a lane change, and stops a moment after", () => {
    const car = {};
    // Shifting right at 1 m/s for a second.
    const during = drive(car, { shift: 0 }, 0.1).concat(
      Array.from({ length: 60 }, (_, i) => carLamps(car, { ...base, shift: (i + 1) / 60, t: 0.1 + (i + 1) / 60 }))
    );
    expect(during.some((l) => l.right)).toBe(true);
    expect(during.some((l) => l.left)).toBe(false);
    // It blinks rather than staying on.
    expect(during.some((l) => !l.right)).toBe(true);
    // Held steady afterwards: it goes off after the hold.
    const after = drive(car, { shift: 1 }, 3, 1.2);
    expect(after.at(-1).right).toBe(0);
  });

  it("signals the way it's turning, and flashes about 1.5 times a second", () => {
    const frames = drive({}, { steer: 0.6 }, 3); // steering left
    expect(frames.some((l) => l.left)).toBe(true);
    expect(frames.some((l) => l.right)).toBe(false);
    let ons = 0;
    for (let i = 1; i < frames.length; i++) if (frames[i].left && !frames[i - 1].left) ons++;
    expect(ons).toBeGreaterThanOrEqual(Math.floor(BLINK_HZ * 2.5) - 1);
    expect(ons).toBeLessThanOrEqual(Math.ceil(BLINK_HZ * 3) + 1);
  });

  it("doesn't signal for small corrections, or when barely moving", () => {
    expect(drive({}, { steer: 0.08 }, 2).some((l) => l.left || l.right)).toBe(false);
    expect(drive({}, { steer: 0.6, speed: 0.3 }, 2).some((l) => l.left || l.right)).toBe(false);
  });

  // Steering by hand: the car's heading turns while the wheel is held over.
  function turn(car, { steer, rate, seconds, from = 0, yaw0 = 0 }) {
    const frames = [];
    let yaw = yaw0;
    for (let t = from; t < from + seconds; t += 1 / 60) {
      yaw += rate * steer * (1 / 60);
      frames.push(carLamps(car, { ...base, steer, yaw, turnAngle: 0.35, t }));
    }
    return { frames, yaw };
  }

  it("by hand, signals once the car has turned far enough, at any speed", () => {
    // Fast (turning quickly) and slow (turning slowly) both signal at ~20°, not before.
    for (const rate of [1.5, 0.3]) {
      const car = {};
      const before = turn(car, { steer: 1, rate, seconds: 0.3 / rate });
      expect(before.frames.some((l) => l.left || l.right)).toBe(false);
      const after = turn(car, { steer: 1, rate, seconds: 0.4 / rate, from: 0.3 / rate, yaw0: before.yaw });
      expect(after.frames.some((l) => l.left)).toBe(true);
      expect(after.frames.some((l) => l.right)).toBe(false);
    }
  });

  it("by hand, never signals for tap-tap steering", () => {
    const car = {};
    let t = 0;
    let yaw = 0;
    const frames = [];
    for (let tap = 0; tap < 10; tap++) {
      const held = turn(car, { steer: -1, rate: 1.2, seconds: 0.25, from: t, yaw0: yaw });
      const off = turn(car, { steer: 0, rate: 1.2, seconds: 0.2, from: t + 0.25, yaw0: held.yaw });
      frames.push(...held.frames, ...off.frames);
      yaw = off.yaw;
      t += 0.45;
    }
    expect(Math.abs(yaw)).toBeGreaterThan(2); // it turned a long way, in small taps
    expect(frames.some((l) => l.left || l.right)).toBe(false);
  });

  it("puts the hazards on: both sides together", () => {
    const frames = drive({}, { hazard: true, reversing: true }, 1);
    expect(frames.some((l) => l.left && l.right)).toBe(true);
    expect(frames.every((l) => l.left === l.right)).toBe(true);
  });
});
