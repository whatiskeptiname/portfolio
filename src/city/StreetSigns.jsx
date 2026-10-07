// src/city/StreetSigns.jsx — road signs: green exit signs, speed-limit
// roundels, blue equator route shields and brown lane guides. Every face is
// painted into one atlas texture; all faces are one mesh and all posts
// another, so the whole lot costs two draw calls. Faces glow faintly so
// they read at night, like retroreflective sheeting in headlights.
import React, { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { placeStreetSigns } from "../lib/signs";
import { surfaceMatrix } from "./globe3d";
import { useDisposable } from "./gpu";

const SLOT_W = 256;
const SLOT_H = 128;
const COLS = 4;

// Board size (world units), centre height, post layout.
const SHAPES = {
  exit: { w: 4.2, h: 2.1, y: 3.4, posts: [-1.5, 1.5] },
  guide: { w: 3.2, h: 1.6, y: 2.5, posts: [0] },
  speed: { w: 2.4, h: 1.2, y: 2.4, posts: [0] },
  shield: { w: 2.6, h: 1.3, y: 2.5, posts: [0] },
};

export function StreetSigns({ layout }) {
  const R = layout.radius;
  const signs = useMemo(() => placeStreetSigns(layout), [layout]);

  const { faces, posts, texture } = useDisposable(() => {
    // One atlas slot per distinct face, plus a metal back per shape.
    const keyOf = (s) => `${s.kind}|${s.text}|${s.sub ?? ""}|${s.arrow ?? ""}|${s.side ?? ""}`;
    const slots = new Map();
    for (const s of signs) if (!slots.has(keyOf(s))) slots.set(keyOf(s), slots.size);
    const backs = {};
    for (const kind of ["board", "speed", "shield"]) backs[kind] = slots.size + Object.keys(backs).length;
    const total = slots.size + 3;
    const rows = Math.ceil(total / COLS);
    const W = SLOT_W * COLS;
    const H = SLOT_H * rows;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const origin = (slot) => [(slot % COLS) * SLOT_W, Math.floor(slot / COLS) * SLOT_H];

    const painted = new Set();
    for (const s of signs) {
      const slot = slots.get(keyOf(s));
      if (painted.has(slot)) continue;
      painted.add(slot);
      ctx.save();
      ctx.translate(...origin(slot));
      paint(ctx, s);
      ctx.restore();
    }
    for (const [kind, slot] of Object.entries(backs)) {
      ctx.save();
      ctx.translate(...origin(slot));
      paintBack(ctx, kind);
      ctx.restore();
    }

    // Geometry: front and back planes per sign (atlas UVs), posts.
    const faceParts = [];
    const postParts = [];
    const plane = new THREE.PlaneGeometry(1, 1);
    const post = new THREE.BoxGeometry(0.12, 1, 0.12);
    const uvInto = (g, slot) => {
      const [x0, y0] = origin(slot);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) {
        uv.setXY(k, (x0 + uv.getX(k) * SLOT_W) / W, 1 - (y0 + (1 - uv.getY(k)) * SLOT_H) / H);
      }
    };
    for (const s of signs) {
      const shape = SHAPES[s.kind];
      const base = surfaceMatrix(R, s.x, s.z, 0, s.yaw);
      const at = (x, y, z, ry = 0) =>
        base
          .clone()
          .multiply(new THREE.Matrix4().makeTranslation(x, y, z))
          .multiply(new THREE.Matrix4().makeRotationY(ry));
      const front = plane.clone().applyMatrix4(at(0, shape.y, 0.04).multiply(new THREE.Matrix4().makeScale(shape.w, shape.h, 1)));
      uvInto(front, slots.get(keyOf(s)));
      faceParts.push(front);
      const back = plane.clone().applyMatrix4(at(0, shape.y, -0.04, Math.PI).multiply(new THREE.Matrix4().makeScale(shape.w, shape.h, 1)));
      uvInto(back, backs[s.kind === "exit" || s.kind === "guide" ? "board" : s.kind]);
      faceParts.push(back);
      const top = shape.y - shape.h * (s.kind === "speed" ? 0.45 : 0.4);
      for (const px of shape.posts) {
        postParts.push(post.clone().applyMatrix4(at(px, top / 2, -0.1).multiply(new THREE.Matrix4().makeScale(1, top, 1))));
      }
    }
    const faces = faceParts.length ? mergeGeometries(faceParts) : null;
    const posts = postParts.length ? mergeGeometries(postParts) : null;
    [...faceParts, ...postParts, plane, post].forEach((g) => g.dispose());
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { faces, posts, texture };
  }, [signs, R]);

  const materials = useDisposable(
    () => ({
      face: new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: "#ffffff",
        emissiveIntensity: 0.32,
        alphaTest: 0.5,
        roughness: 0.6,
      }),
      post: new THREE.MeshStandardMaterial({ color: "#8a9099", metalness: 0.6, roughness: 0.4 }),
    }),
    [texture]
  );

  return (
    <>
      {faces && <mesh geometry={faces} material={materials.face} castShadow />}
      {posts && <mesh geometry={posts} material={materials.post} castShadow />}
    </>
  );
}

