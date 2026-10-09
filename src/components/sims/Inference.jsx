// AI Inference Acceleration, in 3D: prune, sparsify, quantize and distil a
// vision model, then ship a speech model through ONNX and TensorRT to Triton.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { BASELINE, TECHNIQUES, optimise } from "../../lib/sims";
import { Stat } from "./shared";
import { ease } from "./anim";
import { Scene3D } from "./Scene3D";

// Each layer is a grid of neurons (rows × columns), laid out along x.
const LAYERS = [
  [3, 2],
  [3, 3],
  [3, 3],
  [3, 3],
  [2, 2],
];
const PRESET = [
  {},
  { prune: true },
  { prune: true, sparsify: true },
  { prune: true, sparsify: true, quantize: true },
  { prune: true, sparsify: true, quantize: true, distill: true },
  { prune: true, sparsify: true, quantize: true, distill: true },
];

const nodesOf = (offset) =>
  LAYERS.flatMap(([rows, cols], l) =>
    Array.from({ length: rows * cols }, (_, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      return { l, i, pos: new THREE.Vector3(offset + l * 0.9, 1.2 + (r - (rows - 1) / 2) * 0.5, (c - (cols - 1) / 2) * 0.5) };
    })
  );
// Which neurons pruning keeps, and which connections sparsity drops (fixed patterns).
const kept = (n) => n.l === 0 || n.l === LAYERS.length - 1 || (n.i * 7 + n.l * 3) % 9 < 5;
const sparseDrop = (a, b) => (a.i * 13 + b.i * 7 + a.l) % 5 <= 1;

