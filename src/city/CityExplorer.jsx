// src/city/CityExplorer.jsx — full-screen 3D planet: the résumé in the north,
// GitHub in the south, orbiting near a black hole. Modes: "orbit" (look
// around, click buildings; works on touch) and "drive" (car or drone, chase
// camera). Loaded lazily from App.
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { cityBillboards, cityGroups } from "../data";
import { createLayout, riverDistance, worldDistance } from "../lib/layout";
import { buildRoadGraph, planRoute } from "../lib/routing";
import { AUTOPILOT, DRONE_ALT, KMH_PER_UNIT, parseAutoSpeed, parsePilotRules } from "../lib/autopilot";
import { freshBattery, swapBattery } from "../lib/battery";
import { nextTourStop } from "../lib/routing";
import { BLACK_HOLE_DISTANCE, BLACK_HOLE_RADIUS, SKY_ROTATION, SUN_DIRECTION, setGround, surfacePoint } from "./globe3d";
import { terrainAt } from "../lib/terrain";
import { PLANET_DAY_SECONDS, approachHours, formatHours, hoursForMode, localHours, planetHours, sunDirection, sunLongitude } from "../lib/clock";
import { Billboards, Districts, Lighting, Planet, River, Roads, Trees } from "./World";
import { Mountains, Sea } from "./Poles";
import { Lamps } from "./Lamps";
import { RouteViz } from "./RouteViz";
import { DriverView } from "./DriverView";
import { Traffic, TrafficLights } from "./Traffic";
import { placeSignals } from "../lib/traffic";
import { VIEW } from "../lib/perception";
import { Buildings } from "./Buildings";
import { StreetSigns } from "./StreetSigns";
import { PRESETS, TRAFFIC_CARS, loadGraphics, pixelRatio, presetOf, saveGraphics } from "../lib/graphics";
import { CRUISE_MIN } from "../lib/pedals";
import { audibility, heard, nearestCars } from "../lib/carSound";
import { velocityOf } from "../lib/carPhysics";
import { BlackHole, Sky } from "./Space";
import { Clouds } from "./Clouds";
import { countEvent, countOnce } from "../lib/visits";
import { openingCamera, shiftFor } from "../lib/opening";
import { ChaseCamera, Vehicle } from "./Vehicles";
import Minimap from "./Minimap";
import { BatteryPrompt, AutopilotPanel, DriftScore, DriverPanel, FpvOverlay, Gauge, GoToMenu, GraphicsPanel, HelpOverlay, HighOffer, InfoPanel, InputsPanel, KeyHints, StartHint, Toolbar, TouchPad } from "./Hud";
import Icon from "../components/Icon";
import { PASSERS, audio } from "./audio";
import { DriftFx } from "./DriftFx";
import { radio } from "./radio";
import { MiniPlayer, RadioButton, RadioPanel } from "./RadioPanel";
import "./city.css";

const KEY_MAP = {
  KeyW: "up",
  ArrowUp: "arrowUp", // the same as W/S/A/D, except for the realistic drone's right stick
  KeyS: "down",
  ArrowDown: "arrowDown",
  KeyA: "left",
  ArrowLeft: "arrowLeft",
  KeyD: "right",
  ArrowRight: "arrowRight",
  Space: "ascend",
  KeyR: "ascend",
  ShiftLeft: "descend",
  ShiftRight: "descend",
  KeyF: "descend",
};
const NEARBY_DISTANCE = 9;
const HINTS_FOR = 4; // seconds of driving by hand before the key hints go
const CRASH_FROM = 0.35; // bumps harder than this (≈15 km/h lost into it) sound like a crash
const NEARBY_MAX_ALT = 25;

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

// Back the camera off on portrait screens so the whole planet fits at first,
// filling the width rather than leaving room for the black hole beside it.
const portraitFit = () => Math.max(1, 0.8 / (window.innerWidth / window.innerHeight));

function remembered(key, allowed, fallback) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisted in private mode; fine.
  }
}

// The vehicle cameras, in the order T cycles through them.
const VIEWS = ["chase", "fpv", "eye"];