// --- painting --------------------------------------------------------------------

function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shieldPath(ctx, cx, top, w, h) {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top);
  ctx.lineTo(cx + w / 2, top);
  ctx.lineTo(cx + w / 2, top + h * 0.55);
  ctx.quadraticCurveTo(cx + w / 2, top + h * 0.9, cx, top + h);
  ctx.quadraticCurveTo(cx - w / 2, top + h * 0.9, cx - w / 2, top + h * 0.55);
  ctx.closePath();
}

function fitText(ctx, text, max, size, weight = 700, family = "Inter, system-ui, sans-serif") {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 12 && ctx.measureText(text).width > max) ctx.font = `${weight} ${--s}px ${family}`;
  return s;
}

function paint(ctx, s) {
  const W = SLOT_W;
  const H = SLOT_H;
  ctx.textBaseline = "middle";
  if (s.kind === "exit") {
    // Motorway green with a white keyline; a stripe in the hemisphere's colour.
    ctx.fillStyle = "#0b6b3a";
    round(ctx, 2, 2, W - 4, H - 4, 12);
    ctx.fill();
    ctx.strokeStyle = "#f4f4f0";
    ctx.lineWidth = 4;
    round(ctx, 8, 8, W - 16, H - 16, 8);
    ctx.stroke();
    ctx.fillStyle = s.side === "north" ? "#ffb547" : "#3ff0d0";
    ctx.fillRect(14, H - 26, W - 28, 8);
    ctx.fillStyle = "#ffd84a";
    ctx.font = "800 15px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("EXIT", 18, 25);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    fitText(ctx, s.text, W - 90, 34);
    ctx.fillText(s.text, 18, 60);
    ctx.font = "700 46px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(s.arrow, W - 16, 56);
  } else if (s.kind === "guide") {
    // Brown "tourist route" board with the destination and distance.
    ctx.fillStyle = "#6b3f1f";
    round(ctx, 2, 2, W - 4, H - 4, 12);
    ctx.fill();
    ctx.strokeStyle = "#f4ead8";
    ctx.lineWidth = 4;
    round(ctx, 8, 8, W - 16, H - 16, 8);
    ctx.stroke();
    ctx.fillStyle = `hsl(${Math.round(s.hue * 360)} 80% 62%)`;
    ctx.beginPath();
    ctx.arc(30, 48, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffaf0";
    ctx.textAlign = "left";
    fitText(ctx, s.text, W - 100, 30);
    ctx.fillText(s.text, 48, 48);
    ctx.font = "600 20px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillText(s.sub, 48, 88);
    ctx.font = "700 44px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("↑", W - 18, 64);
  } else if (s.kind === "speed") {
    // Red-ringed roundel, centred in the slot (the rest stays transparent).
    const cx = W / 2;
    const cy = H / 2;
    const r = H / 2 - 4;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d4202c";
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    fitText(ctx, s.text, r * 1.25, 44, 800);
    ctx.fillText(s.text, cx, cy + 2);
  } else if (s.kind === "shield") {
    // Blue route shield: "EQ" over the longitude.
    const cx = W / 2;
    shieldPath(ctx, cx, 4, 104, H - 8);
    ctx.fillStyle = "#f4f4f0";
    ctx.fill();
    shieldPath(ctx, cx, 10, 92, H - 20);
    ctx.fillStyle = "#1d4fb8";
    ctx.fill();
    ctx.fillStyle = "#d4202c";
    ctx.fillRect(cx - 46, 10, 92, 16);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "800 13px Inter, system-ui, sans-serif";
    ctx.fillText("EQUATOR", cx, 19);
    ctx.font = "900 34px Inter, system-ui, sans-serif";
    ctx.fillText("EQ", cx, 52);
    fitText(ctx, s.text, 80, 22, 800);
    ctx.fillText(s.text, cx, 84);
  }
}

// Plain galvanised backs, in the same outline as the front.
function paintBack(ctx, kind) {
  const W = SLOT_W;
  const H = SLOT_H;
  ctx.fillStyle = "#9aa1a9";
  if (kind === "board") {
    round(ctx, 2, 2, W - 4, H - 4, 12);
    ctx.fill();
  } else if (kind === "speed") {
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, H / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    shieldPath(ctx, W / 2, 4, 104, H - 8);
    ctx.fill();
  }
}
