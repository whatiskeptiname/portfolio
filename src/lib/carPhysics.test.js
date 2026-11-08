import { describe, expect, it } from "vitest";
import { HIT, collideCars, hitCar, resistance, settleShove, slideCar, topSpeed, velocityOf } from "./carPhysics";

const DT = 1 / 60;
const STEER = 1.9;
// Runs the grip model for `seconds` with input `k`, holding the speed.
function run(c, k, seconds) {
  for (let t = 0; t < seconds; t += DT) slideCar(c, k, DT, STEER);
  return c;
}

describe("handbrake drift", () => {
  it("doesn't slide while the tyres grip", () => {
    // Cornering hard it runs a touch wide of where it points, no more.
    const c = run({ speed: 20, yaw: 0 }, { steer: 1 }, 2);
    expect(Math.abs(c.slip)).toBeLessThan(0.15);
    expect(c.rearGrip).toBeCloseTo(1, 3);
  });

  it("steps the tail out with the handbrake on and the wheel turned", () => {
    const c = run({ speed: 20, yaw: 0 }, { steer: 1, handbrake: true }, 1);
    expect(c.rearGrip).toBeLessThan(0.2);
    expect(c.slip).toBeGreaterThan(0.3); // nose pointing left of where it's going
    expect(c.drifting).toBe(true);
  });

  it("keeps rotating once loose, so you catch it with counter-steer", () => {
    const loose = run({ speed: 20, yaw: 0 }, { steer: 1, handbrake: true }, 0.8);
    const before = loose.yawRate;
    run(loose, { steer: 0, handbrake: true }, 0.1);
    // Gripping, it follows the wheel as it comes back to centre.
    const gripping = run({ speed: 20, yaw: 0 }, { steer: 1 }, 0.8);
    const gripBefore = gripping.yawRate;
    run(gripping, { steer: 0 }, 0.1);
    expect(loose.yawRate / before).toBeGreaterThan(gripping.yawRate / gripBefore + 0.1);
    // Counter-steering (right, against the slide) holds the angle down.
    const caught = run({ speed: 20, yaw: 0 }, { steer: 1, handbrake: true }, 0.6);
    const spun = run({ speed: 20, yaw: 0 }, { steer: 1, handbrake: true }, 0.6);
    run(caught, { steer: -1, handbrake: true }, 0.6);
    run(spun, { steer: 1, handbrake: true }, 0.6);
    expect(Math.abs(caught.slip)).toBeLessThan(Math.abs(spun.slip));
  });

  it("grips again and straightens up after you let go", () => {
    const c = run({ speed: 20, yaw: 0 }, { steer: 1, handbrake: true }, 1);
    run(c, { steer: 0 }, 1.5);
    expect(c.rearGrip).toBeGreaterThan(0.9);
    expect(Math.abs(c.slip)).toBeLessThan(0.05);
    expect(c.drifting).toBe(false);
  });

  it("doesn't slide when barely moving", () => {
    const c = run({ speed: 2, yaw: 0 }, { steer: 1, handbrake: true }, 1);
    expect(c.rearGrip).toBeCloseTo(1, 3);
    expect(Math.abs(c.slip)).toBeLessThan(0.05);
  });
});

describe("collisions", () => {
  it("scrapes along a wall it meets at a shallow angle, keeping most of its speed", () => {
    // A wall along x = 0.2; the car runs into it 0.3 rad off parallel.
    const s = { x: 0.19, z: 0, speed: 20, yaw: -0.3, travelYaw: -0.3, yawRate: 0 };
    const strength = hitCar(s, 1, -0.3, 1, (x) => x > 0.2);
    expect(s.speed).toBeGreaterThan(20 * 0.85);
    expect(s.speed).toBeLessThan(20);
    expect(s.yaw).toBeGreaterThan(-0.3); // turned toward running along the wall
    expect(s.x).toBeLessThanOrEqual(0.2);
    expect(strength).toBeLessThan(0.6);
  });

  it("loses more the steeper it hits", () => {
    const shallow = { x: 0.19, z: 0, speed: 20, yaw: -0.3 };
    const steep = { x: 0.19, z: 0, speed: 20, yaw: -0.9 };
    const a = hitCar(shallow, 1, -0.3, 1, (x) => x > 0.2);
    const b = hitCar(steep, 1, -0.9, 1, (x) => x > 0.2);
    expect(b).toBeGreaterThan(a);
    expect(steep.speed).toBeLessThan(shallow.speed);
  });

  it("stops dead head on and rebounds a little, with a hard knock", () => {
    const s = { x: 0, z: -0.45, speed: 20, yaw: 0, travelYaw: 0, yawRate: 0.4 };
    const strength = hitCar(s, 1, 0, 1, (x, z) => z < -0.5);
    expect(s.speed).toBeCloseTo(-20 * HIT.rebound, 5);
    expect(s.yawRate).toBe(0);
    expect(strength).toBeGreaterThan(1.5);
    expect(s.bump).toBe(1);
    expect(s.impact).toBeGreaterThan(1);
  });

  it("makes no knock for a gentle nudge", () => {
    const s = { x: 0, z: -0.45, speed: 0.3, yaw: 0 };
    hitCar(s, 0.005, 0, 1, (x, z) => z < -0.452);
    expect(s.bump).toBeUndefined();
  });
});

