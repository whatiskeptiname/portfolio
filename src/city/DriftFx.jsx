// src/city/DriftFx.jsx — what a drift leaves behind: tyre smoke billowing off
// the rear wheels, and dark skid marks on the road that fade away after a
// while. Both live in world space (the car's own pose is s.worldMatrix), in
// fixed-size pools, so a long drift never grows the scene.
import React, { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDisposable } from "./gpu";

const SKID = { segments: 900, width: 0.24, life: 9, step: 0.3, alpha: 0.85 };
// Smoke: soft see-through puffs, thin at first, thickening, then swelling
// and thinning away as they rise, drift and slowly turn.
const SMOKE = { count: 180, life: 3.2, every: 0.03, start: 0.7, end: 5.5, opacity: 0.75 };

/** A soft, lumpy puff: a few overlapping blurred blobs, white with a soft edge. */
function puffTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const blob = (x, y, r, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  };
  blob(64, 64, 60, 0.8);
  [[46, 52, 30], [80, 50, 28], [58, 82, 32], [84, 80, 24], [40, 76, 22]].forEach(([x, y, r]) => blob(x, y, r, 0.35));
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Each puff is a square facing the camera (turned by its spin), placed in
// view space so it always faces you; drawn as instances of one quad.
const SMOKE_VERTEX = /* glsl */ `
  attribute vec3 offset;
  attribute float size;
  attribute float alpha;
  attribute float spin;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    float s = sin(spin), k = cos(spin);
    vec2 corner = vec2(k * position.x - s * position.y, s * position.x + k * position.y) * size;
    vec4 mv = viewMatrix * vec4(offset, 1.0);
    mv.xy += corner;
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vAlpha = alpha;
  }
`;
const SMOKE_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 color;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vec4 t = texture2D(map, vUv);
    float a = t.a * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(color * t.rgb, a);
  }
