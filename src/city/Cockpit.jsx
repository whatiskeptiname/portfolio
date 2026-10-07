// src/city/Cockpit.jsx — the inside of the car, for the first-person view:
// right-hand drive (as in Nepal), with a dashboard and a glowing digital
// instrument cluster (speed, gear, the limit), a steering wheel that turns as
// you steer, A-pillars and the windscreen header framing the road, and a
// working rear-view mirror — a small second camera looking back, refreshed a
// few times a second. Rendered inside the car's own group, so it moves with
// it exactly. Front is −z.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAR_LIMITS, KMH_PER_UNIT, gearOf } from "../lib/autopilot";

const MIRROR = { w: 256, h: 80, every: 3 };

function pillar(from, to, thickness) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return { position: mid, quaternion: q, args: [thickness, len, thickness] };
}

export function Cockpit({ state, mirror = true }) {
  const wheel = useRef();
  const mirrorMesh = useRef();
  const { gl, scene } = useThree();

  // The instrument cluster: a small canvas, redrawn ten times a second.
  const cluster = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 112;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, ctx: canvas.getContext("2d"), texture, last: 0 };
  }, []);
  const mirrorRig = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(MIRROR.w, MIRROR.h);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(42, MIRROR.w / MIRROR.h, 0.3, 400);
    return { target, camera, frame: 0 };
  }, []);
  useEffect(
    () => () => {
      cluster.texture.dispose();
      mirrorRig.target.dispose();
    },
    [cluster, mirrorRig]
  );

  const pillars = useMemo(
    () => [
      pillar([-0.9, 0.98, -0.85], [-0.84, 1.95, -0.05], 0.045),
      pillar([0.9, 0.98, -0.85], [0.84, 1.95, -0.05], 0.045),
    ],
    []
  );

  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const s = state.current;
    // The wheel turns with the steering (about 2.5 turns lock to lock, scaled down).
    if (wheel.current) wheel.current.rotation.z = -(s.steer ?? 0) * 2.4;

    // Instrument cluster.
    const now = clock.elapsedTime;
    if (now - cluster.last > 0.1) {
      cluster.last = now;
      const { ctx, canvas } = cluster;
      const kmh = Math.round(Math.abs(s.speed ?? 0) * KMH_PER_UNIT);
      const limit = Math.round((CAR_LIMITS[s.surface ?? "road"] ?? 0) * KMH_PER_UNIT);
      const gear = gearOf(s.speed ?? 0);
      ctx.fillStyle = "#04070c";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Speed arc.
      const f = Math.min(1, kmh / 160);
      ctx.lineWidth = 7;
      ctx.strokeStyle = "rgba(80, 230, 255, 0.18)";
      ctx.beginPath();
      ctx.arc(64, 64, 42, Math.PI * 0.75, Math.PI * 2.25);
      ctx.stroke();
      ctx.strokeStyle = kmh > limit ? "#ff5a4f" : "#4ff3ff";
      ctx.beginPath();
      ctx.arc(64, 64, 42, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * f));
      ctx.stroke();
      ctx.fillStyle = "#eafcff";
      ctx.font = "700 30px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(kmh), 64, 72);
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.fillStyle = "rgba(234, 252, 255, 0.6)";
      ctx.fillText("km/h", 64, 90);
      // Gear and limit.
      ctx.font = "700 40px ui-monospace, monospace";
      ctx.fillStyle = "#ffd27a";
      ctx.fillText(gear === -1 ? "R" : gear === 0 ? "N" : String(gear), 160, 74);
      ctx.beginPath();
      ctx.arc(220, 56, 22, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#e0283f";
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.font = "700 16px ui-monospace, monospace";
      ctx.fillText(String(limit), 220, 62);
      // Autopilot lamp.
      ctx.fillStyle = s.auto || s.route ? "#4ff3ff" : "rgba(79, 243, 255, 0.15)";
      ctx.font = "700 11px ui-monospace, monospace";
      ctx.fillText("AUTO", 160, 100);
      cluster.texture.needsUpdate = true;
    }

    // Rear-view mirror: a camera at the back of the cabin looking backwards.
    if (mirror && mirrorMesh.current && s.worldMatrix && ++mirrorRig.frame % MIRROR.every === 0) {
      const m = s.worldMatrix;
      tmp.pos.set(0, 1.75, 1.2).applyMatrix4(m);
      tmp.look.set(0, 1.4, 12).applyMatrix4(m);
      tmp.up.set(0, 1, 0).transformDirection(m);
      const cam = mirrorRig.camera;
      cam.position.copy(tmp.pos);
      cam.up.copy(tmp.up);
      cam.lookAt(tmp.look);
      mirrorMesh.current.visible = false;
      const before = gl.getRenderTarget();
      gl.setRenderTarget(mirrorRig.target);
      gl.render(scene, cam);
      gl.setRenderTarget(before);
      mirrorMesh.current.visible = true;
    }
  });

  const dash = "#14161b";
  return (
    <group>
      {/* Seats behind (seen when you look round) */}
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 1.25, 0.85]}>
          <boxGeometry args={[0.5, 0.5, 0.12]} />
          <meshStandardMaterial color="#1d1f25" roughness={0.95} />
        </mesh>
      ))}
      {/* Dashboard (deep, low enough to see a sliver of bonnet over it) and
          its shroud over the cluster */}
      <mesh position={[0, 0.92, -0.62]}>
        <boxGeometry args={[1.76, 0.16, 0.62]} />
        <meshStandardMaterial color={dash} roughness={0.85} />
      </mesh>
      <mesh position={[0.42, 1.04, -0.5]} rotation-x={-0.25}>
        <boxGeometry args={[0.5, 0.05, 0.14]} />
        <meshStandardMaterial color="#0d0f13" roughness={0.9} />
      </mesh>
      {/* Instrument cluster, facing the driver */}
      <mesh position={[0.42, 1.0, -0.4]} rotation-x={-0.5}>
        <planeGeometry args={[0.5, 0.22]} />
        <meshBasicMaterial map={cluster.texture} toneMapped={false} />
      </mesh>
      {/* Centre screen glow */}
      <mesh position={[-0.05, 0.98, -0.38]} rotation-x={-0.5}>
        <planeGeometry args={[0.28, 0.16]} />
        <meshBasicMaterial color="#0b2433" toneMapped={false} />
      </mesh>
      {/* Steering wheel on its column */}
      <group position={[0.42, 1.05, -0.2]} rotation-x={-1.15}>
        <group ref={wheel}>
          <mesh>
            <torusGeometry args={[0.19, 0.026, 10, 32]} />
            <meshStandardMaterial color="#1a1c21" roughness={0.6} />
          </mesh>
          {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => (
            <mesh key={a} rotation-z={a} position={[0, 0, 0]}>
              <boxGeometry args={[0.03, 0.19, 0.02]} />
              <meshStandardMaterial color="#2a2d33" metalness={0.4} roughness={0.5} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.01]}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 16]} />
            <meshStandardMaterial color="#e0283f" metalness={0.3} roughness={0.4} />
          </mesh>
        </group>
      </group>
      {/* A-pillars and the windscreen header */}
      {pillars.map((p, i) => (
        <mesh key={i} position={p.position} quaternion={p.quaternion}>
          <boxGeometry args={p.args} />
          <meshStandardMaterial color="#121418" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 1.96, -0.05]}>
        <boxGeometry args={[1.7, 0.04, 0.08]} />
        <meshStandardMaterial color="#121418" roughness={0.9} />
      </mesh>
      {/* The bonnet out front, in the car's paint, and the wing mirrors */}
      <mesh position={[0, 0.84, -1.55]} rotation-x={0.08}>
        <boxGeometry args={[2.0, 0.08, 1.45]} />
        <meshPhysicalMaterial color="#e0283f" metalness={0.15} roughness={0.38} clearcoat={1} clearcoatRoughness={0.12} />
      </mesh>
      <mesh position={[0, 0.8, -2.28]} rotation-x={0.5}>
        <boxGeometry args={[2.0, 0.08, 0.2]} />
        <meshPhysicalMaterial color="#e0283f" metalness={0.15} roughness={0.38} clearcoat={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.97, 0.84, -1.5]}>
            <boxGeometry args={[0.14, 0.14, 1.5]} />
            <meshPhysicalMaterial color="#c81f35" metalness={0.15} roughness={0.4} clearcoat={1} />
          </mesh>
          <mesh position={[side * 1.17, 1.22, -0.72]}>
            <boxGeometry args={[0.2, 0.15, 0.28]} />
            <meshPhysicalMaterial color="#e0283f" metalness={0.15} roughness={0.4} clearcoat={1} />
          </mesh>
          <mesh position={[side * 1.17, 1.22, -0.575]}>
            <planeGeometry args={[0.16, 0.11]} />
            <meshStandardMaterial color="#8fa6b8" metalness={0.9} roughness={0.15} />
          </mesh>
        </group>
      ))}
      {/* Rear-view mirror */}
      <mesh position={[0.15, 1.86, -0.12]} rotation-x={-0.08}>
        <boxGeometry args={[0.3, 0.1, 0.03]} />
        <meshStandardMaterial color="#0b0c0f" />
      </mesh>
      {mirror && (
        <mesh ref={mirrorMesh} position={[0.15, 1.86, -0.1]} rotation-x={-0.08} scale-x={-1}>
          <planeGeometry args={[0.27, 0.085]} />
          <meshBasicMaterial map={mirrorRig.target.texture} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
