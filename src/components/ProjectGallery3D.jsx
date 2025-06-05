// src/components/ProjectGallery3D.jsx
import React, { useMemo, useEffect, useRef, useState } from "react";
import { useThree, useFrame, extend, useLoader } from "@react-three/fiber";
import { Html, FlyControls } from "@react-three/drei";
import * as THREE from "three";

//
// CUSTOM SHADER MATERIAL: blends grass and road textures on one plane
//
const MAX_ROADS = 8;

const GroundShader = {
  uniforms: {
    grassMap:     { value: null },
    roadMap:      { value: null },
    roadWidth:    { value: 6.0 }, // half‐width of each road (world units)
    roadCount:    { value: 0 },
    roadSegments: { value: new Array(MAX_ROADS).fill(new THREE.Vector4(0,0,0,0)) },
    repeatGrass:  { value: new THREE.Vector2(50, 50) }, // tiling for grass
    repeatRoad:   { value: new THREE.Vector2(1, 1) },   // (unused directly below)
  },
  vertexShader: `
    varying vec3 vWorldPos;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    #define MAX_ROADS ${MAX_ROADS}

    uniform sampler2D grassMap;
    uniform sampler2D roadMap;
    uniform vec2 repeatGrass;
    uniform float roadWidth;
    uniform int roadCount;
    uniform vec4 roadSegments[MAX_ROADS];

    varying vec3 vWorldPos;
    varying vec2 vUv;

    // Compute shortest distance from P to segment A→B, return t
    float pointToSegmentDist(vec2 P, vec2 A, vec2 B, out float t) {
      vec2 AB = B - A;
      float ab2 = dot(AB, AB);
      if (ab2 == 0.0) {
        t = 0.0;
        return length(P - A);
      }
      float proj = dot(P - A, AB) / ab2;
      t = clamp(proj, 0.0, 1.0);
      vec2 projection = A + t * AB;
      return length(P - projection);
    }

    void main() {
      // 1) Sample grass by default, tiling at repeatGrass
      vec2 grassUV = vWorldPos.xz * repeatGrass / 2.0;
      grassUV = fract(grassUV);
      vec4 grassColor = texture2D(grassMap, grassUV);

      // 2) Determine if this fragment lies on any road
      vec2 P = vWorldPos.xz;
      bool onRoad = false;
      float tFrac = 0.0;
      vec4 matchedSeg = vec4(0);

      for (int i = 0; i < MAX_ROADS; i++) {
        if (i >= roadCount) break;
        vec4 seg = roadSegments[i];
        vec2 A = seg.xy;
        vec2 B = seg.zw;
        float t;
        float dist = pointToSegmentDist(P, A, B, t);
        if (dist < roadWidth) {
          onRoad = true;
          tFrac = t;
          matchedSeg = seg;
          break;
        }
      }

      if (onRoad) {
        //
        // >>> NEW: “Overlay road texture vertically” by sampling roadMap
        //            using the fragment’s world‐Z coordinate.
        //
        // We ignore the matchedSeg direction entirely; instead we tile
        // roadMap along the Z axis. Feel free to change “10.0” to your own
        // “tile size” in world units (how often the road texture repeats).
        //
        float tileSize = 10.0;
        float v = fract(vWorldPos.z / tileSize);
        // Keep U constant at 0.5 (center of the texture)
        vec2 roadUV = vec2(0.5, v);
        vec4 roadColor = texture2D(roadMap, roadUV);
        gl_FragColor = roadColor;
      } else {
        gl_FragColor = grassColor;
      }
    }
  `,
};

extend({ GroundShaderMaterial: THREE.ShaderMaterial });

