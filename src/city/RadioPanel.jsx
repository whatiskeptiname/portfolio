// src/city/RadioPanel.jsx — Planet Radio's UI. The panel picks stations and
// songs; the mini player (bottom-left) holds the actual YouTube player, which
// must stay visible while it plays, plus quick controls.
import React, { useEffect, useRef, useState } from "react";
import { watchUrl } from "../content/music";
import { formatTime, parseYouTubeId } from "../lib/music";
import { MY_MIX, PLAYER_ELEMENT_ID, radio } from "./radio";

/** Re-render whenever the radio changes, and tick while playing for the progress bar. */
function useRadio(tickMs = 0) {
  const [, setTick] = useState(0);
  useEffect(() => radio.subscribe(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    if (!tickMs) return;
    const id = setInterval(() => radio.playing && setTick((t) => t + 1), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return radio;
}

function Equaliser({ playing }) {
  return (
    <span className={`eq${playing ? " playing" : ""}`} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <i key={i} style={{ animationDelay: `${i * -0.23}s` }} />
      ))}
    </span>
  );
}

function Controls({ r, compact = false }) {
  return (
    <div className={`radio-controls${compact ? " compact" : ""}`}>
      {!compact && (
        <button aria-pressed={r.shuffle} onClick={() => r.setShuffle(!r.shuffle)} title="Shuffle" aria-label="Shuffle">
          ⤮
        </button>
      )}
      <button onClick={() => r.previous()} aria-label="Previous song" title="Previous">
        ⏮
      </button>
      <button className="radio-play" onClick={() => r.toggle()} aria-label={r.playing ? "Pause" : "Play"} title="Play / pause (M)">
        {r.loading ? "…" : r.playing ? "❚❚" : "▶"}
      </button>
      <button onClick={() => r.next()} aria-label="Next song" title="Next (N)">
        ⏭
      </button>
    </div>
  );
}

export function RadioPanel({ onClose, volume, onVolume }) {
  const r = useRadio(500);
  const station = r.stationData;
  const track = r.track;
  const { current, duration } = r.time;
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");

  const addLink = async (e) => {
    e.preventDefault();
    const id = parseYouTubeId(link);
    if (!id) {
      setLinkError("That doesn't look like a YouTube video link.");
      return;
    }
    setLinkError("");
    setLink("");
    await r.addToMix(id);
    if (r.station !== MY_MIX) r.setStation(MY_MIX);
  };

  return (
    <aside className="city-panel radio-panel" aria-label="Planet Radio" style={{ "--c1": station.colors[0], "--c2": station.colors[1] }}>
      <button className="city-panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <span className="city-panel-kicker">
        <Equaliser playing={r.playing} /> Planet Radio
      </span>

      <div className="radio-stations" role="radiogroup" aria-label="Stations">
        {r.stationList.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={s.id === r.station}
            className="radio-station"
            style={{ "--c1": s.colors[0], "--c2": s.colors[1] }}
            onClick={() => r.setStation(s.id)}
          >
            <strong>{s.name}</strong>
            <span>{s.id === MY_MIX ? `${s.tracks.length} song${s.tracks.length === 1 ? "" : "s"}` : s.tagline}</span>
          </button>
        ))}
      </div>

      {track ? (
        <>
          <div className="radio-meta">
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </div>
          <div
            className="radio-progress"
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(current)}
            tabIndex={0}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              r.seek((e.clientX - rect.left) / rect.width);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" && duration) r.seek(Math.min(1, (current + 10) / duration));
              if (e.key === "ArrowLeft" && duration) r.seek(Math.max(0, (current - 10) / duration));
            }}
          >
            <div style={{ width: `${duration ? (current / duration) * 100 : 0}%` }} />
          </div>
          <div className="radio-times">
            <span>{formatTime(current)}</span>
            <span>{duration ? formatTime(duration) : "--:--"}</span>
          </div>
          <div className="radio-row">
            <Controls r={r} />
            <input
              className="gfx-slider radio-volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onVolume(Number(e.target.value))}
              aria-label="Music volume"
              title="Music volume"
            />
          </div>
        </>
      ) : (
        <p className="gfx-note">My mix is empty — paste a YouTube link below to add a song.</p>
      )}
      {r.error && <p className="radio-error">{r.error}</p>}
      <label className="gfx-switch">
        <input type="checkbox" checked={r.hideVideo} onChange={(e) => r.setHideVideo(e.target.checked)} />
        <span>Hide the video (music only)</span>
      </label>

      <ol className="radio-tracks">
        {station.tracks.map((t, i) => (
          <li key={t.id}>
            <button aria-current={i === r.index} onClick={() => r.playTrack(station.id, i)}>
              <span className="radio-track-title">{t.title}</span>
              <span className="radio-track-artist">{t.artist}</span>
            </button>
            {station.id === MY_MIX ? (
              <button className="radio-remove" onClick={() => r.removeFromMix(t.id)} aria-label={`Remove ${t.title}`} title="Remove">
                ×
              </button>
            ) : (
              <a href={watchUrl(t)} target="_blank" rel="noopener noreferrer" title="Watch on YouTube" aria-label={`Watch ${t.title} on YouTube`}>
                ↗
              </a>
            )}
          </li>
        ))}
      </ol>

      <form className="radio-add" onSubmit={addLink}>
        <input
          type="text"
          inputMode="url"
          placeholder="Paste a YouTube link to add to My mix"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          aria-label="YouTube link"
        />
        <button type="submit">Add</button>
      </form>
      {linkError && <p className="radio-error">{linkError}</p>}
      <p className="gfx-note">
        Songs stream from the artists&rsquo; and labels&rsquo; official YouTube channels through YouTube&rsquo;s own player —
        nothing is downloaded. The player loads only after you press play.
      </p>
    </aside>
  );
}

