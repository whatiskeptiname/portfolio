// src/city/Traffic.jsx — the other cars and the traffic lights.
// The cars are simulated by lib/trafficSim (they drive by the same rules as
// your autopilot) and drawn as instanced meshes: hatchbacks, saloons and SUVs,
// one mesh per style, tinted per car; and
// lamps that behave like real ones (lib/carLights): running lights by day,
// headlights and tail lights at night, brake lights, indicators and hazards. The lights are a post
// and a three-lamp head on the left of every stop line, plus the white stop
// line itself; their lamps change with lib/traffic's signal timing.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bridgeElevation, createRng } from "../lib/layout";
import { signalColor, stepSignals, trafficTime } from "../lib/traffic";
import { createTraffic, stepTraffic } from "../lib/trafficSim";
import { sunlightAt, surfaceMatrix } from "./globe3d";
import { carLamps } from "../lib/carLights";
import { useDisposable } from "./gpu";

// A part painted one colour (white parts take each car's tint).
function painted(geometry, color) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}
const boxAt = (w, h, d, x, y, z, color) => painted(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);

// A side profile (x along the car, nose at −x; y up), extruded across with
// rounded edges and turned so the nose faces −z.
function sideways(points, width, bevel, color) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return painted(g, color);
}

const GLASS = "#121a24";
const TRIM = "#24272d";
const TYRE = "#111316";
const RIM = "#d5d8dc"; // light, so it stays silver-ish under each car's tint

// The body styles the traffic is made of. All share a footprint (4.1 m long,
// 1.8 m wide) so the lamps line up on every one.
const STYLES = {
  hatchback: {
    body: [[-2.05, 0.3], [2.0, 0.3], [2.07, 0.56], [2.02, 0.96], [1.62, 1.03], [-0.7, 1.0], [-1.92, 0.87], [-2.08, 0.6]],
    glass: [[-0.7, 0.98], [1.58, 0.98], [1.38, 1.58], [-0.04, 1.62]],
    roof: [[0.0, 1.6], [1.34, 1.6], [1.3, 1.66], [0.04, 1.66]],
    wheel: 0.34,
  },
  saloon: {
    body: [[-2.05, 0.3], [2.04, 0.3], [2.08, 0.58], [2.05, 0.9], [1.3, 0.97], [-0.62, 0.97], [-1.94, 0.84], [-2.08, 0.6]],
    glass: [[-0.62, 0.95], [1.28, 0.95], [0.78, 1.5], [-0.02, 1.53]],
    roof: [[0.02, 1.51], [0.74, 1.51], [0.7, 1.57], [0.05, 1.57]],
    wheel: 0.34,
  },
  suv: {
    body: [[-2.05, 0.4], [2.04, 0.4], [2.08, 0.72], [2.05, 1.16], [1.86, 1.2], [-0.6, 1.2], [-1.94, 1.06], [-2.08, 0.76]],
    glass: [[-0.6, 1.18], [1.86, 1.18], [1.8, 1.9], [-0.04, 1.94]],
    roof: [[0.0, 1.92], [1.78, 1.92], [1.76, 1.98], [0.02, 1.98]],
    wheel: 0.4,
  },
};
const TRAFFIC_STYLES = Object.keys(STYLES);

function carGeometry(style) {
  const { body, glass, roof, wheel } = STYLES[style];
  const parts = [
    sideways(body, 1.8, 0.1, "#ffffff"),
    sideways(glass, 1.64, 0.06, GLASS),
    sideways(roof, 1.66, 0.03, "#ffffff"),
    // (The rounded body reaches about ±2.15 along; bumpers, grille and lamps sit on it.)
    boxAt(1.84, 0.2, 0.24, 0, 0.38, -2.12, TRIM), // front bumper
    boxAt(1.84, 0.2, 0.24, 0, 0.4, 2.12, TRIM), // rear bumper
    boxAt(0.86, 0.14, 0.1, 0, 0.6, -2.16, TRIM), // grille
    ...[-1, 1].flatMap((side) => [
      boxAt(0.16, 0.1, 0.18, side * 0.98, style === "suv" ? 1.26 : 1.05, -0.62, TRIM), // mirror
      boxAt(0.04, 0.08, 3.0, side * 0.91, 0.36, 0, TRIM), // side skirt
      ...[-1.35, 1.35].flatMap((z) => [
        painted(new THREE.CylinderGeometry(wheel, wheel, 0.26, 16).rotateZ(Math.PI / 2).translate(side * 0.84, wheel, z), TYRE),
        painted(new THREE.CylinderGeometry(wheel * 0.62, wheel * 0.62, 0.04, 12).rotateZ(Math.PI / 2).translate(side * 0.98, wheel, z), RIM),
      ]),
    ]),
  ];
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

// The lamps, in groups that light up separately (each car tints its own).
function lampGeometry(parts) {
  const g = mergeGeometries(parts.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)));
  return g;
}
// Deep enough to show on every body style's rounded nose and tail.
const LAMPS = {
  head: [[0.42, 0.18, 0.16, -0.6, 0.76, -2.15], [0.42, 0.18, 0.16, 0.6, 0.76, -2.15]],
  tail: [[0.46, 0.18, 0.16, -0.6, 0.78, 2.15], [0.46, 0.18, 0.16, 0.6, 0.78, 2.15]],
  left: [[0.14, 0.1, 0.16, -0.78, 0.56, -2.17], [0.14, 0.1, 0.16, -0.78, 0.58, 2.17]], // left is −x: the nose faces −z
  right: [[0.14, 0.1, 0.16, 0.78, 0.56, -2.17], [0.14, 0.1, 0.16, 0.78, 0.58, 2.17]],
};
// Each lamp's colour, unlit (its lens) and fully lit.
const LAMP_COLOURS = {
  head: [new THREE.Color(0.35, 0.34, 0.3), new THREE.Color(1.7, 1.6, 1.35)],
  tail: [new THREE.Color(0.16, 0.02, 0.02), new THREE.Color(2.2, 0.15, 0.12)],
  left: [new THREE.Color(0.18, 0.1, 0.0), new THREE.Color(2.0, 1.1, 0.0)],
  right: [new THREE.Color(0.18, 0.1, 0.0), new THREE.Color(2.0, 1.1, 0.0)],
};