export default function ProjectGallery3D({ reposByLanguage }) {
  if (!reposByLanguage || typeof reposByLanguage !== "object") return null;

  //////////////////////////////
  // (A) Load Textures
  //////////////////////////////
  const grassMap  = useLoader(THREE.TextureLoader, "/grass.jpg");
  const roadMap   = useLoader(THREE.TextureLoader, "/road.jpg");
  const waterNorm = useLoader(THREE.TextureLoader, "/water-normal.jpg");

  grassMap.wrapS = grassMap.wrapT = THREE.RepeatWrapping;
  roadMap.wrapS  = roadMap.wrapT  = THREE.RepeatWrapping;
  waterNorm.wrapS = waterNorm.wrapT = THREE.RepeatWrapping;
  waterNorm.repeat.set(4, 2);

  //////////////////////////////
  // (B) Build City Data
  //////////////////////////////
  const planeRadius = 80;
  const cornerPositions = [
    { x: -planeRadius + 10, z: -planeRadius + 10 },
    { x:  planeRadius - 10, z: -planeRadius + 10 },
    { x: -planeRadius + 10, z:  planeRadius - 10 },
    { x:  planeRadius - 10, z:  planeRadius - 10 },
    { x: -50, z: 0 },
    { x:  50, z: 0 },
    { x:   0, z: -50 },
    { x:   0, z: 50 },
  ];

  const cityData = useMemo(() => {
    const langs = Object.keys(reposByLanguage);
    return langs.map((lang, i) => {
      const corner = cornerPositions[i % cornerPositions.length];
      const city = {
        language: lang,
        centerX: corner.x + (Math.random() - 0.5) * 10,
        centerZ: corner.z + (Math.random() - 0.5) * 10,
        clusterRadius: 10 + Math.random() * 5,
        repos: Array.isArray(reposByLanguage[lang]) ? reposByLanguage[lang] : [],
      };
      city.buildingPositions = generateClusterPositions(
        city.repos.length,
        city.centerX,
        city.centerZ,
        city.clusterRadius,
        5
      );
      return city;
    });
  }, [reposByLanguage]);

  //////////////////////////////
  // (C) Build Road Segments
  //////////////////////////////
  const roadSegments = useMemo(() => {
    if (cityData.length === 0) return [];
    const segs = [];
    for (let i = 0; i < cityData.length; i++) {
      const curr = cityData[i];
      const next = cityData[(i + 1) % cityData.length];
      const dx = next.centerX - curr.centerX;
      const dz = next.centerZ - curr.centerZ;
      const dist = Math.hypot(dx, dz);
      const ux = dx / dist;
      const uz = dz / dist;
      const x1 = curr.centerX + ux * (curr.clusterRadius + 2);
      const z1 = curr.centerZ + uz * (curr.clusterRadius + 2);
      const x2 = next.centerX - ux * (next.clusterRadius + 2);
      const z2 = next.centerZ - uz * (next.clusterRadius + 2);
      segs.push([x1, z1, x2, z2]);
    }
    return segs;
  }, [cityData]);

  //////////////////////////////
  // (D) Prepare RoadSegments for Shader
  //////////////////////////////
  const roadSegmentsVec4 = useMemo(() => {
    const arr = new Array(MAX_ROADS).fill(new THREE.Vector4(0, 0, 0, 0));
    roadSegments.forEach((seg, i) => {
      if (i >= MAX_ROADS) return;
      arr[i] = new THREE.Vector4(seg[0], seg[1], seg[2], seg[3]);
    });
    return arr;
  }, [roadSegments]);

  //////////////////////////////
  // (E) Build Obstacle & Tree Lists
  //////////////////////////////
  const { obstacleCenters, treePositions } = useMemo(() => {
    const obstacles = [];
    const trees = [];
    cityData.forEach((city) => {
      city.buildingPositions.forEach((pos) => {
        obstacles.push(pos);
      });
      city.buildingPositions.forEach(([bx, bz]) => {
        const angle = Math.random() * Math.PI * 2;
        const r = city.clusterRadius * (0.85 + Math.random() * 0.3);
        const tx = city.centerX + Math.cos(angle) * r;
        const tz = city.centerZ + Math.sin(angle) * r;
        obstacles.push([tx, tz]);
        trees.push([tx, tz]);
      });
    });
    return { obstacleCenters: obstacles, treePositions: trees };
  }, [cityData]);

  //////////////////////////////
  // (F) Car & Camera State
  //////////////////////////////
  const carRef = useRef();
  const [followCam, setFollowCam] = useState(false);

  const freeKeys = useRef({ Space: false, Control: false });
  const { camera } = useThree();
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space") freeKeys.current.Space = true;
      if (e.code === "ControlLeft" || e.code === "ControlRight")
        freeKeys.current.Control = true;
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") freeKeys.current.Space = false;
      if (e.code === "ControlLeft" || e.code === "ControlRight")
        freeKeys.current.Control = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);
  useFrame((_, delta) => {
    if (!followCam) {
      const speedY = 20 * delta;
      if (freeKeys.current.Space) {
        camera.position.y += speedY;
      }
      if (freeKeys.current.Control) {
        camera.position.y -= speedY;
      }
    }
  });

  //////////////////////////////
  // (G) Setup Ground ShaderMaterial
  //////////////////////////////
  const groundRef = useRef();
  useEffect(() => {
    if (!groundRef.current) return;
    const mat = groundRef.current.material;
    mat.uniforms.grassMap.value      = grassMap;
    mat.uniforms.roadMap.value       = roadMap;
    mat.uniforms.roadCount.value     = roadSegments.length;
    mat.uniforms.roadSegments.value  = roadSegmentsVec4;
    mat.uniforms.roadWidth.value     = 6.0; // half‐width
    mat.uniforms.repeatGrass.value.set(planeRadius / 2, planeRadius / 2);
    mat.uniforms.repeatRoad.value.set(1, 1);
  }, [grassMap, roadMap, roadSegments, roadSegmentsVec4, planeRadius]);

  //////////////////////////////
  // (H) RENDER
  //////////////////////////////
  return (
    <>
      {/* 1) Lights */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[50, 100, 50]} intensity={0.6} />

      {/* 2) Single Ground Plane with ShaderMaterial */}
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[2 * planeRadius, 2 * planeRadius, 512, 512]} />
        <shaderMaterial attach="material" args={[GroundShader]} />
      </mesh>

      {/* 3) River at z=0 (flat) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[2 * planeRadius, 20, 1, 1]} />
        <meshStandardMaterial
          map={waterNorm}
          color="#3399ff"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 4) Cities: parks, buildings, labels */}
      {cityData.map((city) => (
        <group key={city.language}>
          {/* Park Patch */}
          <mesh
            position={[city.centerX, 0.02, city.centerZ]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[city.clusterRadius * 2, city.clusterRadius * 2]} />
            <meshStandardMaterial color="#a3d9a5" />
          </mesh>

          {/* Buildings + Doors + Windows + Labels */}
          {city.buildingPositions.map(([bx, bz], idx) => {
            const repo = city.repos[idx];
            const buildingHeight = 6;
            const color = new THREE.Color().setHSL(Math.random(), 0.5, 0.7).getStyle();
            return (
              <group key={repo.name} position={[bx, 0, bz]}>
                {/* Building */}
                <mesh castShadow receiveShadow position={[0, buildingHeight / 2, 0]}>
                  <boxGeometry args={[4, buildingHeight, 4]} />
                  <meshStandardMaterial color={color} />
                </mesh>
                {/* Door */}
                <mesh position={[0, -buildingHeight / 2 + 1, 2.01]}>
                  <boxGeometry args={[1, 2.5, 0.1]} />
                  <meshStandardMaterial color="#5d4037" />
                </mesh>
                {/* Windows */}
                <BuildingWindows width={4} height={buildingHeight} depth={4} windowColor="#ffed66" />
                {/* Label */}
                <Html
                  position={[0, buildingHeight + 0.7, 0]}
                  style={{ pointerEvents: "auto", transform: "translateX(-50%)" }}
                  center
                >
                  <div
                    style={{
                      background: "rgba(255,255,255,0.9)",
                      padding: "3px 8px",
                      borderRadius: "3px",
                      fontSize: "0.85rem",
                      color: "#2d3748",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <strong>{repo.name}</strong>
                    <br />
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#3182ce",
                        textDecoration: "none",
                        fontSize: "0.75rem",
                      }}
                    >
                      View →
                    </a>
                  </div>
                </Html>
              </group>
            );
          })}
        </group>
      ))}

      {/* 5) Trees */}
      {treePositions.map(([tx, tz], idx) => {
        const th = 1.5 + Math.random() * 0.8;
        return (
          <group key={`tree-${idx}`} position={[tx, th / 2, tz]}>
            <mesh>
              <cylinderGeometry args={[0.4, 0.4, th, 8]} />
              <meshStandardMaterial color="#8b5a2b" />
            </mesh>
            <mesh position={[0, th / 2 + 0.2, 0]}>
              <sphereGeometry args={[1, 12, 12]} />
              <meshStandardMaterial color="#2d7d46" />
            </mesh>
          </group>
        );
      })}

      {/* 6) Drivable Car */}
      <group ref={carRef} position={[0, 0.5, planeRadius - 20]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.5, 1, 4]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
        {[-1, 1].map((x) =>
          [-1.8, 1.8].map((z, idx) => (
            <mesh key={`${x}-${z}`} position={[x, -0.4, z]}>
              <cylinderGeometry args={[0.5, 0.5, 0.5, 16]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
          ))
        )}
      </group>
      <CarControls
        carRef={carRef}
        obstacleCenters={obstacleCenters}
        planeRadius={planeRadius}
        followCam={followCam}
        toggleFollowCam={setFollowCam}
      />

      {/* 7) Free‐fly camera */}
      <FlyControls
        movementSpeed={25}
        rollSpeed={Math.PI / 12}
        autoForward={false}
        dragToLook={true}
      />
    </>
  );
}

