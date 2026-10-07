// src/city/World.jsx — the planet and everything on it: two hemispheres
// (résumé north, GitHub south) divided by the equator highway, winding roads,
// a river from the southern mountains to the northern sea (both in Poles.jsx),
// districts, buildings, trees and skill billboards.
// The black hole is the only sun, so one side is day and the other night —
// windows and plazas light up on the night side by themselves.
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { frameAt } from "../lib/globe";
import { BRIDGE_HEIGHT, MOUNTAIN_HEIGHT, PLAZA_RADIUS, ROUNDABOUT_ISLAND, bridgeElevation, wrapDelta } from "../lib/layout";
import { terrainAt } from "../lib/terrain";
import { highwayJunctions, openArcs, openRuns, roundaboutJunctions } from "../lib/junctions";
import { useDisposable } from "./gpu";
import {
  RIVER_COLOR,
  SEA_COLOR,
  SUN_DIRECTION,
  annulusGeometry,
  arcBandGeometry,
  outlineGeometry,
  blackHolePosition,
  discGeometry,
  ribbonGeometry,
  sunlightAt,
  surfaceMatrix,
  surfacePoint,
  visibleFrom,
} from "./globe3d";

const texture = (name) => `${import.meta.env.BASE_URL}textures/${name}`;
// Start downloading as soon as this chunk loads rather than on first render.
useLoader.preload(THREE.TextureLoader, [texture("grass.jpg"), texture("road.jpg"), texture("water.jpg")]);

const HEMISPHERES = {
  north: { title: "Résumé", subtitle: "work · learning · community", ground: "#f2c76a", cap: "#f6e6b8", crystal: "#ffc65c", edge: "#ffb547" },
  south: { title: "Open source", subtitle: "a district per language", ground: "#c9eab4", cap: "#d6eef7", crystal: "#5fe0c4", edge: "#3ff0d0" },
};

// --- light -------------------------------------------------------------------

// The black hole is the sun. A little cool fill keeps the night side legible.
// `shadows`: "off" | "low" (1024² map) | "high" (2048²).
export function Lighting({ R, shadows = "low" }) {
  const key = useRef();
  const fill = useRef();
  // Follow the black hole as it moves round the planet.
  useFrame(() => {
    blackHolePosition(R, key.current.position);
    fill.current.position.copy(key.current.position).multiplyScalar(-1);
  });
  return (
    <>
      <ambientLight intensity={0.38} color="#9aabff" />
      <hemisphereLight args={["#ffd9a8", "#1e2748", 0.35]} />
      <directionalLight
        ref={key}
        intensity={3.2}
        color="#ffcf98"
        castShadow={shadows !== "off"}
        shadow-mapSize={shadows === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-R * 1.15}
        shadow-camera-right={R * 1.15}
        shadow-camera-top={R * 1.15}
        shadow-camera-bottom={-R * 1.15}
        shadow-camera-near={R * 0.5}
        shadow-camera-far={R * 5}
      />
      {/* Starlight from the far side. */}
      <directionalLight ref={fill} intensity={0.22} color="#7f9cff" />
    </>
  );
}

// --- planet ------------------------------------------------------------------

