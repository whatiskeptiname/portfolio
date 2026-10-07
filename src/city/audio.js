// Everything you hear on the planet, synthesized live with Web Audio — no
// sound files. One AudioContext, three buses (engine, ambience, ui) into a
// master, continuous "voices" that are created once and steered every frame
// by update(), and one-shot effects (transformation, chimes, thuds, shutter).
// Nothing starts until the first click or key press (browser autoplay rules).

const SETTINGS_KEY = "city-audio";
export const AUDIO_DEFAULTS = { enabled: true, master: 0.7, engine: true, ambience: true, ui: true, music: 0.6 };

export function loadAudioSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    const out = { ...AUDIO_DEFAULTS };
    if (raw && typeof raw === "object") for (const k of Object.keys(out)) if (typeof raw[k] === typeof out[k]) out[k] = raw[k];
    return out;
  } catch {
    return { ...AUDIO_DEFAULTS };
  }
}

export function saveAudioSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Not persisted in private mode; fine.
  }
}

import { GEAR_SPAN } from "../lib/autopilot";

// Pentatonic scale (Hz) for the district chimes.
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
// Ambient pad chords: warm by day, darker at night.
const DAY_CHORD = [130.81, 196.0, 329.63, 493.88]; // C3 G3 E4 B4 — Cmaj7 shimmer
const NIGHT_CHORD = [110.0, 164.81, 261.63, 392.0]; // A2 E3 C4 G4 — Am7

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.settings = loadAudioSettings();
    this.voices = null;
    this.lastUpdate = 0;
  }

  /** Create the context and voices (call from a user gesture). Safe to call often. */
  start() {
    if (!this.settings.enabled) return false;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.build();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return true;
  }

  /** Silence and park everything (leaving the planet, or muting). */
  stop() {
    if (this.ctx && this.ctx.state === "running") this.ctx.suspend();
  }

  configure(settings) {
    this.settings = { ...this.settings, ...settings };
    saveAudioSettings(this.settings);
    this.onChange?.(this.settings); // the radio follows mute and music volume
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const { master, buses } = this.voices;
    master.gain.setTargetAtTime(this.settings.enabled ? this.settings.master : 0, now, 0.05);
    buses.engine.gain.setTargetAtTime(this.settings.engine ? 1 : 0, now, 0.05);
    buses.ambience.gain.setTargetAtTime(this.settings.ambience ? 1 : 0, now, 0.2);
    buses.ui.gain.setTargetAtTime(this.settings.ui ? 1 : 0, now, 0.05);
    if (this.settings.enabled) this.start();
    else this.stop();
  }

  // --- building blocks ---------------------------------------------------------

  noise(seconds = 2) {
    const ac = this.ctx;
    const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  loopNoise(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }

  osc(type, freq, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.start();
    return o;
  }

  filter(type, freq, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  gain(value = 0) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    return g;
  }

  build() {
    const ac = this.ctx;
    const master = this.gain(this.settings.master);
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    master.connect(comp).connect(ac.destination);
    const buses = {
      engine: this.gain(this.settings.engine ? 1 : 0),
      ambience: this.gain(this.settings.ambience ? 1 : 0),
      ui: this.gain(this.settings.ui ? 1 : 0),
    };
    Object.values(buses).forEach((b) => b.connect(master));
    const white = this.noise(2);

    // Car engine: two detuned saws and a sub, through a throttle-opened lowpass.
    const carFilter = this.filter("lowpass", 400, 4);
    const carGain = this.gain(0);
    const car = [this.osc("sawtooth", 40), this.osc("sawtooth", 40, 9), this.osc("sine", 20)];
    car.forEach((o) => o.connect(carFilter));
    carFilter.connect(carGain).connect(buses.engine);
    // Tyre squeal.
    const squealGain = this.gain(0);
    this.loopNoise(white).connect(this.filter("bandpass", 2600, 9)).connect(squealGain).connect(buses.engine);

    // Gravel crunch under the tyres off-road.
    const gravelFilter = this.filter("bandpass", 420, 0.9);
    const gravelGain = this.gain(0);
    this.loopNoise(white).connect(gravelFilter).connect(gravelGain).connect(buses.engine);

    // Drone: four motors, each a slightly different pitch, plus an air rush.
    const droneFilter = this.filter("lowpass", 2200, 1);
    const droneGain = this.gain(0);
    const motors = [0, 1, 2, 3].map((i) => this.osc("sawtooth", 190, (i - 1.5) * 18));
    motors.forEach((o) => o.connect(droneFilter));
    droneFilter.connect(droneGain).connect(buses.engine);
    const rushFilter = this.filter("bandpass", 900, 0.8);
    const rushGain = this.gain(0);
    this.loopNoise(white).connect(rushFilter).connect(rushGain).connect(buses.engine);

    // Ambient pad: four voices that glide between the day and night chords,
    // with a slow breathing tremolo.
    const padFilter = this.filter("lowpass", 1100, 0.7);
    const padGain = this.gain(0.05);
    const pad = DAY_CHORD.map((f, i) => {
      const o = this.osc(i % 2 ? "triangle" : "sine", f, (i - 1.5) * 4);
      const g = this.gain(0.25);
      o.connect(g).connect(padFilter);
      return o;
    });
    const lfo = this.osc("sine", 0.07);
    const lfoDepth = this.gain(0.02);
    lfo.connect(lfoDepth).connect(padGain.gain);
    padFilter.connect(padGain).connect(buses.ambience);

    // Black hole: a sub-bass drone and filtered rumble, louder when you face it.
    const holeGain = this.gain(0);
    this.osc("sine", 36).connect(holeGain);
    this.osc("sine", 54.5).connect(this.gain(0.4)).connect(holeGain);
    this.loopNoise(white).connect(this.filter("lowpass", 110, 0.7)).connect(this.gain(2.2)).connect(holeGain);
    holeGain.connect(buses.ambience);

    // Wind (altitude and speed) and river (proximity), both shaped noise.
    const windFilter = this.filter("bandpass", 500, 0.6);
    const windGain = this.gain(0);
    this.loopNoise(white).connect(windFilter).connect(windGain).connect(buses.ambience);
    const riverFilter = this.filter("bandpass", 1300, 1.2);
    const riverGain = this.gain(0);
    this.loopNoise(white).connect(riverFilter).connect(riverGain).connect(buses.ambience);

    this.voices = {
      master, buses, white,
      car, carFilter, carGain, squealGain, gravelFilter, gravelGain,
      motors, droneFilter, droneGain, rushFilter, rushGain,
      pad, padFilter, holeGain, windFilter, windGain, riverFilter, riverGain,
    };
  }

  /**
   * Steer the continuous voices. Called every frame; applied ~20× a second.
   * p: { vehicle: "car"|"drone", speed, maxSpeed, throttle, steer, alt, transforming,
   *      night (0..1), facingHole (0..1), river (0..1), driving }
   */
  update(p) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    if (now - this.lastUpdate < 0.05) return;
    this.lastUpdate = now;
    const v = this.voices;
    const T = 0.08;
    const speed = Math.abs(p.speed);
    const isCar = p.vehicle === "car" && !p.transforming;
    const isDrone = p.vehicle === "drone" && !p.transforming;

    // Car: RPM sweeps up through each gear, drops at the shift.
    const gear = Math.min(5, Math.floor(speed / GEAR_SPAN));
    const inGear = Math.min(1.15, (speed - gear * GEAR_SPAN) / GEAR_SPAN);
    const rpm = 850 + inGear * 3600 + gear * 250;
    const fire = rpm / 30; // four-cylinder firing frequency
    v.car[0].frequency.setTargetAtTime(fire, now, T);
    v.car[1].frequency.setTargetAtTime(fire, now, T);
    v.car[2].frequency.setTargetAtTime(fire / 2, now, T);
    v.carFilter.frequency.setTargetAtTime(260 + p.throttle * 1500 + speed * 25, now, T);
    v.carGain.gain.setTargetAtTime(isCar ? 0.09 + p.throttle * 0.07 + speed * 0.002 : 0, now, 0.12);
    const squeal = isCar && p.surface !== "grass" ? Math.max(0, Math.abs(p.steer) * (speed / 24) - 0.35) * 0.35 : 0;
    v.squealGain.gain.setTargetAtTime(squeal, now, 0.06);
    const gravel = isCar && p.surface === "grass" ? Math.min(0.16, speed * 0.016) : isCar && p.surface === "paved" ? Math.min(0.03, speed * 0.003) : 0;
    v.gravelGain.gain.setTargetAtTime(gravel, now, 0.08);
    v.gravelFilter.frequency.setTargetAtTime(300 + speed * 25 + Math.random() * 120, now, 0.05);

    // Drone: motors rise with throttle and climb.
    const thrust = Math.min(1.4, speed / (p.maxSpeed || 40) + Math.max(0, p.climb ?? 0) / 18 + (p.alt > 0.1 ? 0.35 : 0));
    v.motors.forEach((o) => o.frequency.setTargetAtTime(150 + thrust * 170, now, T));
    v.droneFilter.frequency.setTargetAtTime(900 + thrust * 2400, now, T);
    v.droneGain.gain.setTargetAtTime(isDrone && (p.alt > 0.05 || p.driving) ? 0.03 + thrust * 0.035 : 0, now, 0.12);
    v.rushFilter.frequency.setTargetAtTime(600 + speed * 40, now, T);
    v.rushGain.gain.setTargetAtTime(isDrone ? Math.min(0.12, speed * 0.004) : 0, now, T);

    // Ambience.
    v.pad.forEach((o, i) => o.frequency.setTargetAtTime(DAY_CHORD[i] + (NIGHT_CHORD[i] - DAY_CHORD[i]) * p.night, now, 1.5));
    v.padFilter.frequency.setTargetAtTime(1300 - p.night * 600, now, 1);
    v.holeGain.gain.setTargetAtTime(0.015 + Math.pow(p.facingHole, 3) * 0.16, now, 0.3);
    const wind = Math.min(0.12, (p.alt ?? 0) / 300 + speed * 0.0025);
    v.windGain.gain.setTargetAtTime(wind, now, 0.3);
    v.windFilter.frequency.setTargetAtTime(380 + Math.sin(now * 0.37) * 140 + speed * 12, now, 0.4);
    v.riverGain.gain.setTargetAtTime(p.river * 0.06, now, 0.3);
    v.riverFilter.frequency.setTargetAtTime(1100 + Math.sin(now * 5.3) * 250 + Math.sin(now * 2.1) * 180, now, 0.05);
  }

  // --- one-shots ------------------------------------------------------------------

  env(node, t0, attack, hold, release, peak) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    node.gain.setValueAtTime(peak, t0 + attack + hold);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  }

  tone(bus, type, freq, t0, attack, hold, release, peak, toFreq = null) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t0 + attack + hold + release);
    this.env(g, t0, attack, hold, release, peak);
    o.connect(g).connect(bus);
    o.start(t0);
    o.stop(t0 + attack + hold + release + 0.05);
  }

  burst(bus, t0, filterType, freq, q, attack, hold, release, peak) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.voices.white;
    const f = this.filter(filterType, freq, q);
    const g = this.ctx.createGain();
    this.env(g, t0, attack, hold, release, peak);
    src.connect(f).connect(g).connect(bus);
    src.start(t0, Math.random());
    src.stop(t0 + attack + hold + release + 0.05);
  }

  ready() {
    return this.start() && this.ctx && this.ctx.state !== "closed";
  }

  /** Let the music sit back (or come forward) against the ambience. */
  setMusicPlaying(playing) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.voices.buses.ambience.gain.setTargetAtTime(this.settings.ambience ? (playing ? 0.45 : 1) : 0, now, 0.6);
  }

  /** Briefly lower the music (e.g. under the transformation); the radio listens. */
  duck(amount = 0.3, seconds = 2) {
    this.onDuck?.(amount, seconds);
  }

  /** The car ⇄ drone transformation: thump, servo whine, ratchet, clank, (spin-up). */
  transform(toDrone, duration) {
    if (!this.ready()) return;
    this.duck(0.3, duration);
    const bus = this.voices.buses.engine;
    const now = this.ctx.currentTime + 0.02;
    this.tone(bus, "sine", 140, now, 0.01, 0.05, 0.3, 0.9, 48);
    // Servo whine.
    {
      const o = this.ctx.createOscillator();
      const f = this.filter("lowpass", 1400, 6);
      const g = this.ctx.createGain();
      o.type = "sawtooth";
      const [from, to] = toDrone ? [170, 620] : [620, 150];
      o.frequency.setValueAtTime(from, now + 0.15);
      o.frequency.exponentialRampToValueAtTime(to, now + duration * 0.75);
      this.env(g, now + 0.15, 0.08, duration * 0.55, 0.2, 0.18);
      o.connect(f).connect(g).connect(bus);
      o.start(now + 0.15);
      o.stop(now + duration);
    }
    for (let i = 0; i < 16; i++) {
      const t = now + 0.1 + (i / 16) * duration * 0.75 + (Math.random() - 0.5) * 0.04;
      this.burst(bus, t, "bandpass", 1800 + Math.random() * 2800, 8, 0.002, 0.005, 0.05, 0.7);
    }
    const clank = now + duration * 0.86;
    this.burst(bus, clank, "lowpass", 900, 1, 0.003, 0.02, 0.25, 0.9);
    this.tone(bus, "triangle", 95, clank, 0.005, 0.03, 0.25, 0.7, 55);
    if (toDrone) this.tone(bus, "sawtooth", 60, now + duration * 0.8, 0.1, 0.4, 0.4, 0.12, 260);
  }

  /** Bumping into something. */
  thud(strength = 1) {
    if (!this.ready()) return;
    const now = this.ctx.currentTime;
    const bus = this.voices.buses.engine;
    const k = Math.min(1, strength);
    this.tone(bus, "sine", 110, now, 0.004, 0.02, 0.22, 0.5 * k + 0.1, 45);
    this.burst(bus, now, "lowpass", 700, 1, 0.002, 0.01, 0.12, 0.4 * k + 0.05);
  }

  /** A bell motif for entering district `index`; résumé districts ring higher. */
  chime(index, career = false) {
    if (!this.ready()) return;
    const bus = this.voices.buses.ambience;
    const now = this.ctx.currentTime + 0.02;
    const base = (index * 3) % 5;
    const notes = [0, 2, 4].map((step) => PENTATONIC[base + step] * (career ? 1 : 0.5));
    notes.forEach((f, i) => {
      const t = now + i * 0.14;
      this.tone(bus, "sine", f, t, 0.005, 0.02, 1.4, 0.09);
      this.tone(bus, "sine", f * 2.76, t, 0.003, 0.0, 0.5, 0.025); // bell overtone
    });
  }

  /** Interface: "click", "open" or "shutter". */
  ui(kind) {
    if (!this.ready()) return;
    const bus = this.voices.buses.ui;
    const now = this.ctx.currentTime;
    if (kind === "click") this.tone(bus, "sine", 1250, now, 0.002, 0.0, 0.05, 0.06);
    else if (kind === "open") {
      this.tone(bus, "sine", 660, now, 0.004, 0.02, 0.35, 0.07);
      this.tone(bus, "sine", 990, now + 0.08, 0.004, 0.02, 0.45, 0.06);
    } else if (kind === "shutter") {
      this.burst(bus, now, "highpass", 2500, 0.7, 0.001, 0.01, 0.05, 0.35);
      this.burst(bus, now + 0.09, "highpass", 1800, 0.7, 0.001, 0.015, 0.07, 0.3);
    }
  }
}

export const audio = new AudioEngine();