//
// Utility: generate non‐overlapping positions around (centerX, centerZ)
//
function generateClusterPositions(count, centerX, centerZ, radius, minSep) {
  const positions = [];
  let attempts = 0;
  while (positions.length < count && attempts < count * 50) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const x = centerX + Math.cos(angle) * r;
    const z = centerZ + Math.sin(angle) * r;
    let ok = true;
    for (let [px, pz] of positions) {
      if (Math.hypot(px - x, pz - z) < minSep) {
        ok = false;
        break;
      }
    }
    if (ok) positions.push([x, z]);
  }
  return positions;
}

/**
 * BuildingWindows: renders a simple grid of window quads on the front face.
 */
function BuildingWindows({ width = 3, height = 6, depth = 3, windowColor = "#ffed66" }) {
  const cols = 3, rows = 5;
  const wSpacing = width / (cols + 1);
  const hSpacing = height / (rows + 1);
  const windows = [];
  for (let i = 1; i <= cols; i++) {
    for (let j = 1; j <= rows; j++) {
      const wx = -width / 2 + i * wSpacing;
      const wy = -height / 2 + j * hSpacing;
      windows.push([wx, wy]);
    }
  }
  return (
    <>
      {windows.map(([wx, wy], idx) => (
        <mesh key={idx} position={[wx, wy, depth / 2 + 0.01]}>
          <planeGeometry args={[wSpacing * 0.6, hSpacing * 0.6]} />
          <meshStandardMaterial color={windowColor} />
        </mesh>
      ))}
    </>
  );
}