export function Planet({ layout, atmosphere = true }) {
  const R = layout.radius;
  const grass = useLoader(THREE.TextureLoader, texture("grass.jpg"));
  const snowLat = layout.mountains.edge / R;

  // South: plain grass. North: the same texture desaturated, so the gold
  // tint reads as a wheat field rather than olive grass.
  const ground = useDisposable(() => {
    const prep = (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set((2 * Math.PI * R) / 10, (Math.PI * R) / 2 / 10);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.needsUpdate = true;
      return t;
    };
    const canvas = document.createElement("canvas");
    canvas.width = grass.image.width;
    canvas.height = grass.image.height;
    const ctx = canvas.getContext("2d");
    ctx.filter = "grayscale(1) brightness(1.5) contrast(0.9)";
    ctx.drawImage(grass.image, 0, 0);
    return { south: prep(grass.clone()), north: prep(new THREE.CanvasTexture(canvas)) };
  }, [grass, R]);

  // The ground isn't a perfect sphere: every vertex is pushed out (or in) by
  // the terrain, which is flat under roads, towns and water (lib/terrain).
  const shells = useDisposable(
    () =>
      Object.fromEntries(
        ["north", "south"].map((side) => {
          const g = new THREE.SphereGeometry(R, 256, 64, 0, Math.PI * 2, side === "north" ? 0 : Math.PI / 2, Math.PI / 2);
          const pos = g.attributes.position;
          const v = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            const len = v.length();
            const lat = Math.asin(THREE.MathUtils.clamp(v.y / len, -1, 1));
            const lon = Math.atan2(v.x, v.z);
            const h = terrainAt(layout, lon * R, -lat * R);
            if (h) pos.setXYZ(i, ...v.multiplyScalar((R + h) / len).toArray());
          }
          g.computeVertexNormals();
          return [side, g];
        })
      ),
    [layout, R]
  );

  return (
    <group>
      {["north", "south"].map((side) => (
        <mesh key={side} geometry={shells[side]} receiveShadow castShadow={false}>
          <meshStandardMaterial map={ground[side]} color={HEMISPHERES[side].ground} roughness={0.95} />
        </mesh>
      ))}
      {/* A snowfield under the southern mountains (the north pole is sea,
          see Poles.jsx), and a crystal floating high over each pole as a
          landmark. */}
      <mesh receiveShadow>
        <sphereGeometry args={[R + 0.15, 64, 10, 0, Math.PI * 2, Math.PI / 2 + snowLat, Math.PI / 2 - snowLat]} />
        <meshStandardMaterial color={HEMISPHERES.south.cap} roughness={0.4} emissive={HEMISPHERES.south.cap} emissiveIntensity={0.08} />
      </mesh>
      {["north", "south"].map((side) => {
        const sign = side === "north" ? 1 : -1;
        const h = HEMISPHERES[side];
        return (
          <mesh key={side} position={[0, sign * (R + (side === "north" ? 15 : MOUNTAIN_HEIGHT * 1.6 + 12)), 0]} rotation-x={side === "north" ? 0 : Math.PI} castShadow>
            <octahedronGeometry args={[5, 0]} />
            <meshStandardMaterial color={h.crystal} emissive={h.crystal} emissiveIntensity={0.9} metalness={0.2} roughness={0.15} flatShading />
          </mesh>
        );
      })}
      {atmosphere && <Atmosphere R={R} />}
    </group>
  );
}

// A thin glowing shell: warm where the black hole lights it, faint blue rim elsewhere.
function Atmosphere({ R }) {
  const material = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { sun: { value: SUN_DIRECTION }, shell: { value: R * 1.06 } },
        vertexShader: /* glsl */ `
          varying vec3 vNormal; varying vec3 vView;
          void main() {
            vNormal = normalize(mat3(modelMatrix) * normal);
            vec4 world = modelMatrix * vec4(position, 1.0);
            vView = normalize(cameraPosition - world.xyz);
            gl_Position = projectionMatrix * viewMatrix * world;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 sun; uniform float shell; varying vec3 vNormal; varying vec3 vView;
          void main() {
            // Only seen from space: fade out as the camera comes down through it.
            float outside = smoothstep(shell * 1.02, shell * 1.25, length(cameraPosition));
            // BackSide: the normal points inward, so flip it for the rim term.
            float rim = pow(1.0 - abs(dot(-vNormal, vView)), 3.0);
            float lit = clamp(dot(-vNormal, sun) * 0.5 + 0.5, 0.0, 1.0);
            vec3 col = mix(vec3(0.25, 0.4, 1.0), vec3(1.0, 0.7, 0.4), lit);
            float a = rim * (0.25 + 0.9 * lit) * outside;
            gl_FragColor = vec4(col * a, a);
          }`,
      }),
    [R]
  );
  return (
    <mesh material={material} renderOrder={1}>
      <sphereGeometry args={[R * 1.06, 64, 32]} />
    </mesh>
  );
}

