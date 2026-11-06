import { describe, expect, it } from "vitest";
import { DEFAULT_PRESET, PRESETS, loadGraphics, normalize, pixelRatio, presetOf, saveGraphics } from "./graphics";

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

describe("graphics settings", () => {
  it("recognises presets and custom mixes", () => {
    expect(presetOf(PRESETS.low)).toBe("low");
    expect(presetOf({ ...PRESETS.high })).toBe("high");
    expect(presetOf({ ...PRESETS.medium, trees: false })).toBe("custom");
  });

  it("fills gaps and rejects wrong types from saved data", () => {
    const s = normalize({ fps: 30, shadows: 12, unknown: true });
    expect(s.fps).toBe(30);
    expect(s.shadows).toBe(PRESETS[DEFAULT_PRESET].shadows);
    expect(s).not.toHaveProperty("unknown");
  });

  it("round-trips through storage, falling back to the default", () => {
    const store = memoryStorage();
    expect(loadGraphics(store)).toEqual(PRESETS.low);
    saveGraphics({ ...PRESETS.high }, store);
    expect(loadGraphics(store)).toEqual(PRESETS.high);
    store.setItem("city-graphics", "{not json");
    expect(loadGraphics(store)).toEqual(PRESETS.low);
  });

  it("never renders above the screen's own pixel ratio", () => {
    expect(pixelRatio({ resolution: 1.5 }, 1)).toBe(1);
    expect(pixelRatio({ resolution: 1.5 }, 2)).toBe(1.5);
    expect(pixelRatio({ resolution: 0.75 }, 2)).toBe(0.75);
    // A laptop-sized window or larger is untouched.
    expect(pixelRatio({ resolution: 0.75 }, 2, 1280 * 800)).toBe(0.75);
    expect(pixelRatio({ resolution: 0.75 }, 2, 1920 * 1080)).toBe(0.75);
    // A phone renders about the pixels a laptop would at the same setting...
    const phone = pixelRatio({ resolution: 0.75 }, 3, 390 * 844);
    expect(phone * phone * 390 * 844).toBeCloseTo(0.75 * 0.75 * 1280 * 800, -2);
    // ...but never past its own screen, or past 2×.
    expect(pixelRatio({ resolution: 1.5 }, 1, 390 * 844)).toBe(1);
    expect(pixelRatio({ resolution: 1.5 }, 3, 390 * 844)).toBe(2);
  });
});