/**
 * @param {{ count: number, carsRef: { current: object[] }, player: { current: object } }} props
 *   carsRef is filled with the live cars (for your autopilot and the minimap).
 */
export function Traffic({ layout, graph, signals, count, carsRef, player, vehicleType }) {
  const R = layout.radius;
  const bodies = { hatchback: useRef(), saloon: useRef(), suv: useRef() };
  const lamps = { head: useRef(), tail: useRef(), left: useRef(), right: useRef() };
  const cars = useMemo(() => createTraffic(layout, count, createRng(`traffic-${count}`)), [layout, count]);
  useEffect(() => {
    carsRef.current = cars;
    return () => {
      carsRef.current = [];
    };
  }, [cars, carsRef]);
  const geo = useDisposable(
    () => ({
      ...Object.fromEntries(TRAFFIC_STYLES.map((style) => [style, carGeometry(style)])),
      ...Object.fromEntries(Object.entries(LAMPS).map(([k, parts]) => [k, lampGeometry(parts)])),
    }),
    []
  );
  const materials = useDisposable(
    () => ({
      body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 }),
      lamp: new THREE.MeshBasicMaterial({ toneMapped: false }),
    }),
    []
  );

  // Each car's body style, and its slot among the cars of that style.
  const fleet = useMemo(() => {
    const counts = Object.fromEntries(TRAFFIC_STYLES.map((style) => [style, 0]));
    const slots = cars.map((car, i) => {
      const style = TRAFFIC_STYLES[i % TRAFFIC_STYLES.length];
      return { style, slot: counts[style]++ };
    });
    return { counts, slots };
  }, [cars]);

  // Body tints, set once.
  useEffect(() => {
    const c = new THREE.Color();
    cars.forEach((car, i) => {
      const { style, slot } = fleet.slots[i];
      bodies[style].current?.setColorAt(slot, c.setHSL(car.hue, 0.55, 0.5));
    });
    for (const style of TRAFFIC_STYLES) if (bodies[style].current?.instanceColor) bodies[style].current.instanceColor.needsUpdate = true;
    // (bodies holds refs; it's rebuilt each render but points at the same meshes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cars, fleet]);

  const m = useMemo(() => new THREE.Matrix4(), []);
  const colour = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const p = player.current;
    // Your car is someone to keep a gap from (not the drone, unless it's landed).
    const you = vehicleType === "car" || (p.alt ?? 0) < 1.5 ? p : null;
    stepTraffic(cars, { world: layout, graph, signals, t: trafficTime(), player: you }, dt);
    cars.forEach((car, i) => {
      surfaceMatrix(R, car.x, car.z, bridgeElevation(layout, car.x, car.z), car.yaw, m);
      const { style, slot } = fleet.slots[i];
      bodies[style].current.setMatrixAt(slot, m);
      const reversing = car.speed < -0.1;
      const lit = carLamps(car, {
        steer: car.steer,
        speed: car.speed,
        braking: car.braking,
        reversing,
        hazard: reversing, // they only back up to get unstuck
        night: sunlightAt(R, car.x, car.z) < 0.06,
        t: clock.elapsedTime,
        dt,
      });
      for (const k in lamps) {
        const [off, on] = LAMP_COLOURS[k];
        // The tail lamp is the brake lamp too: brighter of the two.
        const level = k === "tail" ? Math.max(lit.tail, lit.brake) : lit[k];
        lamps[k].current.setMatrixAt(i, m);
        lamps[k].current.setColorAt(i, colour.copy(off).lerp(on, level));
      }
    });
    for (const style of TRAFFIC_STYLES) if (bodies[style].current) bodies[style].current.instanceMatrix.needsUpdate = true;
    for (const k in lamps) {
      lamps[k].current.instanceMatrix.needsUpdate = true;
      if (lamps[k].current.instanceColor) lamps[k].current.instanceColor.needsUpdate = true;
    }
  });

  if (!cars.length) return null;
  return (
    <>
      {TRAFFIC_STYLES.filter((style) => fleet.counts[style]).map((style) => (
        <instancedMesh key={style} ref={bodies[style]} args={[geo[style], materials.body, fleet.counts[style]]} castShadow frustumCulled={false} />
      ))}
      {Object.keys(LAMPS).map((k) => (
        <instancedMesh key={k} ref={lamps[k]} args={[geo[k], materials.lamp, cars.length]} frustumCulled={false} />
      ))}
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
      post(boxAt(0.18, 4.4, 0.18, -(lane + 1.6), 2.2, 0, "#2b2e35"));
      post(boxAt(0.5, 1.5, 0.45, -(lane + 1.6), 4.0, 0.05, "#16181c"));
      post(boxAt(0.7, 1.75, 0.08, -(lane + 1.6), 4.0, -0.22, "#0d0e10")); // backplate
      // Stop line across the lane.
      post(boxAt(3.6, 0.03, 0.4, 0, 0.27, 0, "#f4f4ee"));
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
