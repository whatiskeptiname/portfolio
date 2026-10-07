// src/city/RouteViz.jsx — watching the autopilot think. Whenever it plans a
// route (a "Go to", a tour leg, or re-planning after you've steered), the
// search spreads over the road network as a wave of glowing junctions. In
// front of the car runs its real-time plan — not the whole route, but the
// stretch it's about to drive right now, as it has just decided it: in its
// lane (bending out when it overtakes), painted with the speed it means to
// do there — red where it brakes, amber, green, cyan flat out — with chevrons
// streaming along it, and ending at a pulsing red wall where it means to
// stop. A spinning marker shows the point it's steering for.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { bridgeElevation } from "../lib/layout";
import { speedColor } from "../lib/routing";
import { onGround, surfaceMatrix } from "./globe3d";

const pathMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uTravelled: { value: 0 } },
    vertexShader: `
      attribute vec3 color;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vUv = uv;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uReveal;
      uniform float uTravelled;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        float along = vUv.y;
        if (along > uReveal || along < uTravelled - 0.4) discard;
        float across = abs(vUv.x * 2.0 - 1.0);
        // Chevrons streaming forward (a stripe bent back toward the edges).
        float s = fract((along - across * 1.4 - uTime * 7.0) / 3.2);
        float chevron = smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(0.22, 0.32, s));
        float edge = 1.0 - smoothstep(0.55, 1.0, across);
        float rim = smoothstep(0.7, 0.95, across) * (1.0 - smoothstep(0.95, 1.0, across));
        // A bright leading edge while the path sweeps in; it starts right at the vehicle.
        float head = smoothstep(uReveal - 5.0, uReveal, along);
        float near = smoothstep(uTravelled - 0.4, uTravelled + 0.6, along);
        vec3 col = vColor * (0.28 * edge + 1.1 * chevron * edge + 0.7 * rim) + vec3(1.0) * head * 0.8 * edge;
        gl_FragColor = vec4(col * near, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  });

const searchMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uWave: { value: 0 }, uFade: { value: 1 }, uScale: { value: 1 } },
    vertexShader: `
      attribute float aOrder;
      uniform float uWave;
      uniform float uScale;
      varying float vGlow;
      void main() {
        float age = uWave - aOrder;
        // Unseen yet: hidden. Just reached: a bright flash that settles to an ember.
        vGlow = age < 0.0 ? 0.0 : 0.35 + 1.6 * exp(-age * 9.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float flash = exp(-age * 9.0);
        // World-sized up close, never smaller than a few pixels from afar.
        gl_PointSize = age < 0.0 ? 0.0 : max((3.0 + 5.0 * flash) * uScale, (3.0 + 6.0 * flash) * uScale * 160.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uFade;
      varying float vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.2, d) * vGlow * uFade;
        gl_FragColor = vec4(vec3(0.45, 0.85, 1.0) * a, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

const PLAN_MAX = 64; // poses in the real-time plan ribbon
const PLAN_COLS = 3; // vertices across it

/** A ribbon with room for PLAN_MAX poses, rewritten every frame from the car's plan. */
function planGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PLAN_MAX * PLAN_COLS * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PLAN_MAX * PLAN_COLS * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(PLAN_MAX * PLAN_COLS * 2), 2).setUsage(THREE.DynamicDrawUsage));
  const index = [];
  for (let i = 0; i < PLAN_MAX - 1; i++) {
    for (let c = 0; c < PLAN_COLS - 1; c++) {
      const a = i * PLAN_COLS + c;
      const b = a + PLAN_COLS;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  g.setIndex(index);
  g.setDrawRange(0, 0);
  return g;
}

export function RouteViz({ layout, state }) {
  const R = layout.radius;
  const group = useRef();
  const current = useRef(null); // { route, search, born, waveTime } — the planning wave
  const aim = useRef();
  const tether = useRef();
  const plan = useRef();
  const wall = useRef();
  const materials = useMemo(() => ({ path: pathMaterial(), search: searchMaterial() }), []);
  const tetherGeo = useMemo(() => new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(6), 3)), []);
  const planGeo = useMemo(planGeometry, []);
  const wallMatrix = useMemo(() => new THREE.Matrix4(), []);

  const clear = () => {
    const c = current.current;
    if (!c) return;
    c.search?.geometry.dispose();
    c.search?.removeFromParent(); // (the group may already be gone when unmounting)
    current.current = null;
  };
  useEffect(
    () => () => {
      clear();
      materials.path.dispose();
      materials.search.dispose();
      tetherGeo.dispose();
      planGeo.dispose();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // A new route: replay the search spreading over the road network.
  const build = (route, now) => {
    clear();
    let search = null;
    const explored = route.explored ?? [];
    if (explored.length) {
      const positions = new Float32Array(explored.length * 3);
      const order = new Float32Array(explored.length);
      explored.forEach(([x, z], i) => {
        positions.set(onGround(R, x, z, 0.8 + bridgeElevation(layout, x, z)), i * 3);
        order[i] = i / explored.length;
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      g.setAttribute("aOrder", new THREE.BufferAttribute(order, 1));
      search = new THREE.Points(g, materials.search);
      search.frustumCulled = false;
      search.renderOrder = 4;
      group.current.add(search);
    }
    // The search takes longer to watch the more it explored.
    const waveTime = explored.length ? THREE.MathUtils.clamp(explored.length / 260, 0.9, 2.2) : 0;
    current.current = { route, search, born: now, waveTime };
  };

  // Writes the car's real-time plan (lib/decision via Vehicles: s.drive)
  // into the ribbon: where it'll be, coloured by the speed it means to do.
  const writePlan = (s, reveal) => {
    const drive = s.drive;
    const poses = drive?.poses;
    if (!poses?.length || !drive.speeds) {
      planGeo.setDrawRange(0, 0);
      return null;
    }
    const air = s.route?.kind === "air" || (s.alt ?? 0) > 1.5; // a flying drone: drawn at its height
    // Start right under the car, then the planned poses (up to the stop, if stopping).
    const list = [{ x: s.x, z: s.z, yaw: s.yaw, d: 0 }, ...poses.slice(0, drive.speeds.length)].slice(0, PLAN_MAX);
    const speeds = [s.speed, ...drive.speeds];
    const pos = planGeo.attributes.position.array;
    const col = planGeo.attributes.color.array;
    const uv = planGeo.attributes.uv.array;
    const half = air ? 0.9 : 0.75;
    list.forEach((p, i) => {
      const next = list[Math.min(i + 1, list.length - 1)];
      const prev = list[Math.max(i - 1, 0)];
      let dx = next.x - prev.x;
      let dz = next.z - prev.z;
      if (Math.abs(dx) > layout.width / 2) dx -= Math.sign(dx) * layout.width;
      const len = Math.hypot(dx, dz) || 1;
      const h = air ? (s.alt ?? 0) + (s.ground ?? 0) - 0.4 : 0.42 + bridgeElevation(layout, p.x, p.z);
      const c = speedColor(Math.max(0, speeds[i] ?? 0), drive.cruise ?? 8);
      for (let k = 0; k < PLAN_COLS; k++) {
        const side = (k / (PLAN_COLS - 1)) * 2 - 1;
        const o = (i * PLAN_COLS + k) * 3;
        pos.set(onGround(R, p.x + (-dz / len) * half * side, p.z + (dx / len) * half * side, h), o);
        col.set(c, o);
        uv[(i * PLAN_COLS + k) * 2] = k / (PLAN_COLS - 1);
        uv[(i * PLAN_COLS + k) * 2 + 1] = p.d;
      }
    });
    planGeo.attributes.position.needsUpdate = true;
    planGeo.attributes.color.needsUpdate = true;
    planGeo.attributes.uv.needsUpdate = true;
    planGeo.setDrawRange(0, Math.max(0, list.length - 1) * (PLAN_COLS - 1) * 6);
    planGeo.computeBoundingSphere();
    materials.path.uniforms.uReveal.value = reveal * (list.at(-1).d + 6);
    materials.path.uniforms.uTravelled.value = 0;
    // Where it means to stop: the end of the plan.
    if (drive.stopAt != null) {
      const last = list.at(-1);
      return { x: last.x, z: last.z, yaw: last.yaw, h: air ? (s.alt ?? 0) + (s.ground ?? 0) : bridgeElevation(layout, last.x, last.z) };
    }
    return null;
  };

  useFrame(({ clock, size }) => {
    const s = state.current;
    const now = clock.elapsedTime;
    materials.path.uniforms.uTime.value = now;
    const route = s.route;

    // 1. A new route: the search wave, then the plan sweeping in.
    let sweep = 1;
    if (route) {
      if (current.current?.route !== route) build(route, now);
      const c = current.current;
      const t = now - c.born;
      materials.search.uniforms.uWave.value = c.waveTime ? Math.min(1.15, t / c.waveTime) : 1.15;
      materials.search.uniforms.uFade.value = 1 - THREE.MathUtils.smoothstep(t, c.waveTime + 0.9, c.waveTime + 2.6);
      materials.search.uniforms.uScale.value = size.height / 800;
      if (c.search) c.search.visible = materials.search.uniforms.uFade.value > 0.01;
      sweep = THREE.MathUtils.smootherstep(t, c.waveTime * 0.85, c.waveTime * 0.85 + 1.1);
    } else if (current.current) clear();

    // 2. The plan it's following right now.
    const stop = writePlan(s, sweep);
    if (wall.current) {
      wall.current.visible = Boolean(stop);
      if (stop) {
        surfaceMatrix(R, stop.x, stop.z, stop.h + 0.75, stop.yaw, wallMatrix);
        wall.current.matrix.copy(wallMatrix);
        wall.current.matrixWorldNeedsUpdate = true;
        wall.current.material.opacity = 0.45 + 0.25 * Math.sin(now * 6);
      }
    }

    // 3. Where it's steering for.
    const air = route?.kind === "air" || (s.alt ?? 0) > 1.5;
    if (route?.aim && aim.current && sweep > 0.99) {
      const [ax, az] = route.aim;
      const h = air ? (s.alt ?? 0) + (s.ground ?? 0) : 0.6 + bridgeElevation(layout, ax, az);
      aim.current.visible = true;
      aim.current.position.fromArray(onGround(R, ax, az, h));
      aim.current.lookAt(0, 0, 0);
      aim.current.rotateZ(now * 3);
      aim.current.scale.setScalar(1 + 0.15 * Math.sin(now * 8));
      const p = tetherGeo.attributes.position;
      p.setXYZ(0, ...onGround(R, s.x, s.z, (s.ground ?? 0) + (s.alt ?? 0) + 0.9));
      p.setXYZ(1, ...onGround(R, ax, az, h));
      p.needsUpdate = true;
      tether.current.visible = true;
    } else {
      if (aim.current) aim.current.visible = false;
      if (tether.current) tether.current.visible = false;
    }
  });

  return (
    <group ref={group}>
      <mesh ref={plan} geometry={planGeo} material={materials.path} renderOrder={3} frustumCulled={false} />
      {/* The stop wall: where the plan ends when it means to stop. */}
      <mesh ref={wall} visible={false} matrixAutoUpdate={false} renderOrder={6}>
        <planeGeometry args={[3.6, 1.5]} />
        <meshBasicMaterial color="#ff3b5c" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={aim} visible={false} renderOrder={5}>
        <torusGeometry args={[0.8, 0.12, 6, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <lineSegments ref={tether} geometry={tetherGeo} visible={false} frustumCulled={false}>
        <lineBasicMaterial color="#9ff6ff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
