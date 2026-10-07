// src/city/Space.jsx — the sky and the black hole.
//
// The sky is modelled on the real one: a Milky Way band with dust lanes and a
// brighter core, and stars whose brightness follows a steep power law (lots of
// faint ones, a handful of bright ones) and whose colours follow stellar
// temperature, crowding toward the galactic plane.
//
// The black hole is the planet's sun: a glowing accretion disk, the lensed
// halo of its far side, a photon ring and a wide glow.
import React, { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { createRng } from "../lib/layout";
import { SKY_ROTATION, SPACE_COLOR, blackHolePosition } from "./globe3d";
import { useDisposable } from "./gpu";

// Galactic plane (normal) and the direction of the galactic core.
const GALACTIC_NORMAL = new THREE.Vector3(0.42, 0.78, -0.46).normalize();
const GALACTIC_CORE = new THREE.Vector3(-0.85, 0.25, -0.46).projectOnPlane(GALACTIC_NORMAL).normalize();

// Rough share of stars by spectral colour (blue-white … orange-red).
const STAR_COLOURS = [
  [0.08, "#9db4ff"],
  [0.22, "#cad8ff"],
  [0.32, "#fbf8ff"],
  [0.22, "#ffefd8"],
  [0.11, "#ffd2a1"],
  [0.05, "#ffae72"],
];

// The camera rides with the planet, so as it spins (and circles the black
// hole) the whole sky wheels past — stars and black hole together.
//
// `mode`: "milkyway" (baked band + stars) | "stars" | "off"; `stars`: how many.
export function Sky({ R, mode = "milkyway", stars = 6000 }) {
  const group = useRef();
  useFrame(() => {
    if (group.current) group.current.rotation.y = SKY_ROTATION.y;
  });
  return (
    <>
      <color attach="background" args={[SPACE_COLOR]} />
      {mode !== "off" && (
        <group ref={group}>
          {mode === "milkyway" && <MilkyWay radius={R * 40} />}
          <Stars radius={R * 38} count={stars} key={stars} />
        </group>
      )}
    </>
  );
}

const NOISE = /* glsl */ `
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

// The Milky Way noise is far too costly to evaluate for every sky pixel every
// frame on an integrated GPU, so it's rendered once, at load, into an
// equirectangular texture (laid out exactly like SphereGeometry's UVs) and
// the sky sphere just samples that.
const BAKE_W = 2048;
const BAKE_H = 1024;

function MilkyWay({ radius }) {
  const gl = useThree((s) => s.gl);
  const target = useDisposable(() => {
    const rt = new THREE.WebGLRenderTarget(BAKE_W, BAKE_H, { depthBuffer: false, generateMipmaps: false });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: { normal: { value: GALACTIC_NORMAL }, core: { value: GALACTIC_CORE } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 normal; uniform vec3 core;
        varying vec2 vUv;
        ${NOISE}
        void main() {
          // Same mapping as SphereGeometry: u → phi, v → theta.
          float phi = vUv.x * 6.28318530718;
          float theta = (1.0 - vUv.y) * 3.14159265359;
          vec3 d = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
          float b = dot(d, normal);                       // sin(galactic latitude)
          float towardCore = max(dot(d, core), 0.0);
          float width = 0.13 + 0.12 * towardCore;         // the band bulges at the core
          float band = exp(-pow(b / width, 2.0));
          float clouds = fbm(d * 3.2) * 0.8 + fbm(d * 9.0) * 0.4;
          // Dark dust lanes along the middle of the band.
          float dust = smoothstep(0.42, 0.7, fbm(d * 6.0 + 4.1)) * exp(-pow(b / 0.05, 2.0));
          float glow = band * (0.35 + clouds) * (1.0 - 0.75 * dust);
          glow *= 0.55 + 1.3 * pow(towardCore, 3.0);
          vec3 col = mix(vec3(0.55, 0.62, 0.85), vec3(1.0, 0.85, 0.65), pow(towardCore, 2.0));
          // A faint, uneven background so the sky isn't flat black.
          float haze = fbm(d * 2.0 + 9.0) * 0.025;
          gl_FragColor = vec4(col * glow * 0.16 + vec3(0.05, 0.06, 0.12) * haze, 1.0);
        }`,
    });
    scene.add(new THREE.Mesh(geometry, material));
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(rt);
    gl.render(scene, camera);
    gl.setRenderTarget(previous);
    geometry.dispose();
    material.dispose();
    return rt;
  }, [gl]);

  return (
    <mesh renderOrder={-20} frustumCulled={false}>
      <sphereGeometry args={[radius, 48, 24]} />
      <meshBasicMaterial map={target.texture} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Stars({ radius, count = 6000 }) {
  const { geometry, material } = useDisposable(() => {
    const rng = createRng("stars");
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const tmp = new THREE.Vector3();
    const u = new THREE.Vector3().crossVectors(GALACTIC_NORMAL, new THREE.Vector3(0, 0, 1)).normalize();
    const v = new THREE.Vector3().crossVectors(GALACTIC_NORMAL, u);
    const colour = new THREE.Color();
    const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng());

    for (let i = 0; i < count; i++) {
      if (rng() < 0.55) {
        // Crowd toward the galactic plane (and a little toward the core).
        const a = rng() < 0.3 ? Math.atan2(GALACTIC_CORE.dot(v), GALACTIC_CORE.dot(u)) + gauss() * 0.5 : rng() * Math.PI * 2;
        const lat = gauss() * 0.11;
        tmp
          .copy(u)
          .multiplyScalar(Math.cos(a) * Math.cos(lat))
          .addScaledVector(v, Math.sin(a) * Math.cos(lat))
          .addScaledVector(GALACTIC_NORMAL, Math.sin(lat));
      } else {
        const z = rng() * 2 - 1;
        const t = rng() * Math.PI * 2;
        const r = Math.sqrt(1 - z * z);
        tmp.set(r * Math.cos(t), z, r * Math.sin(t));
      }
      tmp.normalize().multiplyScalar(radius);
      positions.set([tmp.x, tmp.y, tmp.z], i * 3);

      // Steep brightness distribution: most stars faint, very few bright.
      const m = rng();
      sizes[i] = 0.7 + 4.2 * Math.pow(m, 14) + 0.9 * Math.pow(m, 3);
      let pick = rng();
      let hex = STAR_COLOURS[STAR_COLOURS.length - 1][1];
      for (const [share, c] of STAR_COLOURS) {
        if ((pick -= share) <= 0) {
          hex = c;
          break;
        }
      }
      colour.set(hex).multiplyScalar(0.35 + 0.65 * Math.pow(m, 2));
      colors.set([colour.r, colour.g, colour.b], i * 3);
      phases[i] = rng() * Math.PI * 2;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("phase", new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, pixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) } },
      vertexShader: /* glsl */ `
        attribute float size; attribute float phase; attribute vec3 color;
        uniform float time; uniform float pixelRatio;
        varying vec3 vColor; varying float vTwinkle;
        void main() {
          vColor = color;
          // Gentle scintillation, stronger for small (faint) stars.
          vTwinkle = 1.0 - 0.25 * (0.5 + 0.5 * sin(time * (1.3 + fract(phase) * 2.0) + phase * 7.0)) / size;
          gl_PointSize = size * pixelRatio * 1.6;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vTwinkle;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float r = length(p) * 2.0;
          float core = exp(-r * r * 9.0);
          float halo = exp(-r * 3.5) * 0.35;
          float a = (core + halo) * vTwinkle;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * a, a);
        }`,
    });
    return { geometry: g, material: mat };
  }, [radius, count]);

  useFrame((_, delta) => {
    material.uniforms.time.value += delta;
  });

  return <points geometry={geometry} material={material} renderOrder={-19} frustumCulled={false} />;
}

