// src/city/Cockpit.jsx — the inside of the car, for the first-person view:
// right-hand drive (as in Nepal). Framed like a real cabin: a clear windscreen
// with a black ceramic border, wipers parked at its foot, A-pillars, a header
// and roof lining with sun visors and a map-light console; side windows with
// their frames, B-pillars and door cards; a deep stitched dashboard with vents,
// a cluster under its hood (speed and rev dials, gear, the limit and
// tell-tales), a centre touchscreen and a head-up display; a flat-bottomed
// wheel on its column that turns as you steer; a centre console with the gear
// selector; and three working mirrors. One small camera at the back of the
// cabin looks backwards, wide, a few times a second: the rear-view mirror shows
// the middle of that picture and each door mirror its own side.
// Rendered inside the car's own group, so it moves with it exactly. Front is −z.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAR_LIMITS, KMH_PER_UNIT, gearOf } from "../lib/autopilot";

// The mirror camera's picture: wide and short. Across it (u, 0 to 1) the
// right of the car is on the left, as the camera looks backwards.
const MIRROR = { w: 768, h: 128, fov: 22, every: 3 };
const CROP = { right: [0, 0.25], middle: [0.22, 0.78], left: [0.75, 1] };
const COLOURS = {
  leather: "#1b1c21",
  soft: "#25272d",
  stitch: "#5b5f68",
  trim: "#8d939c",
  lining: "#3a3b41",
  frit: "#050607",
  ambient: "#2dd4bf",
  paint: "#e0283f",
};

// The windscreen, side on: its foot and top edge (height, distance forward).
const SCREEN = { foot: [1.06, -1.15], top: [1.9, -0.42], width: 1.78 };
SCREEN.height = Math.hypot(SCREEN.top[0] - SCREEN.foot[0], SCREEN.top[1] - SCREEN.foot[1]);
SCREEN.tilt = Math.atan2(SCREEN.top[1] - SCREEN.foot[1], SCREEN.top[0] - SCREEN.foot[0]);
SCREEN.centre = [0, (SCREEN.foot[0] + SCREEN.top[0]) / 2, (SCREEN.foot[1] + SCREEN.top[1]) / 2];
/** Where the windscreen is at a given height. */
const screenZ = (y) => SCREEN.foot[1] + ((y - SCREEN.foot[0]) / (SCREEN.top[0] - SCREEN.foot[0])) * (SCREEN.top[1] - SCREEN.foot[1]);

/** A bar (box or rod) from one point to another. */
function strut(from, to) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return { position: a.clone().add(b).multiplyScalar(0.5), quaternion: q, length: a.distanceTo(b) };
}

/** A rounded rectangle centred on the origin. */
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** A mirror's housing: a soft rounded shell whose open face (the glass side) is at z = 0. */
function housing(w, h, r, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, h, r), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: 8 });
  g.translate(0, 0, -depth - bevel);
  return g;
}

/** Mirror glass showing a slice [u0, u1] of the mirror camera's picture, flipped as a mirror flips it. */
function mirrorGlass(w, h, r, [u0, u1]) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 8);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, u1 - ((pos.getX(i) + w / 2) / w) * (u1 - u0), (pos.getY(i) + h / 2) / h);
  uv.needsUpdate = true;
  return g;
}

/** A flat outline (side on: distance back, height) standing at x, like a window. */
function sidePanel(points, x) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y))));
  g.rotateY(-Math.PI / 2); // shape x becomes the car's z
  g.translate(x, 0, 0);
  return g;
}

/** The dashboard's side profile (distance forward, height), swept across the car:
 *  a rounded lip facing you, a long top reaching the foot of the windscreen. */
function dashGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0.3, 0.62);
  s.lineTo(0.3, 0.95);
  s.quadraticCurveTo(0.3, 1.08, 0.44, 1.09);
  s.lineTo(0.75, 1.1);
  s.quadraticCurveTo(1.0, 1.09, 1.15, 1.06);
  s.lineTo(1.2, 0.98);
  s.lineTo(1.2, 0.75);
  s.lineTo(0.3, 0.62);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.76, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 10 });
  // Shape x is distance forward (−z in the car); its extrusion runs across the car.
  g.rotateY(Math.PI / 2);
  g.translate(-0.88, 0, 0);
  return g;
}

