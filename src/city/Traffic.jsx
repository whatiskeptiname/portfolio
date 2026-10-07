// src/city/Traffic.jsx — the other cars and the traffic lights.
// The cars are simulated by lib/trafficSim (they drive by the same rules as
// your autopilot) and drawn as instanced meshes: bodies tinted per car, and
// head/tail lights that glow brighter when they brake. The lights are a post
// and a three-lamp head on the left of every stop line, plus the white stop
// line itself; their lamps change with lib/traffic's signal timing.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bridgeElevation, createRng } from "../lib/layout";
import { signalColor, stepSignals, trafficTime } from "../lib/traffic";
import { createTraffic, stepTraffic } from "../lib/trafficSim";
import { surfaceMatrix } from "./globe3d";
import { useDisposable } from "./gpu";

function box(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const c = new THREE.Color(color);
  g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3));
  return g;
}

// A small hatchback, nose toward -z like the player's car. White body parts
// take each car's tint; glass, tyres and trim stay dark.
function carGeometry() {
  const parts = [
    box(1.8, 0.62, 4.1, 0, 0.62, 0, "#ffffff"), // body
    box(1.62, 0.55, 2.1, 0, 1.2, 0.35, "#ffffff"), // cabin
    box(1.66, 0.42, 1.95, 0, 1.2, 0.35, "#1b2129"), // windows (inset band)
    box(1.86, 0.22, 4.16, 0, 0.36, 0, "#2a2d33"), // skirt / bumpers
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.3, 0.62, 0.62, sx * 0.86, 0.31, sz * 1.35, "#111316"))), // tyres
  ];
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

