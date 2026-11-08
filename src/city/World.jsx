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
import { BRIDGE_HEIGHT, MOUNTAIN_HEIGHT, PLAZA_RADIUS, ROUNDABOUT_ISLAND, SURFACE_TOP, bridgeElevation, wrapDelta } from "../lib/layout";
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
  north: { ground: "#f2c76a", cap: "#f6e6b8", crystal: "#ffc65c", edge: "#ffb547" },
  south: { ground: "#c9eab4", cap: "#d6eef7", crystal: "#5fe0c4", edge: "#3ff0d0" },
};

// --- light -------------------------------------------------------------------

// The black hole is the sun. A little cool fill keeps the night side legible.
// `shadows`: "off" | "low" (1024² map) | "high" (2048²).
const LIGHT_DISTANCE = 3;

export function Lighting({ R, shadows = "low" }) {
  const key = useRef();
  const fill = useRef();
  // Follow the black hole as it moves round the planet. The light only needs its
  // direction, so it sits a few radii out, where its shadow camera can see the planet.
  useFrame(() => {
    key.current.position.copy(SUN_DIRECTION).multiplyScalar(R * LIGHT_DISTANCE);
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
        shadow-camera-near={R * (LIGHT_DISTANCE - 1.3)}
        shadow-camera-far={R * (LIGHT_DISTANCE + 1.3)}
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

// A soft glow around the planet: strongest at its edge and fading to nothing
// with height, warm where the sun lights it and faint blue elsewhere.
const AIR = 1.13; // how far out it reaches, in planet radii

function Atmosphere({ R }) {
  const material = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { sun: { value: SUN_DIRECTION }, ground: { value: R }, shell: { value: R * AIR } },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorld = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 sun; uniform float ground; uniform float shell; varying vec3 vWorld;
          void main() {
            // Only seen from space: fade out as the camera comes down through it.
            float outside = smoothstep(shell * 1.02, shell * 1.25, length(cameraPosition));
            // How close this line of sight passes to the planet's centre.
            vec3 view = normalize(vWorld - cameraPosition);
            float pass = length(cross(view, cameraPosition));
            float height = clamp((pass - ground) / (shell - ground), 0.0, 1.0);
            float glow = pow(1.0 - height, 2.4);
            // Which side of the planet that closest point is on.
            vec3 nearest = normalize(cameraPosition + view * dot(-cameraPosition, view));
            float lit = clamp(dot(nearest, sun) * 0.5 + 0.5, 0.0, 1.0);
            vec3 col = mix(vec3(0.25, 0.4, 1.0), vec3(1.0, 0.7, 0.4), lit);
            float a = glow * (0.3 + 0.8 * lit) * outside;
            gl_FragColor = vec4(col * a, a);
          }`,
      }),
    [R]
  );
  return (
    <mesh material={material} renderOrder={1}>
      <sphereGeometry args={[R * AIR, 64, 32]} />
    </mesh>
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
        const [pts, hs] = lift(r.points, SURFACE_TOP.road);
        return ribbonGeometry(R, pts, r.halfWidth, hs, 1 / (r.halfWidth * 2));
      });
    const highway = layout.roads.find((r) => r.kind === "highway");
    const out = { minor: minor.length ? mergeGeometries(minor) : null };
    minor.forEach((g) => g.dispose());
    if (highway) {
      const [pts, hs] = lift(highway.points, SURFACE_TOP.highway);
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
  // The water flows downstream, from the falls in the southern mountains to
  // the northern sea: the ribbon runs in flow order with v growing
  // downstream, and the map samples uv + offset, so a falling offset carries
  // the ripples towards the mouth (about 2.5 m/s, fast enough to read).
  useFrame((_, delta) => {
    if (animate) map.offset.y = (map.offset.y - delta * 0.18) % 1;
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
      paving[c.side === "north" ? "north" : "south"].push(discGeometry(R, c.x, c.z, c.radius + 1.5, SURFACE_TOP.paved, 64, 5));
      asphalt.push(annulusGeometry(R, c.x, c.z, ROUNDABOUT_ISLAND, ring, SURFACE_TOP.roundabout, 72));
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
// A small name tag over each district: its name and how many projects or
// landmarks it holds. From space they all show; while driving, only the ones
// nearby fade in.
function DistrictSign({ city, R, driving }) {
  const position = useMemo(() => surfacePoint(R, city.x, city.z, 6), [R, city.x, city.z]);
  const fade = useMemo(
    () => (driving ? (d) => THREE.MathUtils.clamp((city.radius + 45 - d) / 15, 0, 1) : null),
    [driving, city.radius]
  );
  const count = city.projects.length;
  return (
    <SurfaceLabel R={R} position={position} fadeWhen={fade}>
      <div
        className={`city-sign ${city.kind}`}
        style={{ "--hue": Math.round(city.hue * 360) }}
        title={`${city.language}: ${count} ${city.unit}${count === 1 ? "" : "s"}`}
      >
        <strong>{city.language}</strong>
        <span>{count}</span>
      </div>
    </SurfaceLabel>
  );
}

// Hidden on the far side of the planet; `fadeWhen(distance)` can fade it further.
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

// --- trees -------------------------------------------------------------------

// The kinds of tree, each one merged mesh (trunk and leaves, coloured per
// part). All about the same height as before (~3.5 m), so sight lines and
// collisions are unchanged.
function treePart(geometry, color, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1]) {
  const g = geometry.scale(sx, sy, sz).translate(x, y, z);
  const flat = g.index ? g.toNonIndexed() : g;
  if (flat !== g) g.dispose();
  flat.deleteAttribute("uv");
  flat.computeVertexNormals();
  const c = new THREE.Color(color);
  const colors = new Float32Array(flat.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return flat;
}
const TREE_KINDS = {
  broadleaf: () => [
    treePart(new THREE.CylinderGeometry(0.22, 0.32, 1.9, 6), "#6f4a2b", [0, 0.95, 0]),
    treePart(new THREE.IcosahedronGeometry(1.25, 0), "#3f7d4a", [0, 2.75, 0]),
    treePart(new THREE.IcosahedronGeometry(0.85, 0), "#4a8a50", [0.75, 2.35, 0.2]),
    treePart(new THREE.IcosahedronGeometry(0.8, 0), "#367043", [-0.6, 2.45, -0.35]),
  ],
  autumn: () => [
    treePart(new THREE.CylinderGeometry(0.22, 0.32, 1.9, 6), "#6f4a2b", [0, 0.95, 0]),
    treePart(new THREE.IcosahedronGeometry(1.25, 0), "#c9772c", [0, 2.75, 0]),
    treePart(new THREE.IcosahedronGeometry(0.85, 0), "#d99a35", [0.75, 2.35, 0.2]),
    treePart(new THREE.IcosahedronGeometry(0.8, 0), "#b4552a", [-0.6, 2.45, -0.35]),
  ],
  pine: () => [
    treePart(new THREE.CylinderGeometry(0.16, 0.24, 1.2, 6), "#5b3c24", [0, 0.6, 0]),
    treePart(new THREE.ConeGeometry(1.25, 1.5, 8), "#2c5a37", [0, 1.75, 0]),
    treePart(new THREE.ConeGeometry(0.95, 1.3, 8), "#306140", [0, 2.6, 0]),
    treePart(new THREE.ConeGeometry(0.62, 1.1, 8), "#356a45", [0, 3.35, 0]),
  ],
  birch: () => [
    treePart(new THREE.CylinderGeometry(0.12, 0.17, 2.7, 6), "#e4e0d4", [0, 1.35, 0]),
    treePart(new THREE.CylinderGeometry(0.175, 0.175, 0.12, 6), "#2b2b2b", [0, 0.9, 0]),
    treePart(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 6), "#2b2b2b", [0, 1.8, 0]),
    treePart(new THREE.IcosahedronGeometry(0.9, 0), "#6f9e46", [0, 3.15, 0], [0.95, 1.4, 0.95]),
  ],
  bush: () => [
    treePart(new THREE.IcosahedronGeometry(0.85, 0), "#3e6f37", [0, 0.6, 0]),
    treePart(new THREE.IcosahedronGeometry(0.65, 0), "#477d3e", [0.6, 0.5, 0.25]),
    treePart(new THREE.IcosahedronGeometry(0.6, 0), "#38653a", [-0.5, 0.45, -0.3]),
  ],
};
const KIND_NAMES = Object.keys(TREE_KINDS);

// A steady pseudo-random number in [0, 1) for a spot on the ground.
const spotNoise = (x, z, salt = 0) => {
  const v = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

// Which kind grows where: pines take over toward the poles, birches and bushes
// are scattered through, and the odd broadleaf has turned.
function treeKind(t, halfZ) {
  const north = Math.min(1, Math.abs(t.z) / halfZ);
  const r = spotNoise(t.x, t.z);
  const pines = 0.12 + 0.6 * Math.max(0, north - 0.3);
  if (r < pines) return "pine";
  if (r < pines + 0.14) return "birch";
  if (r < pines + 0.24) return "bush";
  if (r < pines + 0.29) return "autumn";
  return "broadleaf";
}

export function Trees({ layout }) {
  const refs = { broadleaf: useRef(), autumn: useRef(), pine: useRef(), birch: useRef(), bush: useRef() };
  const geometries = useDisposable(() => Object.fromEntries(KIND_NAMES.map((k) => [k, mergeGeometries(TREE_KINDS[k]())])), []);
  const material = useDisposable(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), []);
  const groups = useMemo(() => {
    const out = Object.fromEntries(KIND_NAMES.map((k) => [k, []]));
    for (const t of layout.trees) out[treeKind(t, layout.bounds.halfZ)].push(t);
    return out;
  }, [layout]);

  useLayoutEffect(() => {
    const R = layout.radius;
    const local = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const shade = new THREE.Color();
    for (const kind of KIND_NAMES) {
      const mesh = refs[kind].current;
      if (!mesh) continue;
      groups[kind].forEach((t, i) => {
        const base = surfaceMatrix(R, t.x, t.z, -0.1); // on the ground, terrain included
        const s = t.scale;
        // Turned and coloured a little differently each, so no two match.
        q.setFromAxisAngle(up, spotNoise(t.x, t.z, 1) * Math.PI * 2);
        local.compose(new THREE.Vector3(), q, new THREE.Vector3(s, s * (0.9 + 0.25 * spotNoise(t.x, t.z, 2)), s));
        mesh.setMatrixAt(i, base.multiply(local));
        const light = 0.86 + 0.28 * spotNoise(t.x, t.z, 3);
        mesh.setColorAt(i, shade.setRGB(light, light * (0.97 + 0.06 * spotNoise(t.x, t.z, 4)), light));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    // (refs is rebuilt each render, but always points at the same meshes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, groups]);

  return (
    <group key={layout.trees.length}>
      {KIND_NAMES.filter((k) => groups[k].length).map((k) => (
        <instancedMesh key={k} ref={refs[k]} args={[geometries[k], material, groups[k].length]} castShadow receiveShadow />
      ))}
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
