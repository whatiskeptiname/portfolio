// src/components/ThreeScene.jsx
import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";

function RotatingTorus() {
  const meshRef = useRef();
  useFrame((_, delta) => {
    meshRef.current.rotation.x += delta * 0.15;
    meshRef.current.rotation.y += delta * 0.15;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      {/* Note: use <torusKnotGeometry> instead of <torusKnotBufferGeometry> */}
      <torusKnotGeometry args={[1, 0.4, 128, 32]} />
      <meshStandardMaterial color="#ef4444" metalness={0.7} roughness={0.2} />
    </mesh>
  );
}

export default function ThreeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 60 }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <Environment preset="sunset" />
      <RotatingTorus />
      <OrbitControls enableZoom={true} />
    </Canvas>
  );
}
