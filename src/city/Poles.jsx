// src/city/Poles.jsx — the ends of the world. The black hole always sits a
// little north of the equator, so the north pole basks in its light: a small
// warm sea lies there, ringed by a beach and dotted with palm islands (one
// with a lighthouse), and the river runs straight into it. The south pole
// looks away into the dark, and low mountains crowd round it — snow on the
// peaks — with the river leaping off a cliff in the foothills as a waterfall.
// Only a drone flying above MOUNTAIN_HEIGHT gets over them.
import React from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MOUNTAIN_HEIGHT, createRng, worldDistance } from "../lib/layout";
import { openRuns } from "../lib/junctions";
import { frameAt } from "../lib/globe";
import { RIVER_COLOR, SEA_COLOR, discGeometry, onGround, ribbonGeometry, surfaceMatrix } from "./globe3d";
import { nightGlowMaterial, useDisposable } from "./gpu";

const texture = (name) => `${import.meta.env.BASE_URL}textures/${name}`;

function useWaterMap(repeatX = 1, repeatY = 1) {
  const water = useLoader(THREE.TextureLoader, texture("water.jpg"));
  return useDisposable(() => {
    const t = water.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [water, repeatX, repeatY]);
}

function paint(geometry, color) {
  const c = new THREE.Color(color);
  const n = geometry.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geometry;
}

function setUp(geometry, up) {
  const n = geometry.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set(up, i * 3);
  geometry.setAttribute("aUp", new THREE.BufferAttribute(arr, 3));
  return geometry;
}

function mergeAll(list) {
  const out = list.length ? mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))) : null;
  list.forEach((g) => g.dispose());
  return out;
}

// --- the sea -----------------------------------------------------------------

export function Sea({ layout, animate = true }) {
  const R = layout.radius;
  const { shore } = layout.sea;
  const edge = Math.PI / 2 - shore / R; // polar angle of the waterline
  const map = useWaterMap(Math.round((2 * Math.PI * R * Math.sin(edge)) / 14), Math.max(1, Math.round((R * edge) / 14)));
  // Slow swell rolling in toward the shore.
  useFrame((_, delta) => {
    if (animate) map.offset.y = (map.offset.y + delta * 0.02) % 1;
  });

  // Surf where the waves break — open where the river runs in.
  const surf = useDisposable(() => {
    const mouth = layout.river.points.at(-1)[0];
    const gap = Math.max(...layout.river.widths.slice(-4)) + 2.5;
    const W = layout.width;
    const gaps = [[mouth - gap, mouth + gap], [mouth - gap + W, mouth + gap + W], [mouth - gap - W, mouth + gap - W]];
    const parts = openRuns(-W / 2, W / 2, gaps).map(([a, b]) => {
      const n = Math.max(1, Math.ceil((b - a) / 2));
      const run = Array.from({ length: n + 1 }, (_, i) => [a + ((b - a) * i) / n, -shore - 0.35]);
      return ribbonGeometry(R, run, 0.3, 0.09, 1);
    });
    const out = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return out;
  }, [layout, R, shore]);

  return (
    <group>
      {/* Beach: a band of sand just south of the waterline. */}
      <mesh receiveShadow>
        <sphereGeometry args={[R + 0.04, 128, 3, 0, Math.PI * 2, edge - 0.005, 0.005 + 3.5 / R]} />
        <meshStandardMaterial color="#e6d3a3" roughness={1} />
      </mesh>
      {/* Same colour and finish as the river's mouth, so they meet seamlessly. */}
      <mesh receiveShadow>
        <sphereGeometry args={[R + 0.07, 96, 16, 0, Math.PI * 2, 0, edge]} />
        <meshStandardMaterial map={map} color={SEA_COLOR} emissive="#1aa7d8" emissiveIntensity={0.22} roughness={0.15} metalness={0.1} />
      </mesh>
      <mesh geometry={surf}>
        <meshStandardMaterial color="#f4fbff" emissive="#bfe8ff" emissiveIntensity={0.3} transparent opacity={0.7} />
      </mesh>
      <Islands layout={layout} />
    </group>
  );
}

