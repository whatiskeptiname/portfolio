// src/city/DriverView.jsx — what the autopilot sees, and what it's reacting
// to.
//  - Its vision: exactly the area it can see, all round, drawn at the
//    driver's eye level — sight lines cast in every direction out to its view
//    distance, each stopped by the first building, tree, billboard or car in
//    the way, or where the ground rises to eye level, so whatever's hidden
//    lies in shadow.
//  - The land beyond what it can see — past its view distance, or hidden
//    behind something — shaded dark.
//  - The lane it's in: its two edges ahead along its path, as thin glowing
//    strips painted on the road, bright by the car and fading out ahead
//    (green; amber when it's out in the other lane).
//  - A box round everything it notices: every car, every traffic light (in
//    the light's colour), every tree, building and billboard nearby.
//  - Whatever its current decision is about pulses in the decision's colour
//    (red stopping, amber slowing, cyan going), with a ring and beam at a
//    light or stop line, a ring round a busy roundabout or at a bend.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BUILDING_RADIUS, bridgeElevation } from "../lib/layout";
import { TONES } from "../lib/decision";
import { DRONE_VIEW, VIEW, groundOf, visibleArea } from "../lib/perception";
import { signalColor, trafficTime } from "../lib/traffic";
import { groundAt, onGround, surfaceMatrix } from "./globe3d";

const RAYS = 120;
// Rings from the edge of vision out to SHROUD_REACH — many, and closely
// spaced near the edge: long straight strips would sink under the planet's
// curve and the hills (a 40 m chord dips ~2 m below the surface).
const SHROUD_BANDS = 28;
const SHROUD_REACH = 260; // metres beyond the edge of vision that get darkened
// The car's outline (half length, half width) — vision starts 1 m beyond it.
const BODY = { halfL: 2.15, halfW: 0.95, gap: 1 };
const LANE_MAX = 32; // lane-edge samples
const LANE_LINE = 0.16; // metres wide, about a painted road line
const MAX_BOXES = 160;
const COLORS = { car: "#8ff3ff", tree: "#6dff95", building: "#c49bff", billboard: "#ffd27a", red: "#ff3b5c", amber: "#ffb020", green: "#2bff86" };

// The 12 edges of a unit box (x, z in −½…½, y in 0…1), as 24 points.
const UNIT_EDGES = (() => {
  const c = [-0.5, 0.5];
  const pts = [];
  for (const y of [0, 1]) {
    for (const [a, b] of [[[c[0], c[0]], [c[1], c[0]]], [[c[1], c[0]], [c[1], c[1]]], [[c[1], c[1]], [c[0], c[1]]], [[c[0], c[1]], [c[0], c[0]]]]) {
      pts.push([a[0], y, a[1]], [b[0], y, b[1]]);
    }
  }
  for (const x of c) for (const z of c) pts.push([x, 0, z], [x, 1, z]);
  return pts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
})();

function dynamic(count, itemSize = 3) {
  return new THREE.BufferAttribute(new Float32Array(count * itemSize), itemSize).setUsage(THREE.DynamicDrawUsage);
}

