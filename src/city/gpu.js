// GPU resource helpers. Geometries, materials and textures we create by hand
// (rather than as JSX) aren't freed automatically when a component unmounts,
// so anything the graphics settings can unload goes through useDisposable.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SUN_DIRECTION } from "./globe3d";

// Value noise and fractal noise, for shaders that paint the sky and the clouds.
export const NOISE_GLSL = /* glsl */ `
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

function disposeDeep(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (typeof value.dispose === "function") {
    value.dispose();
    return;
  }
  for (const v of Array.isArray(value) ? value : Object.values(value)) disposeDeep(v, seen);
}

/** useMemo whose result (and anything disposable inside it) is disposed on change/unmount. */
export function useDisposable(factory, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, deps);
  useEffect(() => () => disposeDeep(value), [value]);
  return value;
}

/**
 * A standard material whose emissive glow follows the day/night line: each
 * vertex (or instance) carries `aUp`, the surface normal where it stands, and
 * the shader compares it with the live sun direction. By day the glow is
 * scaled by `dayFactor`; `tint` also warms the base colour at night (windows).
 */
export function nightGlowMaterial(params, { dayFactor = 0, tint = false } = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSun = { value: SUN_DIRECTION };
    shader.vertexShader =
      "attribute vec3 aUp;\nuniform vec3 uSun;\nvarying float vNight;\n" +
      shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vNight = smoothstep(0.1, -0.06, dot(aUp, uSun));");
    shader.fragmentShader =
      "varying float vNight;\n" +
      shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
  totalEmissiveRadiance *= mix(${dayFactor.toFixed(3)}, 1.0, vNight);
  ${tint ? "diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.9, 0.62), vNight * 0.6);" : ""}`
      );
  };
  m.customProgramCacheKey = () => `nightglow-${dayFactor}-${tint}`;
  return m;
}