// `initialVehicle` ("car" | "drone") and `initialView` ("chase" | "fpv" | "eye") come
// from links like #/planet?vehicle=drone&view=eye.
export default function CityExplorer({ onExit, initialVehicle, initialView }) {
  const layout = useMemo(() => {
    const world = createLayout(cityGroups, "whatiskeptiname", { billboards: cityBillboards });
    // Everything placed on the surface sits on the terrain from here on.
    setGround((x, z) => terrainAt(world, x, z));
    return world;
  }, []);
  const R = layout.radius;
  const buildingsById = useMemo(() => new Map(layout.buildings.map((b) => [b.id, b])), [layout]);

  const startVehicle = ["car", "drone"].includes(initialVehicle) ? initialVehicle : null;
  const [mode, setMode] = useState(startVehicle ? "drive" : "orbit"); // land on the planet view
  // Links win; otherwise start in the car, with the camera you used last.
  const [vehicle, setVehicle] = useState(() => startVehicle ?? "car");
  const [view, setView] = useState(() =>
    VIEWS.includes(initialView) ? initialView : remembered("city-view", VIEWS, "chase")
  );
  useEffect(() => remember("city-view", view), [view]);
  const [audioSettings, setAudioSettings] = useState(() => audio.settings);
  const updateAudio = useCallback((patch) => {
    audio.configure(patch);
    setAudioSettings({ ...audio.settings });
  }, []);
  const sound = audioSettings.enabled;
  const [showRadio, setShowRadio] = useState(false);
  // The radio can un-mute sound itself; keep the sound button in step. Also note
  // when the mini player is up so the rest of the HUD makes room for it.
  const [musicActive, setMusicActive] = useState(false);
  const [musicOnly, setMusicOnly] = useState(radio.hideVideo);
  useEffect(
    () =>
      radio.subscribe(() => {
        setAudioSettings((a) => (a.enabled === audio.settings.enabled ? a : { ...audio.settings }));
        setMusicActive(Boolean(radio.player || radio.loading));
        setMusicOnly(radio.hideVideo);
      }),
    []
  );
  const [flash, setFlash] = useState(0); // screenshot flash
  const capture = useRef(null);
  const [gfx, setGfx] = useState(loadGraphics);
  const [showGraphics, setShowGraphics] = useState(false);
  const stats = useRef({ fps: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, renderer: "" });
  const updateGfx = useCallback((patch) => {
    setGfx((g) => {
      const next = typeof patch === "string" ? { ...PRESETS[patch] } : { ...g, ...patch };
      saveGraphics(next);
      return next;
    });
  }, []);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [nearbyId, setNearbyId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [webgl] = useState(hasWebGL);

  // One vehicle; the car/drone switch converts it in place. It starts on the
  // equator highway, below the first résumé district, cruising east on autopilot.
  const vehicleState = useRef({
    x: noonLongitude(layout) * R,
    z: AUTOPILOT.lane,
    yaw: -Math.PI / 2,
    speed: 0,
    steer: 0,
    alt: 0,
    climb: 0,
    takeoff: 0,
    auto: true,
    lastInput: 0,
  });
  // Autopilot cruise speed (km/h), from the settings panel: 80 unless changed. (A
  // new key, so visits that saved the old 30 km/h default start at 80.)
  const [autoKmh, setAutoKmh] = useState(() => {
    try {
      return parseAutoSpeed(localStorage.getItem("city-cruise-kmh"));
    } catch {
      return parseAutoSpeed(null);
    }
  });
  useEffect(() => {
    remember("city-cruise-kmh", autoKmh);
    vehicleState.current.autoSpeed = autoKmh / KMH_PER_UNIT;
  }, [autoKmh]);
  // Drone altitude hold (plane units; the HUD shows metres): − / + step it,
  // Space / Shift move it smoothly (the drone writes those back), 0 lands.
  const [droneAlt, setDroneAlt] = useState(() => {
    try {
      const v = Number(localStorage.getItem("city-drone-alt"));
      return localStorage.getItem("city-drone-alt") != null && Number.isFinite(v) ? Math.min(DRONE_ALT.max, Math.max(DRONE_ALT.min, v)) : DRONE_ALT.fallback;
    } catch {
      return DRONE_ALT.fallback;
    }
  });
  useEffect(() => {
    vehicleState.current.droneAltTarget = droneAlt;
  }, [droneAlt]);
  // Keep the HUD (and the saved value) in step with Space / Shift adjustments.
  useEffect(() => {
    const id = setInterval(() => {
      const t = vehicleState.current.droneAltTarget;
      if (t != null) {
        setDroneAlt((v) => (Math.abs(v - t) > 0.05 ? t : v));
        remember("city-drone-alt", Math.round(t * 10) / 10);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);
  const nudgeAltitude = useCallback((d) => {
    const s = vehicleState.current;
    const next = Math.min(DRONE_ALT.max, Math.max(DRONE_ALT.min, Math.round(((s.droneAltTarget ?? DRONE_ALT.fallback) + d) / DRONE_ALT.step) * DRONE_ALT.step));
    s.droneAltTarget = next;
    setDroneAlt(next);
  }, []);
  // Show the autopilot's route planning and speed plan (G, or in ⚙). On by default.
  const [routeViz, setRouteViz] = useState(true);
  // How far the autopilot sees (all round, in line of sight), from ⚙: 50 m unless
  // changed. (A new key, so visits that saved the old 150 m default start at 50 m.)
  const [viewRange, setViewRange] = useState(() => {
    try {
      const v = Number(localStorage.getItem("city-view-range-m") ?? NaN);
      return Number.isFinite(v) && v >= VIEW.min && v <= VIEW.max ? v : VIEW.range;
    } catch {
      return VIEW.range;
    }
  });
  useEffect(() => {
    remember("city-view-range-m", viewRange);
    vehicleState.current.viewRange = viewRange;
  }, [viewRange]);
  // Time of day: the planet's fast day/night cycle, or always day / always night.
  // Every visit starts on the day–night cycle; Day / Night in ⚙ last the visit.
  const [timeMode, setTimeMode] = useState("cycle");
  // Flying the drone by hand: arcade (easy) or realistic (throttle, yaw, pitch, roll).
  const [droneMode, setDroneMode] = useState(() => remembered("city-drone-mode", ["arcade", "realistic"], "arcade"));
  useEffect(() => {
    remember("city-drone-mode", droneMode);
    const s = vehicleState.current;
    s.droneMode = droneMode;
    s.manualThrottle = 0.38; // start near the hover throttle
  }, [droneMode]);
  // The autopilot's settings page, the rules it obeys, and the inputs readout (O).
  const [showPilot, setShowPilot] = useState(false);
  const [pilotRules, setPilotRules] = useState(() => {
    try {
      return parsePilotRules(localStorage.getItem("city-pilot-rules"));
    } catch {
      return parsePilotRules(null);
    }
  });
  useEffect(() => {
    remember("city-pilot-rules", JSON.stringify(pilotRules));
    vehicleState.current.pilot = pilotRules;
  }, [pilotRules]);
  // The inputs readout (O): on by default.
  const [showInputs, setShowInputs] = useState(true);
  // Show what the autopilot sees and why it does what it does (I, or in ⚙).
  const [decisions, setDecisions] = useState(false);
  // Where the autopilot goes: round the equator, or touring every road.
  const [autoRoute, setAutoRoute] = useState(() => remembered("city-autoroute", ["equator", "roads"], "equator"));
  useEffect(() => {
    remember("city-autoroute", autoRoute);
    const s = vehicleState.current;
    s.autoMode = autoRoute;
    if (autoRoute === "equator" && s.route?.through) s.route = null; // drop the tour leg
  }, [autoRoute]);
  const cameraState = useRef({ position: new THREE.Vector3() }); // for the minimap
  const keys = useRef(new Set());
  const focus = useRef(null); // world point the orbit camera should swing over

  // Counts what people do here, each thing once per visit: vehicle, camera, panels opened, settings.
  useEffect(() => countOnce("planet", "mode", mode), [mode]);
  useEffect(() => countOnce("planet", "vehicle", vehicle), [vehicle]);
  // Camera, time of day and drone handling count only when someone changes them, not their defaults.
  const firstPick = useRef({ view, timeMode, droneMode });
  useEffect(() => void (view !== firstPick.current.view && countOnce("planet", "camera", view)), [view]);
  useEffect(() => void (timeMode !== firstPick.current.timeMode && countOnce("planet", "time", timeMode)), [timeMode]);
  useEffect(() => void (droneMode !== firstPick.current.droneMode && countOnce("planet", "drone-mode", droneMode)), [droneMode]);
  useEffect(() => countOnce("planet", "graphics", presetOf(gfx)), [gfx]);
  useEffect(() => void (showHelp && countOnce("planet", "help")), [showHelp]);
  useEffect(() => void (showRadio && countOnce("planet", "radio")), [showRadio]);
  useEffect(() => void (musicActive && countOnce("planet", "music")), [musicActive]);
  useEffect(() => void (showGraphics && countOnce("planet", "settings")), [showGraphics]);
  useEffect(() => void (selectedId && countOnce("planet", "opened", selectedId)), [selectedId]);

  const selected = selectedId ? buildingsById.get(selectedId) : null;
  const driving = mode === "drive";

  const select = useCallback(
    (id) => {
      setSelectedId(id);
      const b = id && buildingsById.get(id);
      if (b) {
        focus.current = surfacePoint(R, b.x, b.z, b.height / 2);
        audio.ui("open");
      }
    },
    [buildingsById, R]
  );

  // Autopilot on/off. Turned on away from the highway, it drives back to it by road.
  const toggleAutopilot = useCallback(() => {
    countOnce("planet", "autopilot");
    const s = vehicleState.current;
    if (s.transform != null) return;
    if (s.route && !s.auto) {
      s.route = null; // P cancels a "Go to" trip
      s.lastInput = performance.now();
      return;
    }
    if (s.auto) {
      s.auto = false;
      s.route = null;
      s.lastInput = performance.now();
      return;
    }
    s.auto = true;
  }, []);

  // Quick travel: swing the camera there, or have the autopilot take you —
  // by road in the car (keeping left), straight across in the drone. Any
  // drive key takes back the wheel.
  const roadGraph = useMemo(() => buildRoadGraph(layout), [layout]);
  // Traffic lights at the highway junctions, and the other cars (filled in by <Traffic>).
  const signals = useMemo(() => placeSignals(layout), [layout]);
  const trafficCars = useRef([]);
  const onArrive = useCallback(() => audio.ui("open"), []);
  const tour = useRef({ visited: new Set(), last: null });
  // After a manual detour, head for the same place from wherever we are now.
  const replan = useCallback(
    (s, type, route) => {
      const city = layout.cities[route.cityId];
      if (!city) return null;
      return { ...planRoute(layout, roadGraph, s, city, type, { through: route.through }), label: route.label, tour: route.tour };
    },
    [layout, roadGraph]
  );
  const planTour = useCallback(
    (s, type) => {
      const city = nextTourStop(layout, s, tour.current);
      return city ? { ...planRoute(layout, roadGraph, s, city, type, { through: true }), label: city.language, tour: true } : null;
    },
    [layout, roadGraph]
  );
  const goTo = useCallback(
    (city) => {
      audio.ui("open");
      if (!driving) {
        focus.current = surfacePoint(R, city.x, city.z, 0);
        return;
      }
      const s = vehicleState.current;
      if (s.transform != null) return;
      s.route = { ...planRoute(layout, roadGraph, s, city, vehicle), label: city.language };
      Object.assign(s, { auto: false, lastInput: performance.now() });
    },
    [driving, layout, roadGraph, R, vehicle]
  );

  // Stuck? Back onto the nearest bit of road.
  const unstick = useCallback(() => {
    const s = vehicleState.current;
    if (s.transform != null) return;
    let best = null;
    for (const road of layout.roads) {
      for (let i = 1; i < road.points.length; i++) {
        const [x, z] = road.points[i];
        const d = worldDistance(layout, x, z, s.x, s.z);
        if (!best || d < best.d) best = { d, road, i };
      }
    }
    if (!best) return;
    const [x0, z0] = best.road.points[best.i - 1];
    const [x1, z1] = best.road.points[best.i];
    Object.assign(s, { x: x1, z: z1, yaw: Math.atan2(-(x1 - x0), -(z1 - z0)), speed: 0, steer: 0, auto: false, lastInput: performance.now() });
    if (vehicle === "drone") s.alt = Math.max(s.alt, 3);
    audio.ui("click");
  }, [layout, vehicle]);

  const screenshot = useCallback(() => {
    const url = capture.current?.();
    if (!url) return;
    countEvent("planet", "screenshot");
    audio.ui("shutter");
    setFlash((n) => n + 1);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planet-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
    a.click();
  }, []);

  const rootRef = useRef();
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.();
  }, []);

  const toggleMode = useCallback(() => {
    if (mode === "drive") {
      // Pull right back to see the whole planet, centred over the vehicle.
      const s = vehicleState.current;
      focus.current = surfacePoint(R, s.x, s.z, s.alt);
      focus.current.distance = R * 2.6;
    }
    setMode(mode === "orbit" ? "drive" : "orbit");
    keys.current.clear();
  }, [mode, R]);

  const chooseVehicle = useCallback((v) => {
    // Let a transformation finish before starting another.
    if (vehicleState.current.transform != null) return;
    setVehicle(v);
    setMode("drive");
    keys.current.clear();
  }, []);

  const closeHelp = useCallback(() => setShowHelp(false), []);

  // The key hints go once you've been driving by hand for a few seconds (for
  // this visit); they're in Help from then on.
  const [hintsDone, setHintsDone] = useState(false);
  useEffect(() => {
    if (!driving || hintsDone) return;
    let driven = 0;
    const id = setInterval(() => {
      const k = keys.current;
      if (["up", "down", "left", "right", "arrowUp", "arrowDown", "arrowLeft", "arrowRight"].some((c) => k.has(c))) driven += 0.25;
      if (driven >= HINTS_FOR) setHintsDone(true);
    }, 250);
    return () => clearInterval(id);
  }, [driving, hintsDone]);

  // Keyboard: driving keys + shortcuts. Only while the explorer is mounted.
  useEffect(() => {
    const down = (e) => {
      if (e.target.closest?.("input, textarea, [contenteditable]")) return;
      const control = KEY_MAP[e.code];
      if (control && driving) {
        keys.current.add(control);
        e.preventDefault();
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyC") toggleMode();
      else if (e.code === "KeyV") chooseVehicle(vehicle === "car" ? "drone" : "car");
      else if (e.code === "KeyT") setView((v) => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length]);
      else if (e.code === "KeyP") toggleAutopilot();
      else if (e.code === "KeyG") setRouteViz((v) => !v);
      else if (e.code === "KeyI") setDecisions((v) => !v);
      else if (e.code === "KeyO") setShowInputs((v) => !v);
      else if (e.code === "KeyB" && vehicle === "drone") {
        // Swap the drone's battery — on the ground only.
        const s = vehicleState.current;
        s.battery ??= freshBattery();
        if ((s.alt ?? 0) < 0.3) {
          swapBattery(s.battery);
          s.batteryNote = "Fresh battery fitted";
        } else s.batteryNote = "Land first to swap the battery";
        s.batteryNoteAt = performance.now();
      }
      else if (e.code === "Equal" || e.code === "NumpadAdd") nudgeAltitude(DRONE_ALT.step);
      else if (e.code === "Minus" || e.code === "NumpadSubtract") nudgeAltitude(-DRONE_ALT.step);
      else if (e.code === "KeyX" && driving) unstick();
      else if (e.code === "KeyL" && driving && vehicle === "car") {
        // Cruise control: lock the speed you're doing (or let it go). You're
        // driving from here, so the autopilot hands over.
        const s = vehicleState.current;
        if (s.cruise == null && s.speed >= CRUISE_MIN && s.transform == null) {
          s.auto = false;
          s.route = null;
          s.lastInput = performance.now();
          s.cruise = s.speed;
        } else s.cruise = null;
      }
      else if (e.code === "KeyK") screenshot();
      else if (e.code === "KeyM") radio.toggle();
      else if (e.code === "KeyN") radio.next();
      else if (e.code === "KeyH" || e.key === "?") setShowHelp((s) => !s);
      else if (e.code === "KeyE" && nearbyId) select(nearbyId);
      else if (e.code === "Escape") {
        if (showHelp) closeHelp();
        else if (selectedId) setSelectedId(null);
        else onExit();
      }
    };
    const up = (e) => {
      const control = KEY_MAP[e.code];
      if (control) keys.current.delete(control);
    };
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [driving, vehicle, nearbyId, selectedId, showHelp, toggleMode, chooseVehicle, select, closeHelp, onExit, toggleAutopilot, unstick, screenshot, nudgeAltitude]);

  // Sound starts on the first click or key press (browser rule), stops on the
  // way out. Any button in the HUD gives a soft click.
  useEffect(() => {
    const start = () => audio.start();
    const click = (e) => {
      if (e.target.closest?.(".city-root button")) audio.ui("click");
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    window.addEventListener("click", click);
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      window.removeEventListener("click", click);
      radio.stop();
      audio.stop();
    };
  }, []);

  // The explorer owns the whole viewport; stop the page behind it scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Track the building closest to the active vehicle so the HUD can offer "Press E".
  const nearbyRef = useRef(null);
  const onVehicleMove = useCallback(
    (s, alt) => {
      let best = null;
      if (alt < NEARBY_MAX_ALT) {
        let bestDist = NEARBY_DISTANCE;
        for (const b of layout.buildings) {
          const d = worldDistance(layout, b.x, b.z, s.x, s.z);
          if (d < bestDist) {
            best = b.id;
            bestDist = d;
          }
        }
      }
      if (best !== nearbyRef.current) {
        nearbyRef.current = best;
        setNearbyId(best);
      }
    },
    [layout]
  );

  // Open with the planet and the black hole on screen together, as big as that allows.
  const [opening] = useState(() => {
    const sun = sunDirection(planetHours(new Date()), noonLongitude(layout));
    return openingCamera(sun, BLACK_HOLE_DISTANCE, window.innerWidth / window.innerHeight, BLACK_HOLE_RADIUS).map((c) => c * R);
  });

  if (!webgl) {
    return (
      <div className="city-fallback">
        <h1>The 3D planet needs WebGL</h1>
        <p>Your browser or device doesn&rsquo;t support it. Everything is on the main page too.</p>
        <button className="btn btn-primary" onClick={onExit}>
          Back to the portfolio
        </button>
      </div>
    );
  }

  const fit = portraitFit();

  const nearby = driving && nearbyId ? buildingsById.get(nearbyId) : null;

  return (
    <div
      className={`city-root${musicActive ? " music-active" : ""}${musicOnly ? " music-only" : ""}${driving && decisions ? " decisions-on" : ""}${driving && view === "fpv" ? " fpv-on" : ""}`}
      ref={rootRef}
    >
      <Canvas
        // Antialiasing is fixed when the WebGL context is created, so changing
        // it remounts the canvas (the vehicle and settings live outside it).
        key={gfx.antialias ? "aa" : "no-aa"}
        gl={{ antialias: gfx.antialias, powerPreference: "high-performance" }}
        shadows={gfx.shadows !== "off"}
        dpr={pixelRatio(gfx, window.devicePixelRatio, window.innerWidth * window.innerHeight)}
        frameloop={gfx.fps >= 60 ? "always" : "demand"}
        camera={{ position: opening, fov: 50, near: 0.5, far: R * 60 }}
        onPointerMissed={() => setSelectedId(null)}
        style={{ cursor: hoveredId ? "pointer" : "grab" }}
      >
        {gfx.fps < 60 && <FrameLimiter fps={gfx.fps} />}
        <StatsProbe out={stats} />
        <Capture target={capture} />
        <AudioDriver layout={layout} vehicle={vehicleState} type={vehicle} driving={driving} keys={keys} traffic={trafficCars} />
        <SunClock layout={layout} mode={timeMode} vehicle={vehicleState} camera={cameraState} driving={driving} />
        <Sky R={R} mode={gfx.sky} stars={gfx.stars} />
        <BlackHole R={R} quality={gfx.blackHole} />
        <Lighting R={R} shadows={gfx.shadows} key={gfx.shadows} />
        <CameraTracker target={cameraState} />
        <Suspense fallback={<Loader />}>
          <Planet layout={layout} atmosphere={gfx.atmosphere} />
          {gfx.clouds && <Clouds R={R} />}
          <River layout={layout} animate={gfx.water} />
          <Sea layout={layout} animate={gfx.water} />
          <Mountains layout={layout} />
          <Roads layout={layout} />
          {gfx.lamps && <Lamps layout={layout} />}
          <Districts layout={layout} driving={driving} labels={gfx.labels} />
          <Buildings
            layout={layout}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={select}
            onHover={setHoveredId}
            signs={gfx.signs}
            windows={gfx.windows}
          />
          {gfx.billboards && <Billboards layout={layout} />}
          {gfx.streetSigns && <StreetSigns layout={layout} />}
          {gfx.trees && <Trees layout={layout} />}
          <Vehicle layout={layout} state={vehicleState} type={vehicle} keys={keys} active={driving} onMove={onVehicleMove} onArrive={onArrive} planTour={planTour} replan={replan} traffic={trafficCars} signals={signals} graph={roadGraph} view={driving ? view : "chase"} mirror={gfx.shadows !== "off" || gfx.resolution >= 1} />
          <TrafficLights layout={layout} signals={signals} cars={trafficCars} player={vehicleState} />
          <DriftFx state={vehicleState} enabled={vehicle === "car"} />
          {TRAFFIC_CARS[gfx.traffic] > 0 && (
            <Traffic
              key={gfx.traffic}
              layout={layout}
              graph={roadGraph}
              signals={signals}
              count={TRAFFIC_CARS[gfx.traffic]}
              carsRef={trafficCars}
              player={vehicleState}
              vehicleType={vehicle}
            />
          )}
          {routeViz && <RouteViz layout={layout} state={vehicleState} inside={driving && view === "fpv"} />}
          {decisions && driving && <DriverView layout={layout} state={vehicleState} type={vehicle} />}
          {hoveredId && hoveredId !== selectedId && <HoverLabel R={R} building={buildingsById.get(hoveredId)} />}
        </Suspense>
        {driving ? (
          <ChaseCamera layout={layout} state={vehicleState} vehicle={vehicle} view={view} snap={Boolean(startVehicle)} />
        ) : (
          <OrbitRig focus={focus} R={R} maxDistance={Math.max(R * 7 * fit, Math.hypot(...opening) * 1.05)} />
        )}
        <ViewShift enabled={!driving} />
      </Canvas>

      <Toolbar
        mode={mode}
        vehicle={vehicle}
        view={view}
        onView={setView}
        sound={sound}
        onToggleSound={() => updateAudio({ enabled: !sound })}
        goTo={<GoToMenu cities={layout.cities} onGo={goTo} />}
        onScreenshot={screenshot}
        onFullscreen={fullscreen}
        onLookAround={() => driving && toggleMode()}
        onVehicle={chooseVehicle}
        onHelp={() => setShowHelp(true)}
        onGraphics={() => {
          setShowGraphics((v) => !v);
          setShowRadio(false);
          setShowPilot(false);
        }}
        onAutopilot={() => {
          setShowPilot((v) => !v);
          setShowGraphics(false);
          setShowRadio(false);
        }}
        autopilotOpen={showPilot}
        radioButton={
          <RadioButton
            open={showRadio}
            onClick={() => {
              setShowRadio((v) => !v);
              setShowGraphics(false);
              setShowPilot(false);
            }}
          />
        }
        graphicsOpen={showGraphics}
        onExit={onExit}
      />
      {showGraphics && (
        <GraphicsPanel
          timeMode={timeMode}
          onTimeMode={setTimeMode}
          droneMode={droneMode}
          onDroneMode={setDroneMode}
          settings={gfx}
          onChange={updateGfx}
          stats={stats}
          onClose={() => setShowGraphics(false)}
          audioSettings={audioSettings}
          onAudioChange={updateAudio}
        />
      )}
      {showPilot && (
        <AutopilotPanel
          onClose={() => setShowPilot(false)}
          autoSpeed={autoKmh}
          onAutoSpeed={setAutoKmh}
          autoRoute={autoRoute}
          onAutoRoute={setAutoRoute}
          routeViz={routeViz}
          onRouteViz={setRouteViz}
          decisions={decisions}
          onDecisions={setDecisions}
          viewRange={viewRange}
          onViewRange={setViewRange}
          rules={pilotRules}
          onRules={setPilotRules}
          showInputs={showInputs}
          onShowInputs={setShowInputs}
        />
      )}
      {showRadio && <RadioPanel onClose={() => setShowRadio(false)} volume={audioSettings.music} onVolume={(v) => updateAudio({ music: v, musicMuted: false })} />}
      <MiniPlayer
        onOpen={() => {
          setShowRadio(true);
          setShowGraphics(false);
        }}
      />
      {driving && view === "fpv" && <FpvOverlay vehicle={vehicleState} type={vehicle} altitude={droneAlt} />}
      {driving && vehicle === "drone" && <BatteryPrompt vehicle={vehicleState} />}
      {driving && showInputs && <InputsPanel vehicle={vehicleState} type={vehicle} />}
      {driving && decisions && <DriverPanel vehicle={vehicleState} />}
      {driving && <Gauge vehicle={vehicleState} type={vehicle} onToggleAuto={toggleAutopilot} altitude={droneAlt} onAltitude={nudgeAltitude} />}
      {driving && <KeyHints type={vehicle} droneMode={droneMode} hidden={hintsDone} />}
      {driving && vehicle === "car" && <DriftScore vehicle={vehicleState} />}
      <HighOffer settings={gfx} onAccept={() => updateGfx("high")} />
      <StartHint
        driving={driving}
        sound={sound}
        onToggle={toggleMode}
        onSound={() => updateAudio({ enabled: true })}
      />
      {flash > 0 && <div className="shutter-flash" key={flash} />}
      <Minimap
        showRoute={routeViz}
        traffic={trafficCars}
        layout={layout}
        vehicle={vehicleState}
        vehicleType={vehicle}
        camera={cameraState}
        driving={driving}
        selectedId={selectedId}
        onPick={(x, z) => {
          if (!driving) focus.current = surfacePoint(R, x, z, 0);
        }}
      />
      <PlanetClock layout={layout} vehicle={vehicleState} camera={cameraState} driving={driving} mode={timeMode} />
      {nearby && !selected && (
        <button className="city-prompt" onClick={() => select(nearby.id)}>
          <kbd>E</kbd> Visit <strong>{nearby.project.title}</strong>
        </button>
      )}
      {driving && <TouchPad keys={keys} flying={vehicle === "drone"} />}
      {selected && <InfoPanel building={selected} onClose={() => setSelectedId(null)} />}
      {showHelp && <HelpOverlay onClose={closeHelp} type={vehicle} droneMode={droneMode} />}
    </div>
  );
}

// Orbits the planet's centre; when something is selected, swings round so
// it's in front of you.
function OrbitRig({ focus, R, maxDistance }) {
  const controls = useRef();
  const camera = useThree((s) => s.camera);
  // The chase camera tilts camera.up to the local surface normal; orbit
  // controls need world-up back before they're created.
  camera.up.set(0, 1, 0);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const cancel = () => (focus.current = null);
    c.addEventListener("start", cancel);
    return () => c.removeEventListener("start", cancel);
  }, [focus]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c || !focus.current) return;
    const t = 1 - Math.exp(-3 * Math.min(delta, 0.05));
    // Swing over the point at the requested distance, or at about the current one.
    const dist = focus.current.distance ?? THREE.MathUtils.clamp(camera.position.length(), R + 35, R * 2.2);
    const desired = focus.current.clone().normalize().multiplyScalar(dist);
    camera.position.lerp(desired, t);
    camera.position.setLength(THREE.MathUtils.lerp(camera.position.length(), dist, t));
    if (camera.position.distanceTo(desired) < 0.5) focus.current = null;
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 0, 0]}
      enableDamping
      enablePan={false}
      minDistance={R + 14}
      maxDistance={maxDistance}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
    />
  );
}

