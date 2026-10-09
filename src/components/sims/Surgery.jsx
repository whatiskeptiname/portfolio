// AI-Assisted Surgery, in 3D, on a total knee replacement: trim the capture
// rig round the knee, find the bone saw from a text prompt, mask it, track
// it, and rebuild the scene from Gaussian splats.
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MIN_VIEWS, renderMinutes, rigCoverage } from "../../lib/sims";
import { Stat } from "./shared";
import { clamp, ease, lerp, seeded } from "./anim";
import { DetBox3D, Scene3D, VisionCone } from "./Scene3D";
import { STAGES } from "./stages";

const stages = STAGES.surgery;
const SPLATS = 900;

// The leg on the table, knee flexed and raised the way it is for a knee replacement.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HIP = V(-1.55, 0.66, 0);
const KNEE = V(0, 1.12, 0);
const ANKLE = V(1.05, 0.62, 0);
const TO_HIP = HIP.clone().sub(KNEE).normalize();
const TO_ANKLE = ANKLE.clone().sub(KNEE).normalize();
const at = (dir, d) => KNEE.clone().addScaledVector(dir, d);
const FEMUR_CUT = at(TO_HIP, 0.34); // where the drape ends on the thigh
const TIBIA_CUT = at(TO_ANKLE, 0.32); // and on the shin
const RING = 2.3;
const RIG_Y = 2.25;

// Points along a segment, and a mesh oriented along it.
const along = (a, b) => ({
  mid: a.clone().add(b).multiplyScalar(0.5),
  len: a.distanceTo(b),
  q: new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()),
});
const facing = (dir) => new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);

// The saw's path as it works the distal femur (u: 0..1 through tracking).
function sawAt(u) {
  return V(lerp(-0.2, -0.04, u), KNEE.y + 0.13 + Math.sin(u * 9) * 0.02, Math.sin(u * 6.3) * 0.1);
}

function Limb({ a, b, r, color, op }) {
  const s = along(a, b);
  return (
    <mesh position={s.mid} quaternion={s.q} castShadow>
      <capsuleGeometry args={[r, s.len, 6, 16]} />
      <meshStandardMaterial color={color} roughness={0.75} transparent opacity={op} />
    </mesh>
  );
}

function Bone({ a, b, r, op }) {
  const s = along(a, b);
  return (
    <mesh position={s.mid} quaternion={s.q} castShadow>
      <cylinderGeometry args={[r, r * 1.08, s.len, 18]} />
      <meshStandardMaterial color="#efe6d2" roughness={0.6} transparent opacity={op} />
    </mesh>
  );
}

