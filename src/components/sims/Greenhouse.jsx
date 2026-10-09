// Autonomous Greenhouse Robot, in 3D: map the rows, find flowers in 3D,
// pollinate them, and lower the vines as they grow.
import React, { useMemo, useState } from "react";
import * as THREE from "three";
import { Stat } from "./shared";
import { clamp, ease, lerp } from "./anim";
import { DetBox3D, Scene3D, VisionCone } from "./Scene3D";
import { STAGES } from "./stages";

const stages = STAGES.greenhouse;
const ROWS = [-2.1, -0.7, 0.7, 2.1]; // z of each plant row
const PLANT_X = Array.from({ length: 9 }, (_, i) => -3.2 + i * 0.8);
const aisleZ = (r) => ROWS[r] - 0.7; // each aisle runs just before its row
const WIRE = 2.3;

const FLOWERS = (() => {
  const out = [];
  ROWS.forEach((z, r) =>
    PLANT_X.forEach((x, p) => {
      if ((r * 5 + p * 3) % 4 === 0) out.push({ r, p, pos: new THREE.Vector3(x, 0.75 + ((r + p) % 3) * 0.22, z - 0.18) });
    })
  );
  return out;
})();

// Serpentine route through the aisles for mapping (u: 0..1).
function routeAt(u) {
  const leg = Math.min(3, Math.floor(u * 4));
  const f = clamp(u * 4 - leg);
  const forward = leg % 2 === 0;
  return { x: lerp(forward ? -3.8 : 3.8, forward ? 3.8 : -3.8, f), z: aisleZ(leg), heading: forward ? 0 : Math.PI };
}

function Rod({ from, to, radius = 0.025, color = "#d7dde4" }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[radius, radius, len, 8]} />
      <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
    </mesh>
  );
}

