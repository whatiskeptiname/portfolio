// src/city/Minimap.jsx — a little globe: the planet seen from straight above
// the vehicle (or from where the camera is, when looking around), with day
// and night shading from the black hole. Click it to swing the camera there.
import React, { useEffect, useRef } from "react";
import { CAR_LIMITS } from "../lib/autopilot";
import { surfaceAt } from "../lib/layout";
import { routeSpeeds, speedColor } from "../lib/routing";
import { lonLat } from "../lib/globe";
import { SUN_DIRECTION } from "./globe3d";

const SIZE = 236;
const PIXELS = 110; // the shaded disc is drawn at low resolution and scaled up

// Orthographic projection centred on (lon0, lat0). Returns screen x/y in
// [-1, 1] (y down) and whether the point is on the visible hemisphere.
function makeProjection(lon0, lat0) {
  const sl0 = Math.sin(lat0);
  const cl0 = Math.cos(lat0);
  const project = (lon, lat) => {
    const cl = Math.cos(lat);
    const dl = lon - lon0;
    const x = cl * Math.sin(dl);
    const y = cl0 * Math.sin(lat) - sl0 * cl * Math.cos(dl);
    const front = sl0 * Math.sin(lat) + cl0 * cl * Math.cos(dl);
    return { x, y: -y, front };
  };
  // Inverse: screen (x, y down) on the disc → lon/lat, or null off the disc.
  const unproject = (x, yDown) => {
    const y = -yDown;
    const rho = Math.hypot(x, y);
    if (rho > 1) return null;
    const c = Math.asin(rho);
    const lat = rho === 0 ? lat0 : Math.asin(Math.cos(c) * sl0 + (y * Math.sin(c) * cl0) / rho);
    const lon = lon0 + Math.atan2(x * Math.sin(c), rho * Math.cos(c) * cl0 - y * Math.sin(c) * sl0);
    return { lon, lat };
  };
  return { project, unproject };
}