function Patient({ fade }) {
  const op = 1 - fade * 0.85;
  // Polished cobalt-chrome; kept light, as there's no environment for metal to reflect.
  const metal = { color: "#e4e9ee", metalness: 0.35, roughness: 0.28, transparent: true, opacity: op };
  const tray = at(TO_ANKLE, 0.14);
  const insert = at(TO_ANKLE, 0.095);
  return (
    <group>
      {/* the table */}
      <mesh position={[0, 0.38, 0]} receiveShadow>
        <boxGeometry args={[3.8, 0.16, 1.3]} />
        <meshStandardMaterial color="#8a96a3" metalness={0.4} roughness={0.6} transparent opacity={op} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.12, 0.2, 0.32, 16]} />
        <meshStandardMaterial color="#5d6873" transparent opacity={op} />
      </mesh>
      {/* draped thigh and shin, and the foot resting on the table */}
      <Limb a={HIP} b={FEMUR_CUT} r={0.2} color="#2f6f8f" op={op} />
      <Limb a={TIBIA_CUT} b={ANKLE} r={0.15} color="#2f6f8f" op={op} />
      <mesh position={[ANKLE.x + 0.14, 0.55, 0]}>
        <boxGeometry args={[0.32, 0.14, 0.16]} />
        <meshStandardMaterial color="#2f6f8f" transparent opacity={op} />
      </mesh>
      {/* the opened knee: soft tissue held back by retractors */}
      <mesh position={[0, KNEE.y - 0.17, 0]} scale={[1.2, 0.55, 1.3]}>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshStandardMaterial color="#d98a87" roughness={0.8} transparent opacity={op} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[0, KNEE.y + 0.02, side * 0.26]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.5, 8]} />
            <meshStandardMaterial {...metal} />
          </mesh>
          <mesh position={[0, KNEE.y + 0.05, side * 0.22]}>
            <boxGeometry args={[0.12, 0.08, 0.02]} />
            <meshStandardMaterial {...metal} />
          </mesh>
        </group>
      ))}
      {/* femur and tibia */}
      <Bone a={FEMUR_CUT} b={at(TO_HIP, 0.06)} r={0.085} op={op} />
      <Bone a={tray} b={TIBIA_CUT} r={0.075} op={op} />
      {/* the implant: femoral component over the condyles, tibial tray, polyethylene insert */}
      {[-0.055, 0.055].map((z) => (
        <mesh key={z} position={[KNEE.x, KNEE.y + 0.01, z]}>
          <sphereGeometry args={[0.075, 24, 16]} />
          <meshStandardMaterial {...metal} />
        </mesh>
      ))}
      <mesh position={at(TO_HIP, 0.09).add(V(0, 0.05, 0))} quaternion={facing(TO_HIP)}>
        <boxGeometry args={[0.07, 0.08, 0.2]} />
        <meshStandardMaterial {...metal} />
      </mesh>
      <mesh position={insert} quaternion={facing(TO_ANKLE)}>
        <cylinderGeometry args={[0.115, 0.115, 0.035, 28]} />
        <meshStandardMaterial color="#e8f1f8" roughness={0.35} transparent opacity={op} />
      </mesh>
      <mesh position={tray} quaternion={facing(TO_ANKLE)}>
        <cylinderGeometry args={[0.125, 0.125, 0.018, 28]} />
        <meshStandardMaterial {...metal} />
      </mesh>
    </group>
  );
}

function Rig({ cameras }) {
  const cov = useMemo(() => rigCoverage(cameras, 72), [cameras]);
  const cams = useMemo(
    () =>
      Array.from({ length: cameras }, (_, i) => {
        const a = (i / cameras) * Math.PI * 2;
        const pos = V(Math.cos(a) * RING, RIG_Y, Math.sin(a) * RING);
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, KNEE, V(0, 1, 0)));
        return { pos, q };
      }),
    [cameras]
  );
  return (
    <group>
      {cams.map((c, i) => (
        <group key={i} position={c.pos} quaternion={c.q}>
          <mesh castShadow>
            <boxGeometry args={[0.16, 0.12, 0.2]} />
            <meshStandardMaterial color="#20252c" />
          </mesh>
          <mesh position={[0, 0, -0.13]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.08, 12]} />
            <meshStandardMaterial color="#5eead4" emissive="#5eead4" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
      {/* each camera's view: a point at the lens, opening out over the knee */}
      {cams.map((c, i) => (
        <VisionCone key={i} from={c.pos.toArray()} to={KNEE.toArray()} radius={0.5} opacity={cameras > 14 ? 0.025 : 0.06} />
      ))}
      {/* coverage ring round the field: green where two or more cameras see it */}
      {cov.views.map((n, i) => (
        <mesh key={i} position={[0, 0.47, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.95, 1.08, 2, 1, (i / 72) * Math.PI * 2, (Math.PI * 2) / 72 - 0.01]} />
          <meshBasicMaterial color={n >= MIN_VIEWS ? "#22c55e" : "#ef4444"} />
        </mesh>
      ))}
    </group>
  );
}

// An oscillating bone saw: handpiece and blade, glowing teal once SAM masks it.
function Saw({ position, mask, swing }) {
  const glow = { emissive: "#5eead4", emissiveIntensity: mask * 1.4 };
  return (
    <group position={position} rotation={[0, 0.25, -0.35]} scale={0.62}>
      <mesh position={[-0.2, 0.06, 0]} rotation={[0, 0, Math.PI / 2 - 0.35]} castShadow>
        <cylinderGeometry args={[0.05, 0.055, 0.36, 18]} />
        <meshStandardMaterial color="#3a4048" roughness={0.5} {...glow} />
      </mesh>
      <mesh position={[-0.33, -0.08, 0]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.07, 0.2, 0.07]} />
        <meshStandardMaterial color="#2a2f36" {...glow} />
      </mesh>
      <group rotation={[0, swing, 0]}>
        <mesh position={[0.06, 0, 0]}>
          <boxGeometry args={[0.2, 0.006, 0.07]} />
          <meshStandardMaterial color="#eef2f5" metalness={0.4} roughness={0.2} {...glow} />
        </mesh>
      </group>
    </group>
  );
}

