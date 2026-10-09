// The case-study simulation player: one continuous, looping animation of a
// project's pipeline, with its main processes laid out on a timeline you
// can scrub. Loaded only when someone opens a simulation.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SIMS } from "./registry";
import "./sims.css";

// Playback runs a little faster than real time; every animation keeps its proportions.
const SPEED = 1.35;

/** Global time, looping over `total` seconds while `playing`. */
function useLoopClock(playing, total) {
  const [T, setT] = useState(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let id;
    const tick = (now) => {
      setT((v) => (v + Math.min(0.1, (now - last) / 1000) * SPEED) % total);
      last = now;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, total]);
  return [T, setT];
}

function Timeline({ stages, starts, total, T, onSeek, onScrub }) {
  const track = useRef();
  // Only a drag that starts on the timeline scrubs it (not one passing over it).
  const dragging = useRef(false);
  const seekFrom = (e) => {
    const r = track.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(total - 0.001, ((e.clientX - r.left) / r.width) * total)));
  };
  return (
    <div
      className="sim-timeline"
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label="Timeline"
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(T)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        onScrub(true);
        seekFrom(e);
      }}
      onPointerMove={(e) => dragging.current && seekFrom(e)}
      onPointerUp={() => {
        dragging.current = false;
        onScrub(false);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        onScrub(false);
      }}
    >
      {stages.map((s, i) => {
        const done = Math.max(0, Math.min(1, (T - starts[i]) / s.duration));
        const active = T >= starts[i] && T < starts[i] + s.duration;
        return (
          <div className={`sim-seg${active ? " is-active" : ""}`} key={s.title} style={{ flexGrow: s.duration }}>
            <span className="sim-seg-bar">
              <i style={{ width: `${done * 100}%` }} />
            </span>
            <span className="sim-seg-label">
              <b>{i + 1}</b> {s.title}
            </span>
          </div>
        );
      })}
      <span className="sim-playhead" style={{ left: `${(T / total) * 100}%` }} aria-hidden="true" />
    </div>
  );
}

export default function SimPlayer({ study, onClose }) {
  const sim = SIMS[study.id];
  const { starts, total } = useMemo(() => {
    let acc = 0;
    const out = sim.stages.map((s) => {
      const at = acc;
      acc += s.duration;
      return at;
    });
    return { starts: out, total: acc };
  }, [sim]);
  const [playing, setPlaying] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [T, setT] = useLoopClock(playing && !scrubbing, total);
  const stage = Math.max(0, starts.findLastIndex((s) => s <= T));
  const t = T - starts[stage];
  const current = sim.stages[stage];
  const dialog = useRef();
  const pressedBackdrop = useRef(false);

  const jump = useCallback((i) => setT(starts[(i + starts.length) % starts.length]), [setT, starts]);

  useEffect(() => {
    dialog.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") jump(stage + 1);
      else if (e.key === "ArrowLeft") jump(t > 0.6 ? stage : stage - 1);
      else if (e.key === " " && !["INPUT", "BUTTON", "SELECT"].includes(e.target.tagName)) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
    };
  }, [jump, stage, t, onClose]);

  const Sim = sim.Component;
  return (
    <div
      className="sim-backdrop"
      // Close only on a click that starts and ends on the backdrop: releasing a
      // camera drag outside the window mustn't count.
      onPointerDown={(e) => (pressedBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => pressedBackdrop.current && e.target === e.currentTarget && onClose()}
    >
      <div
        className="sim-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sim-title"
        tabIndex={-1}
        ref={dialog}
      >
        <header className="sim-head">
          <div>
            <p className="tile-label">{study.org}</p>
            <h2 id="sim-title">{study.title}</h2>
          </div>
          <button className="sim-close" onClick={onClose} aria-label="Close simulation">
            ✕
          </button>
        </header>

        <div className="sim-body">
          <Sim stage={stage} t={t} playing={playing && !scrubbing} />
        </div>

        <div className="sim-controls-row">
          <button className="sim-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? "❚❚" : "▶"}
          </button>
          <Timeline stages={sim.stages} starts={starts} total={total} T={T} onSeek={setT} onScrub={setScrubbing} />
        </div>

        <div className="sim-caption">
          <p>
            <strong>{current.title}.</strong> {current.text}
          </p>
          {current.cv != null && <blockquote>CV: &ldquo;{study.highlights[current.cv]}&rdquo;</blockquote>}
        </div>
        <p className="sim-note">
          Loops continuously · drag the timeline to scrub · {sim.three ? "drag the scene to rotate · " : ""}synthetic data, headline numbers from the CV.
        </p>
      </div>
    </div>
  );
}
