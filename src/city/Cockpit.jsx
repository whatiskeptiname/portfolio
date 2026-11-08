// src/city/Cockpit.jsx — the inside of the car, for the first-person view:
// right-hand drive (as in Nepal). A sculpted, stitched dashboard with air vents
// and a soft ambient light strip; a digital cluster with speed and rev dials,
// gear, the limit and tell-tales (indicators, headlights, autopilot); a centre
// touchscreen with heading and autopilot status; a head-up display on the
// windscreen; a flat-bottomed wheel with paddles that turns as you steer;
// door cards, a centre console with the gear selector, sun visors and a roof
// lining; tinted glass framed by the A-pillars; and a working rear-view
// mirror, a small second camera looking back, refreshed a few times a second.
// Rendered inside the car's own group, so it moves with it exactly. Front is −z.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAR_LIMITS, KMH_PER_UNIT, gearOf } from "../lib/autopilot";

const MIRROR = { w: 256, h: 80, every: 3 };
const COLOURS = {
  leather: "#1b1c21",
  soft: "#25272d",
  stitch: "#5b5f68",
  trim: "#8d939c",
  lining: "#2b2c31",
  ambient: "#2dd4bf",
  paint: "#e0283f",
};

function pillar(from, to, thickness) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return { position: mid, quaternion: q, args: [thickness, len, thickness] };
}

/** The dashboard's side profile (distance forward, height), swept across the car. */
function dashGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0.3, 0.7);
  s.lineTo(0.3, 0.9);
  s.quadraticCurveTo(0.3, 1.02, 0.42, 1.03); // the rounded lip facing you
  s.lineTo(0.7, 1.0);
  s.quadraticCurveTo(0.9, 0.99, 0.96, 0.97); // down to the windscreen
  s.lineTo(0.96, 0.8);
  s.lineTo(0.3, 0.7);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.76, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 10 });
  // Shape x is distance forward (−z in the car); its extrusion runs across the car.
  g.rotateY(Math.PI / 2);
  g.translate(-0.88, 0, 0);
  return g;
}

/** A flat-bottomed wheel rim: an arc with a straight bar across the bottom. */
const RIM = { r: 0.19, tube: 0.028, gap: (70 * Math.PI) / 180 };

/** Two canvases: the instrument cluster and the centre screen; plus the HUD. */
function useScreens() {
  return useMemo(() => {
    const make = (w, h) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      return { canvas, ctx: canvas.getContext("2d"), texture };
    };
    return { cluster: make(512, 168), centre: make(320, 200), hud: make(256, 96), last: 0 };
  }, []);
}

const MONO = "ui-monospace, 'JetBrains Mono', monospace";

function dial(ctx, cx, cy, r, f, colour, label, value, unit) {
  ctx.lineCap = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(120, 220, 255, 0.14)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
  ctx.stroke();
  // Tick marks.
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(200, 240, 255, 0.35)";
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (0.75 + 0.15 * i);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14));
    ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
    ctx.stroke();
  }
  ctx.lineWidth = 8;
  ctx.strokeStyle = colour;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * Math.max(0.001, Math.min(1, f))));
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#eafcff";
  ctx.font = `700 34px ${MONO}`;
  ctx.fillText(value, cx, cy + 10);
  ctx.font = `600 12px ${MONO}`;
  ctx.fillStyle = "rgba(234, 252, 255, 0.55)";
  ctx.fillText(unit, cx, cy + 30);
  ctx.fillText(label, cx, cy + r + 4);
}

function arrow(ctx, x, y, dir, on) {
  ctx.fillStyle = on ? "#3dff8a" : "rgba(61, 255, 138, 0.12)";
  ctx.beginPath();
  ctx.moveTo(x + dir * 14, y);
  ctx.lineTo(x - dir * 2, y - 11);
  ctx.lineTo(x - dir * 2, y - 4);
  ctx.lineTo(x - dir * 12, y - 4);
  ctx.lineTo(x - dir * 12, y + 4);
  ctx.lineTo(x - dir * 2, y + 4);
  ctx.lineTo(x - dir * 2, y + 11);
  ctx.closePath();
  ctx.fill();
}

