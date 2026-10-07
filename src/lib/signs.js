// Where the street signs go. Pure, so it's testable; the scene draws them.
//
// Signs stand on the left-hand side of the road for the traffic they face
// (traffic keeps left, as in Nepal), a little outside the road edge. A sign's
// `yaw` uses the vehicle convention for the direction of the traffic it
// faces, so the scene can turn its face toward oncoming drivers.
//
// kinds:
//   exit   — green highway sign before each district turn-off, both directions
//   speed  — speed-limit roundel (highway and every turn-off)
//   shield — blue "EQ" route shield with the longitude, every 45°
//   guide  — brown country-lane sign: the next district and how far

import { HIGHWAY_HALF_WIDTH, PLAZA_RADIUS, inRiver, pointAlong, roadDistance, worldDistance } from "./layout";
import { CAR_LIMITS, KMH_PER_UNIT } from "./autopilot";

const EDGE = 1.4; // gap between road edge and sign post
const yawOf = (dx, dz) => Math.atan2(-dx, -dz);

/** Plane offset to the left of travel direction (dx, dz). */
function leftOf(dx, dz) {
  const l = Math.hypot(dx, dz) || 1;
  return [dz / l, -dx / l];
}

export function placeStreetSigns(world) {
  const signs = [];
  const highway = world.roads.find((r) => r.kind === "highway");
  const metres = (d) => (d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d / 10) * 10} m`); // 1 plane unit = 1 m

  // Exit signs: 14 units before each junction, for both directions.
  for (const spur of world.roads.filter((r) => r.kind === "spur")) {
    const city = world.cities[spur.from];
    const [jx] = spur.points.at(-1);
    for (const dir of [1, -1]) {
      const north = city.side === "north";
      signs.push({
        kind: "exit",
        x: jx - dir * 14,
        z: (dir > 0 ? -1 : 1) * (HIGHWAY_HALF_WIDTH + EDGE), // eastbound keep to the north side
        yaw: yawOf(dir, 0),
        text: city.language,
        // On the left (↖) or the right (↗) of the traffic this sign faces.
        arrow: north === dir > 0 ? "↖" : "↗",
        side: city.side,
        hue: city.hue,
      });
    }
    // Speed limit on the turn-off, facing traffic leaving the highway.
    const p = pointAlong(spur, 0.82);
    const travel = [-Math.sin(p.yaw + Math.PI), -Math.cos(p.yaw + Math.PI)];
    const [rx, rz] = leftOf(...travel);
    signs.push({
      kind: "speed",
      x: p.x + rx * (spur.halfWidth + EDGE),
      z: p.z + rz * (spur.halfWidth + EDGE),
      yaw: p.yaw + Math.PI,
      text: String(Math.round(CAR_LIMITS.road * KMH_PER_UNIT)),
    });
  }

  if (highway) {
    // Speed limits every 60°, eastbound (north) side; route shields every 45°, westbound (south) side.
    const R = world.radius;
    for (let i = 0; i < 6; i++) {
      const x = -Math.PI * R + ((i + 0.5) / 6) * world.width;
      signs.push({ kind: "speed", x, z: -(HIGHWAY_HALF_WIDTH + EDGE), yaw: yawOf(1, 0), text: String(Math.round(CAR_LIMITS.highway * KMH_PER_UNIT)) });
    }
    for (let i = 0; i < 8; i++) {
      const lonDeg = -135 + i * 45; // -135 … 180
      const x = (lonDeg / 180) * Math.PI * R;
      const label = lonDeg === 0 || lonDeg === 180 ? `${lonDeg}°` : `${Math.abs(lonDeg)}°${lonDeg > 0 ? "E" : "W"}`;
      signs.push({ kind: "shield", x, z: HIGHWAY_HALF_WIDTH + EDGE, yaw: yawOf(-1, 0), text: label });
    }
  }

  // Lane guides: a quarter of the way along, pointing on to the far end.
  for (const lane of world.roads.filter((r) => r.kind === "lane")) {
    for (const [t, forward] of [
      [0.22, true],
      [0.78, false],
    ]) {
      const p = pointAlong(lane, t);
      const yaw = forward ? p.yaw : p.yaw + Math.PI;
      const travel = [-Math.sin(yaw), -Math.cos(yaw)];
      const [rx, rz] = leftOf(...travel);
      const dest = world.cities[forward ? lane.to : lane.from];
      const remaining = lane.length * (forward ? 1 - t : t);
      signs.push({
        kind: "guide",
        x: p.x + rx * (lane.halfWidth + EDGE),
        z: p.z + rz * (lane.halfWidth + EDGE),
        yaw,
        text: dest.language,
        sub: metres(remaining),
        hue: dest.hue,
      });
    }
  }

  // Keep clear of every road surface (junctions!), billboards, buildings and the river.
  return signs.filter(
    (s) =>
      world.roads.every((r) => roadDistance(world, s.x, s.z, r, r.halfWidth + 0.6) === Infinity) &&
      !inRiver(world, s.x, s.z, 1) &&
      world.cities.every((c) => worldDistance(world, c.x, c.z, s.x, s.z) > PLAZA_RADIUS + 1.5) &&
      world.billboards.every((b) => worldDistance(world, b.x, b.z, s.x, s.z) > 4) &&
      world.buildings.every((b) => worldDistance(world, b.x, b.z, s.x, s.z) > 4)
  );
}