/** A flat-bottomed wheel rim: an arc with a straight bar across the bottom. */
const RIM = { r: 0.19, tube: 0.028, gap: (70 * Math.PI) / 180 };
/** The wheel's hub, and how far it leans back from upright. */
const WHEEL = { at: [0.42, 1.18, -0.25], tilt: -0.45 };

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
  const glasses = useRef([]);
  const ambient = useRef();
  const { gl, scene } = useThree();
  const screens = useScreens();

  const parts = useMemo(() => {
    const H = SCREEN.height;
    // The front door window, side on (distance back, height): from the
    // A-pillar along the roof rail to the B-pillar, down to the sill.
    const pane = [
      [-1.08, 1.13],
      [screenZ(1.88), 1.88],
      [0.56, 1.9],
      [0.56, 1.13],
    ];
    return {
      dash: dashGeometry(),
      mirrorShell: housing(0.25, 0.075, 0.03, 0.02, 0.01),
      mirrorGlass: mirrorGlass(0.234, 0.062, 0.025, CROP.middle),
      wingShell: housing(0.25, 0.15, 0.06, 0.07, 0.035),
      wingGlass: { [-1]: mirrorGlass(0.215, 0.12, 0.05, CROP.left), [1]: mirrorGlass(0.215, 0.12, 0.05, CROP.right) },
      sideGlass: { [-1]: sidePanel(pane, -0.945), [1]: sidePanel(pane, 0.945) },
      sail: {
        [-1]: sidePanel([[-1.1, 1.12], [-0.86, 1.12], [screenZ(1.32), 1.32]], -0.93),
        [1]: sidePanel([[-1.1, 1.12], [-0.86, 1.12], [screenZ(1.32), 1.32]], 0.93),
      },
      pillars: [-1, 1].map((side) => strut([side * 0.89, SCREEN.foot[0], SCREEN.foot[1] - 0.01], [side * 0.86, SCREEN.top[0] + 0.02, SCREEN.top[1] - 0.01])),
      stem: strut([0, 1.835, -0.44], [0, 1.78, -0.405]),
      H,
    };
  }, []);

  const mirrorRig = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(MIRROR.w, MIRROR.h);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(MIRROR.fov, MIRROR.w / MIRROR.h, 0.3, 400);
    return { target, camera, frame: 0 };
  }, []);
  useEffect(
    () => () => {
      for (const k of ["cluster", "centre", "hud"]) screens[k].texture.dispose();
      mirrorRig.target.dispose();
      const { dash, mirrorShell, mirrorGlass: g, wingShell, wingGlass, sideGlass, sail } = parts;
      for (const geo of [dash, mirrorShell, g, wingShell, ...Object.values(wingGlass), ...Object.values(sideGlass), ...Object.values(sail)]) geo.dispose();
    },
    [screens, mirrorRig, parts]
  );

  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const s = state.current;
    // The wheel turns with the steering (about 2.5 turns lock to lock, scaled
    // down). Steering is positive to the left, and the wheel faces you, so
    // left is anticlockwise as you see it: a positive turn about its axis.
    if (wheel.current) wheel.current.rotation.z = (s.steer ?? 0) * 2.4;
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

    // The mirrors: one wide camera at the back of the cabin looking backwards.
    const glass = glasses.current.filter(Boolean);
    if (mirror && glass.length && s.worldMatrix && ++mirrorRig.frame % MIRROR.every === 0) {
      const m = s.worldMatrix;
      tmp.pos.set(0, 1.72, 1.2).applyMatrix4(m);
      tmp.look.set(0, 1.45, 12).applyMatrix4(m);
      tmp.up.set(0, 1, 0).transformDirection(m);
      const cam = mirrorRig.camera;
      cam.position.copy(tmp.pos);
      cam.up.copy(tmp.up);
      cam.lookAt(tmp.look);
      for (const g of glass) g.visible = false;
      const before = gl.getRenderTarget();
      gl.setRenderTarget(mirrorRig.target);
      gl.render(scene, cam);
      gl.setRenderTarget(before);
      for (const g of glass) g.visible = true;
    }
  });

  const leather = <meshStandardMaterial color={COLOURS.leather} roughness={0.82} />;
  const trim = <meshStandardMaterial color={COLOURS.trim} metalness={0.85} roughness={0.32} />;
  const lining = <meshStandardMaterial color={COLOURS.lining} roughness={0.95} />;
  const frit = <meshBasicMaterial color={COLOURS.frit} side={THREE.DoubleSide} />;
  const paint = <meshPhysicalMaterial color={COLOURS.paint} metalness={0.15} roughness={0.38} clearcoat={1} clearcoatRoughness={0.12} />;
  const reflection = (i) =>
    mirror ? (
      <meshBasicMaterial map={mirrorRig.target.texture} toneMapped={false} />
    ) : (
      <meshStandardMaterial key={i} color="#8597a8" metalness={0.25} roughness={0.25} />
    );
  const sideBar = RIM.r * Math.cos(RIM.gap / 2);
  const halfBar = RIM.r * Math.sin(RIM.gap / 2);
  const H = parts.H;

  return (
    <group>
      {/* The floor: carpet over the whole cabin, the bulkhead and sloping toe
          boards under the dash, the pedals, a rear bench, and the back panel —
          so looking down shows the car, not the road through it. */}
      <mesh position={[0, 0.42, 0.06]}>
        <boxGeometry args={[1.9, 0.04, 2.56]} />
        <meshStandardMaterial color="#141518" roughness={1} />
      </mesh>
      <mesh position={[0, 0.72, -1.2]}>
        <boxGeometry args={[1.84, 0.62, 0.04]} />
        <meshStandardMaterial color="#141518" roughness={1} />
      </mesh>
      <mesh position={[0, 0.52, -1.0]} rotation-x={-0.75}>
        <boxGeometry args={[1.84, 0.03, 0.36]} />
        <meshStandardMaterial color="#17181b" roughness={1} />
      </mesh>
      {[
        [0.3, 0.07, 0.06],
        [0.52, 0.05, 0.1],
      ].map(([x, w, h]) => (
        <group key={x} position={[x, 0.6, -0.86]} rotation-x={-0.6}>
          <mesh>
            <boxGeometry args={[w, h, 0.012]} />
            <meshStandardMaterial color="#2a2c31" roughness={0.6} metalness={0.5} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.66, 1.0]}>
        <boxGeometry args={[1.76, 0.18, 0.5]} />
        <meshStandardMaterial color="#202227" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.98, 1.2]} rotation-x={-0.18}>
        <boxGeometry args={[1.76, 0.5, 0.12]} />
        <meshStandardMaterial color="#202227" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.8, 1.3]}>
        <boxGeometry args={[1.84, 0.8, 0.04]} />
        <meshStandardMaterial color="#141518" roughness={1} />
      </mesh>

      {/* Front seats: cushion, backrest with side bolsters, headrest. */}
      {[-0.42, 0.42].map((x) => (
        <group key={x} position={[x, 0, 0.62]}>
          <mesh position={[0, 0.7, -0.28]}>
            <boxGeometry args={[0.52, 0.12, 0.5]} />
            <meshStandardMaterial color="#202227" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.55, -0.28]}>
            <boxGeometry args={[0.4, 0.2, 0.4]} />
            <meshStandardMaterial color="#0d0e10" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.18, 0]} rotation-x={-0.12}>
            <boxGeometry args={[0.52, 0.7, 0.14]} />
            <meshStandardMaterial color="#202227" roughness={0.95} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.24, 1.12, -0.06]} rotation-x={-0.12}>
              <boxGeometry args={[0.07, 0.56, 0.12]} />
              <meshStandardMaterial color="#26282e" roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0, 1.62, 0.06]}>
            <boxGeometry args={[0.3, 0.2, 0.12]} />
            <meshStandardMaterial color="#202227" roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* The dashboard: a deep, soft top up to the windscreen, a stitched lip,
          a metal trim line with the ambient strip, a defrost slot and speakers. */}
      <mesh geometry={parts.dash}>
        <meshStandardMaterial color={COLOURS.soft} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.112, -0.45]}>
        <boxGeometry args={[1.7, 0.004, 0.006]} />
        <meshStandardMaterial color={COLOURS.stitch} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.82, -0.29]}>
        <boxGeometry args={[1.66, 0.012, 0.004]} />
        <meshBasicMaterial ref={ambient} color={COLOURS.ambient} transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.84, -0.3]}>
        <boxGeometry args={[1.7, 0.03, 0.012]} />
        {trim}
      </mesh>
      <mesh position={[0, 1.088, -1.04]}>
        <boxGeometry args={[1.4, 0.004, 0.03]} />
        <meshBasicMaterial color="#060708" />
      </mesh>
      {[-0.68, 0.68].map((x) => (
        <mesh key={x} position={[x, 1.09, -0.96]} scale={[1.6, 1, 1]}>
          <cylinderGeometry args={[0.045, 0.045, 0.004, 24]} />
          <meshStandardMaterial color="#121317" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}

      {/* Air vents: two in the middle, one at each end, with slats. */}
      {[-0.78, -0.2, 0.06, 0.78].map((x) => (
        <group key={x} position={[x, 0.91, -0.305]}>
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

      {/* Instrument cluster under its hood, facing the driver over the wheel. */}
      <group position={[0.42, 1.23, -0.76]} rotation-x={-0.35}>
        <mesh>
          <boxGeometry args={[0.64, 0.24, 0.1]} />
          {leather}
        </mesh>
        <mesh position={[0, 0.005, 0.052]}>
          <planeGeometry args={[0.6, 0.197]} />
          <meshBasicMaterial map={screens.cluster.texture} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.135, 0.03]}>
          <boxGeometry args={[0.68, 0.025, 0.2]} />
          {leather}
        </mesh>
      </group>

      {/* Centre touchscreen on a slim stand, turned a little toward the driver. */}
      <group position={[0.0, 1.24, -0.66]} rotation={[-0.25, 0.22, 0]}>
        <mesh position={[0, 0, -0.012]}>
          <boxGeometry args={[0.36, 0.23, 0.02]} />
          <meshStandardMaterial color="#0a0b0e" roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.33, 0.206]} />
          <meshBasicMaterial map={screens.centre.texture} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.12, -0.04]}>
          <boxGeometry args={[0.08, 0.06, 0.04]} />
          <meshStandardMaterial color="#0a0b0e" roughness={0.5} />
        </mesh>
      </group>

      {/* Head-up display, floating on the windscreen in front of the driver. */}
      <mesh position={[0.42, 1.45, screenZ(1.45) + 0.02]} rotation-x={-0.1}>
        <planeGeometry args={[0.26, 0.098]} />
        <meshBasicMaterial map={screens.hud.texture} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      {/* Steering column with its stalks (fixed), and the wheel (turns). */}
      <group position={WHEEL.at} rotation-x={WHEEL.tilt}>
        <mesh position={[0, 0, -0.17]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.045, 0.06, 0.26, 16]} />
          <meshStandardMaterial color="#121317" roughness={0.85} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.1, 0.01, -0.07]} rotation-z={side * 1.35}>
            <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
            <meshStandardMaterial color="#2a2d33" roughness={0.6} />
          </mesh>
        ))}
        <group ref={wheel}>
          <mesh rotation-z={-Math.PI / 2 + RIM.gap / 2}>
            <torusGeometry args={[RIM.r, RIM.tube, 12, 48, Math.PI * 2 - RIM.gap]} />
            <meshStandardMaterial color="#17181c" roughness={0.7} />
          </mesh>
          <mesh position={[0, -sideBar, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[RIM.tube, RIM.tube, halfBar * 2, 12]} />
            <meshStandardMaterial color="#17181c" roughness={0.7} />
          </mesh>
          {/* A stitched marker at twelve o'clock. */}
          <mesh position={[0, RIM.r, 0]}>
            <boxGeometry args={[0.012, RIM.tube * 2.05, RIM.tube * 2.05]} />
            <meshStandardMaterial color="#6d7178" roughness={0.7} />
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

      {/* Each side: the door card (armrest with window switches, pull handle,
          speaker, ambient line, sill), the window in its frame, the B-pillar,
          the roof rail, and the door mirror outside. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <group position={[side * 0.93, 0, 0]}>
            <mesh position={[0, 0.76, 0.03]}>
              <boxGeometry args={[0.06, 0.72, 2.26]} />
              <meshStandardMaterial color="#1f2126" roughness={0.88} />
            </mesh>
            <mesh position={[-side * 0.06, 0.9, 0.05]}>
              <boxGeometry args={[0.1, 0.05, 0.5]} />
              {leather}
            </mesh>
            {[-0.06, 0.0].map((z) => (
              <mesh key={z} position={[-side * 0.06, 0.93, z - 0.1]}>
                <boxGeometry args={[0.03, 0.012, 0.035]} />
                <meshStandardMaterial color="#0b0c0f" roughness={0.5} />
              </mesh>
            ))}
            <mesh position={[0, 1.13, -0.24]}>
              <boxGeometry args={[0.08, 0.025, 1.72]} />
              {trim}
            </mesh>
            <mesh position={[-side * 0.032, 1.08, -0.24]}>
              <boxGeometry args={[0.004, 0.01, 1.66]} />
              <meshBasicMaterial color={COLOURS.ambient} transparent opacity={0.45} toneMapped={false} />
            </mesh>
            <mesh position={[-side * 0.035, 1.0, -0.42]}>
              <boxGeometry args={[0.012, 0.03, 0.11]} />
              {trim}
            </mesh>
            <mesh position={[-side * 0.032, 0.7, -0.6]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.07, 0.07, 0.006, 24]} />
              <meshStandardMaterial color="#0b0c0f" roughness={0.8} />
            </mesh>
          </group>
          {/* The window: faint glass, a rubber seal along the sill, and the
              black sail where the mirror is fixed. */}
          <mesh geometry={parts.sideGlass[side]}>
            <meshBasicMaterial color="#a9cdee" transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[side * 0.945, 1.15, -0.26]}>
            <boxGeometry args={[0.02, 0.018, 1.64]} />
            <meshStandardMaterial color="#0a0b0d" roughness={0.8} />
          </mesh>
          <mesh geometry={parts.sail[side]}>{frit}</mesh>
          <mesh position={[side * 0.91, 1.51, 0.63]}>
            <boxGeometry args={[0.08, 0.8, 0.14]} />
            {lining}
          </mesh>
          <mesh position={[side * 0.895, 1.91, 0.36]}>
            <boxGeometry args={[0.1, 0.07, 1.6]} />
            {lining}
          </mesh>
          {/* Door mirror: a rounded shell in the body colour on a short arm. */}
          <mesh position={[side * 1.02, 1.17, -0.97]}>
            <boxGeometry args={[0.16, 0.035, 0.07]} />
            <meshStandardMaterial color="#111215" roughness={0.6} />
          </mesh>
          <group position={[side * 1.2, 1.21, -0.93]} rotation-y={side * -0.38}>
            <mesh geometry={parts.wingShell}>{paint}</mesh>
            <mesh position={[0, 0, 0.001]} scale={[1.04, 1.06, 1]}>
              <shapeGeometry args={[roundedRect(0.215, 0.12, 0.05)]} />
              <meshBasicMaterial color="#0a0b0d" />
            </mesh>
            <mesh ref={(el) => (glasses.current[side < 0 ? 0 : 1] = el)} geometry={parts.wingGlass[side]} position={[0, 0, 0.003]}>
              {reflection(side)}
            </mesh>
          </group>
        </group>
      ))}

      {/* A-pillars, the windscreen header, roof lining, sun visors (folded up,
          with their hinge rods, clips and vanity mirrors), the map-light console
          and a grab handle over the passenger door. */}
      {parts.pillars.map((p, i) => (
        <mesh key={i} position={p.position} quaternion={p.quaternion}>
          <boxGeometry args={[0.1, p.length, 0.07]} />
          {lining}
        </mesh>
      ))}
      <mesh position={[0, 1.925, SCREEN.top[1] - 0.02]}>
        <boxGeometry args={[1.8, 0.07, 0.14]} />
        {lining}
      </mesh>
      <mesh position={[0, 1.955, 0.37]}>
        <boxGeometry args={[1.84, 0.03, 1.6]} />
        <meshStandardMaterial color={COLOURS.lining} roughness={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.45, 1.912, -0.27]} rotation-x={0.06}>
          <mesh>
            <boxGeometry args={[0.6, 0.026, 0.2]} />
            <meshStandardMaterial color="#45464d" roughness={1} />
          </mesh>
          <mesh position={[0, -0.0135, 0.01]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[0.22, 0.09]} />
            <meshStandardMaterial color="#2f3036" roughness={0.6} />
          </mesh>
          <mesh position={[side * 0.31, 0.012, -0.07]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.008, 0.008, 0.06, 8]} />
            {trim}
          </mesh>
          <mesh position={[-side * 0.32, 0.016, -0.07]}>
            <boxGeometry args={[0.03, 0.02, 0.03]} />
            <meshStandardMaterial color="#202126" roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.925, -0.24]}>
        <boxGeometry args={[0.24, 0.035, 0.16]} />
        <meshStandardMaterial color="#202126" roughness={0.8} />
      </mesh>
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, 1.906, -0.24]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[0.07, 0.05]} />
          <meshStandardMaterial color="#8d9198" roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[-0.86, 1.86, 0.15]} rotation={[Math.PI, Math.PI / 2, 0]}>
        <torusGeometry args={[0.07, 0.012, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#202126" roughness={0.8} />
      </mesh>

      {/* The windscreen: clear glass, so only its black ceramic border shows,
          with the dotted shade behind the mirror; the wipers park at its foot. */}
      <group position={SCREEN.centre} rotation-x={SCREEN.tilt}>
        <mesh position={[0, H / 2 - 0.035, 0.004]}>
          <planeGeometry args={[SCREEN.width, 0.07]} />
          {frit}
        </mesh>
        <mesh position={[0, -H / 2 + 0.03, 0.004]}>
          <planeGeometry args={[SCREEN.width, 0.06]} />
          {frit}
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (SCREEN.width / 2 - 0.025), 0, 0.004]}>
            <planeGeometry args={[0.05, H]} />
            {frit}
          </mesh>
        ))}
        <mesh position={[0, H / 2 - 0.12, 0.004]}>
          <planeGeometry args={[0.18, 0.12]} />
          {frit}
        </mesh>
        {[
          [0.22, 0.62],
          [-0.52, 0.56],
        ].map(([x, len]) => (
          <group key={x} position={[x, -H / 2 + 0.06, -0.02]} rotation-z={0.05}>
            <mesh>
              <boxGeometry args={[len, 0.014, 0.012]} />
              <meshStandardMaterial color="#0b0c0e" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.016, -0.004]}>
              <boxGeometry args={[len * 0.92, 0.01, 0.02]} />
              <meshStandardMaterial color="#141518" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Rear-view mirror: a sensor cover on the glass, a stem and ball joint,
          and a frameless, rounded mirror turned toward the driver. */}
      <mesh position={[0, 1.85, screenZ(1.85) + 0.028]} rotation-x={SCREEN.tilt}>
        <boxGeometry args={[0.12, 0.1, 0.05]} />
        <meshStandardMaterial color="#121317" roughness={0.7} />
      </mesh>
      <mesh position={parts.stem.position} quaternion={parts.stem.quaternion}>
        <cylinderGeometry args={[0.009, 0.011, parts.stem.length, 10]} />
        <meshStandardMaterial color="#121317" roughness={0.5} metalness={0.3} />
      </mesh>
      <group position={[0, 1.765, -0.385]} rotation={[-0.06, 0.32, 0]}>
        <mesh position={[0, 0.012, -0.05]}>
          <sphereGeometry args={[0.016, 12, 10]} />
          <meshStandardMaterial color="#121317" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh geometry={parts.mirrorShell}>
          <meshStandardMaterial color="#0b0c0f" metalness={0.4} roughness={0.35} />
        </mesh>
        <mesh ref={(el) => (glasses.current[2] = el)} geometry={parts.mirrorGlass} position={[0, 0, 0.002]}>
          {reflection(0)}
        </mesh>
      </group>

      {/* Outside: the cowl, the bonnet in the car's paint, its nose and wings. */}
      <mesh position={[0, 1.0, -1.24]} rotation-x={-0.45}>
        <boxGeometry args={[1.9, 0.02, 0.22]} />
        <meshStandardMaterial color="#0d0e10" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.9, -1.8]} rotation-x={-0.12}>
        <boxGeometry args={[1.96, 0.06, 1.06]} />
        {paint}
      </mesh>
      <mesh position={[0, 0.79, -2.32]} rotation-x={0.5}>
        <boxGeometry args={[1.96, 0.08, 0.2]} />
        {paint}
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.98, 0.88, -1.75]}>
          <boxGeometry args={[0.14, 0.12, 1.2]} />
          <meshPhysicalMaterial color="#c81f35" metalness={0.15} roughness={0.4} clearcoat={1} />
        </mesh>
      ))}
    </group>
  );
}