function Robot({ x, z, heading }) {
  return (
    <group position={[x, 0, z]} rotation={[0, -heading, 0]} scale={1.35}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.7, 0.24, 0.45]} />
        <meshStandardMaterial color="#20252c" />
      </mesh>
      {[-0.25, 0.25].map((wx) =>
        [-0.24, 0.24].map((wz) => (
          <mesh key={`${wx}${wz}`} position={[wx, 0.1, wz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />
            <meshStandardMaterial color="#0d1014" />
          </mesh>
        ))
      )}
      <mesh position={[0.1, 0.75, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.9, 10]} />
        <meshStandardMaterial color="#b9c1c9" metalness={0.6} />
      </mesh>
      <mesh position={[0.18, 1.2, 0]}>
        <boxGeometry args={[0.16, 0.1, 0.18]} />
        <meshStandardMaterial color="#5eead4" emissive="#5eead4" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

function Plant({ x, z, known, drop = 0, string = false }) {
  const leaf = known ? "#4caf6a" : "#3b4450";
  const dark = known ? "#2f7d4a" : "#2c333c";
  const op = known ? 1 : 0.35;
  return (
    <group position={[x, -drop, z]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 1.4, 6]} />
        <meshStandardMaterial color={dark} transparent opacity={op} />
      </mesh>
      {[0.45, 0.85, 1.25].map((y, i) => (
        <mesh key={y} position={[(i - 1) * 0.08, y, (i % 2) * 0.06]} castShadow>
          <icosahedronGeometry args={[0.22 - i * 0.03, 0]} />
          <meshStandardMaterial color={i % 2 ? dark : leaf} flatShading transparent opacity={op} />
        </mesh>
      ))}
      {known &&
        [0.55, 1.0].map((y) => (
          <mesh key={y} position={[0.14, y, 0.1]}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
        ))}
      {string && (
        <mesh position={[0, 1.4 + (WIRE + drop - 1.4) / 2, 0]}>
          <cylinderGeometry args={[0.006, 0.006, WIRE + drop - 1.4, 4]} />
          <meshBasicMaterial color="#cfd6de" />
        </mesh>
      )}
    </group>
  );
}

export default function Greenhouse({ stage, t, playing }) {
  const [speed, setSpeed] = useState(1);
  const tt = t * speed;
  const mapU = stage === 0 ? clamp(tt / stages[0].duration) : 1;
  const visit = stage === 2 ? clamp(tt / (stages[2].duration - 0.4)) * FLOWERS.length : stage === 3 ? FLOWERS.length : 0;
  const target = FLOWERS[Math.min(FLOWERS.length - 1, Math.floor(visit))];
  const lowerU = stage === 3 ? clamp((tt - 0.3) / 4.4) * PLANT_X.length : 0;

  // Where the robot is.
  let robot;
  if (stage === 0) robot = routeAt(mapU);
  else if (stage === 2 && target) robot = { x: target.pos.x - 0.1, z: aisleZ(target.r), heading: 0 };
  else if (stage === 3) {
    const at = Math.min(PLANT_X.length - 1, Math.floor(lowerU));
    robot = { x: lerp(PLANT_X[at], PLANT_X[Math.min(PLANT_X.length - 1, at + 1)], ease(lowerU - at, 0.7, 0.3)), z: aisleZ(0), heading: 0 };
  } else robot = { x: -3.8, z: aisleZ(0), heading: 0 };

  const known = (r, p) => stage > 0 || mapU * 4 > r + (r % 2 === 0 ? (p + 1) / 9 : 1 - p / 9) - 0.1;
  // The robot's camera head (on its mast, scaled with the robot).
  const head = useMemo(() => [robot.x + 0.243 * Math.cos(robot.heading), 1.62, robot.z], [robot.x, robot.z, robot.heading]);

  return (
    <div className="sim-layout">
      <Scene3D rotate={playing} camera={[4.2, 5.2, 6.2]} target={[0, 0.6, 0]} label={stages[stage].title}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[10, 7.4]} />
          <meshStandardMaterial color="#3a3227" />
        </mesh>
        {ROWS.map((z, r) =>
          PLANT_X.map((x, p) => {
            const drop = stage === 3 && r === 0 ? ease(lowerU, p, 0.65) * 0.5 : 0;
            return <Plant key={`${r}-${p}`} x={x} z={z} known={known(r, p)} drop={drop} string={stage === 3 && r === 0} />;
          })
        )}
        {stage === 3 && <Rod from={[-3.6, WIRE, ROWS[0]]} to={[3.6, WIRE, ROWS[0]]} radius={0.018} color="#9aa3ad" />}
        {stage === 3 &&
          (() => {
            const at = Math.min(PLANT_X.length - 1, Math.floor(lowerU));
            // The hook where the string meets the top of the stem.
            const hookY = 1.4 - ease(lowerU, at, 0.65) * 0.5;
            const working = lowerU - at < 0.7;
            return (
              <>
                <DetBox3D position={[PLANT_X[at], hookY, ROWS[0]]} size={[0.16, 0.16, 0.16]} label="hook" />
                {working && <Rod from={head} to={[PLANT_X[at], hookY, ROWS[0]]} />}
              </>
            );
          })()}
        {stage >= 1 &&
          FLOWERS.map((f, i) => {
            const done = stage >= 2 && i < visit;
            return (
              <group key={i}>
                <mesh position={f.pos}>
                  <sphereGeometry args={[done ? 0.14 : 0.11, 14, 10]} />
                  <meshStandardMaterial color={done ? "#f0b65a" : "#fde047"} emissive={done ? "#b07a2c" : "#a16207"} emissiveIntensity={0.4} />
                </mesh>
                {stage === 1 && (
                  <DetBox3D position={[f.pos.x, f.pos.y, f.pos.z]} size={[0.32, 0.32, 0.32]} label={`z ${(f.pos.y + 0.3).toFixed(2)}m`} opacity={ease(t, 0.2 + i * 0.25, 0.3)} />
                )}
              </group>
            );
          })}
        {stage === 2 && target && <Rod from={head} to={[target.pos.x, target.pos.y, target.pos.z]} />}
        <Robot {...robot} />
        {/* What the robot's camera is looking at: ahead while mapping, then the flower or hook it's working on. */}
        {stage === 0 && <VisionCone from={head} to={[head[0] + Math.cos(robot.heading) * 2.6, 0.5, head[2]]} radius={1} sides={24} />}
        {stage === 1 &&
          (() => {
            const f = FLOWERS[Math.min(FLOWERS.length - 1, Math.floor(clamp(t / (stages[1].duration - 0.4)) * FLOWERS.length))];
            return <VisionCone from={head} to={f.pos.toArray()} radius={0.4} sides={24} opacity={0.09} />;
          })()}
        {stage === 2 && target && <VisionCone from={head} to={target.pos.toArray()} radius={0.3} sides={24} opacity={0.09} />}
        {stage === 3 &&
          (() => {
            const at = Math.min(PLANT_X.length - 1, Math.floor(lowerU));
            return <VisionCone from={head} to={[PLANT_X[at], 1.4 - ease(lowerU, at, 0.65) * 0.5, ROWS[0]]} radius={0.3} sides={24} opacity={0.09} />;
          })()}
      </Scene3D>
      <aside className="sim-side">
        {stage === 0 && <Stat label="Greenhouse mapped" value={`${Math.round(mapU * 100)}%`} />}
        {(stage === 1 || stage === 2) && <Stat label="Flowers found" value={FLOWERS.length} />}
        {stage === 2 && <Stat label="Pollinated" value={`${Math.min(FLOWERS.length, Math.floor(visit))} / ${FLOWERS.length}`} tone="ok" />}
        {stage === 3 && <Stat label="Plants lowered" value={`${Math.min(PLANT_X.length, Math.floor(lowerU + 0.001))} / ${PLANT_X.length}`} tone="ok" />}
        <label className="sim-control">
          <span>Robot speed: {speed}×</span>
          <input type="range" min="0.5" max="2" step="0.25" value={speed} onChange={(e) => setSpeed(+e.target.value)} />
        </label>
        <p className="sim-hint">Drag the scene to look round the greenhouse.</p>
      </aside>
    </div>
  );
}
