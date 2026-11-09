import { describe, expect, it } from "vitest";
import { DRIFT, driftState, stepDrift } from "./drift";

const DT = 1 / 60;
const run = (d, input, seconds) => {
  for (let t = 0; t < seconds; t += DT) stepDrift(d, { ...input, dt: DT });
  return d;
};

describe("drift score", () => {
  it("counts only a real slide at speed", () => {
    expect(run(driftState(), { slip: 0.1, speed: 20 }, 1).active).toBe(false); // a small angle
    expect(run(driftState(), { slip: 0.6, speed: 3 }, 1).active).toBe(false); // too slow
    const d = run(driftState(), { slip: 0.6, speed: 20 }, 1);
    expect(d.active).toBe(true);
    expect(d.score).toBeGreaterThan(0);
  });

  it("scores deeper, faster and longer slides higher", () => {
    const base = run(driftState(), { slip: 0.4, speed: 15 }, 1).score;
    expect(run(driftState(), { slip: 0.8, speed: 15 }, 1).score).toBeGreaterThan(base);
    expect(run(driftState(), { slip: 0.4, speed: 25 }, 1).score).toBeGreaterThan(base);
    expect(run(driftState(), { slip: 0.4, speed: 15 }, 2).score).toBeGreaterThan(base);
  });

  it("banks the drift once straight for a moment, shows it, then clears it", () => {
    const d = run(driftState(), { slip: 0.6, speed: 20 }, 2);
    const score = Math.round(d.score);
    run(d, { slip: 0, speed: 20 }, DRIFT.grace + 0.1);
    expect(d.active).toBe(false);
    expect(d.last).toEqual({ score, lost: false });
    expect(d.best).toBe(score);
    run(d, { slip: 0, speed: 20 }, DRIFT.show + 0.1);
    expect(d.last).toBeNull();
  });

  it("keeps one drift going through a quick flick from one side to the other", () => {
    const d = run(driftState(), { slip: 0.6, speed: 20 }, 1);
    run(d, { slip: 0, speed: 20 }, DRIFT.grace / 2);
    run(d, { slip: -0.6, speed: 20 }, 1);
    expect(d.active).toBe(true);
    expect(d.last).toBeNull();
  });

  it("loses the drift if you crash mid-slide", () => {
    const d = run(driftState(), { slip: 0.6, speed: 20 }, 1);
    stepDrift(d, { slip: 0.6, speed: 20, impact: 1, dt: DT });
    expect(d.active).toBe(false);
    expect(d.last.lost).toBe(true);
    expect(d.best).toBe(0);
  });
});
