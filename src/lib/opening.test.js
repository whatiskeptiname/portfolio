import { describe, expect, it } from "vitest";
import { bothInFrame, openingCamera } from "./opening";

const HOLE = 2.48;
const sunAt = (longitude) => {
  const d = (16.6 * Math.PI) / 180;
  return [Math.cos(d) * Math.sin(longitude), Math.sin(d), Math.cos(d) * Math.cos(longitude)];
};

describe("the opening view", () => {
  it.each([0.46, 0.56, 0.75, 1, 1.33, 1.6, 1.78, 2.4])("frames the planet and black hole together at aspect %s", (aspect) => {
    for (let i = 0; i < 24; i++) {
      const sun = sunAt((i / 24) * Math.PI * 2);
      expect(bothInFrame(openingCamera(sun, HOLE, aspect), sun, HOLE, aspect), `hour ${i}`).toBe(true);
    }
  });

  it("leaves the planet well lit on a wide screen", () => {
    const sun = sunAt(1);
    const camera = openingCamera(sun, HOLE, 1.6);
    const facing = camera.reduce((n, c, i) => n + c * sun[i], 0) / Math.hypot(...camera);
    expect(Math.acos(facing)).toBeLessThan((110 * Math.PI) / 180);
  });
});
