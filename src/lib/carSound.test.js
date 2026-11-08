import { describe, expect, it } from "vitest";
import { HEARING, audibility, engineRpm, firingRate, heard, nearestCars } from "./carSound";

describe("engine note", () => {
  it("idles, climbs through a gear and drops at the shift", () => {
    expect(engineRpm(0, 7.5)).toBe(850);
    expect(engineRpm(7, 7.5)).toBeGreaterThan(engineRpm(2, 7.5));
    expect(engineRpm(7.6, 7.5)).toBeLessThan(engineRpm(7.4, 7.5)); // into second
  });

  it("fires twice a revolution: 3,000 rpm is 100 Hz", () => {
    expect(firingRate(3000)).toBe(100);
  });
});

describe("hearing a car", () => {
  it("is loud close by, fades with distance, and is silent from far off", () => {
    expect(audibility(2)).toBe(1);
    expect(audibility(20)).toBeLessThan(audibility(10));
    expect(audibility(10)).toBeLessThan(1);
    expect(audibility(HEARING)).toBe(0);
    expect(audibility(500)).toBe(0);
  });

  const listener = { x: 0, z: 0, yaw: 0, vx: 0, vz: 0 }; // facing −z

  it("sounds higher coming toward you and lower going away", () => {
    const coming = heard(listener, { x: 0, z: -20, vx: 0, vz: 20 });
    const going = heard(listener, { x: 0, z: -20, vx: 0, vz: -20 });
    expect(coming.doppler).toBeGreaterThan(1);
    expect(going.doppler).toBeLessThan(1);
    expect(heard(listener, { x: 0, z: -20, vx: 0, vz: 0 }).doppler).toBe(1);
  });

  it("is heard from the side it's on", () => {
    expect(heard(listener, { x: 10, z: 0, vx: 0, vz: 0 }).pan).toBeCloseTo(1, 5);
    expect(heard(listener, { x: -10, z: 0, vx: 0, vz: 0 }).pan).toBeCloseTo(-1, 5);
    // Facing the other way, right and left swap.
    expect(heard({ ...listener, yaw: Math.PI }, { x: 10, z: 0, vx: 0, vz: 0 }).pan).toBeCloseTo(-1, 5);
  });

  it("picks the nearest cars within hearing, wrapping round the planet", () => {
    const cars = [
      { id: "far", x: 200, z: 0 },
      { id: "b", x: 30, z: 0 },
      { id: "a", x: 0, z: 5 },
      { id: "wrapped", x: 995, z: 0 },
    ];
    expect(nearestCars(cars, { x: 0, z: 0 }, 2, 1000).map((c) => c.id)).toEqual(["a", "wrapped"]);
    expect(nearestCars(cars, { x: 0, z: 0 }, 5, 1000).map((c) => c.id)).toEqual(["a", "wrapped", "b"]);
  });
});
