// src/city/Buildings.jsx — every building on the planet in a handful of draw
// calls. Bodies, trims, crowns, beacons and rooftop signs are each merged into
// one mesh (windows are one instanced mesh); picking maps the hit triangle
// back to its building, and the hovered/selected one gets a highlight shell.
import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BUILDING_SIZE } from "../lib/layout";
import { frameAt } from "../lib/globe";
import { surfaceMatrix } from "./globe3d";
import { nightGlowMaterial, useDisposable } from "./gpu";

const BOX_TRIANGLES = 12;
const SIGN_W = 5;
const SIGN_H = 1.25;

/** Copies `g`, transforms it, and paints every vertex `color` (and optional `up`). */
function part(g, matrix, color, up = null) {
  const geo = g.clone().applyMatrix4(matrix);
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  if (up) {
    const u = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) u.set(up, i * 3);
    geo.setAttribute("aUp", new THREE.BufferAttribute(u, 3));
  }
  return geo;
}

const at = (base, x, y, z, ry = 0) => {
  const m = base.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z));
  return ry ? m.multiply(new THREE.Matrix4().makeRotationY(ry)) : m;
};

export function Buildings({ layout, selectedId, hoveredId, onSelect, onHover, signs = true, windows = true }) {
  const R = layout.radius;

  const merged = useDisposable(() => {
    const plain = [];
    const glass = [];
    const plainIds = [];
    const glassIds = [];
    const trims = [];
    const crowns = [];
    const beacons = [];
    const posts = [];
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const beaconGeo = new THREE.SphereGeometry(0.35, 12, 8);
    const scale = (sx, sy, sz) => new THREE.Matrix4().makeScale(sx, sy, sz);

    for (const b of layout.buildings) {
      const isGlass = b.kind === "career";
      const base = surfaceMatrix(R, b.x, b.z, 0, b.rotation);
      const up = frameAt(R, b.x, b.z).up;
      const color = isGlass ? new THREE.Color().setHSL(b.hue, 0.55, 0.74) : new THREE.Color().setHSL(b.hue, 0.42, b.lightness);

      const body = part(unitBox, at(base, 0, b.height / 2, 0).multiply(scale(BUILDING_SIZE, b.height, BUILDING_SIZE)), color);
      (isGlass ? glass : plain).push(body);
      (isGlass ? glassIds : plainIds).push(b.id);

      // Door facing the plaza.
      trims.push(part(unitBox, at(base, 0, 1.1, BUILDING_SIZE / 2 + 0.03).multiply(scale(1.1, 2.2, 0.06)), new THREE.Color("#5d4037")));
      if (isGlass) {
        crowns.push(part(unitBox, at(base, 0, b.height + 1, 0).multiply(scale(BUILDING_SIZE * 0.6, 2, BUILDING_SIZE * 0.6)), color));
        beacons.push(part(beaconGeo, at(base, 0, b.height + 2.6, 0), new THREE.Color("#ff5a4f"), up));
      } else {
        trims.push(part(unitBox, at(base, 0, b.height + 0.15, 0).multiply(scale(BUILDING_SIZE + 0.3, 0.3, BUILDING_SIZE + 0.3)), new THREE.Color("#6b6b6b")));
      }
      // Stilts for the rooftop sign.
      const signY = b.height + (isGlass ? 3.9 : 1.6);
      const postH = signY - b.height - 0.2;
      for (const x of [-1.6, 1.6]) {
        posts.push(part(unitBox, at(base, x, b.height + postH / 2, 0).multiply(scale(0.08, postH, 0.08)), new THREE.Color("#2a2d33")));
      }
    }
    unitBox.dispose();
    beaconGeo.dispose();
    const merge = (list) => (list.length ? mergeGeometries(list) : null);
    const out = {
      plain: merge(plain),
      glass: merge(glass),
      trims: merge(trims),
      crowns: merge(crowns),
      beacons: merge(beacons),
      posts: merge(posts),
      plainIds,
      glassIds,
    };
    [...plain, ...glass, ...trims, ...crowns, ...beacons, ...posts].forEach((g) => g.dispose());
    return out;
  }, [layout.buildings, R]);

  const materials = useDisposable(
    () => ({
      plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
      glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.2 }),
      trims: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
      beacon: nightGlowMaterial({ vertexColors: true, emissive: "#ff3b30", emissiveIntensity: 3 }, { dayFactor: 0.27 }),
      highlight: new THREE.MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.28, depthWrite: false }),
    }),
    []
  );

  // Picking: triangle → building.
  const pick = (ids) => (e) => ids[Math.floor(e.faceIndex / BOX_TRIANGLES)];
  const handlers = (ids) => {
    const idOf = pick(ids);
    return {
      onClick: (e) => {
        e.stopPropagation();
        onSelect(idOf(e));
      },
      onPointerMove: (e) => {
        e.stopPropagation();
        const id = idOf(e);
        if (id !== hoveredId) onHover(id);
      },
      onPointerOut: () => onHover(null),
    };
  };

  const byId = useMemo(() => new Map(layout.buildings.map((b) => [b.id, b])), [layout.buildings]);
  const active = [...new Set([hoveredId, selectedId])].filter(Boolean).map((id) => byId.get(id)).filter(Boolean);

  return (
    <>
      {merged.plain && <mesh geometry={merged.plain} material={materials.plain} castShadow receiveShadow {...handlers(merged.plainIds)} />}
      {merged.glass && <mesh geometry={merged.glass} material={materials.glass} castShadow receiveShadow {...handlers(merged.glassIds)} />}
      {merged.trims && <mesh geometry={merged.trims} material={materials.trims} castShadow />}
      {merged.crowns && <mesh geometry={merged.crowns} material={materials.glass} castShadow />}
      {merged.beacons && <mesh geometry={merged.beacons} material={materials.beacon} />}
      {signs && merged.posts && <mesh geometry={merged.posts} material={materials.trims} />}
      {signs && <RoofSigns layout={layout} />}
      {windows && <Windows layout={layout} />}
      {active.map((b) => (
        <Highlight key={b.id} R={R} building={b} material={materials.highlight} />
      ))}
    </>
  );
}