/** Floating titles over each pole. Hidden when that pole is behind the planet. */
export function HemisphereLabels({ layout }) {
  const R = layout.radius;
  return ["north", "south"].map((side) => (
    <SurfaceLabel key={side} R={R} position={new THREE.Vector3(0, (side === "north" ? 1 : -1) * (R + 25), 0)}>
      <div className={`hemisphere-label ${side}`}>
        <strong>{HEMISPHERES[side].title}</strong>
        <span>{HEMISPHERES[side].subtitle}</span>
      </div>
    </SurfaceLabel>
  ));
}

function SurfaceLabel({ R, position, children, fadeWhen }) {
  const el = useRef();
  useFrame(({ camera }) => {
    if (!el.current) return;
    let opacity = visibleFrom(position, camera, R) ? 1 : 0;
    if (opacity && fadeWhen) opacity = fadeWhen(camera.position.distanceTo(position));
    const display = opacity > 0 ? "" : "none";
    if (el.current.style.display !== display) el.current.style.display = display;
    el.current.style.opacity = String(opacity);
  });
  return (
    <Html position={position} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div ref={el}>{children}</div>
    </Html>
  );
}

// --- roads & river ------------------------------------------------------------

export function Roads({ layout }) {
  const R = layout.radius;
  const base = useLoader(THREE.TextureLoader, texture("road.jpg"));
  const map = useDisposable(() => {
    const t = base.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [base]);

  // One mesh for every minor road, one for the highway, one per glowing edge.
  // Minor roads sit a little lower than the highway, so where a spur runs into
  // it the highway cleanly covers the overlap. Near bridges the ribbons are
  // resampled finely and lifted onto the arched deck.
  const geo = useDisposable(() => {
    const lift = (points, h) => {
      const fine = densify(layout, points);
      return [fine, fine.map(([x, z]) => h + bridgeElevation(layout, x, z))];
    };
    const minor = layout.roads
      .filter((r) => r.kind !== "highway")
      .map((r) => {
        const [pts, hs] = lift(r.points, 0.15);
        return ribbonGeometry(R, pts, r.halfWidth, hs, 1 / (r.halfWidth * 2));
      });
    const highway = layout.roads.find((r) => r.kind === "highway");
    const out = { minor: minor.length ? mergeGeometries(minor) : null };
    minor.forEach((g) => g.dispose());
    if (highway) {
      const [pts, hs] = lift(highway.points, 0.22);
      out.highway = ribbonGeometry(R, pts, highway.halfWidth, hs, 1 / (highway.halfWidth * 2));

      // Spurs flare into the highway with curved kerbs, like the roundabouts.
      const joins = highwayJunctions(layout, { fillet: 4 });
      const flares = [];
      const kerbs = { north: [], south: [] };
      for (const j of joins) {
        for (const f of j.fillets) {
          flares.push(outlineGeometry(R, f.area, 0.2));
          kerbs[j.side < 0 ? "north" : "south"].push(ribbonGeometry(R, f.kerb, 0.25, 0.26, 1));
        }
      }
      out.flares = flares.length ? mergeGeometries(flares) : null;
      flares.forEach((g) => g.dispose());

      // The highway is the hemisphere divide: gold edge on the résumé side,
      // teal on the open-source side, opening where each spur joins and
      // curving round its kerbs into the spur.
      const W = layout.width;
      const edge = (side) => {
        const gaps = [];
        for (const j of joins.filter((j) => j.side === side)) {
          gaps.push([j.from, j.to]);
          if (j.from < -W / 2) gaps.push([j.from + W, j.to + W]);
          if (j.to > W / 2) gaps.push([j.from - W, j.to - W]);
        }
        const dz = side * (highway.halfWidth + 0.35);
        const parts = openRuns(-W / 2, W / 2, gaps).map(([a, b]) => {
          const n = Math.max(1, Math.ceil((b - a) / 1.5));
          const run = densify(layout, Array.from({ length: n + 1 }, (_, i) => [a + ((b - a) * i) / n, dz]));
          return ribbonGeometry(R, run, 0.25, run.map(([x, z]) => 0.26 + bridgeElevation(layout, x, z)), 1);
        });
        const list = [...parts, ...kerbs[side < 0 ? "north" : "south"]];
        const merged = mergeGeometries(list);
        list.forEach((g) => g.dispose());
        return merged;
      };
      out.north = edge(-1);
      out.south = edge(1);
    }
    return out;
  }, [layout, R]);

  return (
    <>
      {geo.minor && (
        <mesh geometry={geo.minor} receiveShadow>
          <meshStandardMaterial map={map} />
        </mesh>
      )}
      {geo.flares && (
        <mesh geometry={geo.flares} receiveShadow>
          <meshStandardMaterial map={map} />
        </mesh>
      )}
      {geo.highway && (
        <mesh geometry={geo.highway} receiveShadow>
          <meshStandardMaterial map={map} />
        </mesh>
      )}
      {geo.north && (
        <mesh geometry={geo.north}>
          <meshStandardMaterial color={HEMISPHERES.north.edge} emissive={HEMISPHERES.north.edge} emissiveIntensity={1.6} />
        </mesh>
      )}
      {geo.south && (
        <mesh geometry={geo.south}>
          <meshStandardMaterial color={HEMISPHERES.south.edge} emissive={HEMISPHERES.south.edge} emissiveIntensity={1.6} />
        </mesh>
      )}
      <Bridges layout={layout} />
    </>
  );
}

/** Resamples a polyline to ≤ 0.8-unit steps wherever it's near a bridge, so the deck can arch smoothly. */
function densify(layout, points) {
  const near = (x, z) => layout.bridges.some((b) => Math.hypot(wrapDelta(b.x - x, layout.width), b.z - z) < b.span / 2 + 14);
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [x0, z0] = points[i - 1];
    const [x1, z1] = points[i];
    if (near(x0, z0) || near(x1, z1)) {
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.8);
      for (let k = 1; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n]);
    }
    out.push(points[i]);
  }
  return out;
}

