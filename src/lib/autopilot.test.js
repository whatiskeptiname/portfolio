import { describe, expect, it } from "vitest";
import { AUTOPILOT, AUTO_SPEED, CAR_LIMITS, parseAutoSpeed, unstickInput, autopilotInput, gearOf, hasInput, keysToInput, settleToLimit, wrapAngle, yawToward } from "./autopilot";

const EAST = -Math.PI / 2;

describe("autopilot", () => {
  it("holds course when already in lane heading east", () => {
    const input = autopilotInput({ x: 0, z: AUTOPILOT.lane, yaw: EAST, speed: AUTOPILOT.carSpeed, alt: 0 }, "car");
    expect(Math.abs(input.steer)).toBeLessThan(0.01);
    expect(input.up).toBe(false);
    expect(input.down).toBe(false);
  });

  it("speeds up from a standstill and steers back toward the lane", () => {
    const north = autopilotInput({ x: 0, z: -4, yaw: EAST, speed: 0, alt: 0 }, "car");
    expect(north.up).toBe(true);
    // North of the lane, heading east: turn right (south), i.e. negative steer.
    expect(north.steer).toBeLessThan(0);
    const south = autopilotInput({ x: 0, z: 8, yaw: EAST, speed: 0, alt: 0 }, "car");
    expect(south.steer).toBeGreaterThan(0);
  });

  it("turns a vehicle facing the wrong way back round", () => {
    const input = autopilotInput({ x: 0, z: AUTOPILOT.lane, yaw: Math.PI / 2, speed: 3, alt: 0 }, "car");
    expect(Math.abs(input.steer)).toBe(1);
  });

  it("flies the drone at cruising altitude over the equator", () => {
    expect(autopilotInput({ x: 0, z: 0, yaw: EAST, speed: 9, alt: 2 }, "drone").ascend).toBe(true);
    expect(autopilotInput({ x: 0, z: 0, yaw: EAST, speed: 9, alt: 20 }, "drone").descend).toBe(true);
    expect(autopilotInput({ x: 0, z: 0, yaw: EAST, speed: 9, alt: 0 }, "car").ascend).toBe(false);
  });
});

it("turns key sets into inputs and detects any input", () => {
  const input = keysToInput(new Set(["up", "left"]));
  expect(input).toEqual({ up: true, down: false, steer: 1, ascend: false, descend: false });
  expect(hasInput(input)).toBe(true);
  expect(hasInput(keysToInput(new Set()))).toBe(false);
});

it("wraps angles and aims yaw", () => {
  expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  expect(yawToward(1, 0)).toBeCloseTo(EAST);
  expect(yawToward(0, -1)).toBeCloseTo(0);
});

describe("surface speed limits", () => {
  it("ranks highway > road > paved > grass", () => {
    expect(CAR_LIMITS.highway).toBeGreaterThan(CAR_LIMITS.road);
    expect(CAR_LIMITS.road).toBeGreaterThan(CAR_LIMITS.paved);
    expect(CAR_LIMITS.paved).toBeGreaterThan(CAR_LIMITS.grass);
  });

  it("bleeds speed toward the limit rather than snapping", () => {
    const next = settleToLimit(30, 10, 0.1);
    expect(next).toBeLessThan(30);
    expect(next).toBeGreaterThan(10);
    expect(settleToLimit(8, 10, 0.1)).toBe(8);
  });

  it("picks gears", () => {
    expect(gearOf(0)).toBe(0);
    expect(gearOf(-3)).toBe(-1);
    expect(gearOf(1)).toBe(1);
    expect(gearOf(CAR_LIMITS.highway)).toBe(6);
  });
});

it("cruises at the speed chosen in the settings", () => {
  const s = { x: 0, z: AUTOPILOT.lane, yaw: EAST, speed: 15, alt: 0, autoSpeed: 20 };
  expect(autopilotInput(s, "car").up).toBe(true);
  expect(autopilotInput({ ...s, speed: 30 }, "car").down).toBe(true);
});

it("keeps left, as in Nepal", () => {
  expect(AUTOPILOT.lane).toBeLessThan(0); // north of the centre line when heading east
});

it("reads a saved cruise speed, clamped to the slider's range", () => {
  expect(parseAutoSpeed(null)).toBe(AUTO_SPEED.fallback);
  expect(parseAutoSpeed("abc")).toBe(AUTO_SPEED.fallback);
  expect(parseAutoSpeed("80")).toBe(80);
  expect(parseAutoSpeed("999")).toBe(AUTO_SPEED.max);
  expect(parseAutoSpeed("1")).toBe(AUTO_SPEED.min);
});

describe("getting unstuck", () => {
  it("backs off on opposite lock after pushing against something, then carries on", () => {
    const s = { speed: 0 };
    const push = { up: true, down: false, steer: 0.6, ascend: false, descend: false };
    let out = push;
    for (let t = 0; t < 1.2; t += 0.1) out = unstickInput(s, push, "car", 0.1);
    out = unstickInput(s, push, "car", 0.1);
    expect(out.down).toBe(true);
    expect(out.up).toBe(false);
    expect(out.steer).toBeLessThan(0); // opposite lock swings the nose toward the target
    for (let t = 0; t < 2; t += 0.1) out = unstickInput(s, push, "car", 0.1);
    expect(out).toBe(push); // done reversing
  });

  it("leaves a moving vehicle alone, and lets a stuck drone climb away", () => {
    const moving = { speed: 5 };
    const push = { up: true, down: false, steer: 0, ascend: false, descend: false };
    for (let t = 0; t < 3; t += 0.1) expect(unstickInput(moving, push, "car", 0.1)).toBe(push);
    const drone = { speed: 0 };
    let out;
    for (let t = 0; t < 1.4; t += 0.1) out = unstickInput(drone, push, "drone", 0.1);
    expect(out.ascend).toBe(true);
  });
});

import { PILOT_RULES, parsePilotRules } from "./autopilot";

describe("autopilot rules", () => {
  it("are all on by default, and keep what was saved", () => {
    expect(Object.values(parsePilotRules(null)).every(Boolean)).toBe(true);
    expect(parsePilotRules("{bad")).toEqual(parsePilotRules(null));
    const r = parsePilotRules(JSON.stringify({ lights: false, cars: "no" }));
    expect(r.lights).toBe(false);
    expect(r.cars).toBe(true);
    expect(Object.keys(r)).toHaveLength(PILOT_RULES.length);
  });
});