/**
 * CarControls: WASD/Arrow keys drive; 'C' toggles camera-follow; collision detection.
 */
function CarControls({ carRef, obstacleCenters, planeRadius, followCam, toggleFollowCam }) {
  const { camera } = useThree();
  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    ArrowUp: false,
    ArrowLeft: false,
    ArrowDown: false,
    ArrowRight: false,
    c: false,
  });
  const velocity = useRef(0);
  const yaw = useRef(0);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (keys.current[e.key] !== undefined) keys.current[e.key] = true;
      if (e.key === "c" || e.key === "C") {
        toggleFollowCam((prev) => !prev);
      }
    };
    const onKeyUp = (e) => {
      if (keys.current[e.key] !== undefined) keys.current[e.key] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [toggleFollowCam]);

  useFrame((_, delta) => {
    if (!carRef.current) return;
    // Acceleration / braking
    if (keys.current.w || keys.current.ArrowUp) {
      velocity.current = Math.min(20, velocity.current + delta * 10);
    } else if (keys.current.s || keys.current.ArrowDown) {
      velocity.current = Math.max(-10, velocity.current - delta * 10);
    } else {
      velocity.current *= 0.98;
    }
    // Steering
    if (Math.abs(velocity.current) > 0.5) {
      if (keys.current.a || keys.current.ArrowLeft) {
        yaw.current += delta * 1.2;
      }
      if (keys.current.d || keys.current.ArrowRight) {
        yaw.current -= delta * 1.2;
      }
    }
    carRef.current.rotation.y = yaw.current;

    // Proposed new position
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      carRef.current.quaternion
    );
    const proposed = carRef.current.position
      .clone()
      .addScaledVector(forward, velocity.current * delta);

    // Collision check
    const carRadius = 1.0;
    const obstacleRadius = 2.0;
    let collision = false;
    for (let [ox, oz] of obstacleCenters) {
      const dx = proposed.x - ox;
      const dz = proposed.z - oz;
      if (Math.hypot(dx, dz) < carRadius + obstacleRadius) {
        collision = true;
        break;
      }
    }
    if (
      proposed.x < -planeRadius + carRadius ||
      proposed.x > planeRadius - carRadius ||
      proposed.z < -planeRadius + carRadius ||
      proposed.z > planeRadius - carRadius
    ) {
      collision = true;
    }
    if (!collision) {
      carRef.current.position.copy(proposed);
    } else {
      velocity.current = 0;
    }

    // Camera follow if enabled
    if (followCam) {
      const offset = new THREE.Vector3(0, 2.5, 6).applyQuaternion(
        carRef.current.quaternion
      );
      const camPos = carRef.current.position.clone().add(offset);
      camera.position.copy(camPos);
      const lookTarget = carRef.current.position
        .clone()
        .add(forward.clone().multiplyScalar(10))
        .add(new THREE.Vector3(0, 1, 0));
      camera.lookAt(lookTarget);
    }
  });

  return null;
}