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
import { BLACK_HOLE_RADIUS, SKY_ROTATION, SPACE_COLOR, SUN_DIRECTION, blackHolePosition } from "./globe3d";
import { NOISE_GLSL, useDisposable } from "./gpu";

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
          {mode === "milkyway" && <BandStars radius={R * 37} count={stars * 20} key={`band-${stars}`} />}
          <Stars radius={R * 38} count={stars} key={stars} />
        </group>
      )}
    </>
  );
}

// The Milky Way noise is far too costly to evaluate for every sky pixel every
// frame on an integrated GPU, so it's rendered once, at load, into an
// equirectangular texture (laid out exactly like SphereGeometry's UVs) and
// the sky sphere just samples that.
const BAKE_W = 2048;
const BAKE_H = 1024;

// How bright the Milky Way's soft glow gets on the night side (it's off on the
// day side). Its sharp stars are drawn separately (BandStars), so this stays low.
const MILKY_WAY_NIGHT = 1.2;
const toCamera = new THREE.Vector3();

function MilkyWay({ radius }) {
  const gl = useThree((s) => s.gl);
  const material = useRef();
  // Seen only from the night side: it fades out as the camera comes round into
  // daylight, from the road and from space alike.
  useFrame(({ camera }) => {
    if (!material.current) return;
    const sunUp = toCamera.copy(camera.position).normalize().dot(SUN_DIRECTION);
    const night = THREE.MathUtils.smoothstep(-sunUp, -0.15, 0.25);
    material.current.color.setScalar(MILKY_WAY_NIGHT * night);
    NIGHT_SKY.value = night;
  });
  const texture = useDisposable(() => {
    const rt = new THREE.WebGLRenderTarget(BAKE_W, BAKE_H, { depthBuffer: false });
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
        ${NOISE_GLSL}
        void main() {
          // Same mapping as SphereGeometry: u → phi, v → theta.
          float phi = vUv.x * 6.28318530718;
          float theta = (1.0 - vUv.y) * 3.14159265359;
          vec3 d = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
          float b = dot(d, normal);                       // sin(galactic latitude)
          float towardCore = max(dot(d, core), 0.0);
          float width = 0.13 + 0.12 * towardCore;         // the band bulges at the core
          float band = exp(-pow(b / width, 2.0));
          // Star clouds: patchy, with real contrast, rather than an even glow.
          float clouds = pow(fbm(d * 3.2) * 0.8 + fbm(d * 9.0) * 0.4, 2.0) * 1.6;
          // Patches of dark dust along the middle of the band.
          float dust = smoothstep(0.42, 0.7, fbm(d * 6.0 + 4.1)) * exp(-pow(b / 0.05, 2.0));
          float glow = band * (0.15 + clouds) * (1.0 - 0.45 * dust);
          glow *= 0.55 + 1.3 * pow(towardCore, 3.0);
          vec3 col = mix(vec3(0.62, 0.68, 0.88), vec3(0.95, 0.9, 0.82), pow(towardCore, 2.0));
          // A faint, uneven background so the sky isn't flat black.
          float haze = fbm(d * 2.0 + 9.0) * 0.025;
          gl_FragColor = vec4(col * glow * 0.2 + vec3(0.05, 0.06, 0.12) * haze, 1.0);
        }`,
    });
    scene.add(new THREE.Mesh(geometry, material));
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(rt);
    gl.render(scene, camera);
    // Kept as ordinary pixels: a texture still on the GPU would lose its picture
    // if it were ever disposed and used again.
    const pixels = new Uint8Array(BAKE_W * BAKE_H * 4);
    gl.readRenderTargetPixels(rt, 0, 0, BAKE_W, BAKE_H, pixels);
    gl.setRenderTarget(previous);
    rt.dispose();
    geometry.dispose();
    material.dispose();
    const baked = new THREE.DataTexture(pixels, BAKE_W, BAKE_H);
    baked.colorSpace = THREE.SRGBColorSpace;
    baked.minFilter = THREE.LinearFilter;
    baked.magFilter = THREE.LinearFilter;
    baked.needsUpdate = true;
    return baked;
  }, [gl]);

  return (
    <mesh renderOrder={-20} frustumCulled={false}>
      <sphereGeometry args={[radius, 48, 24]} />
      <meshBasicMaterial ref={material} map={texture} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// How far into the night side the camera is (0 by day, 1 at night), shared by
// the Milky Way's glow and its stars.
const NIGHT_SKY = { value: 0 };

// The Milky Way's own stars: tens of thousands of tiny, sharp points packed
// along the band, thickest toward the galactic core, clumped into star clouds
// and split by dark dust lanes. Being points, they stay crisp at any screen size,
// which a painted texture can't.
function BandStars({ radius, count }) {
  const { geometry, material } = useDisposable(() => {
    const rng = createRng("milky-way-stars");
    const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng());
    const u = new THREE.Vector3().crossVectors(GALACTIC_NORMAL, new THREE.Vector3(0, 0, 1)).normalize();
    const v = new THREE.Vector3().crossVectors(GALACTIC_NORMAL, u);
    const coreAngle = Math.atan2(GALACTIC_CORE.dot(v), GALACTIC_CORE.dot(u));
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const p = new THREE.Vector3();
    const colour = new THREE.Color();
    const cool = new THREE.Color("#c9d6ff");
    const warm = new THREE.Color("#ffe2b8");
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 20; tries++) {
      const a = rng() < 0.45 ? coreAngle + gauss() * 0.7 : rng() * Math.PI * 2;
      const toward = Math.max(Math.cos(a - coreAngle), 0);
      const lat = gauss() * (0.045 + 0.075 * toward);
      // Star clouds: patches where the band is dense, gaps where it thins out.
      const clump = 0.5 + 0.5 * Math.sin(a * 7 + 1.3) * Math.sin(lat * 38 + a * 3) * Math.sin(a * 13 + lat * 11);
      if (rng() > 0.3 + 0.7 * clump) continue;
      // Dust: dark patches along the middle of the band in places, thinning
      // the stars out gradually rather than cutting a clean empty stripe.
      const patch = Math.max(0, Math.sin(a * 2.3 + 0.4)) * (0.5 + 0.5 * Math.sin(a * 9.1 + lat * 40));
      const middle = Math.exp(-(((lat - 0.012 * Math.sin(a * 5 + 0.7)) / (0.012 + 0.012 * toward)) ** 2));
      if (rng() < 0.7 * patch * middle) continue;
      p.copy(u)
        .multiplyScalar(Math.cos(a) * Math.cos(lat))
        .addScaledVector(v, Math.sin(a) * Math.cos(lat))
        .addScaledVector(GALACTIC_NORMAL, Math.sin(lat))
        .multiplyScalar(radius);
      positions.set([p.x, p.y, p.z], placed * 3);
      const m = rng();
      sizes[placed] = 0.8 + 1.4 * Math.pow(m, 8);
      colour.copy(cool).lerp(warm, Math.min(1, toward * toward + rng() * 0.3)).multiplyScalar(0.3 + 0.7 * Math.pow(m, 2));
      colors.set([colour.r, colour.g, colour.b], placed * 3);
      placed++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions.subarray(0, placed * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors.subarray(0, placed * 3), 3));
    g.setAttribute("size", new THREE.BufferAttribute(sizes.subarray(0, placed), 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { night: NIGHT_SKY, pixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) } },
      vertexShader: /* glsl */ `
        attribute float size; attribute vec3 color;
        uniform float pixelRatio;
        varying vec3 vColor;
        void main() {
          vColor = color;
          gl_PointSize = size * pixelRatio * 1.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float night; varying vec3 vColor;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float a = exp(-dot(q, q) * 18.0) * night;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * a, a);
        }`,
    });
    return { geometry: g, material: mat };
  }, [radius, count]);
  return <points geometry={geometry} material={material} renderOrder={-19} frustumCulled={false} />;
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
      ${NOISE_GLSL}
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

function glowMaterial(rh, reach) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { rh: { value: rh }, reach: { value: reach } },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float rh; uniform float reach; varying vec2 vPos;
      void main() {
        float r = length(vPos) / rh;
        // Thin photon ring hugging the shadow…
        float ring = exp(-pow((r - 1.08) * 20.0, 2.0)) * 1.6;
        // …and the light it pours out: a hot inner halo and a wide soft bloom.
        float halo = r > 1.0 ? 1.1 * pow(1.0 / r, 2.2) : 0.0;
        float bloom = 0.35 * exp(-r * 0.22);
        vec3 col = vec3(1.0, 0.82, 0.55) * ring + vec3(1.0, 0.62, 0.3) * halo + vec3(1.0, 0.55, 0.25) * bloom;
        // Gone before the edge of its square, so the square never shows.
        float fade = smoothstep(reach, reach * 0.45, r);
        float a = clamp(ring + halo + bloom, 0.0, 1.0) * fade;
        gl_FragColor = vec4(col * fade, a);
      }`,
  });
}

