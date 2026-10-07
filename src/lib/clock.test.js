import { describe, expect, it } from "vitest";
import { PLANET_DAY_SECONDS, formatHours, localHours, planetHours, sunDirection, sunLongitude } from "./clock";

const at = (h, m = 0, s = 0) => new Date(2026, 9, 6, h, m, s);

describe("planetHours", () => {
  it("runs a whole planet day every PLANET_DAY_SECONDS of real time", () => {
    const a = planetHours(at(10, 0, 0));
    const b = planetHours(new Date(at(10, 0, 0).getTime() + PLANET_DAY_SECONDS * 1000));
    expect(b).toBeCloseTo(a);
    const half = planetHours(new Date(at(10, 0, 0).getTime() + (PLANET_DAY_SECONDS / 2) * 1000));
    expect(Math.abs(half - a)).toBeCloseTo(12);
  });

  it("starts the day at real midnight", () => {
    expect(planetHours(at(0, 0, 0))).toBe(0);
  });
});

describe("sun", () => {
  it("is overhead the noon longitude at noon and on the far side at midnight", () => {
    expect(sunLongitude(12, 0.3)).toBeCloseTo(0.3);
    expect(Math.abs(sunLongitude(0, 0.3) - 0.3)).toBeCloseTo(Math.PI);
  });

  it("moves west as time passes", () => {
    expect(sunLongitude(13, 0)).toBeLessThan(sunLongitude(12, 0));
  });

  it("is a unit vector tilted north by the declination", () => {
    const d = sunDirection(9.5, 1, 0.29);
    expect(Math.hypot(...d)).toBeCloseTo(1);
    expect(d[1]).toBeCloseTo(Math.sin(0.29));
  });
});

it("gives local time east and west of the noon longitude", () => {
  expect(localHours(12, 0, Math.PI / 2)).toBeCloseTo(18);
  expect(localHours(12, 0, -Math.PI / 2)).toBeCloseTo(6);
  expect(localHours(23, 0, Math.PI / 2)).toBeCloseTo(5);
});

it("formats hours", () => {
  expect(formatHours(7.5)).toBe("07:30");
  expect(formatHours(23.99)).toBe("23:59");
});

import { approachHours, hoursForMode } from "./clock";

describe("time-of-day modes", () => {
  const date = new Date(2026, 9, 7, 10, 0, 0);
  it("day holds local noon wherever you are; night, midnight; cycle runs the clock", () => {
    for (const lon of [-2, 0, 1.3]) {
      expect(localHours(hoursForMode("day", date, 0.4, lon), 0.4, lon)).toBeCloseTo(12);
      expect(localHours(hoursForMode("night", date, 0.4, lon), 0.4, lon) % 24).toBeCloseTo(0);
    }
    expect(hoursForMode("cycle", date, 0.4, 1)).toBe(planetHours(date));
  });

  it("eases round the dial the short way", () => {
    expect(approachHours(23, 1, 0.5)).toBeCloseTo(23.5);
    expect(approachHours(1, 23, 0.5)).toBeCloseTo(0.5);
    expect(approachHours(10, 10.2, 1)).toBeCloseTo(10.2);
  });
});
