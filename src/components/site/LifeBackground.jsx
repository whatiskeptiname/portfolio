// Conway's Game of Life, quietly, behind the landing page: small squares that
// fade in when born, strengthen as they age, and leave a faint trace for a
// moment when they die (lib/life.js).
// Each universe starts from units scattered at random, then evolves by the real
// rules with nothing added. When too few are left in view, most have drifted out
// of bounds, or only still lifes and oscillators remain, a diagonal wave
// fades it out and fades the next one in. It rests while the tab is hidden or a
// simulation is open, and holds one still generation for reduced motion.
//
// Click and drag on the empty background to paint new cells: the simulation
// holds while the button is down, and the layer brightens so you can see them.
// A plain click, or a tap on a touch screen, plants a random cluster of 1 to 5.
import React, { useEffect, useRef } from "react";
import { censusOf, glowMap, linePoints, plantCells, randomCluster, seedUniverse, stepUniverse, universeEnd, watchUniverse } from "../../lib/life";

const TICK = 1400; // ms per generation
const FADE = 500; // ms of each generation spent fading; the rest is idle
const SEED_DENSITY = 0.16; // measured: at 5% universes die within a few generations
const MIN_UNITS_SHARE = 0.005; // of the cells in view; below this the universe is over
const MIN_UNITS = 6;
const CALM_LIMIT = 12; // generations of nothing new before a settled universe ends
const WAVE = 2600; // ms for a wave to cross the screen
const WAVE_WIDTH = 0.3; // how much of the screen it's resizing at once
const CELL = 14; // CSS pixels
const GAP = 2;

const DRAW_AFTERGLOW = 300; // ms the layer stays bright after drawing
// Where a press belongs to the page, not the background.
const NOT_BACKGROUND = [
  ".tile, .site-header, .site-footer, .section-head, .subheading, .sim-backdrop",
  // Plain sections: dragging over their words selects text.
  ".hero-grid > *, .results, .section-intro, .strengths, .ledger, .path, .path-alongside, .featured, .repos, .languages, .contact-email, .contact-links",
  "a, button, input, select, textarea, label",
].join(", ");

const clamp = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => t * t * (3 - 2 * t);