function lightGeometry() {
  const parts = [
    box(0.42, 0.18, 0.06, -0.6, 0.72, -2.06, "#fff3cf"),
    box(0.42, 0.18, 0.06, 0.6, 0.72, -2.06, "#fff3cf"),
    box(0.46, 0.18, 0.06, -0.6, 0.74, 2.06, "#ff2a2a"),
    box(0.46, 0.18, 0.06, 0.6, 0.74, 2.06, "#ff2a2a"),
  ];
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

/**
 * @param {{ count: number, carsRef: { current: object[] }, player: { current: object } }} props
 *   carsRef is filled with the live cars (for your autopilot and the minimap).
 */
export function Traffic({ layout, graph, signals, count, carsRef, player, vehicleType }) {
  const R = layout.radius;
  const bodies = useRef();
  const lights = useRef();
  const cars = useMemo(() => createTraffic(layout, count, createRng(`traffic-${count}`)), [layout, count]);
  useEffect(() => {
    carsRef.current = cars;
    return () => {
      carsRef.current = [];
    };
  }, [cars, carsRef]);
  const geo = useDisposable(() => ({ body: carGeometry(), light: lightGeometry() }), []);
  const materials = useDisposable(
    () => ({
      body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 }),
      light: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    }),
    []
  );

  // Body tints, set once.
  useEffect(() => {
    const c = new THREE.Color();
    cars.forEach((car, i) => bodies.current.setColorAt(i, c.setHSL(car.hue, 0.55, 0.5)));
    bodies.current.instanceColor.needsUpdate = true;
  }, [cars]);

  const m = useMemo(() => new THREE.Matrix4(), []);
  const dim = useMemo(() => new THREE.Color(0.55, 0.55, 0.55), []);
  const bright = useMemo(() => new THREE.Color(1.6, 1.6, 1.6), []);
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const p = player.current;
    // Your car is someone to keep a gap from (not the drone, unless it's landed).
    const you = vehicleType === "car" || (p.alt ?? 0) < 1.5 ? p : null;
    stepTraffic(cars, { world: layout, graph, signals, t: trafficTime(), player: you }, dt);
    cars.forEach((car, i) => {
      surfaceMatrix(R, car.x, car.z, bridgeElevation(layout, car.x, car.z), car.yaw, m);
      bodies.current.setMatrixAt(i, m);
      lights.current.setMatrixAt(i, m);
      lights.current.setColorAt(i, car.braking ? bright : dim);
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    lights.current.instanceMatrix.needsUpdate = true;
    if (lights.current.instanceColor) lights.current.instanceColor.needsUpdate = true;
  });

  if (!cars.length) return null;
  return (
    <>
      <instancedMesh ref={bodies} args={[geo.body, materials.body, cars.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={lights} args={[geo.light, materials.light, cars.length]} frustumCulled={false} />
    </>
  );
}

const LAMP_COLORS = { red: "#ff2b2b", amber: "#ffb000", green: "#21ff7a" };

export function TrafficLights({ layout, signals, cars, player }) {
  const R = layout.radius;
  const approaches = useMemo(() => signals.flatMap((s) => s.approaches.map((ap) => ({ ...ap, signal: s }))), [signals]);
  // Static parts: posts, arms, lamp housings and stop lines, merged.
  const statics = useDisposable(() => {
    const parts = [];
    const lane = 1.9;
    for (const ap of approaches) {
      const yaw = Math.atan2(-ap.dir[0], -ap.dir[1]); // facing the traffic that comes to it: back toward it
      const base = surfaceMatrix(R, ap.x, ap.z, bridgeElevation(layout, ap.x, ap.z), yaw);
      // Post on the left of the lane (traffic keeps left), housing facing oncoming drivers.
      const post = (g) => parts.push(g.applyMatrix4(base));
      post(box(0.18, 4.4, 0.18, -(lane + 1.6), 2.2, 0, "#2b2e35"));
      post(box(0.5, 1.5, 0.45, -(lane + 1.6), 4.0, 0.05, "#16181c"));
      post(box(0.7, 1.75, 0.08, -(lane + 1.6), 4.0, -0.22, "#0d0e10")); // backplate
      // Stop line across the lane.
      post(box(3.6, 0.03, 0.4, 0, 0.27, 0, "#f4f4ee"));
    }
    if (!parts.length) return null;
    const g = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    return g;
  }, [approaches, R, layout]);

  const lamps = useRef([]);
  const lampGeo = useDisposable(() => new THREE.CylinderGeometry(0.17, 0.17, 0.1, 12).rotateX(Math.PI / 2), []);
  const lampMat = useDisposable(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const matrices = useMemo(
    () =>
      approaches.map((ap) => {
        const yaw = Math.atan2(-ap.dir[0], -ap.dir[1]);
        const base = surfaceMatrix(R, ap.x, ap.z, bridgeElevation(layout, ap.x, ap.z), yaw);
        // Red on top, amber, green — facing back down the lane (+z local).
        return [4.45, 4.0, 3.55].map((y) => base.clone().multiply(new THREE.Matrix4().makeTranslation(-(1.9 + 1.6), y, 0.29)));
      }),
    [approaches, R, layout]
  );
  useEffect(() => {
    lamps.current.forEach((mesh, k) => {
      if (!mesh) return;
      matrices.forEach((list, i) => mesh.setMatrixAt(i, list[k]));
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [matrices]);

  const off = useMemo(() => new THREE.Color("#2a1a12"), []);
  const on = useMemo(() => Object.fromEntries(Object.entries(LAMP_COLORS).map(([k, v]) => [k, new THREE.Color(v).multiplyScalar(2.2)])), []);
  useFrame((_, rawDelta) => {
    // The lights are actuated: green goes to the approaches with cars waiting
    // (other cars and you), stepped once a frame here for everyone.
    const you = player?.current;
    const traffic = cars?.current ?? [];
    stepSignals(signals, you && (you.alt ?? 0) < 1.5 ? [...traffic, you] : traffic, Math.min(rawDelta, 0.05), layout.width);
    const t = trafficTime();
    const colors = approaches.map((ap) => signalColor(ap.signal, ap.group, t));
    ["red", "amber", "green"].forEach((name, k) => {
      const mesh = lamps.current[k];
      if (!mesh) return;
      colors.forEach((c, i) => mesh.setColorAt(i, c === name ? on[name] : off));
      mesh.instanceColor.needsUpdate = true;
    });
  });

  if (!statics) return null;
  return (
    <>
      <mesh geometry={statics} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </mesh>
      {[0, 1, 2].map((k) => (
        <instancedMesh
          key={k}
          ref={(el) => {
            lamps.current[k] = el;
          }}
          args={[lampGeo, lampMat, approaches.length]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}