// `quality`: "full" (swirling disk, lensed halo, wide glow) | "simple"
// (lighter disk, no lensed halo, tighter glow).
// How far from the camera the black hole is drawn, in planet radii: past the
// planet, inside the camera's range.
const DRAWN_AT = 30;
const toHole = new THREE.Vector3();

export function BlackHole({ R, quality = "full" }) {
  const rh = R * BLACK_HOLE_RADIUS; // event horizon
  const full = quality === "full";
  const group = useRef();
  const disk = useDisposable(() => diskMaterial(rh * 1.5, rh * 5.5, 1.4), [rh]);
  const lensed = useDisposable(() => diskMaterial(rh * 1.05, rh * 2.2, 1.0), [rh]);
  const glowSize = full ? 18 : 11; // across, in event-horizon radii
  const glow = useDisposable(() => glowMaterial(rh, glowSize / 2), [rh, glowSize]);

  // It's far beyond what the camera draws, so it's drawn as part of the sky: at a
  // fixed distance from the camera, along its true direction and scaled to its true
  // size there. It looks exactly as far off as it is, without stretching the
  // camera's range (which would make the roads flicker).
  useFrame(({ camera }, delta) => {
    disk.uniforms.time.value += delta;
    lensed.uniforms.time.value += delta * 1.3;
    blackHolePosition(R, toHole).sub(camera.position);
    const shrink = (R * DRAWN_AT) / toHole.length();
    group.current.position.copy(camera.position).addScaledVector(toHole, shrink);
    group.current.scale.setScalar(shrink);
    group.current.rotation.y = SKY_ROTATION.y; // the disk keeps its tilt relative to the sky
  });

  return (
    <group ref={group}>
      {/* Wide glow first, so the disk and shadow draw over it. */}
      <Billboard>
        <mesh material={glow} renderOrder={2}>
          <planeGeometry args={[rh * glowSize, rh * glowSize]} />
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
        <sphereGeometry args={[rh, 96, 48]} />
        <meshBasicMaterial color="#000" />
      </mesh>
    </group>
  );
}
