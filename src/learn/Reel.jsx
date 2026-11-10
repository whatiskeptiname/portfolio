// A short animated walkthrough at the top of a lesson: a few scenes, each with
// a caption that matches one of the lesson's "what to remember" points. It's
// drawn live (no video files), so it follows the theme and weighs nothing.
// It starts when you press play; with reduced motion, each scene shows its
// finished frame and you step through them.
import React, { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { reducedMotion, useLoop } from "./plot";
import { countOnce, here } from "../lib/visits";

export default function Reel({ scenes, title, method }) {
  const still = reducedMotion();
  const total = scenes.reduce((s, x) => s + x.duration, 0);
  const [time, setTime] = useState(0); // ms into the whole reel
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const ref = useLoop((dt) => {
    setTime((t) => {
      const next = t + dt * 1000;
      if (next >= total) {
        setPlaying(false);
        return total;
      }
      return next;
    });
  }, playing && !still);

  // Which scene we're in, and how far through it (0 to 1).
  let start = 0;
  let index = scenes.length - 1;
  for (let i = 0; i < scenes.length; i++) {
    if (time < start + scenes[i].duration || i === scenes.length - 1) {
      index = i;
      break;
    }
    start += scenes[i].duration;
  }
  const scene = scenes[index];
  const t = still ? 1 : Math.min(1, Math.max(0, (time - start) / scene.duration));
  const Scene = scene.Scene;
  const startOf = (i) => scenes.slice(0, i).reduce((s, x) => s + x.duration, 0);
  const done = time >= total;
  // Counts walkthroughs played, and played to the end (or stepped to the last scene).
  const finished = started && (still ? index === scenes.length - 1 : done);
  useEffect(() => {
    if (finished) countOnce("walkthrough", here(), "finished");
  }, [finished]);

  const play = () => {
    countOnce("walkthrough", here(), "played");
    setStarted(true);
    if (still) {
      setTime(startOf((index + (started ? 1 : 0)) % scenes.length));
      return;
    }
    if (done) setTime(0);
    setPlaying((p) => !p);
  };
  const jump = (i) => {
    setStarted(true);
    setTime(startOf(i) + (still ? 0 : 1));
  };

  return (
    <figure className="reel" ref={ref} aria-label={`Walkthrough: ${title}`}>
      {method && (
        <p className="reel-method">
          <strong>The method:</strong> {method}
        </p>
      )}
      <div className="reel-stage">
        {/* Before it starts, the first scene's finished frame is the poster. */}
        <Scene t={started ? t : 1} />
        {!started && (
          <button type="button" className="reel-start" onClick={play}>
            <span className="reel-start-icon">
              <Icon name="play" />
            </span>
            Watch the {Math.round(total / 1000)}-second version
          </button>
        )}
      </div>
      <figcaption className="reel-caption" aria-live="polite">
        <span className="reel-n">
          {index + 1} / {scenes.length}
        </span>
        <span key={index} className="reel-text">
          {scene.caption}
        </span>
      </figcaption>
      <div className="reel-controls">
        <button type="button" className="ctl-btn is-primary" onClick={play} aria-label={still ? "Next scene" : playing ? "Pause" : done ? "Replay" : "Play"}>
          <Icon name={still ? "right" : playing ? "pause" : "play"} />
          {still ? "Next" : playing ? "Pause" : done ? "Replay" : started ? "Play" : "Play"}
        </button>
        <div className="reel-progress" role="group" aria-label="Scenes">
          {scenes.map((s, i) => {
            const from = startOf(i);
            const fill = Math.min(1, Math.max(0, (time - from) / s.duration));
            return (
              <button key={i} type="button" className="reel-seg" onClick={() => jump(i)} aria-label={`Scene ${i + 1}: ${s.caption}`} style={{ flexGrow: s.duration }}>
                <span style={{ transform: `scaleX(${still ? (i <= index && started ? 1 : 0) : fill})` }} />
              </button>
            );
          })}
        </div>
      </div>
    </figure>
  );
}
