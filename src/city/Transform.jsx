// src/city/Transform.jsx — the car ⇄ drone transformation.
//
// While transforming, the vehicle is drawn as a rig of ~19 pieces. Every
// piece has a pose in the car and a pose in the drone and travels between
// them on its own staggered, arcing, spinning path: wheels flip flat and slide
// out to become motors, fenders unfold into arms, the cabin lifts and
// compacts into the battery, the hood flips into the top plate, headlights
// become the FPV camera, the spoiler the antenna, props fan out last.
// Energy lines, sparks at every joint, a shockwave ring and a core flash sell
// it. Drone → car plays the same choreography backwards.
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const TRANSFORM_SECONDS = 1.9;

const RED = "#e0283f";
const CARBON = "#17181c";
const TIRE = "#181818";
const MOTOR = "#2b2d33";
const PROP = "#2fd6ff";
const DRONE_Y = 0.22; // the drone model sits this high in the vehicle frame

// [x, y, z] position, [x, y, z] rotation, [x, y, z] scale, colour, emissive.
const pose = (p, r, s, c, e = null) => ({ p, r, s, c, e });
const H = Math.PI / 2;

/**
 * Each piece: shape ("box" | "cyl"), car pose, drone pose, timing (delay and
 * duration as fractions of the whole transform), arc height, and extra spin
 * (radians about x/y/z) thrown in mid-flight.
 */