// Sandy islets with a grassy knoll and palms; the biggest has a lighthouse
// whose lamp comes on at night.
function Islands({ layout }) {
  const R = layout.radius;
  const geo = useDisposable(() => {
    const rng = createRng("islands");
    const parts = [];
    const glow = [];
    const islands = layout.sea.islands;
    const biggest = islands.reduce((a, b) => (b.r > (a?.r ?? 0) ? b : a), null);
    const trunk = new THREE.CylinderGeometry(0.1, 0.16, 2.6, 5, 3);
    const frond = new THREE.ConeGeometry(0.35, 1.9, 4);
    frond.rotateX(Math.PI / 2);
    frond.scale(1, 0.25, 1);
    const knoll = new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const isl of islands) {
      const sx = isl.rx / isl.r; // pre-stretched east–west (see layout)
      // Shallows, sand, grass, knoll.
      parts.push(paint(discGeometry(R, isl.x, isl.z, isl.r + 1.4, 0.075, 32, 2, isl.rx + 1.4 * sx), "#6ec9d6"));
      parts.push(paint(discGeometry(R, isl.x, isl.z, isl.r, 0.12, 32, 3, isl.rx), "#ecdcae"));
      parts.push(paint(discGeometry(R, isl.x, isl.z, isl.r * 0.62, 0.16, 32, 2, isl.rx * 0.62), "#7cb85a"));
      parts.push(
        paint(knoll.clone().applyMatrix4(surfaceMatrix(R, isl.x, isl.z, 0, 0).multiply(new THREE.Matrix4().makeScale(isl.r * 0.45, isl.r * 0.28, isl.r * 0.45))), "#6aa64c")
      );
      // Palms round the knoll, leaning out to sea.
      const palms = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < palms; i++) {
        const a = (i / palms) * Math.PI * 2 + rng();
        const d = isl.r * (0.55 + rng() * 0.2);
        const px = isl.x + Math.cos(a) * d * sx;
        const pz = isl.z + Math.sin(a) * d;
        const s = 0.8 + rng() * 0.5;
        const lean = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), 0.25);
        const base = surfaceMatrix(R, px, pz, 0.12, 0).multiply(lean).multiply(new THREE.Matrix4().makeScale(s, s, s));
        parts.push(paint(trunk.clone().applyMatrix4(base.clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.3, 0))), "#8a6a45"));
        for (let k = 0; k < 6; k++) {
          const m = base
            .clone()
            .multiply(new THREE.Matrix4().makeTranslation(0, 2.6, 0))
            .multiply(new THREE.Matrix4().makeRotationY((k / 6) * Math.PI * 2))
            .multiply(new THREE.Matrix4().makeRotationX(0.45))
            .multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.9));
          parts.push(paint(frond.clone().applyMatrix4(m), k % 2 ? "#3f8f3a" : "#4fa544"));
        }
      }
      if (isl === biggest) {
        // Red-and-white lighthouse on the shore side.
        const a = rng() * Math.PI * 2;
        const lx = isl.x + Math.cos(a) * isl.r * 0.35 * sx;
        const lz = isl.z + Math.sin(a) * isl.r * 0.35;
        const base = surfaceMatrix(R, lx, lz, 0.12, 0);
        for (let band = 0; band < 5; band++) {
          const r0 = 0.75 - band * 0.08;
          const seg = new THREE.CylinderGeometry(r0 - 0.08, r0, 1.2, 10);
          seg.translate(0, 0.6 + band * 1.2, 0);
          parts.push(paint(seg.applyMatrix4(base), band % 2 ? "#d8433a" : "#f6f2ea"));
        }
        const gallery = new THREE.CylinderGeometry(0.62, 0.62, 0.15, 10);
        gallery.translate(0, 6.08, 0);
        parts.push(paint(gallery.applyMatrix4(base), "#2f3138"));
        const roof = new THREE.ConeGeometry(0.5, 0.7, 10);
        roof.translate(0, 7.25, 0);
        parts.push(paint(roof.applyMatrix4(base), "#d8433a"));
        const lamp = new THREE.CylinderGeometry(0.38, 0.38, 0.75, 10);
        lamp.translate(0, 6.52, 0);
        glow.push(setUp(paint(lamp.applyMatrix4(base), "#fff6d8"), frameAt(R, lx, lz).up));
      }
    }
    [trunk, frond, knoll].forEach((g) => g.dispose());
    return {
      land: mergeAll(parts),
      lamp: mergeAll(glow),
      lampMaterial: nightGlowMaterial({ vertexColors: true, emissive: "#ffe39a", emissiveIntensity: 4 }, { dayFactor: 0.1 }),
    };
  }, [layout.sea, R]);

  return (
    <>
      {geo.land && (
        <mesh geometry={geo.land} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.9} flatShading />
        </mesh>
      )}
      {geo.lamp && <mesh geometry={geo.lamp} material={geo.lampMaterial} />}
    </>
  );
}