function drawCluster({ ctx, canvas }, s) {
  const kmh = Math.round(Math.abs(s.speed ?? 0) * KMH_PER_UNIT);
  const limit = Math.round((CAR_LIMITS[s.surface ?? "road"] ?? 0) * KMH_PER_UNIT);
  const gear = gearOf(s.speed ?? 0);
  // A believable rev counter: rises through each gear, drops on the change.
  const inGear = gear > 0 ? (kmh % 40) / 40 : 0;
  const rpm = gear === 0 ? 800 : 1100 + inGear * 4200;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#060a12");
  grad.addColorStop(1, "#02040a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  dial(ctx, 96, 86, 62, kmh / 180, kmh > limit + 2 ? "#ff5a4f" : "#4ff3ff", "SPEED", String(kmh), "km/h");
  dial(ctx, 416, 86, 62, rpm / 7000, rpm > 5000 ? "#ffb347" : "#9b8cff", "RPM ×1000", (rpm / 1000).toFixed(1), "rpm");
  // Middle: gear, the limit, tell-tales.
  ctx.textAlign = "center";
  ctx.font = `800 54px ${MONO}`;
  ctx.fillStyle = "#ffd27a";
  ctx.fillText(gear === -1 ? "R" : gear === 0 ? "N" : String(gear), 256, 96);
  ctx.font = `600 11px ${MONO}`;
  ctx.fillStyle = "rgba(234, 252, 255, 0.5)";
  ctx.fillText("GEAR", 256, 114);
  const l = s.lamps ?? {};
  arrow(ctx, 206, 30, -1, (l.left ?? 0) > 0.5);
  arrow(ctx, 306, 30, 1, (l.right ?? 0) > 0.5);
  // Headlights tell-tale.
  ctx.fillStyle = s.night ? "#4fa8ff" : "rgba(79, 168, 255, 0.12)";
  ctx.beginPath();
  ctx.ellipse(246, 30, 9, 7, 0, Math.PI / 2, Math.PI * 1.5);
  ctx.fill();
  for (let i = -1; i <= 1; i++) ctx.fillRect(250, 27 + i * 5, 12, 2);
  // Limit sign.
  ctx.beginPath();
  ctx.arc(256, 146, 15, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#e0283f";
  ctx.stroke();
  ctx.fillStyle = "#111";
  ctx.font = `800 12px ${MONO}`;
  ctx.fillText(String(limit), 256, 150);
  // Autopilot.
  const auto = s.auto || s.route;
  ctx.font = `700 12px ${MONO}`;
  ctx.fillStyle = auto ? "#4ff3ff" : "rgba(79, 243, 255, 0.18)";
  ctx.fillText("AUTO", 196, 150);
  ctx.fillStyle = s.pedal === "brake" || s.pedal === "hold" ? "#ff5a4f" : "rgba(255, 90, 79, 0.15)";
  ctx.fillText("BRAKE", 318, 150);
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function drawCentre({ ctx, canvas }, s) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#07111a";
  ctx.fillRect(0, 0, w, h);
  // Heading: the plane's x is east and z is south; forward is (−sin yaw, −cos yaw).
  const bearing = (((-(s.yaw ?? 0) * 180) / Math.PI) % 360 + 360) % 360;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(234, 252, 255, 0.55)";
  ctx.font = `600 13px ${MONO}`;
  ctx.fillText("HEADING", w / 2, 26);
  // A sliding compass strip.
  ctx.save();
  ctx.beginPath();
  ctx.rect(20, 34, w - 40, 40);
  ctx.clip();
  for (let d = -180; d <= 540; d += 15) {
    const x = w / 2 + (d - bearing) * 2.2;
    if (x < 10 || x > w - 10) continue;
    const major = d % 45 === 0;
    ctx.fillStyle = major ? "#eafcff" : "rgba(234, 252, 255, 0.35)";
    ctx.fillRect(x - 1, 40, 2, major ? 12 : 6);
    if (major) {
      ctx.font = `700 14px ${MONO}`;
      ctx.fillText(COMPASS[(((d / 45) % 8) + 8) % 8], x, 70);
    }
  }
  ctx.restore();
  ctx.fillStyle = "#4ff3ff";
  ctx.beginPath();
  ctx.moveTo(w / 2, 36);
  ctx.lineTo(w / 2 - 6, 30);
  ctx.lineTo(w / 2 + 6, 30);
  ctx.fill();
  ctx.fillStyle = "#eafcff";
  ctx.font = `700 26px ${MONO}`;
  ctx.fillText(`${Math.round(bearing)}°`, w / 2, 108);
  // Autopilot and the road.
  const auto = s.auto || s.route;
  ctx.fillStyle = auto ? "rgba(79, 243, 255, 0.14)" : "rgba(255, 255, 255, 0.05)";
  ctx.fillRect(20, 126, w - 40, 54);
  ctx.textAlign = "left";
  ctx.fillStyle = auto ? "#4ff3ff" : "rgba(234, 252, 255, 0.6)";
  ctx.font = `700 15px ${MONO}`;
  ctx.fillText(auto ? "AUTOPILOT ON" : "MANUAL", 34, 148);
  ctx.fillStyle = "rgba(234, 252, 255, 0.7)";
  ctx.font = `600 13px ${MONO}`;
  const road = { highway: "Highway", road: "Road", roundabout: "Roundabout", paved: "Town square", grass: "Off road" }[s.surface] ?? "Road";
  ctx.fillText(`${road} · limit ${Math.round((CAR_LIMITS[s.surface ?? "road"] ?? 0) * KMH_PER_UNIT)} km/h`, 34, 168);
}

function drawHud({ ctx, canvas }, s) {
  const kmh = Math.round(Math.abs(s.speed ?? 0) * KMH_PER_UNIT);
  const limit = Math.round((CAR_LIMITS[s.surface ?? "road"] ?? 0) * KMH_PER_UNIT);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = kmh > limit + 2 ? "#ff7a70" : "#7ff7ff";
  ctx.font = `700 52px ${MONO}`;
  ctx.fillText(String(kmh), 110, 62);
  ctx.font = `600 13px ${MONO}`;
  ctx.fillText("km/h", 110, 84);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#ff7a70";
  ctx.beginPath();
  ctx.arc(196, 46, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#e9fdff";
  ctx.font = `700 16px ${MONO}`;
  ctx.fillText(String(limit), 196, 52);
}

export function Cockpit({ state, mirror = true }) {
  const wheel = useRef();
  const mirrorMesh = useRef();
  const ambient = useRef();
  const { gl, scene } = useThree();
  const screens = useScreens();
  const dash = useMemo(dashGeometry, []);

  const mirrorRig = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(MIRROR.w, MIRROR.h);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(42, MIRROR.w / MIRROR.h, 0.3, 400);
    return { target, camera, frame: 0 };
  }, []);
  useEffect(
    () => () => {
      for (const k of ["cluster", "centre", "hud"]) screens[k].texture.dispose();
      mirrorRig.target.dispose();
      dash.dispose();
    },
    [screens, mirrorRig, dash]
  );

  const pillars = useMemo(
    () => [
      pillar([-0.9, 0.98, -0.85], [-0.84, 1.95, -0.05], 0.06),
      pillar([0.9, 0.98, -0.85], [0.84, 1.95, -0.05], 0.06),
    ],
    []
  );
  const glass = useMemo(() => {
    const dy = 1.95 - 0.98;
    const dz = 0.8;
    return { position: [0, (0.98 + 1.95) / 2, -0.45], tilt: Math.atan2(dz, dy), height: Math.hypot(dy, dz) };
  }, []);

  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const s = state.current;
    // The wheel turns with the steering (about 2.5 turns lock to lock, scaled down).
    if (wheel.current) wheel.current.rotation.z = -(s.steer ?? 0) * 2.4;
    // The ambient strip glows more at night.
    if (ambient.current) ambient.current.opacity = s.night ? 0.9 : 0.35;

    const now = clock.elapsedTime;
    if (now - screens.last > 0.1) {
      screens.last = now;
      drawCluster(screens.cluster, s);
      drawCentre(screens.centre, s);
      drawHud(screens.hud, s);
      for (const k of ["cluster", "centre", "hud"]) screens[k].texture.needsUpdate = true;
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

  const leather = <meshStandardMaterial color={COLOURS.leather} roughness={0.82} />;
  const trim = <meshStandardMaterial color={COLOURS.trim} metalness={0.85} roughness={0.32} />;
  const sideBar = RIM.r * Math.cos(RIM.gap / 2);
  const halfBar = RIM.r * Math.sin(RIM.gap / 2);

  return (
    <group>
      {/* Front seats with headrests (seen when you look round). */}
      {[-0.42, 0.42].map((x) => (
        <group key={x} position={[x, 0, 0.62]}>
          <mesh position={[0, 1.18, 0]} rotation-x={-0.12}>
            <boxGeometry args={[0.52, 0.7, 0.14]} />
            <meshStandardMaterial color="#202227" roughness={0.95} />
          </mesh>
          <mesh position={[0, 1.62, 0.06]}>
            <boxGeometry args={[0.3, 0.2, 0.12]} />
            <meshStandardMaterial color="#202227" roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* The sculpted dashboard, a stitched seam along its lip, and the ambient strip. */}
      <mesh geometry={dash}>
        <meshStandardMaterial color={COLOURS.soft} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.035, -0.43]}>
        <boxGeometry args={[1.7, 0.004, 0.006]} />
        <meshStandardMaterial color={COLOURS.stitch} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.86, -0.29]}>
        <boxGeometry args={[1.66, 0.012, 0.004]} />
        <meshBasicMaterial ref={ambient} color={COLOURS.ambient} transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.88, -0.3]}>
        <boxGeometry args={[1.7, 0.03, 0.012]} />
        {trim}
      </mesh>

      {/* Air vents: two in the middle, one at each end, with slats. */}
      {[-0.78, -0.2, 0.06, 0.78].map((x) => (
        <group key={x} position={[x, 0.95, -0.305]}>
          <mesh>
            <boxGeometry args={[0.14, 0.07, 0.02]} />
            <meshStandardMaterial color="#08090b" roughness={0.9} />
          </mesh>
          {[-0.02, 0, 0.02].map((y) => (
            <mesh key={y} position={[0, y, 0.012]}>
              <boxGeometry args={[0.13, 0.006, 0.01]} />
              {trim}
            </mesh>
          ))}
        </group>
      ))}

      {/* Instrument cluster under its hood, facing the driver, high enough to
          read over the wheel. */}
      <mesh position={[0.42, 1.24, -0.66]} rotation-x={-0.3}>
        <boxGeometry args={[0.66, 0.03, 0.16]} />
        {leather}
      </mesh>
      <mesh position={[0.42, 1.13, -0.62]} rotation-x={-0.5}>
        <boxGeometry args={[0.64, 0.24, 0.1]} />
        {leather}
      </mesh>
      <mesh position={[0.42, 1.14, -0.565]} rotation-x={-0.5}>
        <planeGeometry args={[0.6, 0.197]} />
        <meshBasicMaterial map={screens.cluster.texture} toneMapped={false} />
      </mesh>

      {/* Centre touchscreen, angled a little toward the driver. */}
      <group position={[-0.08, 1.14, -0.62]} rotation={[-0.3, 0.2, 0]}>
        <mesh position={[0, 0, -0.012]}>
          <boxGeometry args={[0.36, 0.23, 0.02]} />
          <meshStandardMaterial color="#0a0b0e" roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.33, 0.206]} />
          <meshBasicMaterial map={screens.centre.texture} toneMapped={false} />
        </mesh>
      </group>

      {/* Head-up display, floating on the windscreen in front of the driver. */}
      <mesh position={[0.42, 1.3, -0.8]} rotation-x={-0.1}>
        <planeGeometry args={[0.26, 0.098]} />
        <meshBasicMaterial map={screens.hud.texture} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      {/* Steering column with its stalks, and the flat-bottomed wheel. */}
      <mesh position={[0.42, 0.98, -0.32]} rotation-x={-1.15}>
        <cylinderGeometry args={[0.045, 0.06, 0.26, 16]} />
        {leather}
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0.42 + side * 0.1, 1.0, -0.27]} rotation-z={side * 1.35}>
          <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
          <meshStandardMaterial color="#2a2d33" roughness={0.6} />
        </mesh>
      ))}
      <group position={[0.42, 1.05, -0.2]} rotation-x={-1.15}>
        <group ref={wheel}>
          <mesh rotation-z={-Math.PI / 2 + RIM.gap / 2}>
            <torusGeometry args={[RIM.r, RIM.tube, 12, 48, Math.PI * 2 - RIM.gap]} />
            <meshStandardMaterial color="#17181c" roughness={0.7} />
          </mesh>
          <mesh position={[0, -sideBar, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[RIM.tube, RIM.tube, halfBar * 2, 12]} />
            <meshStandardMaterial color="#17181c" roughness={0.7} />
          </mesh>
          {/* Spokes: left, right and down, in brushed metal. */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.1, -0.01, 0]}>
              <boxGeometry args={[0.15, 0.04, 0.02]} />
              {trim}
            </mesh>
          ))}
          <mesh position={[0, -0.09, 0]}>
            <boxGeometry args={[0.035, 0.12, 0.02]} />
            {trim}
          </mesh>
          {/* Buttons on the spokes. */}
          {[-0.12, -0.08, 0.08, 0.12].map((x) => (
            <mesh key={x} position={[x, -0.01, 0.012]}>
              <cylinderGeometry args={[0.008, 0.008, 0.006, 10]} />
              <meshBasicMaterial color="#9fe9f5" toneMapped={false} />
            </mesh>
          ))}
          {/* Hub, with a ring badge. */}
          <mesh position={[0, 0, 0.01]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.055, 0.055, 0.035, 24]} />
            {leather}
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <torusGeometry args={[0.022, 0.004, 8, 24]} />
            <meshBasicMaterial color={COLOURS.ambient} toneMapped={false} />
          </mesh>
          {/* Paddle shifters behind the rim. */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.17, 0.04, -0.035]} rotation-z={side * -0.3}>
              <boxGeometry args={[0.06, 0.09, 0.008]} />
              {trim}
            </mesh>
          ))}
        </group>
      </group>

      {/* Centre console and the gear selector. */}
      <mesh position={[0, 0.7, 0.05]}>
        <boxGeometry args={[0.26, 0.24, 0.8]} />
        {leather}
      </mesh>
      <mesh position={[0, 0.825, 0.05]}>
        <boxGeometry args={[0.27, 0.012, 0.81]} />
        {trim}
      </mesh>
      <group position={[0, 0.83, -0.1]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.012, 0.016, 0.12, 12]} />
          {trim}
        </mesh>
        <mesh position={[0, 0.13, 0]}>
          <sphereGeometry args={[0.035, 16, 12]} />
          {leather}
        </mesh>
      </group>
      {[0.22, 0.32].map((z) => (
        <mesh key={z} position={[0, 0.832, z]}>
          <cylinderGeometry args={[0.04, 0.04, 0.004, 20]} />
          <meshStandardMaterial color="#07080a" roughness={0.9} />
        </mesh>
      ))}

      {/* Door cards: armrest, window sill, handle, speaker, and the ambient line. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.93, 0, 0]}>
          <mesh position={[0, 0.86, -0.05]}>
            <boxGeometry args={[0.06, 0.52, 1.35]} />
            <meshStandardMaterial color="#1f2126" roughness={0.88} />
          </mesh>
          <mesh position={[-side * 0.06, 0.9, 0.05]}>
            <boxGeometry args={[0.1, 0.05, 0.5]} />
            {leather}
          </mesh>
          <mesh position={[0, 1.13, -0.05]}>
            <boxGeometry args={[0.08, 0.025, 1.36]} />
            {trim}
          </mesh>
          <mesh position={[-side * 0.032, 1.08, -0.05]}>
            <boxGeometry args={[0.004, 0.01, 1.3]} />
            <meshBasicMaterial color={COLOURS.ambient} transparent opacity={0.45} toneMapped={false} />
          </mesh>
          <mesh position={[-side * 0.035, 1.0, -0.42]}>
            <boxGeometry args={[0.012, 0.03, 0.11]} />
            {trim}
          </mesh>
          <mesh position={[-side * 0.032, 0.7, -0.45]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.07, 0.07, 0.006, 24]} />
            <meshStandardMaterial color="#0b0c0f" roughness={0.6} metalness={0.4} />
          </mesh>
        </group>
      ))}

      {/* A-pillars, the windscreen header, roof lining and sun visors. */}
      {pillars.map((p, i) => (
        <mesh key={i} position={p.position} quaternion={p.quaternion}>
          <boxGeometry args={p.args} />
          <meshStandardMaterial color={COLOURS.lining} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 1.97, -0.05]}>
        <boxGeometry args={[1.76, 0.06, 0.1]} />
        <meshStandardMaterial color={COLOURS.lining} roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.0, 0.5]}>
        <boxGeometry args={[1.8, 0.03, 1.1]} />
        <meshStandardMaterial color={COLOURS.lining} roughness={1} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 1.955, 0.06]} rotation-x={0.12}>
          <boxGeometry args={[0.5, 0.025, 0.16]} />
          <meshStandardMaterial color="#34353b" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 1.97, 0.12]}>
        <boxGeometry args={[0.24, 0.035, 0.12]} />
        <meshStandardMaterial color="#202126" roughness={0.8} />
      </mesh>

      {/* Windscreen glass: a faint tint, and a darker shade band along the top. */}
      <mesh position={glass.position} rotation-x={glass.tilt}>
        <planeGeometry args={[1.76, glass.height]} />
        <meshPhysicalMaterial color="#b8d8ff" transparent opacity={0.06} roughness={0} metalness={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.86, -0.13]} rotation-x={glass.tilt}>
        <planeGeometry args={[1.74, 0.16]} />
        <meshBasicMaterial color="#0c1a2a" transparent opacity={0.45} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* The bonnet out front, in the car's paint, and the wing mirrors. */}
      <mesh position={[0, 0.84, -1.55]} rotation-x={0.08}>
        <boxGeometry args={[2.0, 0.08, 1.45]} />
        <meshPhysicalMaterial color={COLOURS.paint} metalness={0.15} roughness={0.38} clearcoat={1} clearcoatRoughness={0.12} />
      </mesh>
      <mesh position={[0, 0.8, -2.28]} rotation-x={0.5}>
        <boxGeometry args={[2.0, 0.08, 0.2]} />
        <meshPhysicalMaterial color={COLOURS.paint} metalness={0.15} roughness={0.38} clearcoat={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.97, 0.84, -1.5]}>
            <boxGeometry args={[0.14, 0.14, 1.5]} />
            <meshPhysicalMaterial color="#c81f35" metalness={0.15} roughness={0.4} clearcoat={1} />
          </mesh>
          <mesh position={[side * 1.17, 1.22, -0.72]}>
            <boxGeometry args={[0.2, 0.15, 0.28]} />
            <meshPhysicalMaterial color={COLOURS.paint} metalness={0.15} roughness={0.4} clearcoat={1} />
          </mesh>
          <mesh position={[side * 1.17, 1.22, -0.575]}>
            <planeGeometry args={[0.16, 0.11]} />
            <meshStandardMaterial color="#8fa6b8" metalness={0.9} roughness={0.15} />
          </mesh>
        </group>
      ))}

      {/* Rear-view mirror, frameless with a thin bezel. */}
      <mesh position={[0.15, 1.86, -0.12]} rotation-x={-0.08}>
        <boxGeometry args={[0.32, 0.105, 0.03]} />
        <meshStandardMaterial color="#0b0c0f" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0.15, 1.92, -0.1]}>
        <boxGeometry args={[0.03, 0.06, 0.03]} />
        <meshStandardMaterial color="#0b0c0f" />
      </mesh>
      {mirror && (
        <mesh ref={mirrorMesh} position={[0.15, 1.86, -0.1]} rotation-x={-0.08} scale-x={-1}>
          <planeGeometry args={[0.29, 0.088]} />
          <meshBasicMaterial map={mirrorRig.target.texture} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