export function River({ layout, animate = true }) {
  const R = layout.radius;
  const water = useLoader(THREE.TextureLoader, texture("water.jpg"));
  const { river } = layout;
  const map = useDisposable(() => {
    const t = water.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [water]);
  const geo = useDisposable(() => {
    const water = ribbonGeometry(R, river.points, river.widths, 0.06, 1 / 14);
    // Fresh, pale water below the falls deepening to the sea's blue at the
    // mouth, so the river runs into the sea without a seam.
    const rows = river.points.length;
    const cols = water.attributes.position.count / rows;
    const fresh = new THREE.Color(RIVER_COLOR);
    const salt = new THREE.Color(SEA_COLOR);
    const c = new THREE.Color();
    const colors = new Float32Array(rows * cols * 3);
    for (let i = 0; i < rows; i++) {
      c.copy(fresh).lerp(salt, THREE.MathUtils.smoothstep(i / (rows - 1), 0.82, 1));
      for (let k = 0; k < cols; k++) colors.set([c.r, c.g, c.b], (i * cols + k) * 3);
    }
    water.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const banks = ribbonGeometry(R, river.points, river.widths.map((w) => w + 1.4), 0.03, 1 / 14);
    return { water, banks };
  }, [river, R]);
  // The water flows downstream (the ribbon runs in flow order), to the sea.
  useFrame((_, delta) => {
    if (animate) map.offset.y = (map.offset.y - delta * 0.08) % 1;
  });

  return (
    <>
      <mesh geometry={geo.banks} receiveShadow>
        <meshStandardMaterial color="#b8a27a" roughness={1} />
      </mesh>
      <mesh geometry={geo.water} receiveShadow>
        <meshStandardMaterial map={map} vertexColors emissive="#1aa7d8" emissiveIntensity={0.22} roughness={0.15} metalness={0.1} />
      </mesh>
    </>
  );
}

function paint(geometry, color) {
  const c = new THREE.Color(color);
  const n = geometry.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(arr, 3));
}