export default function Minimap({ layout, vehicle, vehicleType, camera, driving, selectedId, onPick, showRoute = true, traffic }) {
  const canvasRef = useRef();
  const projRef = useRef(null);
  const R = layout.radius;
  const seaLat = layout.sea.shore / R;
  const mountainLat = layout.mountains.edge / R;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const shade = document.createElement("canvas");
    shade.width = shade.height = PIXELS;
    const sctx = shade.getContext("2d");
    const image = sctx.createImageData(PIXELS, PIXELS);
    const half = SIZE / 2;
    const radius = half - 3;
    let frame;

    const draw = () => {
      // Where are we looking from?
      let lon0;
      let lat0;
      if (driving) {
        ({ lon: lon0, lat: lat0 } = lonLat(R, vehicle.current.x, vehicle.current.z));
      } else {
        const p = camera.current.position;
        lon0 = Math.atan2(p.x, p.z);
        lat0 = Math.atan2(p.y, Math.hypot(p.x, p.z));
      }
      const proj = makeProjection(lon0, lat0);
      projRef.current = proj;
      const toScreen = (lon, lat) => {
        const q = proj.project(lon, lat);
        return { sx: half + q.x * radius, sy: half + q.y * radius, front: q.front };
      };

      // 1. Shaded disc: hemisphere colours, sea and mountains, day/night.
      const d = image.data;
      for (let j = 0; j < PIXELS; j++) {
        for (let i = 0; i < PIXELS; i++) {
          const k = (j * PIXELS + i) * 4;
          const g = proj.unproject((i + 0.5) / (PIXELS / 2) - 1, (j + 0.5) / (PIXELS / 2) - 1);
          if (!g) {
            d[k + 3] = 0;
            continue;
          }
          const cl = Math.cos(g.lat);
          const nx = cl * Math.sin(g.lon);
          const ny = Math.sin(g.lat);
          const nz = cl * Math.cos(g.lon);
          const sun = nx * SUN_DIRECTION.x + ny * SUN_DIRECTION.y + nz * SUN_DIRECTION.z;
          const light = 0.28 + 0.72 * Math.max(0, Math.min(1, sun * 1.6 + 0.15));
          let c;
          // The northern sea; the southern mountains, snowier toward the pole.
          if (g.lat > seaLat) c = [63, 143, 201];
          else if (g.lat > seaLat - 0.03) c = [222, 204, 160]; // beach
          else if (g.lat < -mountainLat) c = (-g.lat - mountainLat) / (Math.PI / 2 - mountainLat) > 0.35 ? [232, 238, 244] : [128, 120, 112];
          else c = g.lat > 0 ? [214, 178, 96] : [120, 176, 102];
          d[k] = c[0] * light;
          d[k + 1] = c[1] * light;
          d[k + 2] = c[2] * light;
          d[k + 3] = 255;
        }
      }
      sctx.putImageData(image, 0, 0);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, SIZE, SIZE);
      // Atmosphere glow.
      const glow = ctx.createRadialGradient(half, half, radius * 0.9, half, half, half);
      glow.addColorStop(0, "rgba(255, 190, 120, 0.5)");
      glow.addColorStop(1, "rgba(255, 190, 120, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(half, half, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(shade, half - radius, half - radius, radius * 2, radius * 2);

      // 2. Polylines (roads, river) — only the visible parts.
      const line = (points, color, w) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.lineCap = "round";
        ctx.beginPath();
        let pen = false;
        for (const [x, z] of points) {
          const { lon, lat } = lonLat(R, x, z);
          const s = toScreen(lon, lat);
          if (s.front <= 0) {
            pen = false;
            continue;
          }
          if (pen) ctx.lineTo(s.sx, s.sy);
          else ctx.moveTo(s.sx, s.sy);
          pen = true;
        }
        ctx.stroke();
      };
      line(layout.river.points, "#47c6f0", 2.5);
      for (const l of layout.sea.islands) {
        const { lon, lat } = lonLat(R, l.x, l.z);
        const q = toScreen(lon, lat);
        if (q.front <= 0) continue;
        ctx.fillStyle = "#ecdcae";
        ctx.beginPath();
        ctx.arc(q.sx, q.sy, Math.max(2, (l.r / R) * radius * q.front), 0, Math.PI * 2);
        ctx.fill();
      }
      for (const r of layout.roads) line(r.points, r.kind === "highway" ? "#2b2b33" : "#3b3b3b", r.kind === "highway" ? 2.6 : 1.4);

      // 3. Districts and buildings.
      for (const c of layout.cities) {
        const { lon, lat } = lonLat(R, c.x, c.z);
        const s = toScreen(lon, lat);
        if (s.front <= 0) continue;
        ctx.fillStyle = c.side === "north" ? "rgba(255, 246, 222, 0.85)" : "rgba(238, 240, 230, 0.8)";
        ctx.beginPath();
        ctx.arc(s.sx, s.sy, Math.max(2.5, ((c.radius + 1.5) / R) * radius * s.front), 0, Math.PI * 2);
        ctx.fill();
      }
      for (const b of layout.buildings) {
        const { lon, lat } = lonLat(R, b.x, b.z);
        const s = toScreen(lon, lat);
        if (s.front <= 0) continue;
        const sel = b.id === selectedId;
        ctx.fillStyle = sel ? "#ff9f1c" : `hsl(${b.hue * 360} 45% 40%)`;
        const size = sel ? 5 : 2;
        ctx.fillRect(s.sx - size / 2, s.sy - size / 2, size, size);
      }
      ctx.restore();

      // Other cars: little white dots.
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      for (const c of traffic?.current ?? []) {
        const ll = lonLat(R, c.x, c.z);
        const q = toScreen(ll.lon, ll.lat);
        if (q.front > 0) ctx.fillRect(q.sx - 1.2, q.sy - 1.2, 2.4, 2.4);
      }

      // 4. Where the autopilot is heading: the rest of the route, dashed,
      //    and a pulsing ring on the destination.
      const v = vehicle.current;
      if (v.route?.points?.length) {
        const from = Math.min((v.route.i ?? 0) + 1, v.route.points.length - 1);
        const rest = [[v.x, v.z], ...v.route.points.slice(from)];
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -performance.now() / 60;
        ctx.shadowBlur = 6;
        if (showRoute) {
          // Coloured by the speed the autopilot plans there (as in the 3D view).
          const cruise = v.autoSpeed ?? 7;
          const limitAt = v.route.kind === "road" ? (x, z) => CAR_LIMITS[surfaceAt(layout, x, z)] : undefined;
          const speeds = routeSpeeds(v.route, vehicleType, cruise, limitAt); // cached: shared with the 3D view
          for (let i = from; i < v.route.points.length; i++) {
            const [r, g, b] = speedColor(speeds[i], cruise).map((c) => Math.round(c * 255));
            ctx.shadowColor = `rgb(${r} ${g} ${b})`;
            line([i === from ? [v.x, v.z] : v.route.points[i - 1], v.route.points[i]], `rgb(${r} ${g} ${b})`, 2.6);
          }
        } else {
          ctx.shadowColor = "#4ff3ff";
          line(rest, "#4ff3ff", 2.4);
        }
        ctx.restore();
        const [ex, ez] = v.route.points.at(-1);
        const end = lonLat(R, ex, ez);
        const e = toScreen(end.lon, end.lat);
        if (e.front > 0) {
          const pulse = 4 + 2 * Math.sin(performance.now() / 250);
          ctx.strokeStyle = "#4ff3ff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(e.sx, e.sy, pulse + 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#4ff3ff";
          ctx.beginPath();
          ctx.arc(e.sx, e.sy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. The vehicle (always at the centre while driving).
      const { lon, lat } = lonLat(R, v.x, v.z);
      const s = toScreen(lon, lat);
      if (s.front > 0) {
        ctx.save();
        ctx.translate(s.sx, s.sy);
        ctx.rotate(-v.yaw);
        ctx.fillStyle = vehicleType === "car" ? "#e2483d" : "#1fb5a0";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(7, 7);
        ctx.lineTo(-7, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      // Rim + north marker.
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(half, half, radius, 0, Math.PI * 2);
      ctx.stroke();
      const north = toScreen(lon0, Math.PI / 2);
      if (north.front > 0) {
        ctx.fillStyle = "#fff";
        ctx.font = "700 12px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("N", north.sx, Math.max(10, north.sy - 3));
      }

      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [layout, vehicle, vehicleType, camera, driving, selectedId, R, seaLat, mountainLat, showRoute, traffic]);

  const pick = (e) => {
    const proj = projRef.current;
    if (!proj) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const radius = (rect.width / 2) * ((SIZE / 2 - 3) / (SIZE / 2));
    const x = (e.clientX - rect.left - rect.width / 2) / radius;
    const y = (e.clientY - rect.top - rect.height / 2) / radius;
    const g = proj.unproject(x, y);
    if (g) onPick(g.lon * R, -g.lat * R);
  };

  return (
    <canvas
      ref={canvasRef}
      className="city-minimap globe"
      style={{ width: SIZE, height: SIZE }}
      onClick={pick}
      aria-label="Globe map. Click to swing the camera there."
      role="img"
    />
  );
}