describe("car meets car", () => {
  // Both facing −z (yaw 0); b is 4.6 m ahead of a.
  const pair = (va, vb, bx = 0) => [
    { x: 0, z: 0, yaw: 0, speed: va },
    { x: bx, z: -4.6, yaw: 0, speed: vb },
  ];

  it("shares momentum: rear-ending a stopped car shoves it on and slows you", () => {
    const [a, b] = pair(20, 0);
    expect(collideCars(a, b)).toBeCloseTo(20, 5);
    expect(a.speed + b.speed).toBeCloseTo(20, 5); // momentum kept
    expect(b.speed).toBeGreaterThan(10);
    expect(a.speed).toBeLessThan(10);
    expect(a.speed).toBeGreaterThan(0);
  });

  it("goes by the combined speed: head on is far harder than a nudge", () => {
    const [a, b] = pair(20, 0);
    collideCars(a, b);
    const headOnA = { x: 0, z: 0, yaw: 0, speed: 20 };
    const headOnB = { x: 0, z: -4.6, yaw: Math.PI, speed: 20 }; // coming the other way
    expect(collideCars(headOnA, headOnB)).toBeCloseTo(40, 5);
    expect(headOnA.impact).toBeGreaterThan(a.impact);
    const [c, d] = pair(3, 0);
    collideCars(c, d);
    expect(c.impact).toBeLessThan(a.impact);
    // Head on, both end up nearly stopped, bouncing back a little.
    expect(headOnA.speed).toBeLessThan(0);
    expect(headOnA.speed).toBeGreaterThan(-5);
  });

  it("does nothing if they're already moving apart", () => {
    const [a, b] = pair(5, 10);
    expect(collideCars(a, b)).toBe(0);
    expect(a.speed).toBe(5);
    expect(b.speed).toBe(10);
  });

  it("spins both cars when the blow is off-centre, and shoves sideways what doesn't fit", () => {
    const [a, b] = pair(20, 0, 1.4); // b is ahead and to the right
    collideCars(a, b);
    expect(Math.abs(a.spin)).toBeGreaterThan(0.05);
    expect(Math.abs(b.spin)).toBeGreaterThan(0.05);
    expect(Math.abs(b.pushX)).toBeGreaterThan(1); // pushed off to the right
    expect(b.pushX).toBeGreaterThan(0);
  });

  it("a light thing barely moves a car", () => {
    const drone = { x: 0, z: 0, yaw: 0, speed: 20 };
    const car = { x: 0, z: -2, yaw: 0, speed: 0 };
    collideCars(drone, car, { massA: 0.25 });
    expect(car.speed).toBeLessThan(5);
    expect(drone.speed).toBeLessThan(3); // and it all but stops
  });

  it("scrubs a sideways shove away, and the spin dies down", () => {
    const c = { x: 0, z: 0, yaw: 0, speed: 0, pushX: 6, pushZ: 0, spin: 1 };
    let moved = 0;
    for (let t = 0; t < 2; t += DT) moved += settleShove(c, DT).dx;
    expect(c.pushX).toBe(0);
    expect(moved).toBeGreaterThan(1);
    expect(moved).toBeLessThan(4);
    expect(c.spin).toBe(0);
    expect(Math.hypot(velocityOf(c).x, velocityOf(c).z)).toBe(0);
  });
});

describe("engine and drag", () => {
  const KMH = 4; // plane units per second → km/h
  const ACCEL = 18; // the car's full push

  it("settles each pedal position at its own speed", () => {
    expect(topSpeed(ACCEL) * KMH).toBeGreaterThan(190);
    expect(topSpeed(ACCEL) * KMH).toBeLessThan(210);
    expect(topSpeed(ACCEL * 0.5) * KMH).toBeGreaterThan(125);
    expect(topSpeed(ACCEL * 0.5) * KMH).toBeLessThan(155);
    expect(topSpeed(ACCEL * 0.1) * KMH).toBeGreaterThan(50);
    expect(topSpeed(ACCEL * 0.1) * KMH).toBeLessThan(70);
  });

  it("at a light 10% touch, climbs to that speed and no further", () => {
    let v = 0;
    let most = 0;
    for (let t = 0; t < 120; t += 1 / 60) {
      v = Math.max(0, v + (ACCEL * 0.1 - resistance(v)) / 60);
      most = Math.max(most, v);
    }
    expect(v).toBeCloseTo(topSpeed(ACCEL * 0.1), 1);
    expect(most).toBeLessThanOrEqual(topSpeed(ACCEL * 0.1) + 1e-6);
  });

  it("drags harder the faster you go", () => {
    expect(resistance(30)).toBeGreaterThan(resistance(10) * 3);
    expect(resistance(0)).toBe(0);
  });
});
