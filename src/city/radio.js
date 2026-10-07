// Planet Radio: streams songs from YouTube through its official embedded
// (IFrame) player — nothing is downloaded or re-hosted. The player script is
// only loaded when you first press play, from the privacy-enhanced
// youtube-nocookie.com domain. Stations, shuffle, a "My mix" of your own
// links, volume that follows the planet's mute and music level, a dip under
// the transformation, and skipping any video whose owner blocks embedding.
import { STATIONS, watchUrl } from "../content/music";
import { nextIndex, previousIndex } from "../lib/music";
import { audio } from "./audio";

const KEY = "city-radio";
const MIX_KEY = "city-radio-mix";
const VIDEO_KEY = "city-radio-hide-video";
export const MY_MIX = "mix";
export const PLAYER_ELEMENT_ID = "planet-radio-player";

function loadMix() {
  try {
    const raw = JSON.parse(localStorage.getItem(MIX_KEY));
    return Array.isArray(raw) ? raw.filter((t) => t && typeof t.id === "string") : [];
  } catch {
    return [];
  }
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return {
      station: typeof raw?.station === "string" ? raw.station : "nepali",
      index: Number.isInteger(raw?.index) ? raw.index : 0,
      shuffle: Boolean(raw?.shuffle),
    };
  } catch {
    return { station: "nepali", index: 0, shuffle: false };
  }
}

let apiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        apiPromise = null;
        reject(new Error("Couldn't reach YouTube"));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

class Radio {
  constructor() {
    Object.assign(this, loadState());
    this.mix = loadMix();
    try {
      this.hideVideo = localStorage.getItem(VIDEO_KEY) === "1";
    } catch {
      this.hideVideo = false;
    }
    this.playing = false;
    this.loading = false;
    this.error = null;
    this.player = null;
    this.ready = null;
    this.duckLevel = 1;
    this.listeners = new Set();
    this.failures = 0;
    audio.onChange = () => this.applyVolume();
    audio.onDuck = (amount, seconds) => this.duck(amount, seconds);
    if (!this.stationList.some((s) => s.id === this.station)) this.station = "nepali";
  }

  get stationList() {
    return [...STATIONS, { id: MY_MIX, name: "My mix", tagline: "Paste any YouTube link", colors: ["#3a3f4b", "#8a93a6"], tracks: this.mix }];
  }

  get stationData() {
    return this.stationList.find((s) => s.id === this.station) ?? this.stationList[0];
  }