// --- the mountains -------------------------------------------------------------

export function Mountains({ layout }) {
  const R = layout.radius;
  const geometry = useDisposable(() => {
    const rng = createRng("mountains");
    const edge = layout.mountains.edge;
    const pole = (Math.PI / 2) * R;
    const { source } = layout.river;
    const parts = [];
    const rock = new THREE.Color("#6e675f");
    const scree = new THREE.Color("#8a8073");
    const snow = new THREE.Color("#f1f5fa");
    const peak = (x, z, height, radius, { snowy = true, segments = 7, flat = 0 } = {}) => {
      const g = new THREE.CylinderGeometry(radius * flat, radius, height, segments, 4);
      g.translate(0, height / 2 - 0.4, 0);
      // Craggy: jitter every vertex but the summit, then colour by height.
      const pos = g.attributes.position;
      const colors = [];
      const snowLine = 0.55 + rng() * 0.15;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const k = (y + 0.4) / height;
        if (k < 0.97) {
          const j = radius * 0.18 * (1 - k);
          pos.setXYZ(i, pos.getX(i) + (rng() - 0.5) * j, y + (rng() - 0.5) * height * 0.05, pos.getZ(i) + (rng() - 0.5) * j);
        }
        const c = snowy && k > snowLine + (rng() - 0.5) * 0.08 ? snow : k < 0.18 ? scree : rock;
        colors.push(c.r, c.g, c.b);
      }
      g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      g.deleteAttribute("uv");
      g.applyMatrix4(surfaceMatrix(R, x, z, 0, rng() * Math.PI * 2));
      parts.push(g.toNonIndexed());
      g.dispose();
    };

    // Rings of peaks from the foothills to the pole, growing taller inward.
    for (let z = edge + 3, ring = 0; z < pole - 5; z += 8, ring++) {
      const t = (z - edge) / (pole - edge);
      const around = 2 * Math.PI * R * Math.cos(z / R);
      const n = Math.max(3, Math.round(around / 9));
      for (let i = 0; i < n; i++) {
        const lon = (i + rng() * 0.6 + (ring % 2) * 0.5) / n;
        const x = (lon - 0.5) * layout.width;
        const zz = z + (rng() - 0.5) * 3;
        const radius = 4.5 + rng() * 2.5 + t * 2;
        // Leave room for the cliff the river falls from.
        if (source && worldDistance(layout, source.x, source.z + 5, x, zz) < radius + 6) continue;
        const height = MOUNTAIN_HEIGHT * (0.45 + t * 0.75) + rng() * 3;
        peak(x, zz, height, radius, { snowy: ring > 0 });
      }
    }
    // The summit over the pole itself, just off it where the frame is defined.
    peak(0, pole - 1, MOUNTAIN_HEIGHT * 1.4, 8);
    // The cliff the waterfall leaps from: a flat-topped crag.
    if (source) peak(source.x, source.z + 5.5, source.height + 0.6, 5.5, { snowy: false, segments: 9, flat: 0.75 });

    const merged = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    merged.computeVertexNormals();
    return merged;
  }, [layout, R]);

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} flatShading />
      </mesh>
      <Waterfall layout={layout} />
    </>
  );
}