// The sun's longitude the opening camera angle was composed for.
const OPENING_SUN_LON = Math.atan2(-0.955, 0.016);

// Planet "noon" is when the black hole is over the first résumé district.
function noonLongitude(layout) {
  const first = layout.cities.find((c) => c.side === "north") ?? layout.cities[0];
  return first ? first.x / layout.radius : 0;
}

// Renders a fresh frame and returns it as a PNG data URL (for the screenshot button).
function Capture({ target }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    target.current = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    };
    return () => (target.current = null);
  }, [gl, scene, camera, target]);
  return null;
}

// Feeds the audio engine every frame: engine state, where the black hole is
// relative to the camera, day/night where you are, the river nearby, bumps,
// and a chime whenever you roll into a district. Your vehicle is as loud as
// it is from where the camera is (silent once the camera leaves the planet),
// and the nearest traffic is heard passing, from its side, with its pitch
// rising as it comes and falling as it goes.
function AudioDriver({ layout, vehicle, type, driving, keys, traffic }) {
  const camera = useThree((s) => s.camera);
  const last = useRef({ bump: 0, bumpAt: 0, district: null });
  const tmp = useMemo(() => ({ forward: new THREE.Vector3(), toHole: new THREE.Vector3(), up: new THREE.Vector3(), at: new THREE.Vector3() }), []);
  useFrame(() => {
    const s = vehicle.current;
    const R = layout.radius;
    // How far the camera is from your vehicle: inside it or following, you
    // hear it fully; zoomed out over the planet, not at all.
    const audible = s.worldMatrix ? audibility(tmp.at.setFromMatrixPosition(s.worldMatrix).distanceTo(camera.position), 25, 140) : 0;
    // The traffic within earshot of you, nearest first.
    let passers = [];
    if (audible > 0 && type === "car") {
      const me = { x: s.x, z: s.z, yaw: s.yaw, ...planeVelocity(s) };
      passers = nearestCars(traffic.current ?? [], me, PASSERS, layout.width).map((c) => ({ speed: c.speed, ...heard(me, { x: c.x, z: c.z, ...planeVelocity(c) }, layout.width) }));
    }
    camera.getWorldDirection(tmp.forward);
    tmp.toHole.copy(SUN_DIRECTION).multiplyScalar(R * 2.48).sub(camera.position).normalize();
    const facingHole = Math.max(0, tmp.forward.dot(tmp.toHole));
    // Day or night where you are: under the vehicle, or below the camera.
    if (driving) {
      const lon = s.x / R;
      const lat = -s.z / R;
      tmp.up.set(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
    } else tmp.up.copy(camera.position).normalize();
    const night = THREE.MathUtils.clamp(0.5 - tmp.up.dot(SUN_DIRECTION) * 3, 0, 1);
    const near = driving ? riverDistance(layout, s.x, s.z, 40) : Infinity;
    audio.update({
      vehicle: type,
      speed: s.speed,
      maxSpeed: type === "car" ? 24 : 42,
      surface: s.surface,
      throttle: s.throttle ?? (keys.current.has("up") ? 1 : 0),
      steer: s.steer,
      slip: type === "car" ? s.slip : 0,
      drifting: type === "car" && Boolean(s.drifting),
      alt: s.alt,
      climb: s.climb,
      transforming: s.transform != null,
      driving,
      night,
      facingHole,
      river: near === Infinity ? 0 : Math.max(0, 1 - near / 40) * (s.alt < 20 ? 1 : 0.3),
      audible,
      passers,
    });

    const now = performance.now();
    const l = last.current;
    if ((s.bump ?? 0) !== l.bump) {
      l.bump = s.bump;
      if ((s.bumpStrength ?? 0) * audible > 0.12 && now - l.bumpAt > 300) {
        l.bumpAt = now;
        // A knock is a thud; a real hit is a crash (heard less from further off).
        if (s.bumpStrength > CRASH_FROM) audio.crash(s.bumpStrength * audible);
        else audio.thud(s.bumpStrength * audible);
      }
    }
    if (driving && s.alt < 25) {
      const inside = layout.cities.find((c) => worldDistance(layout, c.x, c.z, s.x, s.z) < c.radius + 1);
      const id = inside ? inside.id : null;
      if (id !== l.district) {
        l.district = id;
        if (inside) audio.chime(inside.id, inside.side === "north");
      }
    }
  });
  return null;
}

/** A car's velocity in the plane, for the Doppler effect. */
function planeVelocity(c) {
  const v = velocityOf({ ...c, speed: c.speed ?? 0, yaw: c.yaw ?? 0 });
  return { vx: v.x, vz: v.z };
}

// Caps the frame rate: with frameloop="demand", only render when this says so.
function FrameLimiter({ fps }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const interval = 1000 / fps;
    let last = 0;
    let raf;
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      if (t - last >= interval - 2) {
        last = t;
        invalidate();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps, invalidate]);
  return null;
}

