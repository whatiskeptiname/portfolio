// src/city/Clouds.jsx — soft, wispy cloud around the planet, stretched east to
// west as on a real planet seen from space, at heights from 40 to 50 m. The noise
// is too costly to work out for every pixel every frame, so it's painted once at
// load into a texture, and each frame just samples that. The cloud is shared out
// between a few thin shells, so spreading it over those heights doesn't thicken
// it. Lit by the sun, so it fades on the night side.
import React, { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SUN_DIRECTION } from "./globe3d";
import { NOISE_GLSL, useDisposable } from "./gpu";

const BAKE_W = 1024;
const BAKE_H = 512;
const HEIGHTS = [40, 45, 50]; // above the ground, in metres
const OPACITY = 0.4;
const NIGHT = new THREE.Color(0.16, 0.18, 0.28);
const DRIFT = 0.006; // radians a second

function bakeClouds(gl) {
  const target = new THREE.WebGLRenderTarget(BAKE_W, BAKE_H, { depthBuffer: false });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        // Same mapping as SphereGeometry: u → phi, v → theta.
        float phi = vUv.x * 6.28318530718;
        float theta = (1.0 - vUv.y) * 3.14159265359;
        vec3 d = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
        // Squashed toward the poles, so the patches run east to west.
        vec3 p = vec3(d.x, d.y * 2.6, d.z);
        // Bending the noise through itself is what makes it curl like cloud.
        vec3 warp = vec3(fbm(p * 2.5 + 1.7), fbm(p * 2.5 + 9.2), fbm(p * 2.5 + 4.4));
        float masses = fbm(p * 4.5 + warp * 1.6);
        float wisps = fbm(p * 19.0 + warp * 3.5);
        float cloud = smoothstep(0.54, 0.76, masses * 0.78 + wisps * 0.34);
        // A second, slower noise decides which height each part of the cloud is at.
        float height = smoothstep(0.3, 0.66, fbm(p * 3.5 + 20.0));
        gl_FragColor = vec4(cloud, height, 0.0, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(geometry, material));
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  gl.render(scene, camera);
  // Kept as ordinary pixels: a texture still on the GPU would lose its picture if
  // it were ever disposed and used again.
  const pixels = new Uint8Array(BAKE_W * BAKE_H * 4);
  gl.readRenderTargetPixels(target, 0, 0, BAKE_W, BAKE_H, pixels);
  gl.setRenderTarget(previous);
  target.dispose();
  geometry.dispose();
  material.dispose();
  const texture = new THREE.DataTexture(pixels, BAKE_W, BAKE_H);
  texture.wrapS = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function shellMaterial(baked, shell) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide, // seen from space above and from the road below
    uniforms: {
      map: { value: baked },
      sun: { value: SUN_DIRECTION },
      shell: { value: shell },
      last: { value: HEIGHTS.length - 1 },
      night: { value: NIGHT },
      opacity: { value: OPACITY },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vUp; varying vec3 vWorld;
      void main() {
        vUv = uv;
        vUp = normalize(mat3(modelMatrix) * normal);
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 sun; uniform vec3 night; uniform float opacity;
      uniform float shell; uniform float last;
      varying vec2 vUv; varying vec3 vUp; varying vec3 vWorld;
      void main() {
        vec4 baked = texture2D(map, vUv);
        // This shell's share of the cloud; the shares add up to the whole.
        float share = clamp(1.0 - abs(baked.g * last - shell), 0.0, 1.0);
        float cloud = baked.r;
        float day = smoothstep(-0.12, 0.3, dot(normalize(vUp), sun));
        // Thick cloud is a little greyer than its thin edges.
        vec3 col = mix(night, vec3(1.0), day) * (1.0 - 0.14 * cloud);
        // Faded where you look along the layer: no hard rim around the planet
        // from space, and no band along the horizon from the road.
        float facing = abs(dot(normalize(vUp), normalize(cameraPosition - vWorld)));
        gl_FragColor = vec4(col, cloud * share * opacity * (0.45 + 0.55 * day) * smoothstep(0.05, 0.4, facing));
      }`,
  });
}

export function Clouds({ R }) {
  const gl = useThree((s) => s.gl);
  const group = useRef();
  const baked = useDisposable(() => bakeClouds(gl), [gl]);
  const materials = useDisposable(() => HEIGHTS.map((_, shell) => shellMaterial(baked, shell)), [baked]);

  useFrame((_, delta) => {
    group.current.rotation.y += delta * DRIFT;
  });

  return (
    <group ref={group}>
      {HEIGHTS.map((height, i) => (
        <mesh key={height} material={materials[i]} renderOrder={2}>
          <sphereGeometry args={[R + height, 96, 48]} />
        </mesh>
      ))}
    </group>
  );
}