export default function LifeBackground() {
  const canvas = useRef();

  useEffect(() => {
    const el = canvas.current;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let cols = 0;
    let rows = 0;
    let now = new Map();
    let from = new Float32Array(0); // how strongly each cell showed a generation ago
    let to = new Float32Array(0); // and now
    let watch;
    let phase = "live"; // live -> wiping -> seeding -> live
    let phaseTime = 0;
    let colour = "#000";
    let lastFrame = null;
    let frame = 0;
    let idle = false;
    let drawing = null; // the cell the pointer was last on, while painting
    let moved = false;
    let tap = null; // a touch that may turn out to be a scroll
    let brightTimer = 0;

    const skin = () => {
      colour = getComputedStyle(el).getPropertyValue("--life-cell").trim();
      idle = false;
    };

    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      cols = Math.ceil(w / CELL);
      rows = Math.ceil(h / CELL);
      to = glowMap(now, cols, rows);
      from = to.slice();
      idle = false;
    };

    const draw = (t) => {
      const w = el.clientWidth;
      const dpr = el.width / w;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, el.clientHeight);
      ctx.fillStyle = colour;
      const live = phase === "live";
      const ease = live ? smooth(t) : 1;
      const size = CELL - GAP;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          let alpha = from[i] + (to[i] - from[i]) * ease;
          if (alpha < 0.01) continue;
          if (!live) {
            const passed = smooth(clamp((t * (1 + WAVE_WIDTH) - (x / cols + y / rows) / 2) / WAVE_WIDTH));
            alpha *= phase === "wiping" ? 1 - passed : passed;
            if (alpha < 0.01) continue;
          }
          ctx.globalAlpha = alpha;
          ctx.fillRect(x * CELL, y * CELL, size, size);
        }
      }
      ctx.globalAlpha = 1;
    };

    const seed = () => {
      watch = undefined;
      now = seedUniverse(cols, rows, Math.round(cols * rows * SEED_DENSITY));
      glowMap(now, cols, rows, null, to);
      from.set(to);
    };

    const nextGeneration = () => {
      now = stepUniverse(now);
      [from, to] = [to, from];
      glowMap(now, cols, rows, from, to);
      const c = censusOf(now, cols, rows);
      watch = watchUniverse(watch, c.signature);
      return universeEnd(c, watch.calm, { minUnits: Math.max(MIN_UNITS, Math.round(cols * rows * MIN_UNITS_SHARE)), calmLimit: CALM_LIMIT });
    };

    const advance = (dt) => {
      phaseTime += dt;
      // Hold the next generation while someone is painting.
      if (drawing && phase === "live") phaseTime = Math.min(phaseTime, TICK - 1);
      if (phase === "live") {
        if (phaseTime < TICK) return clamp(phaseTime / FADE);
        phaseTime -= TICK;
        idle = false;
        if (nextGeneration()) {
          from.set(to);
          phase = "wiping";
          phaseTime = 0;
        }
        return 0;
      }
      if (phaseTime < WAVE) return phaseTime / WAVE;
      phaseTime = 0;
      idle = false;
      if (phase === "wiping") {
        seed();
        phase = "seeding";
        return 0;
      }
      phase = "live";
      return 1;
    };

    const loop = (time) => {
      frame = requestAnimationFrame(loop);
      const dt = lastFrame === null ? 0 : Math.min(100, time - lastFrame);
      lastFrame = time;
      if (document.hidden || !cols || document.querySelector(".sim-backdrop")) return;
      const t = advance(dt);
      // Once the fades have finished nothing moves, so nothing needs drawing.
      if (phase === "live" && t >= 1 && idle) return;
      draw(t);
      idle = phase === "live" && t >= 1;
    };

    skin();
    fit();
    const observer = new ResizeObserver(() => {
      fit();
      if (still) draw(1);
    });
    observer.observe(el);
    const reskin = () => {
      skin();
      if (still) draw(1);
    };
    const themes = new MutationObserver(reskin);
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const system = window.matchMedia?.("(prefers-color-scheme: dark)");
    system?.addEventListener("change", reskin);

    const cellAt = (e) => [Math.floor(e.clientX / CELL), Math.floor(e.clientY / CELL)];

    const plant = (points) => {
      plantCells(now, points);
      for (const [x, y] of points) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const i = y * cols + x;
        from[i] = to[i] = 1;
      }
      idle = false;
    };

    const brighten = () => {
      clearTimeout(brightTimer);
      el.classList.add("is-drawing");
    };
    const relax = () => {
      clearTimeout(brightTimer);
      brightTimer = setTimeout(() => el.classList.remove("is-drawing"), DRAW_AFTERGLOW);
    };

    const finish = (clicked) => {
      if (!drawing) return;
      if (clicked && !moved) plant(randomCluster(drawing[0], drawing[1]));
      drawing = null;
      // What's on the board is new, so it isn't settled any more.
      watch = undefined;
      relax();
    };

    const press = (e) => {
      if (phase !== "live" || e.button !== 0) return;
      // The window's scrollbar reports presses on <html> too.
      if (e.clientX >= document.documentElement.clientWidth || e.target.closest?.(NOT_BACKGROUND)) return;
      if (e.pointerType === "touch") {
        tap = e.pointerId;
        return;
      }
      drawing = cellAt(e);
      moved = false;
      brighten();
      plant([drawing]);
    };
    const drag = (e) => {
      if (!drawing) return;
      const here = cellAt(e);
      if (here[0] === drawing[0] && here[1] === drawing[1]) return;
      plant(linePoints(drawing[0], drawing[1], here[0], here[1]));
      drawing = here;
      moved = true;
    };
    const release = (e) => {
      if (tap === e.pointerId) {
        tap = null;
        if (phase === "live") {
          brighten();
          plant(randomCluster(...cellAt(e)));
          watch = undefined;
          relax();
        }
      }
      finish(true);
    };
    const cancel = () => {
      tap = null;
      finish(false);
    };
    // Painting across some text mustn't select it.
    const noSelect = (e) => drawing && e.preventDefault();

    seed();
    if (still) {
      // One universe, evolved a while so real structures have formed, then held.
      for (let i = 0; i < 40; i++) nextGeneration();
      from.set(to);
      draw(1);
    } else {
      phase = "seeding";
      frame = requestAnimationFrame(loop);
      document.documentElement.classList.add("life-paintable");
      window.addEventListener("pointerdown", press);
      window.addEventListener("pointermove", drag, { passive: true });
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("blur", cancel);
      document.addEventListener("selectstart", noSelect);
    }

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(brightTimer);
      document.documentElement.classList.remove("life-paintable");
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointermove", drag);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("selectstart", noSelect);
      observer.disconnect();
      themes.disconnect();
      system?.removeEventListener("change", reskin);
    };
  }, []);

  return <canvas ref={canvas} className="life-bg" aria-hidden="true" />;
}
