// Graphics settings for the 3D planet: presets plus individual switches that
// load or unload parts of the scene. Saved per browser.

export const PRESETS = {
  low: {
    resolution: 0.75, // × CSS pixels
    antialias: false,
    fps: 30,
    shadows: "off", // "off" | "low" | "high"
    sky: "stars", // "milkyway" | "stars" | "off"
    stars: 3000,
    blackHole: "simple", // "full" | "simple"
    atmosphere: false,
    trees: true,
    windows: true,
    signs: false,
    billboards: false,
    labels: true,
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
    trees: true,
    windows: true,
    signs: true,
    billboards: true,
    labels: true,
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
    trees: true,
    windows: true,
    signs: true,
    billboards: true,
    labels: true,
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

/** Device pixel ratio to render at, never above the screen's own. */
export function pixelRatio(settings, devicePixelRatio = 1) {
  return Math.min(settings.resolution, Math.max(devicePixelRatio, 1));
}
