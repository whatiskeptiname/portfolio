// Graphics settings for the 3D planet: presets plus individual switches that
// load or unload parts of the scene. Saved per browser.

export const PRESETS = {
  low: {
    resolution: 0.75, // × CSS pixels
    antialias: false,
    fps: 30,
    shadows: "off", // "off" | "low" | "high"
    sky: "milkyway", // "milkyway" | "stars" | "off"
    stars: 3000,
    blackHole: "simple", // "full" | "simple"
    atmosphere: true,
    clouds: true,
    labels: true,
    trees: true,
    windows: true,
    signs: false,
    billboards: false,
    water: false, // animated river
    streetSigns: false,
    lamps: true,
    traffic: "light", // "off" | "light" | "busy"
  },
  medium: {
    resolution: 1,
    antialias: false,
    fps: 60,
    shadows: "low",
    sky: "milkyway",
    stars: 6000,
    blackHole: "full",
    atmosphere: true,
    clouds: true,
    labels: true,
    trees: true,
    windows: true,
    signs: true,
    billboards: true,
    water: true,
    streetSigns: true,
    lamps: true,
    traffic: "light",
  },
  high: {
    resolution: 1.5,
    antialias: true,
    fps: 60,
    shadows: "high",
    sky: "milkyway",
    stars: 11000,
    blackHole: "full",
    atmosphere: true,
    clouds: true,
    labels: true,
    trees: true,
    windows: true,
    signs: true,
    billboards: true,
    water: true,
    streetSigns: true,
    lamps: true,
    traffic: "busy",
  },
};

export const DEFAULT_PRESET = "low";

/** How many other cars each traffic setting puts on the roads. */
export const TRAFFIC_CARS = { off: 0, light: 12, busy: 24 };
const KEY = "city-graphics";

/** Which preset these settings match exactly, or "custom". */
export function presetOf(settings) {
  for (const [name, p] of Object.entries(PRESETS)) {
    if (Object.keys(p).every((k) => p[k] === settings[k])) return name;
  }
  return "custom";
}

/** Fills in anything missing or invalid from the default preset. */
export function normalize(raw) {
  const base = PRESETS[DEFAULT_PRESET];
  const out = { ...base };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(base)) {
      if (typeof raw[k] === typeof base[k]) out[k] = raw[k];
    }
  }
  return out;
}

export function loadGraphics(storage = globalThis.localStorage) {
  try {
    return normalize(JSON.parse(storage.getItem(KEY)));
  } catch {
    return normalize(null);
  }
}

export function saveGraphics(settings, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode etc.: settings just won't persist.
  }
}

// `resolution` is per CSS pixel, which is sized for a laptop: a phone has about a
// third of the CSS pixels, so the same number looks blocky there.
const REFERENCE_AREA = 1280 * 800;

/**
 * Device pixel ratio to render at, never above the screen's own. Smaller screens
 * get the rendered pixels a laptop would at this setting, so they stay as sharp.
 */
export function pixelRatio(settings, devicePixelRatio = 1, cssArea = Infinity) {
  const boost = Math.sqrt(Math.max(1, REFERENCE_AREA / cssArea));
  return Math.min(settings.resolution * boost, 2, Math.max(devicePixelRatio, 1));
}