// Every bridge in one mesh: the arched deck's stone underside and approach
// embankments, piers in the water, and railings that follow the arch.
function Bridges({ layout }) {
  const R = layout.radius;
  const geometry = useDisposable(() => {
    const parts = [];
    const box = new THREE.BoxGeometry(1, 1, 1);
    // A box centred `h` up at (x, z), `len` long along the bridge, tilted by `pitch`.
    const place = (x, z, h, sx, sy, sz, angle, color, pitch = 0) => {
      const m = surfaceMatrix(R, x, z, h, angle).multiply(new THREE.Matrix4().makeRotationX(pitch)).multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
      const g = box.clone().applyMatrix4(m);
      paint(g, color);
      parts.push(g);
    };
    for (const bridge of layout.bridges) {
      const ux = Math.sin(bridge.angle);
      const uz = Math.cos(bridge.angle);
      const ramp = bridge.span / 2 + 9;
      const deckAt = (t) => BRIDGE_HEIGHT * (0.5 + 0.5 * Math.cos((Math.PI * Math.min(Math.abs(t), ramp)) / ramp));
      const at = (t, off = 0) => [bridge.x + ux * t - uz * off, bridge.z + uz * t + ux * off];
      const step = 1.2;
      const wide = bridge.halfWidth * 2 + 1;
      for (let t = -ramp; t < ramp; t += step) {
        const mid = t + step / 2;
        const h = deckAt(mid);
        const pitch = -Math.atan2(deckAt(t + step) - deckAt(t), step);
        const [x, z] = at(mid);
        const overWater = Math.abs(mid) < bridge.span / 2;
        if (overWater) place(x, z, h - 0.35, wide, 0.7, step + 0.05, bridge.angle, "#8e877c", pitch);
        else if (h > 0.08) place(x, z, (h - 0.02) / 2, wide, h, step + 0.05, bridge.angle, "#9d9483", pitch); // embankment
        // Railings: a low parapet with a glowing-white top rail along the raised part.
        if (h > 0.4) {
          for (const side of [-1, 1]) {
            const [px, pz] = at(mid, side * (bridge.halfWidth + 0.3));
            place(px, pz, h + 0.35, 0.3, 0.7, step + 0.05, bridge.angle, "#b9b1a2", pitch);
            place(px, pz, h + 0.75, 0.36, 0.12, step + 0.05, bridge.angle, "#efe9dc", pitch);
          }
        }
      }
      // Piers: one at each bank and, on wide crossings, one midstream.
      const piers = bridge.span > 16 ? [-0.5, 0, 0.5] : [-0.5, 0.5];
      for (const f of piers) {
        const t = f * (bridge.span - 2);
        const h = deckAt(t);
        const [x, z] = at(t);
        place(x, z, h / 2 - 0.3, wide * 0.8, h + 0.6, 1.1, bridge.angle, "#7d766b");
      }
    }
    box.dispose();
    const merged = parts.length ? mergeGeometries(parts) : null;
    parts.forEach((g) => g.dispose());
    return merged;
  }, [layout.bridges, R]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  );
}

// --- districts -----------------------------------------------------------------

