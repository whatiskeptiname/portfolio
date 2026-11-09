// src/city/Hud.jsx — DOM overlays on top of the 3D canvas.
import React, { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon";
import { LanguageDot, Stars } from "../components/ProjectCard";
import { offerHigh, presetOf } from "../lib/graphics";
import { isLow } from "../lib/battery";
import { AUTO_SPEED, CAR_LIMITS, KMH_PER_UNIT, PILOT_DEFAULTS, PILOT_RULES, gearOf } from "../lib/autopilot";
import { VIEW } from "../lib/perception";
import { metres } from "../lib/decision";

export function Toolbar({
  mode,
  vehicle,
  view,
  onView,
  sound,
  onToggleSound,
  onLookAround,
  onVehicle,
  onHelp,
  onGraphics,
  graphicsOpen,
  onAutopilot,
  autopilotOpen,
  onExit,
  goTo,
  onScreenshot,
  onFullscreen,
  radioButton,
}) {
  const driving = mode === "drive";
  // On phones the camera views and tools fold away behind a "more" button.
  const [more, setMore] = useState(false);
  const bar = useRef();
  useEffect(() => {
    if (!more) return;
    const close = (e) => !bar.current?.contains(e.target) && setMore(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [more]);
  return (
    <div className={`city-toolbar${more ? " more-open" : ""}`} ref={bar}>
      <button className="city-btn" onClick={onExit} aria-label="Back to the portfolio">
        <Icon name="arrowLeft" /> <span className="wide-only">Portfolio</span>
      </button>
      <div className="city-toolbar-group" role="group" aria-label="How to explore">
        <button className="city-btn" aria-pressed={!driving} onClick={onLookAround} aria-label="Look around">
          <span className="wide-only">Look around</span>
          <span className="compact-only">Look</span>
        </button>
        <button className="city-btn" aria-pressed={driving && vehicle === "car"} onClick={() => onVehicle("car")}>
          Car
        </button>
        <button className="city-btn" aria-pressed={driving && vehicle === "drone"} onClick={() => onVehicle("drone")}>
          Drone
        </button>
      </div>
      {goTo}
      <div className="city-more" onClick={(e) => e.target.closest("button") && setMore(false)}>
        {driving && (
          <div className="city-toolbar-group" role="group" aria-label="Vehicle camera">
            <button className="city-btn" aria-pressed={view === "chase"} onClick={() => onView("chase")}>
              Chase
            </button>
            <button className="city-btn" aria-pressed={view === "fpv"} onClick={() => onView("fpv")} title="First person (T cycles views)">
              FPV
            </button>
            <button className="city-btn" aria-pressed={view === "eye"} onClick={() => onView("eye")}>
              Eye view
            </button>
          </div>
        )}
        <div className="city-toolbar-group icons" role="group" aria-label="Tools">
          {radioButton}
          <button className="city-btn" onClick={onScreenshot} aria-label="Take a screenshot (K)" title="Screenshot (K)">
            <Icon name="camera" />
          </button>
          <button className="city-btn" onClick={onFullscreen} aria-label="Toggle fullscreen" title="Fullscreen">
            <Icon name="expand" />
          </button>
          <button
            className="city-btn"
            onClick={onToggleSound}
            aria-pressed={sound}
            aria-label={sound ? "Mute sound" : "Turn sound on"}
            title={sound ? "Mute" : "Sound on"}
          >
            <Icon name={sound ? "sound" : "mute"} />
          </button>
          <button className="city-btn" onClick={onAutopilot} aria-pressed={autopilotOpen} aria-label="Autopilot settings" title="Autopilot">
            <Icon name="compass" />
          </button>
          <button className="city-btn" onClick={onGraphics} aria-pressed={graphicsOpen} aria-label="Settings" title="Settings">
            <Icon name="sliders" />
          </button>
          <button className="city-btn" onClick={onHelp} aria-label="Controls help" title="Help (H)">
            ?
          </button>
        </div>
      </div>
      <button className="city-btn city-more-btn" onClick={() => setMore((m) => !m)} aria-expanded={more} aria-label="More controls">
        ⋯
      </button>
    </div>
  );
}

/** Quick travel: every district, résumé first, each with its colour. */
export function GoToMenu({ cities, onGo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  const groups = [
    ["Résumé", cities.filter((c) => c.side === "north")],
    ["Open source", cities.filter((c) => c.side !== "north")],
  ];
  return (
    <div className="goto" ref={ref}>
      <button className="city-btn" aria-expanded={open} aria-label="Go to a district" onClick={() => setOpen((o) => !o)}>
        <Icon name="pin" /> <span className="wide-only">Go to</span>
      </button>
      {open && (
        <div className="goto-menu" role="menu">
          {groups.map(([title, list]) => (
            <div key={title}>
              <p className="goto-title">{title}</p>
              {list.map((c) => (
                <button
                  key={c.id}
                  role="menuitem"
                  className="goto-item"
                  style={{ "--hue": Math.round(c.hue * 360) }}
                  onClick={() => {
                    setOpen(false);
                    onGo(c);
                  }}
                >
                  <span className="goto-dot" />
                  {c.language}
                  <span className="goto-count">{c.projects.length}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 1 plane unit = 1 m (as everywhere: signs, the driver panel).
const tripDistance = (d) => metres(Math.max(1, d));

/**
 * Neon dial: speed (and gear for the car, altitude for the drone), with an
 * AUTO badge that also toggles the autopilot.
 */
export function Gauge({ vehicle, type, onToggleAuto, altitude = 12, onAltitude }) {
  const [v, setV] = useState({ speed: 0, alt: 0, auto: true, surface: "highway" });
  useEffect(() => {
    const id = setInterval(() => {
      const s = vehicle.current;
      setV({
        speed: s.speed,
        alt: s.alt,
        auto: Boolean(s.auto || s.route),
        // Steering by hand in auto mode: it takes over again when you let go.
        override: Boolean((s.auto || s.route) && performance.now() - (s.lastInput ?? 0) < 400),
        trip: s.route ? { label: s.route.label, tour: Boolean(s.route.tour), remaining: s.route.remaining ?? s.route.length } : null,
        transform: s.transform != null,
        surface: s.surface ?? "highway",
        holding: Boolean(s.holding) && Math.abs(s.speed) < 0.3,
      });
    }, 100);
    return () => clearInterval(id);
  }, [vehicle]);
  const max = type === "car" ? 300 / KMH_PER_UNIT : 42; // the car's dial reads to 300 km/h
  const kmh = Math.round(Math.abs(v.speed) * KMH_PER_UNIT);
  const frac = Math.min(1, Math.abs(v.speed) / max);
  // 240° sweep, from -210° to +30° (SVG angles, y down).
  const a0 = (-210 * Math.PI) / 180;
  const a = a0 + frac * ((240 * Math.PI) / 180);
  const r = 46;
  const arc = (from, to) => {
    const x1 = 60 + r * Math.cos(from);
    const y1 = 60 + r * Math.sin(from);
    const x2 = 60 + r * Math.cos(to);
    const y2 = 60 + r * Math.sin(to);
    const large = to - from > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  const g = gearOf(v.speed);
  const gear = v.holding ? "H" : g === -1 ? "R" : g === 0 ? "N" : String(g); // H: holding the brake
  const limit = Math.round(CAR_LIMITS[v.surface] * KMH_PER_UNIT);
  const surfaceName = { highway: "Highway", road: "Road", paved: "Paved", grass: "Off-road" }[v.surface];
  return (
    <div className={`gauge ${type}`}>
      <svg viewBox="0 0 120 104" aria-hidden="true">
        <defs>
          <linearGradient id="gauge-grad" x1="0" x2="1">
            <stop offset="0" stopColor="#4ff3ff" />
            <stop offset="0.6" stopColor="#ffd36b" />
            <stop offset="1" stopColor="#ff4d6d" />
          </linearGradient>
        </defs>
        <path d={arc(a0, a0 + (240 * Math.PI) / 180)} className="gauge-track" />
        {frac > 0.005 && <path d={arc(a0, a)} className="gauge-fill" stroke="url(#gauge-grad)" />}
        {Array.from({ length: 9 }, (_, i) => {
          const t = a0 + (i / 8) * ((240 * Math.PI) / 180);
          return (
            <line key={i} x1={60 + 38 * Math.cos(t)} y1={60 + 38 * Math.sin(t)} x2={60 + 42 * Math.cos(t)} y2={60 + 42 * Math.sin(t)} className="gauge-tick" />
          );
        })}
        <line x1="60" y1="60" x2={60 + 34 * Math.cos(a)} y2={60 + 34 * Math.sin(a)} className="gauge-needle" />
        <circle cx="60" cy="60" r="4" className="gauge-hub" />
        <text x="60" y="84" className="gauge-value">
          {kmh}
        </text>
        <text x="60" y="97" className="gauge-unit">
          km/h
        </text>
      </svg>
      <div className="gauge-side">
        {type === "car" ? (
          <>
            <span className="gauge-chip">
              GEAR <strong>{gear}</strong>
            </span>
            {/* Like a car's traffic-sign display: the limit for the surface you're on. */}
            <span className={`gauge-limit ${v.surface}`} title={`${surfaceName}: up to ${limit} km/h`}>
              <span className="gauge-roundel">{limit}</span>
              {surfaceName}
            </span>
          </>
        ) : (
          <>
            <span className="gauge-chip">
              ALT <strong>{Math.round(v.alt)}</strong> m
            </span>
            {/* Altitude hold: the height the drone flies at (0 lands). */}
            <span className="gauge-throttle" title="Altitude to hold (− / + keys, or hold Space / Shift)">
              <button onClick={() => onAltitude?.(-2)} aria-label="Fly lower">
                −
              </button>
              <span className="gauge-throttle-bar" style={{ "--throttle": altitude / 60 }}>
                <span>{altitude <= 0.05 ? "LAND" : `HOLD ${Math.round(altitude)} m`}</span>
              </span>
              <button onClick={() => onAltitude?.(2)} aria-label="Fly higher">
                +
              </button>
            </span>
          </>
        )}
        <button className="gauge-auto" aria-pressed={v.auto} onClick={onToggleAuto} title={v.trip && !v.trip.tour ? "Cancel trip (P)" : "Autopilot (P)"}>
          {v.override ? "YOU " : v.trip?.tour || (v.auto && !v.trip) ? "AUTO " : ""}
          {v.trip ? `→ ${v.trip.label} · ${tripDistance(v.trip.remaining)}` : v.auto ? "" : "MANUAL"}
        </button>
      </div>
    </div>
  );
}

/**
 * First-visit nudges, one line at the bottom: C switches between driving and
 * looking around, and sound is off until you want it. Each one leaves for good
 * once it's used.
 */
export function StartHint({ driving, sound, onToggle, onSound }) {
  const [first] = useState(driving);
  const [switched, setSwitched] = useState(false);
  const [heard, setHeard] = useState(sound);
  useEffect(() => void (driving !== first && setSwitched(true)), [driving, first]);
  useEffect(() => void (sound && setHeard(true)), [sound]);
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const showMode = !switched && !(touch && driving); // touch has the toolbar buttons right there
  const showSound = !heard && !sound;
  if (!showMode && !showSound) return null;
  return (
    <div className={`start-hint${driving ? " over-gauge" : ""}`}>
      {showMode && (
        <button className="start-chip" onClick={onToggle}>
          {touch ? "Tap to drive" : <><kbd>C</kbd> {driving ? "look around" : "to drive"}</>}
        </button>
      )}
      {showSound && (
        <button className="start-chip" onClick={onSound} aria-label="Turn sound on">
          <Icon name="mute" /> Sound off · turn on
        </button>
      )}
    </div>
  );
}

/**
 * On a device with a fast processor, suggest High graphics the first time the
 * planet opens, and never again: being asked once is remembered, whatever the
 * answer. Yes switches every setting to High.
 */
export function HighOffer({ settings, onAccept }) {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 0;
  const [declined, setDeclined] = useState(() => {
    try {
      return localStorage.getItem("city-high-offer") !== null;
    } catch {
      return false;
    }
  });
  const showing = offerHigh(settings, { cores, declined });
  // Asked once is enough: remember it as soon as the question appears.
  useEffect(() => {
    if (!showing) return;
    try {
      localStorage.setItem("city-high-offer", "asked");
    } catch {
      // Not remembered; it may ask again next time.
    }
  }, [showing]);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    if (!accepted) return;
    const id = setTimeout(() => setAccepted(false), 4000);
    return () => clearTimeout(id);
  }, [accepted]);
  if (accepted) {
    return (
      <div className="high-offer is-done" role="status">
        Switched to High. You can change it any time in Settings.
      </div>
    );
  }
  if (!showing) return null;
  const decline = () => {
    setDeclined(true);
    try {
      localStorage.setItem("city-high-offer", "no");
    } catch {
      // Not remembered; it will ask again next time.
    }
  };
  return (
    <div className="high-offer" role="dialog" aria-label="Graphics suggestion">
      <p>
        <strong>Your device has a fast processor ({cores} threads).</strong> Switch to High graphics for sharper shadows, the full black hole,
        a denser sky and busier roads?
      </p>
      <div className="high-offer-actions">
        <button
          className="start-chip is-primary"
          onClick={() => {
            onAccept();
            setAccepted(true);
          }}
        >
          Use High
        </button>
        <button className="start-chip" onClick={decline}>
          Not now
        </button>
      </div>
    </div>
  );
}

/** The keys for the vehicle you're in, shown while you drive or fly. */
export function KeyHints({ type, droneMode, hidden = false, inline = false }) {
  // Shown when you start driving or flying, and gone once you've been at the
  // wheel a few seconds (they're always in Help, under ?).
  return (
    <div className={`key-hints${inline ? " is-inline" : ""}${hidden ? " hidden" : ""}`} aria-hidden={inline ? undefined : "true"}>
      {type === "drone" && droneMode === "realistic" ? (
        <>
          <span>
            <kbd>W</kbd>
            <kbd>S</kbd> throttle
          </span>
          <span>
            <kbd>A</kbd>
            <kbd>D</kbd> yaw
          </span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> pitch
          </span>
          <span>
            <kbd>←</kbd>
            <kbd>→</kbd> roll
          </span>
        </>
      ) : (
        <>
          {type === "car" ? (
            <>
              <span>
                <kbd>W</kbd> drive
              </span>
              <span>
                <kbd>S</kbd> brake / reverse
              </span>
              <span>
                <kbd>Space</kbd> handbrake
              </span>
              <span>
                <kbd>L</kbd> cruise
              </span>
            </>
          ) : (
            <span>
              <kbd>W</kbd>
              <kbd>S</kbd> fly
            </span>
          )}
          <span>
            <kbd>A</kbd>
            <kbd>D</kbd> steer
          </span>
        </>
      )}
      {type === "drone" && droneMode !== "realistic" && (
        <span>
          <kbd>Space</kbd>
          <kbd>Shift</kbd> up/down
        </span>
      )}
      {type === "drone" && (
        <span>
          <kbd>−</kbd>
          <kbd>+</kbd> altitude
        </span>
      )}
      <span>
        <kbd>V</kbd> transform
      </span>
      <span>
        <kbd>P</kbd> autopilot
      </span>
      <span>
        <kbd>X</kbd> unstuck
      </span>
    </div>
  );
}

export function InfoPanel({ building, onClose }) {
  const { project } = building;
  const closeRef = useRef();
  useEffect(() => closeRef.current?.focus(), [building]);
  if (project.kind === "career") return <CareerPanel item={project} closeRef={closeRef} onClose={onClose} />;
  return (
    <aside className="city-panel" aria-label={`${project.title} details`}>
      <button ref={closeRef} className="city-panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <LanguageDot language={project.language} />
      <h2>{project.title}</h2>
      <p>{project.description || "No description yet."}</p>
      {project.topics.length > 0 && (
        <ul className="city-topics">
          {project.topics.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      <div className="city-panel-meta">
        <Stars count={project.stars} />
        {project.pushedAt && <span>Updated {project.pushedAt.slice(0, 7)}</span>}
      </div>
      <div className="city-panel-actions">
        <a className="btn btn-primary" href={project.url} target="_blank" rel="noopener noreferrer">
          View source <Icon name="external" />
        </a>
        {project.demo && (
          <a className="btn" href={project.demo} target="_blank" rel="noopener noreferrer">
            Live demo <Icon name="external" />
          </a>
        )}
      </div>
    </aside>
  );
}

function CareerPanel({ item, closeRef, onClose }) {
  return (
    <aside className="city-panel career" aria-label={`${item.title} details`}>
      <button ref={closeRef} className="city-panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <span className="city-panel-kicker">{item.category}</span>
      <h2>{item.title}</h2>
      <div className="city-panel-meta">
        <span>{item.subtitle}</span>
        {item.period && <span>{item.period}</span>}
      </div>
      {item.description && <p className="city-panel-metric">{item.description}</p>}
      {item.highlights.length > 0 && (
        <ul className="city-highlights">
          {item.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
      {item.topics.length > 0 && (
        <ul className="city-topics">
          {item.topics.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      <div className="city-panel-actions">
        <a className="btn" href={item.link}>
          Read on the portfolio
        </a>
      </div>
    </aside>
  );
}

export function HelpOverlay({ onClose, type = "car", droneMode }) {
  // Focus the button without scrolling to it: on a phone it's far below the title.
  const go = useRef();
  useEffect(() => go.current?.focus({ preventScroll: true }), []);
  return (
    <div className="city-help" role="dialog" aria-modal="true" aria-labelledby="city-help-title" onClick={onClose}>
      <div className="city-help-card" onClick={(e) => e.stopPropagation()}>
        {/* The controls first: what you came here for once you're driving. */}
        <section className="help-controls keys-only" aria-label="Controls">
          <h3>Controls · {type === "drone" ? "drone" : "car"}</h3>
          <KeyHints type={type} droneMode={droneMode} inline />
          <p className="help-shortcuts">
            <kbd>C</kbd> look around / drive · <kbd>T</kbd> chase / eye · <kbd>G</kbd> route plan · <kbd>O</kbd> inputs ·{" "}
            <kbd>K</kbd> screenshot · <kbd>M</kbd> music · <kbd>H</kbd> or <kbd>?</kbd> help · <kbd>Esc</kbd> close / exit
          </p>
        </section>
        <h2 id="city-help-title">Welcome to my planet</h2>
        <p>
          The <strong>northern hemisphere</strong> is my résumé: glass towers in the Work, Learning
          and Community districts. The <strong>southern hemisphere</strong> is GitHub, with one
          district per language and one building per repository (taller means more stars). A highway
          runs round the equator between them, a river winds from pole to pole, and billboards list
          my toolbox. The planet turns in front of a black hole — its only sun — on a time-lapse of
          your clock (a day every 12 minutes), so watch it rise and set.
        </p>
        <dl>
          <dt className="touch-only">On a touch screen</dt>
          <dd className="touch-only">
            Tap <strong>Car</strong> or <strong>Drone</strong> to drive. The arrows steer, and letting go hands back to the autopilot;
            in the car, hold <strong>Drift</strong> (the handbrake) with the accelerator and steer to slide;{" "}
            <strong>AUTO</strong> on the speedometer turns it off or on. <strong>⋯</strong> holds the camera views, music and settings.
          </dd>
          <dt>Look around</dt>
          <dd>Drag to spin the planet, scroll or pinch to zoom. Click a building to open it.</dd>
          <dt>Autopilot</dt>
          <dd>
            Your vehicle drives itself — round the equator, or touring every district (Settings). Steer any time to
            take over; let go and it carries on. <kbd>P</kbd> toggles it, <em>Go to</em> drives you to any
            district, and <kbd>G</kbd> shows how it plans the route and the speed it means to do.
          </dd>
          <dt>Car ↔ drone</dt>
          <dd>
            One vehicle that transforms: press <kbd>V</kbd> and watch the car rebuild itself into a drone
            and lift off — or the drone land and become the car again.
          </dd>
          <dt className="keys-only">Car</dt>
          <dd className="keys-only">
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> or arrow keys. Pull up to a building and press <kbd>E</kbd>.
            <kbd>L</kbd> locks your speed (cruise control); braking cancels it. Handbrake and accelerator together to
            drift — counter-steer to hold it.
          </dd>
          <dt className="keys-only">Drone</dt>
          <dd className="keys-only">
            A racing FPV quad: same keys to fly, <kbd>Space</kbd>/<kbd>R</kbd> to climb, <kbd>Shift</kbd>/<kbd>F</kbd>{" "}
            to descend. Fly over the river and rooftops — or over the poles.
          </dd>
          <dt>Cameras</dt>
          <dd>
            Drag while driving to look around; <kbd>T</kbd> switches to <em>Eye view</em> to circle the
            vehicle freely (scroll to zoom).
          </dd>
          <dt className="keys-only">Shortcuts</dt>
          <dd className="keys-only">
            <kbd>C</kbd> look around / drive · <kbd>V</kbd> car / drone · <kbd>T</kbd> chase / eye ·{" "}
            <kbd>P</kbd> autopilot · <kbd>X</kbd> unstuck · <kbd>K</kbd> screenshot · <kbd>M</kbd> music ·{" "}
            <kbd>N</kbd> next track · <kbd>H</kbd> help ·{" "}
            <kbd>Esc</kbd> close / exit
          </dd>
        </dl>
        <button className="btn btn-primary" onClick={onClose} ref={go}>
          Let&rsquo;s go
        </button>
      </div>
    </div>
  );
}

// On-screen pedals for touch devices; feeds the same key set as the keyboard.
export function TouchPad({ keys, flying }) {
  const bind = (control) => ({
    onPointerDown: (e) => {
      keys.current.add(control);
      try {
        e.currentTarget.setPointerCapture(e.pointerId); // keep it held if the finger slides off
      } catch {
        // (Some browsers refuse capture for synthetic or already-lifted pointers.)
      }
    },
    onPointerUp: () => keys.current.delete(control),
    onPointerCancel: () => keys.current.delete(control),
    onContextMenu: (e) => e.preventDefault(),
  });
  return (
    <div className="city-touchpad" aria-hidden="true">
      <div className="steer">
        <button {...bind("left")}><Icon name="left" /></button>
        <button {...bind("right")}><Icon name="right" /></button>
      </div>
      {flying && (
        <div className="pedals">
          <button {...bind("ascend")}><Icon name="ascend" /></button>
          <button {...bind("descend")}><Icon name="descend" /></button>
        </div>
      )}
      <div className="pedals">
        {/* In the car, the handbrake: hold it with the accelerator and steer to drift. */}
        {!flying && (
          <button className="tp-drift" {...bind("ascend")} aria-label="Handbrake (drift)">
            Drift
          </button>
        )}
        <button {...bind("up")}><Icon name="up" /></button>
        <button {...bind("down")}><Icon name="down" /></button>
      </div>
    </div>
  );
}

// --- graphics settings ---------------------------------------------------------

const SWITCHES = [
  ["atmosphere", "Atmosphere glow"],
  ["clouds", "Clouds"],
  ["labels", "District labels"],
  ["trees", "Trees"],
  ["windows", "Night-time windows"],
  ["signs", "Rooftop name signs"],
  ["billboards", "Skill billboards"],
  ["streetSigns", "Street signs"],
  ["lamps", "Street lamps"],
  ["water", "Flowing river & sea"],
];

function Choice({ label, value, options, onChange }) {
  return (
    <div className="gfx-row">
      <span>{label}</span>
      <div className="gfx-choice" role="group" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={String(v)} aria-pressed={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Presets plus individual switches. Switching something off unmounts it and
 * frees its GPU memory; the numbers at the top update live so you can see
 * what each change costs.
 */
export function GraphicsPanel({
  timeMode,
  onTimeMode,
  droneMode,
  onDroneMode,
  settings,
  onChange,
  stats,
  onClose,
  audioSettings,
  onAudioChange,
}) {
  const [live, setLive] = useState(stats.current);
  useEffect(() => {
    const id = setInterval(() => setLive({ ...stats.current }), 500);
    return () => clearInterval(id);
  }, [stats]);
  const preset = presetOf(settings);
  const set = (key) => (value) => onChange({ [key]: value });

  return (
    <aside className="city-panel gfx-panel" aria-label="Graphics settings">
      <button className="city-panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <span className="city-panel-kicker">Settings</span>
      <h2>Sound &amp; graphics</h2>

      <h3>Audio</h3>
      <div className="gfx-row">
        <span>Volume</span>
        <input
          className="gfx-slider"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={audioSettings.enabled ? audioSettings.master : 0}
          onChange={(e) => onAudioChange({ master: Number(e.target.value), enabled: Number(e.target.value) > 0 })}
          aria-label="Volume"
        />
      </div>
      {/* Music and the cars each have their own level and mute, so either can
          be silenced while the other plays. */}
      {[
        ["music", "musicMuted", "Music"],
        ["cars", "carsMuted", "Cars & engines"],
      ].map(([key, muted, label]) => (
        <div className="gfx-row" key={key}>
          <span>{label}</span>
          <span className="gfx-level">
            <input
              className="gfx-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioSettings[muted] ? 0 : audioSettings[key]}
              onChange={(e) => {
                const v = Number(e.target.value);
                onAudioChange(v === 0 ? { [muted]: true } : { [key]: v, [muted]: false });
              }}
              aria-label={`${label} volume`}
            />
            <button
              type="button"
              className={`gfx-mute${audioSettings[muted] ? " is-muted" : ""}`}
              aria-pressed={audioSettings[muted]}
              aria-label={`${audioSettings[muted] ? "Unmute" : "Mute"} ${label.toLowerCase()}`}
              onClick={() => onAudioChange({ [muted]: !audioSettings[muted] })}
            >
              <Icon name={audioSettings[muted] ? "mute" : "sound"} />
            </button>
          </span>
        </div>
      ))}
      <div className="gfx-switches">
        {[
          ["ambience", "Space, wind, river & chimes"],
          ["ui", "Interface clicks"],
        ].map(([key, label]) => (
          <label key={key} className="gfx-switch">
            <input type="checkbox" checked={audioSettings[key]} onChange={(e) => onAudioChange({ [key]: e.target.checked })} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <h3>World</h3>
      <Choice
        label="Time of day"
        value={timeMode}
        options={[
          ["cycle", "Cycle"],
          ["day", "Day"],
          ["night", "Night"],
        ]}
        onChange={onTimeMode}
      />
      <p className="gfx-note">Cycle runs the planet's day — 12 minutes long, synced to your clock. Day and Night hold it wherever you are: noon with the black hole high overhead, or midnight under the Milky Way.</p>

      <h3>Drone controls</h3>
      <Choice
        label="Flying"
        value={droneMode}
        options={[
          ["arcade", "Arcade"],
          ["realistic", "Realistic"],
        ]}
        onChange={onDroneMode}
      />
      <p className="gfx-note">
        {droneMode === "realistic"
          ? "Like a real radio (mode 2): W/S throttle — it stays where you leave it — A/D yaw, ↑/↓ pitch, ←/→ roll. Tilt to move; more throttle to climb."
          : "Easy: W/S speed, A/D turn, Space/Shift climb, − / + set the height it holds."}{" "}
        On autopilot it always flies the realistic way.
      </p>

      <h3>Performance</h3>
      <div className="gfx-stats">
        <div>
          <strong>{live.fps}</strong>
          <span>fps</span>
        </div>
        <div>
          <strong>{live.calls}</strong>
          <span>draw calls</span>
        </div>
        <div>
          <strong>{Math.round(live.triangles / 1000)}k</strong>
          <span>triangles</span>
        </div>
        <div>
          <strong>{live.textures}</strong>
          <span>textures</span>
        </div>
      </div>
      {live.renderer && <p className="gfx-renderer">{live.renderer}</p>}

      <Choice
        label="Preset"
        value={preset}
        options={[
          ["low", "Low"],
          ["medium", "Medium"],
          ["high", "High"],
        ]}
        onChange={(p) => onChange(p)}
      />
      {preset === "custom" && <p className="gfx-note">Custom mix — pick a preset to reset.</p>}

      <h3>Rendering</h3>
      <Choice
        label="Resolution"
        value={settings.resolution}
        options={[
          [0.6, "60%"],
          [0.75, "75%"],
          [1, "100%"],
          [1.5, "150%"],
        ]}
        onChange={set("resolution")}
      />
      <Choice
        label="Frame rate"
        value={settings.fps}
        options={[
          [30, "30"],
          [60, "60"],
        ]}
        onChange={set("fps")}
      />
      <Choice
        label="Anti-aliasing"
        value={settings.antialias}
        options={[
          [false, "Off"],
          [true, "On"],
        ]}
        onChange={set("antialias")}
      />
      <Choice
        label="Shadows"
        value={settings.shadows}
        options={[
          ["off", "Off"],
          ["low", "Low"],
          ["high", "High"],
        ]}
        onChange={set("shadows")}
      />

      <h3>Space</h3>
      <Choice
        label="Sky"
        value={settings.sky}
        options={[
          ["off", "Off"],
          ["stars", "Stars"],
          ["milkyway", "Milky Way"],
        ]}
        onChange={set("sky")}
      />
      <Choice
        label="Stars"
        value={settings.stars}
        options={[
          [3000, "Few"],
          [6000, "Some"],
          [11000, "Many"],
        ]}
        onChange={set("stars")}
      />
      <Choice
        label="Black hole"
        value={settings.blackHole}
        options={[
          ["simple", "Simple"],
          ["full", "Full"],
        ]}
        onChange={set("blackHole")}
      />

      <h3>Planet</h3>
      <Choice
        label="Traffic"
        value={settings.traffic}
        options={[
          ["off", "Off"],
          ["light", "Light"],
          ["busy", "Busy"],
        ]}
        onChange={set("traffic")}
      />
      <div className="gfx-switches">
        {SWITCHES.map(([key, label]) => (
          <label key={key} className="gfx-switch">
            <input type="checkbox" checked={settings[key]} onChange={(e) => onChange({ [key]: e.target.checked })} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <p className="gfx-note">Turning something off unloads it and frees its GPU memory. Settings are saved in this browser.</p>
    </aside>
  );
}

/**
 * What the autopilot is doing and why, live: the action ("Stopping"), its
 * cause ("Red light · 40 m"), anything holding it back ("Can't overtake:
 * oncoming traffic"), and what it can see. Colour-coded like the 3D markers.
 */
export function DriverPanel({ vehicle }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    const id = setInterval(() => {
      const drive = vehicle.current.drive;
      if (!drive?.decision) return setD(null);
      const { decision, seen = [], seenLights = 0, obstacles = [] } = drive;
      const count = (kind) => obstacles.filter((o) => o.kind === kind).length;
      const lane = drive.lane ? (drive.lane.offRoad ? "Off-road — no lane" : `${drive.lane.label}${drive.lane.wrongWay ? " · in the other lane" : " · in lane"}`) : null;
      setD({ ...decision, cars: seen.length, lights: seenLights, trees: count("tree"), buildings: count("building"), boards: count("billboard"), lane, focus: undefined });
    }, 120);
    return () => clearInterval(id);
  }, [vehicle]);
  if (!d) return null;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const sees =
    d.action === "You're driving"
      ? null
      : "Sees " +
        [
          plural(d.cars, "car"),
          d.lights && plural(d.lights, "light"),
          d.trees && plural(d.trees, "tree"),
          d.buildings && plural(d.buildings, "building"),
          d.boards && plural(d.boards, "billboard"),
        ]
          .filter(Boolean)
          .join(" · ");
  return (
    <div className={`driver-panel tone-${d.tone}`} role="status" aria-live="polite">
      <span className="dp-dot" aria-hidden="true" />
      <div className="dp-text">
        <div className="dp-line">
          <strong>{d.action}</strong>
          {d.reason && (
            <span>
              {d.reason}
              {d.distance ? ` · ${d.distance}` : ""}
            </span>
          )}
        </div>
        {(d.note || sees || d.lane) && (
          <div className="dp-sub">
            {d.note && <em>{d.note}</em>}
            {d.lane && <span className="dp-lane">{d.lane}</span>}
            {sees && <span>{sees}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * First-person overlays. The drone gets an FPV goggles OSD (on-screen
 * display) in the style of racing quads' flight controllers — crosshair,
 * artificial horizon, speed, altitude, battery, flight timer, link quality,
 * a blinking REC — over an analog-video look (scanlines, vignette, a little
 * noise). The car gets a cinematic vignette that tightens with speed (its
 * own dashboard shows speed and gear).
 */
export function FpvOverlay({ vehicle, type, altitude }) {
  const [v, setV] = useState(null);
  const flight = useRef({ start: performance.now(), used: 0, last: performance.now() });
  useEffect(() => {
    let raf;
    const tick = () => {
      const s = vehicle.current;
      const now = performance.now();
      const f = flight.current;
      // Battery drains while it's airborne (a 4S pack, 16.8 V full).
      if ((s.alt ?? 0) > 0.3) f.used += (now - f.last) / 1000;
      f.last = now;
      setV({
        speed: Math.abs(s.speed ?? 0),
        alt: s.alt ?? 0,
        pitch: (s.bodyPitch ?? 0) + (25 * Math.PI) / 180,
        roll: s.bodyRoll ?? 0,
        auto: Boolean(s.auto || s.route),
        seconds: (now - f.start) / 1000,
        volts: s.battery?.volts ?? 16.8,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [vehicle]);
  if (!v) return null;
  if (type === "car") {
    const k = Math.min(1, v.speed / 35);
    return <div className="fpv-car" style={{ "--speed": k }} aria-hidden="true" />;
  }
  const mmss = `${String(Math.floor(v.seconds / 60)).padStart(2, "0")}:${String(Math.floor(v.seconds % 60)).padStart(2, "0")}`;
  // The horizon: up or down the screen by the camera's pitch, through the
  // camera's own lens (88° vertical), and rotated by the bank.
  const horizonY = (Math.tan(v.pitch) / Math.tan((88 / 2) * (Math.PI / 180))) * 50;
  return (
    <div className="fpv-osd" aria-hidden="true">
      <div className="fpv-noise" />
      <div className="fpv-horizon" style={{ transform: `translateY(${-horizonY}vh) rotate(${(v.roll * 180) / Math.PI}deg)` }}>
        <span />
      </div>
      <div className="fpv-cross">+</div>
      <div className="fpv-top">
        <span>LQ 99</span>
        <span className="fpv-rec">● REC</span>
        <span>{v.auto ? "AUTO" : "ANGLE"}</span>
      </div>
      <div className="fpv-left">
        <strong>{Math.round(v.speed * 4)}</strong>
        <small>KM/H</small>
      </div>
      <div className="fpv-right">
        <strong>{Math.round(v.alt)}</strong>
        <small>M · HOLD {Math.round(altitude)}</small>
      </div>
      <div className="fpv-bottom">
        <span className={v.volts < 14 ? "fpv-warn" : ""}>4S {v.volts.toFixed(1)}V</span>
        <span>{v.alt > 0.3 ? "ARMED" : "DISARMED"}</span>
        <span>{mmss}</span>
      </div>
    </div>
  );
}

/**
 * The autopilot's own settings page: where it goes and how fast, how far it
 * sees, what's drawn, and — rule by rule — what it pays attention to. Switch
 * a rule off and it ignores that part of the world entirely.
 */
export function AutopilotPanel({
  onClose,
  autoSpeed,
  onAutoSpeed,
  autoRoute,
  onAutoRoute,
  routeViz,
  onRouteViz,
  decisions,
  onDecisions,
  viewRange,
  onViewRange,
  rules,
  onRules,
  showInputs,
  onShowInputs,
}) {
  const allOn = PILOT_RULES.every((r) => rules[r.key]);
  return (
    <aside className="city-panel gfx-panel" aria-label="Autopilot settings">
      <button className="city-panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <span className="city-panel-kicker">Autopilot</span>
      <h2>How it drives</h2>
      <h3>Where &amp; how fast</h3>
      <Choice
        label="Route"
        value={autoRoute}
        options={[
          ["equator", "Equator"],
          ["roads", "All roads"],
        ]}
        onChange={onAutoRoute}
      />
      <div className="gfx-row">
        <span>Cruise speed</span>
        <input
          className="gfx-slider"
          type="range"
          min={AUTO_SPEED.min}
          max={AUTO_SPEED.max}
          step="5"
          value={autoSpeed}
          onChange={(e) => onAutoSpeed(Number(e.target.value))}
          aria-label="Autopilot cruise speed"
        />
        <output className="gfx-value">{autoSpeed} km/h</output>
      </div>
      <div className="gfx-row">
        <span>Sees up to</span>
        <input
          className="gfx-slider"
          type="range"
          min={VIEW.min}
          max={VIEW.max}
          step="5"
          value={viewRange}
          onChange={(e) => onViewRange(Number(e.target.value))}
          aria-label="How far the autopilot sees"
        />
        <output className="gfx-value">{metres(viewRange)}</output>
      </div>
      <h3>Show</h3>
      <div className="gfx-switches">
        <label className="gfx-switch">
          <input type="checkbox" checked={routeViz} onChange={(e) => onRouteViz(e.target.checked)} />
          <span>Show route planning &amp; the plan ahead (G)</span>
        </label>
        <label className="gfx-switch">
          <input type="checkbox" checked={decisions} onChange={(e) => onDecisions(e.target.checked)} />
          <span>Show what the driver sees &amp; decides (I)</span>
        </label>
        <label className="gfx-switch">
          <input type="checkbox" checked={showInputs} onChange={(e) => onShowInputs(e.target.checked)} />
          <span>Show the controls it's sending to the vehicle (O)</span>
        </label>
      </div>
      {routeViz && (
        <div className="route-legend" aria-label="Route colours: planned speed">
          <span>brake</span>
          <i />
          <span>cruise</span>
        </div>
      )}
      <p className="gfx-note">
        It looks all round, but only sees what's in direct line of sight — buildings and other cars hide what's behind them — out to the distance set
        here, and decides from that. Press P to hand over to the autopilot. <em>Equator</em> cruises round the highway; <em>All roads</em> tours every district in turn, through
        the side roads, lanes and roundabouts (the drone flies between them). It keeps left, as in Nepal, and the road's own limit still applies.
      </p>


      <h3>What it pays attention to</h3>
      <div className="gfx-switches">
        {PILOT_RULES.map((r) => (
          <label key={r.key} className="gfx-switch" title={r.hint}>
            <input type="checkbox" checked={rules[r.key]} onChange={(e) => onRules({ ...rules, [r.key]: e.target.checked })} />
            <span>
              {r.label}
              <small className="pilot-hint">{rules[r.key] ? r.hint : "Ignored"}</small>
            </span>
          </label>
        ))}
      </div>
      {!allOn && (
        <button className="city-btn pilot-reset" onClick={() => onRules(PILOT_DEFAULTS)}>
          Obey everything again
        </button>
      )}
      <p className="gfx-note">Ignored rules really are ignored — it'll run red lights, drive into the car ahead, or plough into trees. Other cars still can't pass through you.</p>
    </aside>
  );
}

/**
 * The controls going to the vehicle right now — from the autopilot, or from
 * you: throttle, brake, steering (and climb for the drone).
 */
/** The car's controls as bars: throttle, brake, reverse, handbrake, cruise, steering. */
function CarInputs({ c, steer }) {
  return (
    <div className={`inputs-panel by-${c.by ?? "you"}`} aria-label="Vehicle controls">
      <span className="ip-title">{c.by === "autopilot" ? "Autopilot inputs" : "Your inputs"}</span>
      <div className="ip-row">
        <span>Throttle</span>
        <i className="ip-bar"><b style={{ width: `${Math.round((c.up ? (c.throttle ?? 1) : 0) * 100)}%` }} /></i>
      </div>
      {/* Each lights only when it's what's really happening: S brakes while
          rolling forward and only then reverses; Space is the handbrake. */}
      <div className="ip-row">
        <span>{c.pedal === "hold" ? "Hold" : "Brake"}</span>
        <i className="ip-bar brake">
          <b style={{ width: `${c.pedal === "brake" || c.pedal === "hold" ? Math.round((c.brake ? (c.brakeLevel ?? 1) : 1) * 100) : 0}%` }} />
        </i>
      </div>
      <div className="ip-row">
        <span>Reverse</span>
        <i className="ip-bar reverse">
          <b style={{ width: c.pedal === "reverse" ? "100%" : "0%" }} />
        </i>
        <output>{c.pedal === "reverse" ? "R" : ""}</output>
      </div>
      <div className="ip-row">
        <span>Handbrake</span>
        <output className={c.handbrake ? "ip-on" : "ip-off"}>{c.handbrake ? "ON" : "off"}</output>
      </div>
      {c.by !== "autopilot" && (
        <div className="ip-row">
          <span>Cruise</span>
          <output className={c.cruise != null ? "ip-on" : "ip-off"} title="L locks the speed you're doing">
            {c.cruise != null ? `${Math.round(c.cruise * KMH_PER_UNIT)} km/h` : "off · L"}
          </output>
        </div>
      )}
      <div className="ip-row">
        <span>Steer</span>
        <i className="ip-steer">
          <b style={{ left: `${50 - steer * 50}%` }} />
        </i>
        <output>{Math.abs(steer) < 0.03 ? "—" : `${Math.round(Math.abs(steer) * 100)}% ${steer > 0 ? "L" : "R"}`}</output>
      </div>
    </div>
  );
}

/** One gimbal of the transmitter: the stick's position, x and y in −1…1 (y up). */
function Stick({ x = 0, y = 0, label, reading }) {
  const clamp = (v) => Math.max(-1, Math.min(1, v || 0));
  return (
    <figure className="rc-stick">
      <div className="rc-gate" role="img" aria-label={`${label}: ${reading}`}>
        <b style={{ left: `${50 + clamp(x) * 40}%`, top: `${50 - clamp(y) * 40}%` }} />
      </div>
      <figcaption>
        <span>{label}</span>
        <output>{reading}</output>
      </figcaption>
    </figure>
  );
}

const pct = (v) => `${Math.round(Math.abs(v) * 100)}%`;

/**
 * What's being sent to the vehicle. The car: bars for each control. The
 * drone: a radio-control transmitter's two sticks in "Mode 2" — left stick
 * throttle (up/down) and yaw (sideways), right stick pitch and roll.
 */
export function InputsPanel({ vehicle, type }) {
  const [c, setC] = useState(null);
  useEffect(() => {
    const id = setInterval(() => setC({ ...(vehicle.current.controls ?? {}) }), 60);
    return () => clearInterval(id);
  }, [vehicle]);
  if (!c) return null;
  const auto = c.by === "autopilot";
  const steer = Math.max(-1, Math.min(1, c.steer ?? 0)); // + = left
  const turn = Math.abs(steer) < 0.03 ? "centre" : `${pct(steer)} ${steer > 0 ? "L" : "R"}`;
  if (type === "car") return <CarInputs c={c} steer={steer} />;
  let left;
  let right;
  if (c.sticks) {
    const st = c.sticks;
    left = { x: -(st.yaw ?? 0), y: (st.throttle ?? 0) * 2 - 1, label: "Throttle · yaw", reading: `${pct(st.throttle ?? 0)} · ${pct(st.yaw ?? 0)}` };
    right = { x: st.roll ?? 0, y: st.pitch ?? 0, label: "Pitch · roll", reading: `${pct(st.pitch ?? 0)} · ${pct(st.roll ?? 0)}` };
  } else {
    const climb = (c.ascend ? 1 : 0) - (c.descend ? 1 : 0);
    const fwd = (c.up ? 1 : 0) - (c.down ? 1 : 0);
    left = { x: -steer, y: climb, label: "Climb · turn", reading: `${climb > 0 ? "up" : climb < 0 ? "down" : "hold"} · ${turn}` };
    right = { x: 0, y: fwd, label: "Forward", reading: fwd > 0 ? "forward" : fwd < 0 ? "back" : "hold" };
  }
  return (
    <div className={`inputs-panel rc by-${c.by ?? "you"}`} aria-label="Drone sticks">
      <span className="ip-title">{auto ? "Autopilot · radio" : "You · radio"}</span>
      <div className="rc-sticks">
        <Stick {...left} />
        <Stick {...right} />
      </div>
    </div>
  );
}

/**
 * The drone's battery: a small pack meter (voltage under load, charge), and
 * — flying by hand with a low pack — a prompt to land and swap it (B). On
 * autopilot it says what it's doing (landing, swapping, taking off).
 */
export function BatteryPrompt({ vehicle }) {
  const [b, setB] = useState(null);
  useEffect(() => {
    const id = setInterval(() => {
      const s = vehicle.current;
      const bat = s.battery;
      if (!bat) return setB(null);
      const auto = Boolean(s.auto || s.route);
      const recent = s.batteryNote && performance.now() - (s.batteryNoteAt ?? 0) < 3000 ? s.batteryNote : null;
      setB({
        volts: bat.volts,
        charge: bat.charge,
        amps: bat.current,
        note: recent ?? (!auto && isLow(bat) ? ((s.alt ?? 0) < 0.3 ? "Battery low — press B to swap it" : "Battery low — land, then press B to swap it") : null),
      });
    }, 100);
    return () => clearInterval(id);
  }, [vehicle]);
  if (!b) return null;
  const tone = b.charge < 0.1 ? "stop" : b.charge < 0.2 ? "slow" : "go";
  return (
    <>
      <div className={`battery-meter tone-${tone}`} aria-label="Drone battery">
        <span className="bm-cell">
          <b style={{ width: `${Math.round(b.charge * 100)}%` }} />
        </span>
        <span>
          {b.volts.toFixed(1)} V · {Math.round(b.amps)} A · {Math.round(b.charge * 100)}%
        </span>
      </div>
      {b.note && (
        <div className={`battery-note tone-${tone}`} role="status">
          🔋 {b.note}
        </div>
      )}
    </>
  );
}

/**
 * The drift score, top centre: the points piling up while you slide, then
 * the banked total for a moment (or "Drift lost" if it ended in a crash),
 * and your best this visit.
 */
export function DriftScore({ vehicle }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    const id = setInterval(() => {
      const x = vehicle.current.drift;
      setD(x ? { active: x.active, score: Math.round(x.score), angle: Math.round((x.angle * 180) / Math.PI), last: x.last, best: x.best } : null);
    }, 80);
    return () => clearInterval(id);
  }, [vehicle]);
  if (!d || (!d.active && !d.last)) return null;
  return (
    <div className={`drift-score${d.last?.lost && !d.active ? " is-lost" : ""}`} role="status" aria-live="polite">
      {d.active ? (
        <>
          <span className="drift-label">Drift · {d.angle}°</span>
          <strong>{d.score.toLocaleString()}</strong>
        </>
      ) : d.last.lost ? (
        <>
          <span className="drift-label">Drift lost</span>
          <strong>{d.last.score.toLocaleString()}</strong>
        </>
      ) : (
        <>
          <span className="drift-label">Drift!</span>
          <strong>+{d.last.score.toLocaleString()}</strong>
        </>
      )}
      {d.best > 0 && <span className="drift-best">best {d.best.toLocaleString()}</span>}
    </div>
  );
}