  get track() {
    const tracks = this.stationData.tracks;
    return tracks.length ? tracks[Math.min(this.index, tracks.length - 1)] : null;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(trackChanged = false) {
    for (const fn of this.listeners) fn(this, trackChanged);
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ station: this.station, index: this.index, shuffle: this.shuffle }));
      localStorage.setItem(MIX_KEY, JSON.stringify(this.mix));
    } catch {
      // Not persisted in private mode; fine.
    }
  }

  /** Create the YouTube player in the mini-player's slot (once). */
  ensurePlayer() {
    if (this.ready) return this.ready;
    this.ready = loadYouTubeApi().then(
      (YT) =>
        new Promise((resolve) => {
          this.player = new YT.Player(PLAYER_ELEMENT_ID, {
            host: "https://www.youtube-nocookie.com",
            width: "100%",
            height: "100%",
            playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
            events: {
              onReady: () => {
                this.applyVolume();
                resolve(this.player);
              },
              onStateChange: (e) => {
                const S = window.YT.PlayerState;
                if (e.data === S.PLAYING) {
                  this.playing = true;
                  this.loading = false;
                  this.failures = 0;
                  audio.setMusicPlaying(true);
                } else if (e.data === S.PAUSED) {
                  this.playing = false;
                  audio.setMusicPlaying(false);
                } else if (e.data === S.ENDED) {
                  this.next();
                }
                this.emit();
              },
              // 101/150: the owner doesn't allow embedding here; 2/5/100: bad or gone. Skip it.
              onError: () => {
                this.failures++;
                if (this.failures < this.stationData.tracks.length) this.next();
                else {
                  this.error = "None of these videos can play here right now.";
                  this.loading = false;
                  this.playing = false;
                  this.emit();
                }
              },
            },
          });
        })
    );
    this.ready.catch(() => {
      this.ready = null;
      this.error = "Couldn't reach YouTube. Check your connection.";
      this.loading = false;
      this.emit();
    });
    return this.ready;
  }

  /** Player volume = music level × master, 0 when muted, dipped while ducking. */
  applyVolume() {
    if (!this.player?.setVolume) return;
    const s = audio.settings;
    const v = s.enabled ? Math.round(s.music * s.master * this.duckLevel * 140) : 0;
    this.player.setVolume(Math.max(0, Math.min(100, v)));
    if (v === 0) this.player.mute();
    else this.player.unMute();
  }

  duck(amount, seconds) {
    this.duckLevel = amount;
    this.applyVolume();
    clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      this.duckLevel = 1;
      this.applyVolume();
    }, seconds * 1000);
  }

  async play() {
    const track = this.track;
    if (!track) return;
    // Asking for music is asking for sound: un-mute if muted.
    if (!audio.settings.enabled) audio.configure({ enabled: true });
    this.error = null;
    this.loading = true;
    this.emit(true);
    try {
      const player = await this.ensurePlayer();
      const current = player.getVideoData?.().video_id;
      if (current === track.id) player.playVideo();
      else player.loadVideoById(track.id);
    } catch {
      // ensurePlayer reports the error.
    }
  }

  pause() {
    this.player?.pauseVideo?.();
    this.playing = false;
    audio.setMusicPlaying(false);
    this.emit();
  }

  toggle() {
    if (this.playing || this.loading) this.pause();
    else this.play();
  }

  go(update) {
    update();
    this.save();
    this.play();
  }

  next() {
    const n = this.stationData.tracks.length;
    this.go(() => (this.index = nextIndex(this.index, n, this.shuffle)));
  }

  previous() {
    if (this.player?.getCurrentTime?.() > 4) {
      this.player.seekTo(0, true);
      return;
    }
    this.go(() => (this.index = previousIndex(this.index, this.stationData.tracks.length)));
  }

  playTrack(stationId, index) {
    this.go(() => {
      this.station = stationId;
      this.index = index;
    });
  }

  setStation(id) {
    if (id === this.station) return;
    const station = this.stationList.find((s) => s.id === id);
    if (!station?.tracks.length) {
      this.station = id;
      this.index = 0;
      this.save();
      this.emit(true);
      return;
    }
    this.playTrack(id, this.shuffle ? Math.floor(Math.random() * station.tracks.length) : 0);
  }

  /**
   * Hide the video entirely and keep just the music. The player is shrunk to
   * an invisible pixel rather than removed, so playback carries on. (YouTube's
   * terms ask for a visible player; this is the visitor's choice, off by default.)
   */
  setHideVideo(on) {
    this.hideVideo = on;
    try {
      localStorage.setItem(VIDEO_KEY, on ? "1" : "0");
    } catch {
      // Not persisted in private mode; fine.
    }
    this.emit();
  }

  setShuffle(on) {
    this.shuffle = on;
    this.save();
    this.emit();
  }

  /** Add a song to My mix (title fetched from YouTube's oEmbed when it can be). */
  async addToMix(id) {
    if (this.mix.some((t) => t.id === id)) return;
    const track = { id, title: "YouTube video", artist: "" };
    try {
      const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(track))}`);
      if (res.ok) {
        const data = await res.json();
        track.title = data.title;
        track.artist = data.author_name;
      }
    } catch {
      // Titles are a nicety; the video still plays.
    }
    this.mix = [...this.mix, track];
    this.save();
    this.emit();
  }

  removeFromMix(id) {
    const at = this.mix.findIndex((t) => t.id === id);
    this.mix = this.mix.filter((t) => t.id !== id);
    if (this.station === MY_MIX && at <= this.index && this.index > 0) this.index--;
    this.save();
    this.emit();
  }

  seek(fraction) {
    const d = this.player?.getDuration?.();
    if (d) this.player.seekTo(fraction * d, true);
  }

  get time() {
    return { current: this.player?.getCurrentTime?.() ?? 0, duration: this.player?.getDuration?.() ?? 0 };
  }

  /** Leaving the planet: stop. The player is rebuilt next time. */
  stop() {
    try {
      this.player?.stopVideo?.();
      this.player?.destroy?.();
    } catch {
      // Already gone.
    }
    this.player = null;
    this.ready = null;
    this.playing = false;
    this.loading = false;
    audio.setMusicPlaying(false);
    this.emit();
  }
}

export const radio = new Radio();