export function Districts({ layout, driving, labels = true }) {
  const R = layout.radius;
  // Shared parts of every town, merged: district paving (one mesh per
  // hemisphere colour), the roundabout's asphalt ring, its white lane
  // markings and the island kerbs. Islands stay separate so each can glow in
  // its district's colour.
  const geo = useDisposable(() => {
    const ring = PLAZA_RADIUS - 0.5;
    const merge = (list) => {
      const out = list.length ? mergeGeometries(list) : null;
      list.forEach((g) => g.dispose());
      return out;
    };
    const paving = { north: [], south: [] };
    const asphalt = [];
    const markings = [];
    const kerbs = [];
    const islands = [];
    for (const c of layout.cities) {
      paving[c.side === "north" ? "north" : "south"].push(discGeometry(R, c.x, c.z, c.radius + 1.5, 0.06, 64, 5));
      asphalt.push(annulusGeometry(R, c.x, c.z, ROUNDABOUT_ISLAND, ring, 0.17, 72));
      markings.push(annulusGeometry(R, c.x, c.z, (ROUNDABOUT_ISLAND + ring) / 2 - 0.08, (ROUNDABOUT_ISLAND + ring) / 2 + 0.08, 0.18, 0, 16));
      kerbs.push(annulusGeometry(R, c.x, c.z, ROUNDABOUT_ISLAND - 0.05, ROUNDABOUT_ISLAND + 0.3, 0.24, 48));
      islands.push(discGeometry(R, c.x, c.z, ROUNDABOUT_ISLAND, 0.22, 40, 2));
    }
    // Road mouths flare into the ring with curved kerbs (see lib/junctions).
    // The ring's solid edge line opens where each road comes in, and the
    // kerb arcs carry the line round into the road edges.
    for (const j of roundaboutJunctions(layout, { ring, fillet: 3 })) {
      for (const f of j.fillets) {
        asphalt.push(outlineGeometry(R, f.area, 0.165));
        markings.push(ribbonGeometry(R, f.kerb, 0.1, 0.18, 1));
      }
      for (const [start, end] of openArcs(j.mouths)) {
        markings.push(arcBandGeometry(R, j.x, j.z, ring - 0.45, ring - 0.25, 0.18, start, end, Math.max(4, Math.ceil((end - start) * 12))));
      }
    }
    return {
      north: merge(paving.north),
      south: merge(paving.south),
      asphalt: merge(asphalt),
      markings: merge(markings),
      kerbs: merge(kerbs),
      islands,
    };
  }, [layout.cities, R]);

  // Islands glow after dark; the terminator moves, so check every frame.
  const islandMaterials = useRef([]);
  useFrame(() => {
    layout.cities.forEach((c, i) => {
      const m = islandMaterials.current[i];
      if (m) m.emissiveIntensity = THREE.MathUtils.lerp(1.1, 0.15, THREE.MathUtils.smoothstep(sunlightAt(R, c.x, c.z), -0.05, 0.12));
    });
  });

  return (
    <>
      {geo.north && (
        <mesh geometry={geo.north} receiveShadow>
          <meshStandardMaterial color="#e8dcc0" />
        </mesh>
      )}
      {geo.south && (
        <mesh geometry={geo.south} receiveShadow>
          <meshStandardMaterial color="#d4d6c8" />
        </mesh>
      )}
      {geo.asphalt && (
        <mesh geometry={geo.asphalt} receiveShadow>
          <meshStandardMaterial color="#2a2b30" roughness={0.9} />
        </mesh>
      )}
      {geo.markings && (
        <mesh geometry={geo.markings}>
          <meshStandardMaterial color="#f2f2ec" roughness={0.6} emissive="#ffffff" emissiveIntensity={0.08} />
        </mesh>
      )}
      {geo.kerbs && (
        <mesh geometry={geo.kerbs} receiveShadow>
          <meshStandardMaterial color="#c9c4b8" roughness={0.8} />
        </mesh>
      )}
      {layout.cities.map((city, i) => (
        <group key={city.id}>
          <mesh geometry={geo.islands[i]} receiveShadow>
            <meshStandardMaterial
              ref={(m) => {
                islandMaterials.current[i] = m;
              }}
              color={new THREE.Color().setHSL(city.hue, 0.45, 0.62)}
              emissive={new THREE.Color().setHSL(city.hue, 0.7, 0.5)}
              emissiveIntensity={0.15}
            />
          </mesh>
          {labels && <DistrictSign city={city} R={R} driving={driving} />}
        </group>
      ))}
    </>
  );
}

// Labels are DOM overlays, so they'd show through buildings and the planet.
// Hide them on the far side, and while driving keep only nearby ones.
function DistrictSign({ city, R, driving }) {
  const position = useMemo(() => surfacePoint(R, city.x, city.z, 6), [R, city.x, city.z]);
  const fade = useMemo(
    () => (driving ? (d) => THREE.MathUtils.clamp((city.radius + 45 - d) / 15, 0, 1) : null),
    [driving, city.radius]
  );
  return (
    <SurfaceLabel R={R} position={position} fadeWhen={fade}>
      <div className={`city-sign ${city.kind}`} style={{ "--hue": Math.round(city.hue * 360) }}>
        <strong>{city.language}</strong>
        <span>
          {city.projects.length} {city.unit}
          {city.projects.length === 1 ? "" : "s"}
        </span>
      </div>
    </SurfaceLabel>
  );
}

// --- trees -------------------------------------------------------------------