function Network({ enabled, offset = -1.8, ghost = false, t }) {
  const nodes = useMemo(() => nodesOf(offset), [offset]);
  const alive = (n) => !enabled.prune || kept(n);
  const edges = useMemo(() => {
    const strong = [];
    const weak = [];
    for (const a of nodes)
      for (const b of nodes) {
        if (b.l !== a.l + 1 || !alive(a) || !alive(b)) continue;
        (enabled.sparsify && sparseDrop(a, b) ? weak : strong).push(a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z);
      }
    const geo = (arr) => new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return { strong: geo(strong), weak: geo(weak) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, enabled.prune, enabled.sparsify]);
  useEffect(
    () => () => {
      edges.strong.dispose();
      edges.weak.dispose();
    },
    [edges]
  );
  const int8 = enabled.quantize;
  return (
    <group>
      <lineSegments geometry={edges.strong}>
        <lineBasicMaterial color={ghost ? "#7d8a99" : "#9fb6c9"} transparent opacity={ghost ? 0.18 : 0.45} />
      </lineSegments>
      <lineSegments geometry={edges.weak}>
        <lineBasicMaterial color="#9fb6c9" transparent opacity={0.07} />
      </lineSegments>
      {nodes.map((n) => {
        const on = alive(n);
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(n.i * 1.7 + n.l * 0.9 + t * 3));
        return (
          <mesh key={`${n.l}-${n.i}`} position={n.pos} scale={on ? 1 : 0.35}>
            {int8 && on ? <boxGeometry args={[0.16, 0.16, 0.16]} /> : <sphereGeometry args={[0.09, 16, 12]} />}
            <meshStandardMaterial
              color={!on ? "#3b4450" : int8 ? "#f0b65a" : "#5eead4"}
              emissive={!on ? "#000000" : int8 ? "#b07a2c" : "#14b8a6"}
              emissiveIntensity={on ? pulse * (ghost ? 0.2 : 0.6) : 0}
              transparent
              opacity={ghost ? 0.35 : on ? 1 : 0.5}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Deploy({ t }) {
  const steps = ["PyTorch", "ONNX", "TensorRT FP16", "Triton"];
  return (
    <group>
      {steps.map((s, i) => {
        const lit = ease(t, i * 0.7, 0.5);
        const x = -2.7 + i * 1.8;
        return (
          <group key={s} position={[x, 1, 0]}>
            <mesh castShadow>
              <boxGeometry args={[1.1, 0.7 + i * 0.05, 0.9]} />
              <meshStandardMaterial color={lit > 0.5 ? "#0f766e" : "#2a323d"} emissive="#5eead4" emissiveIntensity={lit * 0.35} />
            </mesh>
            <Html position={[0, 0.62, 0]} center zIndexRange={[10, 0]}>
              <span className="tag3d">{s}</span>
            </Html>
            {i < 3 && (
              <mesh position={[0.9, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
                <meshStandardMaterial color="#9aa3ad" />
              </mesh>
            )}
          </group>
        );
      })}
      {t > 2.8 &&
        Array.from({ length: 8 }, (_, k) => {
          const u = ((t - 2.8) * 0.5 + k / 8) % 1;
          return (
            <mesh key={k} position={[-3.3 + u * 6.6, 1.6, 0]}>
              <sphereGeometry args={[0.06, 10, 8]} />
              <meshBasicMaterial color="#f0b65a" />
            </mesh>
          );
        })}
    </group>
  );
}

// Knowledge flowing from teacher to student: sparks along a gentle arc.
function Sparks({ t }) {
  return Array.from({ length: 10 }, (_, k) => {
    const u = (t * 0.6 + k / 10) % 1;
    const x = THREE.MathUtils.lerp(-0.6, 0.6, u);
    return (
      <mesh key={k} position={[x, 1.2 + Math.sin(u * Math.PI) * 0.9, Math.sin(k * 2.3) * 0.5]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshBasicMaterial color="#f0b65a" />
      </mesh>
    );
  });
}

export default function Inference({ stage, t, playing }) {
  const [enabled, setEnabled] = useState(PRESET[0]);
  useEffect(() => setEnabled(PRESET[stage]), [stage]);
  const m = useMemo(() => optimise(enabled), [enabled]);
  const deploy = stage === 5;
  const speedup = deploy ? 1 + 1.84 * ease(t, 2.6, 1.2) : m.speed;
  const label = deploy ? "ZipVoice · 123M params" : `${enabled.quantize ? "INT8" : "FP32"} · ${m.params}% of parameters`;
  return (
    <div className="sim-layout">
      <Scene3D rotate={playing} camera={[1.2, 3.2, 7]} target={[0, 1.1, 0]} label={label} distance={enabled.distill && !deploy ? 8.6 : deploy ? 7.2 : 4.6}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[6, 48]} />
          <meshStandardMaterial color="#1d2633" />
        </mesh>
        {deploy ? (
          <Deploy t={t} />
        ) : enabled.distill ? (
          <>
            <group position={[-2.3, 0, 0]}>
              <Network enabled={{}} offset={-1.8} ghost t={t} />
              <Html position={[0, 0.25, 0]} center zIndexRange={[10, 0]}>
                <span className="tag3d">teacher</span>
              </Html>
            </group>
            <group position={[2.3, 0, 0]}>
              <Network enabled={enabled} offset={-1.8} t={t} />
              <Html position={[0, 0.25, 0]} center zIndexRange={[10, 0]}>
                <span className="tag3d">student</span>
              </Html>
            </group>
            <Sparks t={t} />
          </>
        ) : (
          <Network enabled={enabled} t={t} />
        )}
      </Scene3D>
      <aside className="sim-side">
        <Stat label={deploy ? "ZipVoice speed-up" : "Speed-up"} value={`${speedup.toFixed(deploy ? 2 : 1)}×`} tone="ok" />
        {!deploy && (
          <>
            <Stat label="Latency (per image)" value={`${m.latency.toFixed(1)} ms`} />
            <Stat label="Accuracy" value={`${m.accuracy.toFixed(2)}%`} tone={m.withinBaseline ? "ok" : "bad"} />
            <Stat label="Parameters" value={`${m.params}%`} />
            <fieldset className="sim-toggles">
              <legend>Techniques</legend>
              {TECHNIQUES.map((tq) => (
                <label key={tq.key}>
                  <input type="checkbox" checked={!!enabled[tq.key]} onChange={(e) => setEnabled((x) => ({ ...x, [tq.key]: e.target.checked }))} />
                  {tq.label}
                </label>
              ))}
            </fieldset>
            <p className="sim-hint">Green accuracy is within 2% of the {BASELINE.accuracy}% baseline (illustrative).</p>
          </>
        )}
        {deploy && (
          <>
            <Stat label="Precision" value="FP16" />
            <Stat label="Shapes" value="dynamic" />
            <Stat label="Quality" value="unchanged" tone="ok" />
          </>
        )}
      </aside>
    </div>
  );
}