function Highlight({ R, building: b, material }) {
  const matrix = useMemo(() => surfaceMatrix(R, b.x, b.z, 0, b.rotation), [R, b.x, b.z, b.rotation]);
  return (
    <group matrixAutoUpdate={false} matrix={matrix}>
      <mesh position-y={b.height / 2} material={material}>
        <boxGeometry args={[BUILDING_SIZE + 0.25, b.height + 0.25, BUILDING_SIZE + 0.25]} />
      </mesh>
    </group>
  );
}

// --- rooftop name signs (one atlas texture, one mesh) ----------------------------

const SLOT_W = 320;
const SLOT_H = 80;
const COLS = 3;

function RoofSigns({ layout }) {
  const R = layout.radius;
  const { geometry, texture } = useDisposable(() => {
    const n = layout.buildings.length;
    const rows = Math.max(1, Math.ceil(n / COLS));
    const W = SLOT_W * COLS;
    const H = SLOT_H * rows;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const planes = [];
    const plane = new THREE.PlaneGeometry(SIGN_W, SIGN_H);

    layout.buildings.forEach((b, i) => {
      const glass = b.kind === "career";
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      drawSign(
        ctx,
        col * SLOT_W,
        row * SLOT_H,
        b.project.title,
        glass ? "#ffcf7a" : `hsl(${Math.round(b.hue * 360)} 90% 72%)`,
        glass ? "RÉSUMÉ" : b.project.language
      );
      const base = surfaceMatrix(R, b.x, b.z, 0, b.rotation);
      const y = b.height + (glass ? 3.9 : 1.6);
      // Two faces so it reads the right way from both sides.
      for (const [ry, dz] of [
        [0, 0.02],
        [Math.PI, -0.02],
      ]) {
        const g = plane.clone().applyMatrix4(at(base, 0, y, dz, ry));
        const uv = g.attributes.uv;
        for (let k = 0; k < uv.count; k++) {
          const u = (col + uv.getX(k)) * (SLOT_W / W);
          const v = 1 - (row + 1) * (SLOT_H / H) + uv.getY(k) * (SLOT_H / H);
          uv.setXY(k, u, v);
        }
        planes.push(g);
      }
    });
    const geometry = mergeGeometries(planes);
    planes.forEach((g) => g.dispose());
    plane.dispose();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { geometry, texture };
  }, [layout.buildings, R]);

  const material = useDisposable(() => new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }), [texture]);
  return <mesh geometry={geometry} material={material} />;
}

