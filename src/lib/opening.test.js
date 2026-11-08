import { describe, expect, it } from "vitest";
import { bothInFrame, openingCamera, staysFor, sunLater } from "./opening";

const HOLE = 2500;
const SIZE = 9;
const sunAt = (longitude) => {
  const d = (16.6 * Math.PI) / 180;
  return [Math.cos(d) * Math.sin(longitude), Math.sin(d), Math.cos(d) * Math.cos(longitude)];
};

describe("the opening view", () => {
  it.each([0.46, 0.56, 0.75, 1, 1.33, 1.6, 1.78, 2.4])("frames the planet and black hole together at aspect %s", (aspect) => {
    for (let i = 0; i < 24; i++) {
      const sun = sunAt((i / 24) * Math.PI * 2);
      const camera = openingCamera(sun, HOLE, aspect, SIZE);
      expect(bothInFrame(camera, sun, HOLE, aspect, SIZE), `hour ${i}`).toBe(true);
      // …and still, a few seconds later, after the black hole has moved on a little.
      expect(bothInFrame(camera, sunLater(sun, staysFor(aspect)), HOLE, aspect, SIZE), `hour ${i}, later`).toBe(true);
    }
  });

  it.each([0.46, 1.6])("shows at least a lit crescent, close up, at aspect %s", (aspect) => {
    const sun = sunAt(1);
    const camera = openingCamera(sun, HOLE, aspect, SIZE);
    const facing = camera.reduce((n, c, i) => n + c * sun[i], 0) / Math.hypot(...camera);
    expect(Math.acos(facing)).toBeLessThan((160 * Math.PI) / 180);
    expect(Math.hypot(...camera)).toBeLessThan(aspect < 1 ? 9 : 6);
  });
});