function Splats({ progress }) {
  const mesh = useRef();
  const pts = useMemo(() => {
    const rnd = seeded(7);
    const out = [];
    const C = (c) => new THREE.Color(c);
    const steel = C("#8a96a3");
    const drape = C("#2f6f8f");
    const tissue = C("#d98a87");
    const bone = C("#efe6d2");
    const implant = C("#cfd6de");
    const onLimb = (a, b, r) => {
      const p = a.clone().lerp(b, rnd());
      const ang = rnd() * Math.PI * 2;
      return p.add(V(-Math.sin(ang) * r * 0.3, Math.sin(ang) * r, Math.cos(ang) * r));
    };
    for (let i = 0; i < SPLATS; i++) {
      const r = rnd();
      let p;
      let c;
      if (r < 0.3) [p, c] = [V((rnd() - 0.5) * 3.6, 0.47, (rnd() - 0.5) * 1.2), steel];
      else if (r < 0.52) [p, c] = [onLimb(HIP, FEMUR_CUT, 0.2), drape];
      else if (r < 0.68) [p, c] = [onLimb(TIBIA_CUT, ANKLE, 0.15), drape];
      else if (r < 0.8) [p, c] = [onLimb(FEMUR_CUT, TIBIA_CUT, 0.08), bone];
      else if (r < 0.9) {
        const a = rnd() * Math.PI * 2;
        p = V(Math.cos(a) * 0.22, KNEE.y - 0.08 + (rnd() - 0.5) * 0.1, Math.sin(a) * 0.25);
        c = tissue;
      } else {
        const a = rnd() * Math.PI * 2;
        const b = rnd() * Math.PI * 0.5;
        p = V(Math.cos(a) * Math.cos(b) * 0.1, KNEE.y + Math.sin(b) * 0.08, Math.sin(a) * Math.cos(b) * 0.12);
        c = implant;
      }
      out.push({ p, c: c.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.12), s: 0.02 + rnd() * 0.045, order: rnd(), rot: rnd() * Math.PI });
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    pts.forEach((pt, i) => {
      const k = ease(progress, pt.order * 0.75, 0.25);
      q.setFromEuler(new THREE.Euler(pt.rot, pt.rot * 0.7, 0));
      m.compose(pt.p, q, scale.set(pt.s * 1.8 * k, pt.s * 0.7 * k, pt.s * k));
      mesh.current.setMatrixAt(i, m);
      mesh.current.setColorAt(i, pt.c);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [progress, pts]);
  return (
    <instancedMesh ref={mesh} args={[null, null, SPLATS]}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial transparent opacity={0.85} roughness={0.9} />
    </instancedMesh>
  );
}

export default function Surgery({ stage, t, playing }) {
  const [manual, setManual] = useState(null);
  const animated = Math.round(lerp(30, 8, ease(t, 0.4, 3)));
  const cameras = stage === 0 ? manual ?? animated : manual ?? 8;
  const cov = rigCoverage(cameras);
  const u = stage === 3 ? clamp(t / stages[3].duration) : 0.3;
  const saw = sawAt(u);
  const box = stage === 1 ? ease(t, 1.5, 0.5) : stage === 2 || stage === 3 ? 1 : 0;
  const mask = stage === 2 ? ease(t, 0.2, 1.4) : stage === 3 ? 1 : 0;
  const progress = stage === 4 ? clamp(t / (stages[4].duration - 0.6)) : 0;
  const trail = useMemo(() => Array.from({ length: 16 }, (_, i) => sawAt(clamp(u - i * 0.025))), [u]);
  const prompt = "bone saw".slice(0, Math.floor(clamp(t / 1.1) * 8));
  const label =
    stage === 1 ? `prompt: “${prompt}”` : stage === 3 ? `frame ${String(Math.floor(u * 240)).padStart(3, "0")} / 240` : stages[stage].title;
  return (
    <div className="sim-layout">
      <Scene3D rotate={playing} camera={[3.4, 3.1, 4.2]} target={[0, 1.05, 0]} label={label} distance={stage >= 1 && stage <= 3 ? 1.7 : 6}>
        <Patient fade={ease(progress, 0, 0.5)} />
        {stage === 0 && <Rig cameras={cameras} />}
        {stage >= 1 && stage <= 3 && (
          <>
            <Saw position={saw} mask={mask} swing={Math.sin(t * 40) * 0.12} />
            <DetBox3D
              position={[saw.x - 0.07, saw.y, saw.z]}
              size={[0.36, 0.24, 0.2]}
              label={`bone saw ${(0.88 + 0.06 * Math.sin(u * 9)).toFixed(2)}`}
              opacity={box}
            />
          </>
        )}
        {stage === 3 &&
          trail.map((p, i) => (
            <mesh key={i} position={p}>
              <sphereGeometry args={[0.018 - i * 0.0009, 8, 6]} />
              <meshBasicMaterial color="#5eead4" transparent opacity={1 - i / 16} />
            </mesh>
          ))}
        {stage === 4 && <Splats progress={progress} />}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[5, 48]} />
          <meshStandardMaterial color="#1d2633" />
        </mesh>
      </Scene3D>
      <aside className="sim-side">
        {stage === 0 && (
          <>
            <Stat label="Cameras" value={cameras} />
            <Stat label="Field covered (2+ views)" value={`${Math.round(cov.covered * 100)}%`} tone={cov.covered === 1 ? "ok" : "bad"} />
            <Stat label="Views per point" value={`${cov.min}–${Math.max(...cov.views)}`} />
            <label className="sim-control">
              <span>Cameras in the rig</span>
              <input type="range" min="3" max="30" value={cameras} onChange={(e) => setManual(+e.target.value)} />
            </label>
            <p className="sim-hint">Below 6 the ring turns red: parts of the field are seen once or not at all.</p>
          </>
        )}
        {(stage === 1 || stage === 2) && (
          <>
            <Stat label="Model" value={stage === 1 ? "GroundingDINO" : "SAM"} />
            <Stat label="Input" value={stage === 1 ? "frame + text" : "frame + box"} />
            <Stat label="Output" value={stage === 1 ? "box + score" : "pixel mask"} />
          </>
        )}
        {stage === 3 && (
          <>
            <Stat label="Tracker" value="MMDetection" />
            <Stat label="Frame" value={`${Math.floor(u * 240)} / 240`} />
            <Stat label="Markers on the tool" value="none" tone="ok" />
          </>
        )}
        {stage === 4 && (
          <>
            <Stat label="Gaussian splats" value={Math.round(progress * 412000).toLocaleString()} />
            <div className="sim-bars">
              <span>Before</span>
              <div className="sim-bar">
                <i className="bad" style={{ width: "100%" }} />
              </div>
              <b>~{Math.round(renderMinutes(cameras, false) / 60)} h</b>
              <span>Now</span>
              <div className="sim-bar">
                <i className="ok" style={{ width: `${(renderMinutes(cameras, true) / renderMinutes(cameras, false)) * 100 * ease(t, 0.5, 1.5)}%` }} />
              </div>
              <b>{Math.round(renderMinutes(cameras, true))} min</b>
            </div>
            <p className="sim-hint">Render time for novel views from {cameras} cameras.</p>
          </>
        )}
      </aside>
    </div>
  );
}