function drawSign(ctx, x0, y0, title, neon, tag) {
  const W = SLOT_W;
  const H = SLOT_H;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.fillStyle = "rgba(10, 12, 20, 0.88)";
  roundRect(ctx, 3, 3, W - 6, H - 6, 14);
  ctx.fill();
  ctx.strokeStyle = neon;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = neon;
  ctx.shadowBlur = 9;
  roundRect(ctx, 6, 6, W - 12, H - 12, 11);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = neon;
  ctx.globalAlpha = 0.8;
  ctx.font = "600 11px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(tag.toUpperCase(), 16, 11);
  ctx.globalAlpha = 1;
  ctx.shadowColor = neon;
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#fffaf0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxW = W - 34;
  const font = (s) => `700 ${s}px Inter, system-ui, sans-serif`;
  let size = 33;
  ctx.font = font(size);
  while (size > 19 && ctx.measureText(title).width > maxW) ctx.font = font(--size);
  if (ctx.measureText(title).width <= maxW) {
    ctx.fillText(title, W / 2, H / 2 + 6);
  } else {
    const words = title.split(" ");
    const mid = Math.ceil(words.length / 2);
    const lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    size = 21;
    ctx.font = font(size);
    while (size > 13 && Math.max(...lines.map((l) => ctx.measureText(l).width)) > maxW) ctx.font = font(--size);
    ctx.fillText(lines[0], W / 2, H / 2 - size * 0.45 + 6);
    ctx.fillText(lines[1], W / 2, H / 2 + size * 0.6 + 6);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- windows: one instanced mesh, lit by the shader on the night side -------------

const WINDOW_W = 0.7;
const WINDOW_H = 0.9;

function Windows({ layout }) {
  const ref = useRef();
  const R = layout.radius;
  const { matrices, geometry } = useDisposable(() => {
    const matrices = [];
    const ups = [];
    const local = new THREE.Matrix4();
    for (const b of layout.buildings) {
      const up = frameAt(R, b.x, b.z).up;
      const rows = Math.max(1, Math.floor((b.height - 2.8) / 1.6));
      for (let face = 0; face < 4; face++) {
        const base = surfaceMatrix(R, b.x, b.z, 0, b.rotation + (face * Math.PI) / 2);
        for (let row = 0; row < rows; row++) {
          for (const col of [-0.9, 0.9]) {
            local.makeTranslation(col, 3 + row * 1.6, BUILDING_SIZE / 2 + 0.02);
            matrices.push(base.clone().multiply(local));
            ups.push(...up);
          }
        }
      }
    }
    const geometry = new THREE.PlaneGeometry(WINDOW_W, WINDOW_H);
    geometry.setAttribute("aUp", new THREE.InstancedBufferAttribute(new Float32Array(ups), 3));
    return { matrices, geometry };
  }, [layout.buildings, R]);

  const material = useDisposable(
    () => nightGlowMaterial({ color: "#d4e6f1", emissive: "#ffcf5a", emissiveIntensity: 1.5, roughness: 0.25, metalness: 0.2 }, { tint: true }),
    []
  );

  useLayoutEffect(() => {
    matrices.forEach((m, i) => ref.current.setMatrixAt(i, m));
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [matrices]);

  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} key={matrices.length} />;
}