// --- the waterfall -------------------------------------------------------------

// A stream across the crag's top pours over the lip and falls in a curtain
// to the river, foaming where it lands.
function Waterfall({ layout }) {
  const R = layout.radius;
  const { source } = layout.river;
  const map = useWaterMap(1, 1);
  // The stream has its own copy: its texture runs the other way along the
  // crag (v grows towards the lip), so it must scroll the other way to pour
  // towards the falls rather than back up to the mountain.
  const streamMap = useWaterMap(1, 1);
  useFrame((_, delta) => {
    map.offset.y = (map.offset.y + delta * 0.9) % 1; // falling fast
    streamMap.offset.y = (streamMap.offset.y - delta * 0.45) % 1; // hurrying to the lip
  });
  const geo = useDisposable(() => {
    if (!source) return null;
    const w = layout.river.widths[0] * 0.75;
    const lip = source.z + 1.4; // the crag's front edge
    const H = source.height;
    // The curtain: rows down the fall, columns across.
    const rows = 14;
    const cols = 6;
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      // Shoots out over the lip, then drops (a parabola).
      const z = lip - 1.6 * Math.sqrt(t);
      const h = H * (1 - t * t) + 0.08;
      for (let k = 0; k <= cols; k++) {
        const u = k / cols;
        positions.push(...onGround(R, source.x + (u - 0.5) * 2 * w * (1 + 0.25 * t), z, h));
        uvs.push(u, -t * 2.5);
      }
      if (i < rows) {
        for (let k = 0; k < cols; k++) {
          const a = i * (cols + 1) + k;
          const b = a + cols + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    const curtain = new THREE.BufferGeometry();
    curtain.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    curtain.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    curtain.setIndex(indices);
    curtain.computeVertexNormals();
    // The stream on top of the crag, running to the lip.
    const stream = ribbonGeometry(R, [[source.x, source.z + 7], [source.x, lip]], w, H + 0.65, 1 / 6);
    // Foam where it lands.
    const rng = createRng("foam");
    const blob = new THREE.IcosahedronGeometry(1, 0);
    const foam = [];
    for (let i = 0; i < 14; i++) {
      const s = 0.4 + rng() * 0.7;
      const m = surfaceMatrix(R, source.x + (rng() - 0.5) * 2 * w, source.z - 0.6 - rng() * 1.5, 0.1, rng() * 6).multiply(
        new THREE.Matrix4().makeScale(s, s * 0.6, s)
      );
      foam.push(blob.clone().applyMatrix4(m));
    }
    blob.dispose();
    return { curtain, stream, foam: mergeAll(foam) };
  }, [layout, R, source]);

  if (!geo) return null;
  return (
    <>
      <mesh geometry={geo.curtain}>
        <meshStandardMaterial
          map={map}
          color="#d9f1ff"
          emissive={RIVER_COLOR}
          emissiveIntensity={0.35}
          transparent
          opacity={0.88}
          side={THREE.DoubleSide}
          roughness={0.2}
        />
      </mesh>
      <mesh geometry={geo.stream}>
        <meshStandardMaterial map={streamMap} color={RIVER_COLOR} emissive="#1aa7d8" emissiveIntensity={0.22} roughness={0.15} />
      </mesh>
      <mesh geometry={geo.foam}>
        <meshStandardMaterial color="#f4fbff" emissive="#cdeeff" emissiveIntensity={0.25} transparent opacity={0.85} flatShading />
      </mesh>
    </>
  );
}
