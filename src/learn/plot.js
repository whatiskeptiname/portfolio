// Plotting and timing helpers shared by the lesson simulations.
import { useEffect, useRef, useState } from "react";

export function scale([d0, d1], [r0, r1]) {
  const f = (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
  f.invert = (p) => d0 + ((p - r0) / (r1 - r0 || 1)) * (d1 - d0);
  return f;
}

export function linePath(points, sx, sy) {
  let d = "";
  let pen = false;
  for (const [x, y] of points) {
    if (y == null || Number.isNaN(y)) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
    pen = true;
  }
  return d;
}

export function bandPath(xs, lo, hi, sx, sy) {
  const top = xs.map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(hi[i]).toFixed(1)}`).join("");
  const bottom = xs
    .map((x, i) => [x, lo[i]])
    .reverse()
    .map(([x, y]) => `L${sx(x).toFixed(1)},${sy(y).toFixed(1)}`)
    .join("");
  return `${top}${bottom}Z`;
}

export const pct = (v, digits = 0) => `${(v * 100).toFixed(digits)}%`;
export const fix = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "–");

export const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useLoop(tick, running = true) {
  const ref = useRef(null);
  const latest = useRef(tick);
  latest.current = tick;
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!running || !visible) return;
    let frame = 0;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      latest.current(dt);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running, visible]);
  return ref;
}

export function useClock(running = true) {
  const [t, setT] = useState(0);
  const still = useRef(reducedMotion());
  const ref = useLoop((dt) => setT((v) => v + dt), running && !still.current);
  return [t, ref];
}

export function useReport(onState, state) {
  const key = JSON.stringify(state);
  const cb = useRef(onState);
  cb.current = onState;
  useEffect(() => {
    cb.current?.(JSON.parse(key));
  }, [key]);
}

export function svgPoint(svg, event) {
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

export function useDrag(onMove) {
  const svgRef = useRef(null);
  const handlers = {
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      onMove(svgPoint(svgRef.current, e), e, "start");
    },
    onPointerMove: (e) => {
      if (e.buttons === 1 || e.pointerType === "touch") onMove(svgPoint(svgRef.current, e), e, "move");
    },
  };
  return [svgRef, handlers];
}

export function frame(domain, rangePx) {
  return { f: scale(domain, rangePx), range: rangePx };
}
