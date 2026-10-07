// src/city/Lamps.jsx — street lamps along every road (placed by lib/lamps).
// Posts and arms are one merged mesh; the lamp heads glow only on the night
// side (nightGlowMaterial), and each throws a soft pool of light onto the
// road — an additive decal rather than a real light, so hundreds cost next to
// nothing. Highway lamps take their side's colour: warm gold on the résumé
// side, cool white on the open-source side; the side roads burn sodium-warm.
import React from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HIGHWAY_HALF_WIDTH } from "../lib/layout";
import { placeLamps } from "../lib/lamps";
import { frameAt } from "../lib/globe";
import { SUN_DIRECTION, onGround, surfaceMatrix } from "./globe3d";
import { nightGlowMaterial, useDisposable } from "./gpu";

const POST = 4.6;
const ARM = 1.7;
const POOL = 3.6;
const COLORS = { north: "#ffd27a", south: "#d8f4ff", lane: "#ffb867" };

const poolMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIRECTION } },
    vertexShader: `
      attribute vec3 aUp;
      attribute vec3 color;
      uniform vec3 uSun;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vNight;
      void main() {
        vUv = uv;
        vColor = color;
        vNight = smoothstep(0.1, -0.06, dot(aUp, uSun));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vNight;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d);
        gl_FragColor = vec4(vColor * a * a * 0.55 * vNight, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

export function Lamps({ layout }) {
  const R = layout.radius;
  const geo = useDisposable(() => {
    const lamps = placeLamps(layout);
    const posts = [];
    const heads = { north: [], south: [], lane: [] };
    const pools = [];
    const post = new THREE.CylinderGeometry(0.08, 0.13, POST, 6);
    post.translate(0, POST / 2, 0);
    const arm = new THREE.BoxGeometry(0.1, 0.1, ARM);
    const head = new THREE.BoxGeometry(0.34, 0.14, 0.7);
    for (const l of lamps) {
      // Yaw so local -z (vehicle "forward") points along the arm, over the road.
      const yaw = Math.atan2(-l.dx, -l.dz);
      const m = surfaceMatrix(R, l.x, l.z, l.h, yaw);
      posts.push(post.clone().applyMatrix4(m));
      posts.push(arm.clone().applyMatrix4(m.clone().multiply(new THREE.Matrix4().makeTranslation(0, POST - 0.05, -ARM / 2 + 0.05))));
      const kind = Math.abs(l.z) < HIGHWAY_HALF_WIDTH + 2 ? (l.z < 0 ? "north" : "south") : "lane";
      const h = head.clone().applyMatrix4(m.clone().multiply(new THREE.Matrix4().makeTranslation(0, POST - 0.14, -ARM + 0.1)));
      setUp(h, frameAt(R, l.x, l.z).up);
      heads[kind].push(h);
      // The pool of light under the head.
      const cx = l.x + l.dx * (ARM - 0.1);
      const cz = l.z + l.dz * (ARM - 0.1);
      pools.push(poolGeometry(R, cx, cz, l.h + 0.3, POOL, new THREE.Color(COLORS[kind])));
    }
    post.dispose();
    arm.dispose();
    head.dispose();
    const merge = (list) => {
      const out = list.length ? mergeGeometries(list) : null;
      list.forEach((g) => g.dispose());
      return out;
    };
    return {
      posts: merge(posts),
      heads: Object.fromEntries(Object.entries(heads).map(([k, v]) => [k, merge(v)])),
      pools: merge(pools),
      materials: {
        ...Object.fromEntries(
          Object.entries(COLORS).map(([k, c]) => [k, nightGlowMaterial({ color: "#3b3d44", emissive: c, emissiveIntensity: 3 }, { dayFactor: 0 })])
        ),
        pool: poolMaterial(),
      },
    };
  }, [layout, R]);

  return (
    <>
      {geo.posts && (
        <mesh geometry={geo.posts} castShadow>
          <meshStandardMaterial color="#4a4d55" metalness={0.5} roughness={0.5} />
        </mesh>
      )}
      {Object.entries(geo.heads).map(([k, g]) => g && <mesh key={k} geometry={g} material={geo.materials[k]} />)}
      {geo.pools && <mesh geometry={geo.pools} material={geo.materials.pool} renderOrder={2} />}
    </>
  );
}

function setUp(geometry, up) {
  const n = geometry.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set(up, i * 3);
  geometry.setAttribute("aUp", new THREE.BufferAttribute(arr, 3));
}

// A small square decal (uv 0..1 across) draped on the planet at (cx, cz).
function poolGeometry(R, cx, cz, h, radius, color) {
  const positions = [];
  const uvs = [];
  const n = 4;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const v = j / n;
      positions.push(...onGround(R, cx + (u - 0.5) * 2 * radius, cz + (v - 0.5) * 2 * radius, h));
      uvs.push(u, v);
    }
  }
  const indices = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      indices.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  const count = positions.length / 3;
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3).map((_, i) => [color.r, color.g, color.b][i % 3]), 3));
  setUp(g, frameAt(R, cx, cz).up);
  return g;
}