export function DriverView({ layout, state, type = "car" }) {
  const isDrone = type === "drone";
  const R = layout.radius;
  const geos = useMemo(() => {
    // Vision area: a fan from the car to the end of each sight line.
    // Vision: a band from 1 m off the car's body out to the end of each sight
    // line — faint, a touch brighter toward the edge of what it can see.
    const area = new THREE.BufferGeometry();
    area.setAttribute("position", dynamic((RAYS + 1) * 2));
    const shade = new Float32Array((RAYS + 1) * 2 * 3);
    for (let i = 0; i <= RAYS; i++) {
      shade.set([0, 0.03, 0.04], i * 6);
      shade.set([0.03, 0.13, 0.17], i * 6 + 3);
    }
    area.setAttribute("color", new THREE.BufferAttribute(shade, 3));
    const index = [];
    for (let i = 0; i < RAYS; i++) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    area.setIndex(index);
    // Beyond what it can see: a shroud over the land, from the end of each
    // sight line outward, in a few bands so it follows the hills.
    const shroud = new THREE.BufferGeometry();
    shroud.setAttribute("position", dynamic((RAYS + 1) * SHROUD_BANDS));
    const si = [];
    for (let i = 0; i < RAYS; i++) {
      for (let b = 0; b < SHROUD_BANDS - 1; b++) {
        const a = i * SHROUD_BANDS + b;
        si.push(a, a + SHROUD_BANDS, a + 1, a + 1, a + SHROUD_BANDS, a + SHROUD_BANDS + 1);
      }
    }
    shroud.setIndex(si);
    const rim = new THREE.BufferGeometry();
    rim.setAttribute("position", dynamic(RAYS + 1));
    const boxes = new THREE.BufferGeometry();
    boxes.setAttribute("position", dynamic(MAX_BOXES * 24));
    boxes.setAttribute("color", dynamic(MAX_BOXES * 24));
    boxes.setDrawRange(0, 0);
    // The lane's two edges: a thin strip each (2 vertices per sample), the
    // two strips' triangles interleaved per segment so one draw range covers both.
    const laneEdges = new THREE.BufferGeometry();
    laneEdges.setAttribute("position", dynamic(LANE_MAX * 4));
    laneEdges.setAttribute("color", dynamic(LANE_MAX * 4));
    const laneIndex = [];
    const v = (edge, i, side) => (edge * LANE_MAX + i) * 2 + side;
    for (let i = 0; i < LANE_MAX - 1; i++) {
      for (const e of [0, 1]) laneIndex.push(v(e, i, 0), v(e, i, 1), v(e, i + 1, 0), v(e, i, 1), v(e, i + 1, 1), v(e, i + 1, 0));
    }
    laneEdges.setIndex(laneIndex);
    laneEdges.setDrawRange(0, 0);
    const ring = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
    const beam = new THREE.CylinderGeometry(0.08, 0.08, 6, 6);
    return { area, shroud, rim, boxes, laneEdges, ring, beam };
  }, []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const ground = useMemo(() => groundOf(layout), [layout]);
  const laneEdges = useRef();
  const area = useRef();
  const sphere = useRef();
  const cone = useRef();
  // The drone's view cone: a translucent shell, apex at the drone, unit
  // length along −z (the way it faces) — scaled to its view distance.
  const coneGeo = useMemo(() => new THREE.ConeGeometry(Math.tan(DRONE_VIEW.halfAngle), 1, 48, 1, true).translate(0, -0.5, 0).rotateX(Math.PI / 2), []);
  useEffect(() => () => coneGeo.dispose(), [coneGeo]);
  // The drone's small sphere of close-up awareness: a translucent bubble.
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 32, 16), []);
  useEffect(() => () => sphereGeo.dispose(), [sphereGeo]);
  const shroud = useRef();
  const rim = useRef();
  const boxes = useRef();
  const ring = useRef();
  const beam = useRef();
  const m = useMemo(() => new THREE.Matrix4(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const palette = useMemo(() => Object.fromEntries(Object.entries(COLORS).map(([k, c]) => [k, new THREE.Color(c)])), []);

  useFrame(({ clock }) => {
    const s = state.current;
    const drive = s.drive;
    const auto = Boolean(drive?.range); // set while the autopilot is driving
    const t = clock.elapsedTime;
    for (const r of [shroud, rim, laneEdges]) r.current.visible = auto && !isDrone;
    boxes.current.visible = auto;
    sphere.current.visible = auto && isDrone;
    cone.current.visible = auto && isDrone;
    ring.current.visible = false;
    beam.current.visible = false;
    if (!auto) return;
    const range = drive.range ?? VIEW.range;
    // The driver's eye level (absolute height above the sphere): the vision
    // sheet is drawn there, and stops where the ground rises to meet it.
    const eye = ground(s.x, s.z) + (s.alt ?? 0) + VIEW.eye;
    const atEye = (x, z) => onGround(R, x, z, eye - groundAt(x, z));

    if (isDrone) {
      // The drone: its camera's cone ahead, out to its view distance, tilted
      // with the frame — and a small sphere of close-up awareness round it.
      surfaceMatrix(R, s.x, s.z, (s.alt ?? 0) + 0.3, s.yaw, m);
      const frame = m.clone().multiply(new THREE.Matrix4().makeRotationX(-(s.qpitch ?? 0) * 0.5));
      cone.current.matrix.copy(frame).multiply(new THREE.Matrix4().makeScale(range, range, range));
      cone.current.matrixWorldNeedsUpdate = true;
      sphere.current.matrix.copy(m).multiply(new THREE.Matrix4().makeScale(DRONE_VIEW.near, DRONE_VIEW.near, DRONE_VIEW.near));
      sphere.current.matrixWorldNeedsUpdate = true;
    } else {
    // 1. Exactly what it can see: every sight line out to the first thing in
    // the way — a building, tree, billboard, car, or the rise of the ground.
    const near = (o, extra = 0) => Math.hypot(o.x - s.x, o.z - s.z) < range + extra || Math.abs(o.x - s.x) > layout.width / 2;
    const blockers = [
      ...layout.buildings.filter((b) => near(b, 6)).map((b) => ({ x: b.x, z: b.z, r: BUILDING_RADIUS * 0.85 })),
      ...layout.trees.filter((t) => near(t, 2)).map((t) => ({ x: t.x, z: t.z, r: 0.8 * t.scale })),
      ...layout.billboards.filter((b) => near(b, 3)).map((b) => ({ x: b.x, z: b.z, r: 1.4 })),
      ...(drive.seen ?? []).filter((c) => (c.alt ?? 0) < 1.5).map((c) => ({ x: c.x, z: c.z, r: 1.4 })),
    ];
    const reach = visibleArea(s, blockers, layout.width, range, RAYS, ground, eye);
    const pos = geos.area.attributes.position;
    const edge = geos.rim.attributes.position;
    const dark = geos.shroud.attributes.position;
    for (let i = 0; i <= RAYS; i++) {
      const k = i % RAYS;
      const rel = (k / RAYS) * Math.PI * 2; // from straight ahead
      const a = s.yaw + rel;
      const dx = -Math.sin(a);
      const dz = -Math.cos(a);
      // 1 m beyond the car's body in this direction.
      const body = Math.min(BODY.halfL / Math.max(1e-3, Math.abs(Math.cos(rel))), BODY.halfW / Math.max(1e-3, Math.abs(Math.sin(rel))));
      const start = Math.min(reach[k], body + BODY.gap);
      pos.setXYZ(i * 2, ...atEye(s.x + dx * start, s.z + dz * start));
      pos.setXYZ(i * 2 + 1, ...atEye(s.x + dx * reach[k], s.z + dz * reach[k]));
      edge.setXYZ(i, ...atEye(s.x + dx * reach[k], s.z + dz * reach[k]));
      // The land it can't see, darkened (on the ground, following the hills).
      for (let b = 0; b < SHROUD_BANDS; b++) {
        const d = reach[k] + SHROUD_REACH * (b / (SHROUD_BANDS - 1)) ** 2;
        const x = s.x + dx * d;
        const z = s.z + dz * d;
        dark.setXYZ(i * SHROUD_BANDS + b, ...onGround(R, x, z, 0.8 + bridgeElevation(layout, x, z)));
      }
    }
    pos.needsUpdate = true;
    edge.needsUpdate = true;
    dark.needsUpdate = true;
    geos.area.computeBoundingSphere();
    geos.rim.computeBoundingSphere();
    geos.shroud.computeBoundingSphere();

    }

    // 2. The lane it's in: its two edges, on the road.
    const ln = drive.lane;
    const le = geos.laneEdges.attributes.position;
    const lc = geos.laneEdges.attributes.color;
    const count = ln && !ln.offRoad ? Math.min(LANE_MAX, ln.left.length) : 0;
    const laneColor = ln?.wrongWay ? palette.amber : palette.green;
    for (let i = 0; i < count; i++) {
      const [lx, lz] = ln.left[i];
      const [rx, rz] = ln.right[i];
      // Across the lane, so each strip is LANE_LINE wide whichever way the road turns.
      const across = Math.hypot(rx - lx, rz - lz) || 1;
      const ux = ((rx - lx) / across) * (LANE_LINE / 2);
      const uz = ((rz - lz) / across) * (LANE_LINE / 2);
      // Bright by the car, fading out ahead (additive: darker = fainter).
      const fade = 0.9 * (1 - i / Math.max(1, count - 1)) ** 1.3 + 0.08;
      for (const [e, x, z] of [[0, lx, lz], [1, rx, rz]]) {
        const h = 0.36 + bridgeElevation(layout, x, z);
        const k = (e * LANE_MAX + i) * 2;
        le.setXYZ(k, ...onGround(R, x - ux, z - uz, h));
        le.setXYZ(k + 1, ...onGround(R, x + ux, z + uz, h));
        lc.setXYZ(k, laneColor.r * fade, laneColor.g * fade, laneColor.b * fade);
        lc.setXYZ(k + 1, laneColor.r * fade, laneColor.g * fade, laneColor.b * fade);
      }
    }
    le.needsUpdate = true;
    lc.needsUpdate = true;
    geos.laneEdges.setDrawRange(0, Math.max(0, count - 1) * 12);
    geos.laneEdges.computeBoundingSphere();

    // 3. A box round everything it notices.
    const focus = drive.decision?.focus;
    const items = [];
    for (const c of drive.seen ?? []) items.push({ x: c.x, z: c.z, yaw: c.yaw, w: 2.3, h: 2.0, d: 4.7, base: bridgeElevation(layout, c.x, c.z) + (c.alt ?? 0), kind: "car", cause: focus?.other === c });
    const now = trafficTime();
    for (const sig of drive.seenSignals ?? []) {
      for (const ap of sig.approaches) {
        // The light head on its post, on the left of the stop line (see Traffic.jsx).
        const yaw = Math.atan2(-ap.dir[0], -ap.dir[1]);
        const px = ap.x - Math.cos(yaw) * 3.5;
        const pz = ap.z + Math.sin(yaw) * 3.5;
        const cause = focus && (focus.kind === "red" || focus.kind === "amber" || focus.kind === "box") && Math.hypot(focus.x - ap.x, focus.z - ap.z) < 0.5;
        items.push({ x: px, z: pz, yaw, w: 1, h: 2.1, d: 1, base: bridgeElevation(layout, ap.x, ap.z) + 3, kind: signalColor(sig, ap.group, now), cause });
      }
    }
    for (const o of drive.obstacles ?? []) {
      // A little bigger than the thing itself, so the box reads clearly against it.
      const size = o.kind === "building" ? 5 : o.kind === "billboard" ? 7.6 : o.r * 2.6;
      const cause = focus?.kind === "obstacle" && Math.hypot(focus.x - o.x, focus.z - o.z) < o.r + 1.5;
      const h = o.kind === "building" ? (o.h ?? 6) + 1 : o.h ?? 4;
      items.push({ x: o.x, z: o.z, yaw: o.yaw ?? 0, w: size, h, d: o.kind === "billboard" ? 1 : size, base: 0, kind: o.kind, cause });
    }
    const bp = geos.boxes.attributes.position;
    const bc = geos.boxes.attributes.color;
    const pulse = 1 + 0.06 * Math.sin(t * 8);
    let n = 0;
    const addBox = (it, grow, col) => {
      if (n >= MAX_BOXES) return;
      surfaceMatrix(R, it.x, it.z, it.base - 0.05, it.yaw, m);
      m.multiply(new THREE.Matrix4().makeScale(it.w * grow, it.h * grow + 0.1, it.d * grow));
      UNIT_EDGES.forEach((e, j) => {
        v.copy(e).applyMatrix4(m);
        bp.setXYZ(n * 24 + j, v.x, v.y, v.z);
        bc.setXYZ(n * 24 + j, col.r, col.g, col.b);
      });
      n++;
    };
    const tone = color.set(TONES[drive.decision?.tone ?? "info"]);
    for (const it of items) {
      addBox(it, 1, palette[it.kind] ?? palette.car);
      if (it.cause) addBox(it, 1.18 * pulse, tone); // what the decision is about
    }
    bp.needsUpdate = true;
    bc.needsUpdate = true;
    geos.boxes.setDrawRange(0, n * 24);
    geos.boxes.computeBoundingSphere();

    // 4. Rings and beams for causes that aren't boxed things.
    if (!focus || focus.other || focus.kind === "obstacle") return;
    const radius = focus.kind === "roundabout" ? 8.2 : focus.kind === "red" || focus.kind === "amber" || focus.kind === "box" ? 2.2 : 1.5;
    const h = bridgeElevation(layout, focus.x, focus.z);
    surfaceMatrix(R, focus.x, focus.z, h + 0.35, 0, m);
    m.multiply(new THREE.Matrix4().makeScale(radius * pulse, radius * pulse, radius * pulse));
    ring.current.matrix.copy(m);
    ring.current.matrixWorldNeedsUpdate = true;
    ring.current.material.color.copy(tone);
    ring.current.visible = true;
    if (focus.kind === "red" || focus.kind === "amber" || focus.kind === "box") {
      surfaceMatrix(R, focus.x, focus.z, h + 3, 0, m);
      beam.current.matrix.copy(m);
      beam.current.matrixWorldNeedsUpdate = true;
      beam.current.material.color.copy(tone);
      beam.current.visible = true;
    }
  });

  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
  return (
    <>
      {/* No fill inside what it can see — nothing drawn over the ground there,
          so the scene (shadows and all) shows exactly as it is. Only the
          outline at the edge of its vision, and the shading beyond it. */}
      <mesh ref={area} geometry={geos.area} frustumCulled={false} visible={false}>
        <meshBasicMaterial visible={false} />
      </mesh>
      {/* The drone's camera cone, and its small sphere of close-up awareness. */}
      <mesh ref={cone} geometry={coneGeo} visible={false} matrixAutoUpdate={false} frustumCulled={false} renderOrder={3}>
        <meshBasicMaterial color="#7ff0ff" transparent opacity={0.05} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh ref={sphere} geometry={sphereGeo} visible={false} matrixAutoUpdate={false} frustumCulled={false} renderOrder={3}>
        <meshBasicMaterial color="#b7f9ff" transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* What it can't see: the land beyond its vision, shaded dark. */}
      <mesh ref={shroud} geometry={geos.shroud} frustumCulled={false} renderOrder={1}>
        <meshBasicMaterial color="#02040a" transparent opacity={0.38} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <line ref={rim} geometry={geos.rim} frustumCulled={false}>
        <lineBasicMaterial color="#7ff0ff" {...additive} opacity={0.35} />
      </line>
      {/* The lane: its two edges, thin glowing strips fading ahead. */}
      <mesh ref={laneEdges} geometry={geos.laneEdges} frustumCulled={false} renderOrder={4}>
        <meshBasicMaterial vertexColors {...additive} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments ref={boxes} geometry={geos.boxes} frustumCulled={false} renderOrder={6}>
        <lineBasicMaterial vertexColors {...additive} opacity={0.95} />
      </lineSegments>
      <mesh ref={ring} geometry={geos.ring} visible={false} matrixAutoUpdate={false} frustumCulled={false} renderOrder={5}>
        <meshBasicMaterial {...additive} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={beam} geometry={geos.beam} visible={false} matrixAutoUpdate={false} frustumCulled={false}>
        <meshBasicMaterial {...additive} opacity={0.8} />
      </mesh>
    </>
  );
}