// --- black hole -------------------------------------------------------------

// Glowing, swirling disk. `inner`/`outer` are radii in the ring's units.
function diskMaterial(inner, outer, strength) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, inner: { value: inner }, outer: { value: outer }, strength: { value: strength } },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform float inner; uniform float outer; uniform float strength;
      varying vec2 vPos;
      ${NOISE}
      void main() {
        float r = length(vPos);
        float t = clamp((r - inner) / (outer - inner), 0.0, 1.0);
        float ang = atan(vPos.y, vPos.x);
        // Streaks orbit faster near the hole.
        float spin = ang - time * (0.9 - 0.6 * t);
        float swirl = fbm(vec3(cos(spin) * 3.0, sin(spin) * 3.0, t * 9.0));
        float falloff = pow(1.0 - t, 1.6) * smoothstep(0.0, 0.06, t);
        // Doppler beaming: the side moving toward us is brighter.
        float beam = 0.65 + 0.55 * cos(ang + 0.6);
        vec3 hot = vec3(1.0, 0.97, 0.9);
        vec3 warm = vec3(1.0, 0.6, 0.22);
        vec3 cool = vec3(0.6, 0.15, 0.06);
        vec3 col = mix(hot, warm, smoothstep(0.0, 0.35, t));
        col = mix(col, cool, smoothstep(0.35, 1.0, t));
        float i = falloff * (0.5 + 0.9 * swirl) * beam * strength;
        gl_FragColor = vec4(col * i, i);
      }`,
  });
}

function glowMaterial(rh) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { rh: { value: rh } },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float rh; varying vec2 vPos;
      void main() {
        float r = length(vPos) / rh;
        // Thin photon ring hugging the shadow…
        float ring = exp(-pow((r - 1.08) * 20.0, 2.0)) * 1.6;
        // …and the light it pours out: a hot inner halo and a wide soft bloom.
        float halo = r > 1.0 ? 1.1 * pow(1.0 / r, 2.2) : 0.0;
        float bloom = 0.35 * exp(-r * 0.22);
        vec3 col = vec3(1.0, 0.82, 0.55) * ring + vec3(1.0, 0.62, 0.3) * halo + vec3(1.0, 0.55, 0.25) * bloom;
        float a = clamp(ring + halo + bloom, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }`,
  });
}