`;
// The rear wheels, in the car's frame (front is −z): where they touch the
// road, and a little behind and above for the smoke.
const REAR = [
  [-0.95, 0.04, 1.42],
  [0.95, 0.04, 1.42],
];

/** Is the car sliding enough to mark the road and smoke the tyres? */
const sliding = (s) => Boolean(s.drifting) || ((s.rearGrip ?? 1) < 0.6 && Math.abs(s.speed ?? 0) > 4);

export function DriftFx({ state, enabled = true }) {
  // Skid marks: one quad (two triangles) per stretch of tyre, with RGBA
  // vertex colours so each stretch can fade on its own.
  const skid = useDisposable(() => {
    const geometry = new THREE.BufferGeometry();
    const n = SKID.segments * 6;
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    return { geometry, material };
  }, []);
  const marks = useMemo(() => ({ born: new Float32Array(SKID.segments).fill(-1e9), next: 0, prev: [null, null] }), []);

  // Smoke: a pool of puffs drawn as soft, camera-facing points, each with
  // its own size, opacity and turn.
  const smoke = useDisposable(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute("position", quad.attributes.position);
    geometry.setAttribute("uv", quad.attributes.uv);
    const per = (n) => new THREE.InstancedBufferAttribute(new Float32Array(SMOKE.count * n), n).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("offset", per(3));
    geometry.setAttribute("size", per(1));
    geometry.setAttribute("alpha", per(1));
    geometry.setAttribute("spin", per(1));
    geometry.instanceCount = SMOKE.count;
    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: puffTexture() }, color: { value: new THREE.Color("#a9a6a0") } },
      vertexShader: SMOKE_VERTEX,
      fragmentShader: SMOKE_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    return { geometry, material };
  }, []);
  const puffs = useMemo(
    () => ({
      items: Array.from({ length: SMOKE.count }, () => ({ age: Infinity, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0, turn: 0, grow: 1 })),
      next: 0,
      since: 0,
    }),
    []
  );
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3(), back: new THREE.Vector3() }), []);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const now = clock.elapsedTime;
    const s = state.current;
    const m = s.worldMatrix;
    const on = enabled && m && sliding(s);
    if (m) {
      tmp.right.setFromMatrixColumn(m, 0).normalize();
      tmp.up.setFromMatrixColumn(m, 1).normalize();
      tmp.back.setFromMatrixColumn(m, 2).normalize();
    }

    // Lay new skid marks behind each rear wheel.
    const pos = skid.geometry.attributes.position;
    const col = skid.geometry.attributes.color;
    REAR.forEach((local, w) => {
      if (!on) {
        marks.prev[w] = null;
        return;
      }
      const p = tmp.p.set(...local).applyMatrix4(m).addScaledVector(tmp.up, 0.03).clone();
      const prev = marks.prev[w];
      if (!prev) {
        marks.prev[w] = p;
        return;
      }
      if (prev.distanceTo(p) < SKID.step) return;
      const i = marks.next;
      marks.next = (i + 1) % SKID.segments;
      marks.born[i] = now;
      const h = SKID.width / 2;
      const a1 = prev.clone().addScaledVector(tmp.right, -h);
      const a2 = prev.clone().addScaledVector(tmp.right, h);
      const b1 = p.clone().addScaledVector(tmp.right, -h);
      const b2 = p.clone().addScaledVector(tmp.right, h);
      [a1, a2, b1, a2, b2, b1].forEach((v, k) => pos.setXYZ(i * 6 + k, v.x, v.y, v.z));
      marks.prev[w] = p;
    });
    // Fade every mark with its age.
    for (let i = 0; i < SKID.segments; i++) {
      const age = now - marks.born[i];
      const a = age < SKID.life ? SKID.alpha * (1 - age / SKID.life) : 0;
      for (let k = 0; k < 6; k++) col.setXYZW(i * 6 + k, 0.01, 0.01, 0.012, a);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;

    // Puff smoke off the rear tyres while sliding, thicker the harder it slides.
    puffs.since += dt;
    const every = SMOKE.every / Math.max(0.4, Math.min(1.5, Math.abs(Math.sin(s.slip ?? 0)) * 2.5));
    if (on && puffs.since > every) {
      puffs.since = 0;
      for (const local of REAR) {
        const pf = puffs.items[puffs.next];
        puffs.next = (puffs.next + 1) % SMOKE.count;
        pf.age = 0;
        pf.spin = Math.random() * Math.PI * 2;
        pf.turn = (Math.random() - 0.5) * 1.2;
        pf.grow = 0.8 + Math.random() * 0.5;
        pf.pos.set(local[0], 0.35, local[2] + 0.3).applyMatrix4(m);
        pf.vel
          .copy(tmp.up)
          .multiplyScalar(0.6 + Math.random() * 0.5)
          .addScaledVector(tmp.right, (Math.random() - 0.5) * 1.6)
          .addScaledVector(tmp.back, 0.8 + Math.random());
      }
    }
    const at = smoke.geometry.attributes;
    puffs.items.forEach((pf, i) => {
      pf.age += dt;
      let size = 0;
      let alpha = 0;
      if (pf.age < SMOKE.life) {
        pf.pos.addScaledVector(pf.vel, dt);
        pf.vel.multiplyScalar(Math.exp(-1.2 * dt));
        pf.vel.addScaledVector(tmp.up, 0.25 * dt); // warm air: it keeps rising gently
        pf.spin += pf.turn * dt;
        const t = pf.age / SMOKE.life;
        size = (SMOKE.start + (SMOKE.end - SMOKE.start) * (1 - (1 - t) * (1 - t))) * pf.grow; // swells fast, then slower
        alpha = SMOKE.opacity * Math.min(1, pf.age / 0.15) * Math.pow(1 - t, 1.3); // thickens, then thins away
      }
      at.offset.setXYZ(i, pf.pos.x, pf.pos.y, pf.pos.z);
      at.size.setX(i, size);
      at.alpha.setX(i, alpha);
      at.spin.setX(i, pf.spin);
    });
    at.offset.needsUpdate = true;
    at.size.needsUpdate = true;
    at.alpha.needsUpdate = true;
    at.spin.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={skid.geometry} material={skid.material} frustumCulled={false} renderOrder={1} />
      <mesh geometry={smoke.geometry} material={smoke.material} frustumCulled={false} renderOrder={2} />
    </>
  );
}
