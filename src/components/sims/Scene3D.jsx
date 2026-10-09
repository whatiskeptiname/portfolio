// A small 3D stage for the simulations that read better in space (the
// surgical field, the greenhouse, the network): lights, a camera you can
// drag round, and a few shared pieces.
import React, { useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Eases the camera in or out to `distance` from the target (null leaves it
// alone), so a stage can move in for detail. Only until you take the camera.
function Dolly({ distance, target }) {
  useFrame(({ camera }, delta) => {
    if (!distance) return;
    const t = new THREE.Vector3(...target);
    const offset = camera.position.clone().sub(t);
    const len = offset.length();
    const next = THREE.MathUtils.lerp(len, distance, 1 - Math.exp(-2.5 * delta));
    camera.position.copy(t.add(offset.setLength(next)));
  });
  return null;
}

export function Scene3D({ children, label, camera = [5, 4, 6], target = [0, 0.6, 0], rotate = true, distance = null }) {
  // Once you drag or zoom, the camera is yours: no auto-rotate, no stage
  // zooms. The simulation itself plays on regardless.
  const [yours, setYours] = useState(false);
  const [tx, ty, tz] = target;
  const focus = useMemo(() => [tx, ty, tz], [tx, ty, tz]);
  return (
    <div className="sim-3d">
      <Canvas camera={{ position: camera, fov: 40 }} dpr={[1, 2]} shadows>
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#cfe7ff", "#2a2118", 0.5]} />
        <directionalLight position={[4, 8, 5]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
        <OrbitControls
          target={focus}
          enablePan={false}
          minDistance={1.5}
          maxDistance={16}
          autoRotate={rotate && !yours}
          autoRotateSpeed={0.6}
          maxPolarAngle={Math.PI * 0.48}
          onStart={() => setYours(true)}
        />
        <Dolly distance={yours ? null : distance} target={focus} />
        {children}
      </Canvas>
      {label && <div className="sim-3d-label">{label}</div>}
    </div>
  );
}

/**
 * What a camera sees: a pyramid (or cone, with more `sides`) with its point
 * at the lens (`from`) opening out to `radius` where it meets `to`.
 */
export function VisionCone({ from, to, radius = 0.5, sides = 4, opacity = 0.07, color = "#5eead4" }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  if (len < 1e-3) return null;
  // ConeGeometry's point is at +y: turn +y to face back at the lens.
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize());
  return (
    <mesh position={a.clone().add(b).multiplyScalar(0.5)} quaternion={q}>
      <coneGeometry args={[radius, len, sides, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// The 12 edges of a unit cube, for wireframe detection boxes.
const BOX_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));

/** A 3D detection box with a floating class label, like a 3D detector draws. */
export function DetBox3D({ position, size, label, opacity = 1, color = "#5eead4" }) {
  if (opacity <= 0.01) return null;
  return (
    <group position={position}>
      <lineSegments geometry={BOX_EDGES} scale={size}>
        <lineBasicMaterial color={color} transparent opacity={opacity} />
      </lineSegments>
      {label && (
        <Html position={[-size[0] / 2, size[1] / 2 + 0.08, 0]} style={{ opacity }} zIndexRange={[10, 0]}>
          <span className="tag3d">{label}</span>
        </Html>
      )}
    </group>
  );
}
