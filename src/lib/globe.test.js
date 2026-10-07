import { describe, expect, it } from "vitest";
import { crossPole, eastScale, eastStretch, frameAt, toSphere, wrapX } from "./globe";

const R = 50;
const len = (v) => Math.hypot(...v);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

describe("toSphere", () => {
  it("puts the plane origin facing +z and north up", () => {
    toSphere(R, 0, 0).forEach((v, i) => expect(v).toBeCloseTo([0, 0, R][i]));
    const [, y] = toSphere(R, 0, -R * (Math.PI / 2));
    expect(y).toBeCloseTo(R);
  });

  it("keeps points at radius R + h", () => {
    expect(len(toSphere(R, 37, -12, 3))).toBeCloseTo(R + 3);
  });

  it("wraps longitude every 2πR", () => {
    const a = toSphere(R, 10, 5);
    const b = toSphere(R, 10 + 2 * Math.PI * R, 5);
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v));
  });
});

describe("frameAt", () => {
  it("is orthonormal and right-handed (east × up = south)", () => {
    for (const [x, z] of [[0, 0], [40, -20], [-90, 33]]) {
      const { up, east, south } = frameAt(R, x, z);
      [up, east, south].forEach((v) => expect(len(v)).toBeCloseTo(1));
      expect(dot(up, east)).toBeCloseTo(0);
      expect(dot(up, south)).toBeCloseTo(0);
      cross(east, up).forEach((v, i) => expect(v).toBeCloseTo(south[i]));
    }
  });

  it("points along the direction plane movement goes", () => {
    const eps = 1e-3;
    const p = toSphere(R, 20, 10);
    const pe = toSphere(R, 20 + eps, 10);
    const ps = toSphere(R, 20, 10 + eps);
    const { east, south } = frameAt(R, 20, 10);
    expect(dot(east, pe.map((v, i) => v - p[i]))).toBeGreaterThan(0);
    expect(dot(south, ps.map((v, i) => v - p[i]))).toBeGreaterThan(0);
  });
});

it("shrinks east–west distances toward the poles", () => {
  expect(eastScale(R, 0)).toBe(1);
  expect(eastScale(R, -R * (Math.PI / 3))).toBeCloseTo(0.5);
});

it("wraps x into [-πR, πR)", () => {
  expect(wrapX(R, Math.PI * R + 1)).toBeCloseTo(-Math.PI * R + 1);
  expect(wrapX(R, 3)).toBeCloseTo(3);
});

describe("crossPole", () => {
  it("brings you out the other side heading the other way, at the same point on the sphere", () => {
    const pole = (Math.PI / 2) * R;
    const s = { x: 10, z: -pole - 2, yaw: 0.3 };
    const before = toSphere(R, s.x, s.z);
    expect(crossPole(R, s)).toBe(true);
    expect(s.z).toBeCloseTo(-pole + 2);
    expect(s.yaw).toBeCloseTo(0.3 + Math.PI);
    toSphere(R, s.x, s.z).forEach((v, i) => expect(v).toBeCloseTo(before[i]));
  });

  it("works over the south pole and leaves everyone else alone", () => {
    const pole = (Math.PI / 2) * R;
    const s = { x: 0, z: pole + 1, yaw: Math.PI };
    expect(crossPole(R, s)).toBe(true);
    expect(s.z).toBeCloseTo(pole - 1);
    const t = { x: 0, z: 5, yaw: 0 };
    expect(crossPole(R, t)).toBe(false);
  });
});

it("stretches east–west plane motion toward the poles, with a cap", () => {
  expect(eastStretch(R, 0)).toBe(1);
  expect(eastStretch(R, -R * (Math.PI / 3))).toBeCloseTo(2);
  expect(eastStretch(R, -R * (Math.PI / 2))).toBe(25);
});