export function Trees({ layout }) {
  const trunks = useRef();
  const crowns = useRef();
  useLayoutEffect(() => {
    const R = layout.radius;
    const local = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    layout.trees.forEach((t, i) => {
      const base = surfaceMatrix(R, t.x, t.z, -0.1); // on the ground, terrain included
      const s = t.scale;
      local.compose(new THREE.Vector3(0, 0.9 * s, 0), q, new THREE.Vector3(s, s, s));
      trunks.current.setMatrixAt(i, base.clone().multiply(local));
      local.compose(new THREE.Vector3(0, 2.6 * s, 0), q, new THREE.Vector3(s, s * 1.15, s));
      crowns.current.setMatrixAt(i, base.clone().multiply(local));
    });
    for (const m of [trunks.current, crowns.current]) {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [layout]);

  const n = layout.trees.length;
  return (
    <group key={n}>
      <instancedMesh ref={trunks} args={[undefined, undefined, n]} castShadow>
        <cylinderGeometry args={[0.25, 0.35, 1.8, 6]} />
        <meshStandardMaterial color="#7a5230" />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, n]} castShadow receiveShadow>
        <icosahedronGeometry args={[1.4, 0]} />
        <meshStandardMaterial color="#3f7d4a" flatShading />
      </instancedMesh>
    </group>
  );
}

// --- billboards ------------------------------------------------------------------

// Roadside skill billboards. The text is real DOM laid onto the board in 3D.
export function Billboards({ layout }) {
  return layout.billboards.map((b) => <Billboard key={b.item.id} board={b} R={layout.radius} />);
}

const BOARD_W = 7;
const BOARD_H = 4.2;
const BOARD_Y = 4.4;

function Billboard({ board, R }) {
  const content = useRef();
  const { matrix, pos, normal } = useMemo(() => {
    const { east, south } = frameAt(R, board.x, board.z);
    return {
      matrix: surfaceMatrix(R, board.x, board.z, 0, board.rotation),
      pos: surfacePoint(R, board.x, board.z, BOARD_Y),
      normal: new THREE.Vector3()
        .fromArray(east)
        .multiplyScalar(Math.sin(board.rotation))
        .add(new THREE.Vector3().fromArray(south).multiplyScalar(Math.cos(board.rotation))),
    };
  }, [R, board.x, board.z, board.rotation]);
  const toCamera = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const el = content.current;
    if (!el) return;
    toCamera.subVectors(camera.position, pos);
    // Hidden boards must leave layout entirely (not just opacity 0): a CSS 3D
    // layer seen edge-on, from behind or up close gets an enormous projected
    // size and the compositor grinds to a halt rasterizing it.
    const d = toCamera.length();
    const facing = toCamera.dot(normal) / d > 0.25 && visibleFrom(pos, camera, R);
    const opacity = facing && d > 5 ? THREE.MathUtils.clamp((90 - d) / 30, 0, 1) : 0;
    const display = opacity > 0 ? "" : "none";
    if (el.style.display !== display) el.style.display = display;
    el.style.opacity = String(opacity);
  });

  return (
    <group matrixAutoUpdate={false} matrix={matrix}>
      {[-BOARD_W / 2 + 0.6, BOARD_W / 2 - 0.6].map((x) => (
        <mesh key={x} position={[x, BOARD_Y / 2, -0.15]} castShadow>
          <boxGeometry args={[0.25, BOARD_Y, 0.25]} />
          <meshStandardMaterial color="#5b5f63" />
        </mesh>
      ))}
      <mesh position-y={BOARD_Y} castShadow receiveShadow>
        <boxGeometry args={[BOARD_W + 0.3, BOARD_H + 0.3, 0.2]} />
        <meshStandardMaterial color="#24403a" emissive="#0d2a22" emissiveIntensity={0.6} />
      </mesh>
      <Html transform position={[0, BOARD_Y, 0.11]} distanceFactor={10} zIndexRange={[5, 0]} pointerEvents="none">
        <div ref={content} className="billboard" style={{ display: "none" }}>
          <span className="billboard-label">Toolbox</span>
          <strong>{board.item.title}</strong>
          <ul>
            {board.item.items.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </Html>
    </group>
  );
}