/**
 * Holds the YouTube player. It appears once you start the radio (YouTube's
 * player has to stay visible while playing) with the song and quick controls.
 */
export function MiniPlayer({ onOpen }) {
  const r = useRadio();
  const active = Boolean(r.player || r.loading);
  const track = r.track;
  // YouTube swaps the target element for its iframe, so React must not own
  // it: create it by hand inside a slot React leaves empty.
  const slot = useRef();
  useEffect(() => {
    const host = slot.current;
    const el = document.createElement("div");
    el.id = PLAYER_ELEMENT_ID;
    host.appendChild(el);
    return () => {
      radio.stop();
      host.replaceChildren();
    };
  }, []);
  return (
    <div
      className={`mini-player${active ? "" : " idle"}${r.hideVideo ? " video-hidden" : ""}`}
      aria-hidden={!active}
      style={{ "--c1": r.stationData.colors[0], "--c2": r.stationData.colors[1] }}
    >
      <div className="mini-video" ref={slot} />
      {active && track && (
        <div className="mini-info">
          <button className="mini-title" onClick={onOpen} title="Open Planet Radio">
            <Equaliser playing={r.playing} />
            <span>
              <strong>{track.title}</strong>
              <em>{track.artist}</em>
            </span>
          </button>
          <Controls r={r} compact />
          <button
            className="mini-eye"
            onClick={() => r.setHideVideo(!r.hideVideo)}
            aria-pressed={r.hideVideo}
            aria-label={r.hideVideo ? "Show video" : "Hide video"}
            title={r.hideVideo ? "Show video" : "Hide video (music only)"}
          >
            {r.hideVideo ? "▣" : "▢"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Toolbar button that shows a live equaliser while playing. */
export function RadioButton({ open, onClick }) {
  const r = useRadio();
  return (
    <button className="city-btn radio-btn" onClick={onClick} aria-pressed={open} aria-label="Music" title="Music (M to play/pause)">
      {r.playing ? <Equaliser playing /> : "♫"}
    </button>
  );
}