// Frame rate and renderer counters for the Graphics panel.
function StatsProbe({ out }) {
  const gl = useThree((s) => s.gl);
  const frames = useRef({ count: 0, since: performance.now() });
  useEffect(() => {
    const ctx = gl.getContext();
    const info = ctx.getExtension("WEBGL_debug_renderer_info");
    out.current.renderer = info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : "";
  }, [gl, out]);
  useFrame(() => {
    const f = frames.current;
    f.count++;
    const now = performance.now();
    if (now - f.since >= 1000) {
      out.current.fps = Math.round((f.count * 1000) / (now - f.since));
      f.count = 0;
      f.since = now;
    }
    // Counters are from the previous frame (reset at the start of each render).
    out.current.calls = gl.info.render.calls;
    out.current.triangles = gl.info.render.triangles;
    out.current.geometries = gl.info.memory.geometries;
    out.current.textures = gl.info.memory.textures;
  });
  return null;
}

// Moves the sun (black hole) and turns the sky from the planet clock.
// The planet time actually shown (it eases into a new time-of-day mode).
const NOW = { hours: null };

/** Longitude (radians) of whoever's looking: the vehicle, or the middle of the view. */
function viewerLongitude(layout, vehicle, camera, driving) {
  if (driving) return vehicle.current.x / layout.radius;
  const p = camera.current.position;
  return Math.atan2(p.x, p.z);
}

