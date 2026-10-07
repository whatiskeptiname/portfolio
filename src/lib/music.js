// Pure helpers for Planet Radio.

/** Next track index: in order, or shuffled without immediately repeating. */
export function nextIndex(current, length, shuffle, rng = Math.random) {
  if (length <= 1) return 0;
  if (!shuffle) return (current + 1) % length;
  let i = Math.floor(rng() * (length - 1));
  if (i >= current) i++;
  return i;
}

export function previousIndex(current, length) {
  return length ? (current - 1 + length) % length : 0;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * The video ID from anything someone might paste: a watch / share / shorts /
 * embed / music.youtube.com link, or a bare 11-character ID. Null if none.
 */
export function parseYouTubeId(input) {
  const text = String(input ?? "").trim();
  if (ID.test(text)) return text;
  let url;
  try {
    url = new URL(text.startsWith("http") ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  let candidate = null;
  if (host === "youtu.be") candidate = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    candidate = url.searchParams.get("v");
    if (!candidate) {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      candidate = m?.[1] ?? null;
    }
  }
  return candidate && ID.test(candidate) ? candidate : null;
}