// `quality`: "full" (swirling disk, lensed halo, wide glow) | "simple"
// (lighter disk, no lensed halo, tighter glow).
export function BlackHole({ R, quality = "full" }) {
  const rh = R * 0.2; // event horizon
  const full = quality === "full";
  const group = useRef();
  const disk = useDisposable(() => diskMaterial(rh * 1.5, rh * 5.5, 1.4), [rh]);
  const lensed = useDisposable(() => diskMaterial(rh * 1.05, rh * 2.2, 1.0), [rh]);
  const glow = useDisposable(() => glowMaterial(rh), [rh]);

  useFrame((_, delta) => {
    disk.uniforms.time.value += delta;
    lensed.uniforms.time.value += delta * 1.3;
    blackHolePosition(R, group.current.position);
    group.current.rotation.y = SKY_ROTATION.y; // the disk keeps its tilt relative to the sky
  });

  return (
    <group ref={group}>
      {/* Wide glow first, so the disk and shadow draw over it. */}
      <Billboard>
        <mesh material={glow} renderOrder={2}>
          <planeGeometry args={full ? [rh * 18, rh * 18] : [rh * 11, rh * 11]} />
        </mesh>
      </Billboard>
      {/* Accretion disk, tilted a little toward the planet. */}
      <group rotation={[-Math.PI / 2 + 0.22, 0, 0.25]}>
        <mesh material={disk} renderOrder={3}>
          <ringGeometry args={[rh * 1.5, rh * 5.5, full ? 160 : 96, full ? 3 : 1]} />
        </mesh>
      </group>
      {/* Light bent over and under the hole: the lensed far side of the disk. */}
      {full && (
        <Billboard>
          <mesh material={lensed} scale={[1, 0.92, 1]} renderOrder={3}>
            <ringGeometry args={[rh * 1.05, rh * 2.2, 128, 1]} />
          </mesh>
        </Billboard>
      )}
      <mesh renderOrder={4}>
        <sphereGeometry args={[rh, 32, 16]} />
        <meshBasicMaterial color="#000" />
      </mesh>
    </group>
  );
}