function SunClock({ layout, mode, vehicle, camera, driving }) {
  const noon = useMemo(() => noonLongitude(layout), [layout]);
  useFrame((_, delta) => {
    const target = hoursForMode(mode, new Date(), noon, viewerLongitude(layout, vehicle, camera, driving));
    // Switching mode swings the sun across over a couple of seconds.
    NOW.hours = NOW.hours == null ? target : approachHours(NOW.hours, target, Math.max(Math.min(delta, 0.1) * 8, mode === "cycle" ? 0.5 : 0));
    const hours = NOW.hours;
    SUN_DIRECTION.fromArray(sunDirection(hours, noon));
    // Stars turn with the black hole, plus a slow extra drift as the planet
    // works its way round its orbit.
    SKY_ROTATION.y = sunLongitude(hours, noon) - OPENING_SUN_LON + (Date.now() / 1000 / 3600) * 0.6;
  });
  return null;
}

// Local planet time where you are (the vehicle, or the middle of the view).
function PlanetClock({ layout, vehicle, camera, driving, mode }) {
  const [text, setText] = useState(null);
  useEffect(() => {
    const noon = noonLongitude(layout);
    const tick = () => {
      const lon = viewerLongitude(layout, vehicle, camera, driving);
      const h = localHours(NOW.hours ?? planetHours(new Date()), noon, lon);
      const day = h >= 6 && h < 18;
      setText({ day, time: formatHours(h) });
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [layout, vehicle, camera, driving, mode]);
  return (
    <div className="planet-clock" title="Planet time here. One planet day = 4 real minutes, synced to your clock.">
      <b>
        {text && <Icon name={text.day ? "sun" : "moon"} />} {text?.time}
      </b>
      <span>{mode === "cycle" ? `local time · 1 day = ${PLANET_DAY_SECONDS / 60} min` : mode === "day" ? "always day here" : "always night here"}</span>
    </div>
  );
}

// Shifts the picture (a lens shift, not a camera move) so the black hole fits on
// screen with the planet while orbiting. Off when driving.
function ViewShift({ enabled }) {
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  useEffect(() => {
    const { x, y } = shiftFor(size.width / size.height);
    if (enabled) camera.setViewOffset(size.width, size.height, -size.width * x, -size.height * Math.abs(y), size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [enabled, camera, size.width, size.height]);
  return null;
}

// Copies the camera position out of the canvas for the minimap.
function CameraTracker({ target }) {
  useFrame(({ camera }) => target.current.position.copy(camera.position));
  return null;
}

function HoverLabel({ R, building }) {
  const position = useMemo(() => building && surfacePoint(R, building.x, building.z, building.height + 2), [R, building]);
  if (!building) return null;
  return (
    <Html position={position} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
      <div className="hover-label">{building.project.title}</div>
    </Html>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="city-loader">Terraforming…</div>
    </Html>
  );
}