function buildPieces() {
  const pieces = [
    {
      name: "chassis",
      shape: "box",
      car: pose([0, 0.55, 0], [0, 0, 0], [2.1, 0.45, 4.4], RED),
      drone: pose([0, DRONE_Y + 0.02, 0], [0, 0, 0], [0.72, 0.05, 1.15], CARBON),
      delay: 0.34,
      dur: 0.5,
      arc: 0.3,
      spin: [0, 0, 0],
    },
    {
      name: "hood",
      shape: "box",
      car: pose([0, 1.02, -1.55], [0, 0, 0], [1.9, 0.12, 1.3], RED),
      drone: pose([0, DRONE_Y + 0.34, 0], [0, 0, 0], [0.62, 0.04, 0.95], CARBON),
      delay: 0.28,
      dur: 0.55,
      arc: 1.1,
      spin: [Math.PI * 2, 0, 0],
    },
    {
      name: "cabin",
      shape: "box",
      car: pose([0, 1.42, 0.3], [0, 0, 0], [1.8, 0.7, 2.0], "#1c2d3c"),
      drone: pose([0, DRONE_Y + 0.52, 0], [0, 0, 0], [0.46, 0.3, 0.92], "#ff4d2e"),
      delay: 0.4,
      dur: 0.5,
      arc: 1.6,
      spin: [0, Math.PI * 2, 0],
    },
    {
      name: "trunk",
      shape: "box",
      car: pose([0, 1.05, 1.75], [0, 0, 0], [1.9, 0.12, 1.0], RED),
      drone: pose([0, DRONE_Y + 0.17, 0], [0, 0, 0], [0.4, 0.12, 0.4], "#0f3b2e", "#18ff9c"),
      delay: 0.44,
      dur: 0.45,
      arc: 0.8,
      spin: [0, 0, Math.PI],
    },
    {
      name: "headlights",
      shape: "box",
      car: pose([0, 0.8, -2.43], [0, 0, 0], [1.4, 0.14, 0.12], "#fff8e1", "#fff1b0"),
      drone: pose([0, DRONE_Y + 0.18, -0.6], [0.45, 0, 0], [0.3, 0.26, 0.24], "#ff8a00"),
      delay: 0.5,
      dur: 0.42,
      arc: 0.5,
      spin: [0, Math.PI, 0],
    },
    {
      name: "spoiler",
      shape: "box",
      car: pose([0, 1.27, 2.2], [0, 0, 0], [1.9, 0.08, 0.4], "#1b1b1f"),
      drone: pose([0, DRONE_Y + 0.6, 0.66], [-0.6, 0, 0], [0.05, 0.5, 0.05], "#222"),
      delay: 0.52,
      dur: 0.42,
      arc: 1.3,
      spin: [0, 0, Math.PI * 2],
    },
    {
      name: "taillights",
      shape: "box",
      car: pose([0, 0.98, 2.47], [0, 0, 0], [1.5, 0.07, 0.05], "#ff3030", "#ff1a1a"),
      drone: pose([0, DRONE_Y - 0.05, 0.3], [0, 0, 0], [0.9, 0.03, 0.06], "#ff2d6a", "#ff2d6a"),
      delay: 0.58,
      dur: 0.36,
      arc: 0.4,
      spin: [0, 0, 0],
    },
  ];

  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  corners.forEach(([sx, sz], i) => {
    // Fenders unfold into the four arm halves of the X frame.
    pieces.push({
      name: `fender${i}`,
      shape: "box",
      car: pose([sx * 1.06, 0.75, sz * 1.4], [0, 0, 0], [0.12, 0.45, 1.2], RED),
      drone: pose([sx * 0.475, DRONE_Y, sz * 0.475], [0, Math.atan2(sx, sz), 0], [0.24, 0.06, 1.35], CARBON),
      delay: 0.14 + i * 0.04,
      dur: 0.5,
      arc: 0.7,
      spin: [0, 0, sx * Math.PI],
    });
    // Wheels flip flat and slide out to the arm tips as motors.
    pieces.push({
      name: `wheel${i}`,
      shape: "cyl",
      car: pose([sx * 1.02, 0.42, sz < 0 ? -1.4 : 1.42], [0, 0, H], [0.84, 0.32, 0.84], TIRE),
      drone: pose([sx * 0.95, DRONE_Y + 0.1, sz * 0.95], [0, 0, 0], [0.32, 0.16, 0.32], MOTOR),
      delay: 0.06 + i * 0.05,
      dur: 0.55,
      arc: 1.0,
      spin: [Math.PI * 4, 0, 0],
    });
    // Props fan out of the motors at the very end.
    pieces.push({
      name: `prop${i}`,
      shape: "cyl",
      car: pose([sx * 1.02, 0.42, sz < 0 ? -1.4 : 1.42], [0, 0, H], [0.01, 0.01, 0.01], PROP),
      drone: pose([sx * 0.95, DRONE_Y + 0.23, sz * 0.95], [0, 0, 0], [1.32, 0.01, 1.32], PROP),
      delay: 0.76 + i * 0.03,
      dur: 0.2,
      arc: 0,
      spin: [0, Math.PI * 6, 0],
      transparent: true,
    });
  });
  return pieces;
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // easeInOutCubic
const clamp01 = (t) => Math.min(1, Math.max(0, t));

/**
 * `progress` is a ref holding the overall progress 0 → 1; `toDrone` sets which
 * way the choreography plays. The accent colour tints the energy effects.
 */
export function TransformRig({ progress, toDrone }) {
  const pieces = useMemo(buildPieces, []);
  const rig = useRef();
  const meshes = useRef([]);
  const ring = useRef();
  const flash = useRef();
  const accent = toDrone ? "#4ff3ff" : "#ff5a3c";
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
    // Outlines for the glowing "energy seams".
    return { box, cyl, boxEdges: new THREE.EdgesGeometry(box), cylEdges: new THREE.EdgesGeometry(cyl, 30) };
  }, []);
  const seams = useRef([]);
  const colours = useMemo(
    () =>
      pieces.map((p) => ({
        car: new THREE.Color(p.car.c),
        drone: new THREE.Color(p.drone.c),
        carE: new THREE.Color(p.car.e ?? "#000"),
        droneE: new THREE.Color(p.drone.e ?? "#000"),
      })),
    [pieces]
  );
  const accentColour = useMemo(() => new THREE.Color(accent), [accent]);
  const sparks = useSparks(accent);
  const started = useRef(new Set());

  useFrame(({ clock }, delta) => {
    // T runs car → drone; play it backwards for drone → car.
    const t = progress.current;
    const T = toDrone ? t : 1 - t;

    // Whole rig: hop up, judder while it works, settle.
    const lift = Math.sin(clamp01(T / 0.22) * H) * 0.45 * (1 - THREE.MathUtils.smoothstep(T, 0.82, 1));
    const shake = T > 0.05 && T < 0.9 ? 0.035 : 0;
    rig.current.position.set(
      Math.sin(clock.elapsedTime * 61) * shake,
      lift + Math.sin(clock.elapsedTime * 47) * shake,
      Math.cos(clock.elapsedTime * 53) * shake
    );

    // Energy lines pulse over everything just before it comes apart.
    const charge = Math.max(0, Math.sin(clamp01(T / 0.2) * Math.PI)) * (toDrone ? 1 : 0.6);

    pieces.forEach((piece, i) => {
      const m = meshes.current[i];
      if (!m) return;
      const raw = clamp01((T - piece.delay) / piece.dur);
      const k = ease(raw);
      const a = piece.car;
      const b = piece.drone;
      const mid = Math.sin(raw * Math.PI); // 0 at both ends, 1 mid-flight

      m.position.set(
        THREE.MathUtils.lerp(a.p[0], b.p[0], k),
        THREE.MathUtils.lerp(a.p[1], b.p[1], k) + piece.arc * mid,
        THREE.MathUtils.lerp(a.p[2], b.p[2], k)
      );
      m.rotation.set(
        THREE.MathUtils.lerp(a.r[0], b.r[0], k) + piece.spin[0] * k,
        THREE.MathUtils.lerp(a.r[1], b.r[1], k) + piece.spin[1] * k,
        THREE.MathUtils.lerp(a.r[2], b.r[2], k) + piece.spin[2] * k
      );
      m.scale.set(
        Math.max(0.001, THREE.MathUtils.lerp(a.s[0], b.s[0], k)),
        Math.max(0.001, THREE.MathUtils.lerp(a.s[1], b.s[1], k)),
        Math.max(0.001, THREE.MathUtils.lerp(a.s[2], b.s[2], k))
      );
      const mat = m.material;
      mat.color.lerpColors(colours[i].car, colours[i].drone, k);
      // Parts keep their own colour, with just a hint of energy while moving…
      mat.emissive.lerpColors(colours[i].carE, colours[i].droneE, k).lerp(accentColour, Math.min(0.15, mid * 0.15));
      mat.emissiveIntensity = 0.8 + mid * 0.4;
      if (piece.transparent) mat.opacity = 0.25 + 0.6 * (1 - k);
      // …and the seams blaze: outlines light up on the opening charge and
      // while each part is in flight.
      const seam = seams.current[i];
      if (seam) seam.material.opacity = Math.min(1, charge * 0.9 + mid * 1.2);

      // Sparks fly from each joint as it lets go.
      if (raw > 0.02 && raw < 0.98 && !started.current.has(i)) {
        started.current.add(i);
        sparks.burst(m.position, rig.current.position, piece.shape === "cyl" ? 14 : 9);
      }
    });

    // Shockwave ring and core flash as it locks into its new shape.
    const lock = clamp01((T - 0.78) / 0.22);
    const lockT = toDrone ? lock : clamp01((t - 0.78) / 0.22);
    ring.current.scale.setScalar(0.2 + lockT * 7);
    ring.current.material.opacity = lockT > 0 ? (1 - lockT) * 0.9 : 0;
    const f = Math.sin(clamp01((t - 0.8) / 0.16) * Math.PI);
    flash.current.scale.setScalar(0.01 + f * 1.0);
    flash.current.material.opacity = f * 0.25;

    sparks.update(delta);
  });

  return (
    <group>
      <group ref={rig}>
        {pieces.map((piece, i) => (
          <mesh
            key={piece.name}
            ref={(el) => {
              meshes.current[i] = el;
            }}
            geometry={geometry[piece.shape]}
            castShadow
          >
            <meshStandardMaterial
              roughness={0.4}
              metalness={0.2}
              transparent={Boolean(piece.transparent)}
              depthWrite={!piece.transparent}
            />
            <lineSegments
              ref={(el) => {
                seams.current[i] = el;
              }}
              geometry={geometry[`${piece.shape}Edges`]}
            >
              <lineBasicMaterial color={accent} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </lineSegments>
          </mesh>
        ))}
      </group>
      <mesh ref={ring} rotation-x={-H} position-y={0.08}>
        <ringGeometry args={[0.8, 1, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={flash} position-y={0.7}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color={accent} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <points geometry={sparks.geometry} material={sparks.material} frustumCulled={false} />
    </group>
  );
}

// A small pool of additive spark particles with gravity, in the vehicle frame.
function useSparks(accent) {
  return useMemo(() => {
    const MAX = 260;
    const positions = new Float32Array(MAX * 3);
    const velocities = new Float32Array(MAX * 3);
    const life = new Float32Array(MAX);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: new THREE.Color("#ffb347").lerp(new THREE.Color(accent), 0.35),
      size: 0.12,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    let next = 0;
    positions.fill(9999); // parked far away until used
    return {
      geometry,
      material,
      burst(at, offset, count) {
        for (let n = 0; n < count; n++) {
          const i = next++ % MAX;
          positions[i * 3] = at.x + offset.x;
          positions[i * 3 + 1] = at.y + offset.y;
          positions[i * 3 + 2] = at.z + offset.z;
          const a = Math.random() * Math.PI * 2;
          const sp = 2 + Math.random() * 4;
          velocities[i * 3] = Math.cos(a) * sp;
          velocities[i * 3 + 1] = 2 + Math.random() * 4;
          velocities[i * 3 + 2] = Math.sin(a) * sp;
          life[i] = 0.4 + Math.random() * 0.4;
        }
      },
      update(dt) {
        for (let i = 0; i < MAX; i++) {
          if (life[i] <= 0) continue;
          life[i] -= dt;
          velocities[i * 3 + 1] -= 14 * dt;
          positions[i * 3] += velocities[i * 3] * dt;
          positions[i * 3 + 1] = Math.max(0.02, positions[i * 3 + 1] + velocities[i * 3 + 1] * dt);
          positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
          if (life[i] <= 0) positions[i * 3 + 1] = 9999;
        }
        geometry.attributes.position.needsUpdate = true;
      },
    };
  }, [accent]);
}
