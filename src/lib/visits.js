// Anonymous visit counts through GoatCounter (wikin.goatcounter.com): no cookies,
// nothing personal stored. The site's pages live after the "#" (#/learn/...,
// #/planet), which GoatCounter can't see on its own, so its automatic count is
// switched off in index.html and every page and event is counted here instead.
//
// The file isn't called analytics.js on purpose: ad blockers block any URL ending
// that way, and on the dev server (one file per module) that stopped the whole site.

/** The path to count for an address: "#/learn/neural/layers" counts as "/learn/neural/layers"; the home page and its sections all count as "/". */
export function pagePath(hash) {
  const path = (hash || "").split("?")[0];
  if (!path.startsWith("#/")) return "/";
  return path.slice(1).replace(/\/+$/, "") || "/";
}

/** An event's name: lower case, words joined by dashes, nothing that could carry personal data. */
export function eventName(...parts) {
  return parts
    .map((p) =>
      String(p)
        .toLowerCase()
        .replace(/[^a-z0-9/.]+/g, "-")
        .replace(/^[-/.]+|[-/.]+$/g, "")
    )
    .filter(Boolean)
    .join("/");
}

// Counts made before GoatCounter's script has loaded wait here.
const waiting = [];
let polling = false;

function send(vars) {
  if (typeof window === "undefined") return;
  const gc = window.goatcounter;
  if (gc && typeof gc.count === "function") {
    gc.count(vars);
    return;
  }
  waiting.push(vars);
  if (polling) return;
  polling = true;
  // The script loads asynchronously; check for it for up to 20 seconds, then give up quietly (say, a blocker).
  let tries = 0;
  const timer = setInterval(() => {
    const ready = window.goatcounter && typeof window.goatcounter.count === "function";
    if (ready) while (waiting.length) window.goatcounter.count(waiting.shift());
    if (ready || ++tries > 40) {
      clearInterval(timer);
      polling = false;
      if (!ready) waiting.length = 0;
    }
  }, 500);
}

/** How long someone stayed, as a band (a rough figure is all that's useful, and all that's sent). */
export function durationBand(ms) {
  const s = ms / 1000;
  if (s < 10) return "under-10s";
  if (s < 30) return "10-30s";
  if (s < 60) return "30s-1m";
  if (s < 180) return "1-3m";
  if (s < 600) return "3-10m";
  if (s < 1800) return "10-30m";
  return "over-30m";
}

/**
 * The event for following a link, or null for a link within the site: "out/github.com",
 * "email", "download/susan-ghimire-cv.pdf". Only the site's name is kept, never the rest
 * of the address.
 */
export function linkEvent(href, here, isDownload = false) {
  let url;
  try {
    url = new URL(href, here);
  } catch {
    return null;
  }
  if (url.protocol === "mailto:") return "email";
  if (url.protocol === "tel:") return "phone";
  const file = url.pathname.split("/").pop();
  if (isDownload || /\.(pdf|docx?|zip)$/i.test(file)) return `download/${file}`;
  if (url.host === new URL(here).host) return null;
  return `out/${url.host.replace(/^www\./, "")}`;
}

let lastPage = null;
let pageStart = 0;
let once = new Set();

/** Counts how long the current page was open, when someone leaves it. */
function countTime() {
  if (lastPage === null || !pageStart) return;
  countEvent("time", lastPage === "/" ? "home" : lastPage, durationBand(Date.now() - pageStart));
  pageStart = 0;
}

/** Counts a page view for this address, once per change of page (moving between home sections isn't a new page). */
export function countPage(hash) {
  const path = pagePath(hash);
  if (path === lastPage) return;
  countTime();
  lastPage = path;
  pageStart = Date.now();
  once = new Set();
  send({ path });
}

/** Counts something once per page visit, however often it happens (a slider dragged back and forth is one count). */
export function countOnce(...parts) {
  const path = eventName(...parts);
  if (!path || once.has(path)) return;
  once.add(path);
  send({ path, event: true });
}

/** An error message safe to count: web and email addresses and long numbers taken out, and kept short. */
export function scrubError(message) {
  return String(message || "unknown")
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "<link>")
    .replace(/\S+@\S+\.\S+/g, "<email>")
    .replace(/\d{4,}/g, "<number>")
    .slice(0, 60);
}

/** A name cut to a few words at most, at a word boundary: "compare-activation-functions-and-how". */
export function shortName(text, max = 36) {
  const slug = eventName(text);
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max + 1);
  return cut.slice(0, cut.lastIndexOf("-") > 10 ? cut.lastIndexOf("-") : max);
}

/** The page being looked at, without "/learn/": "neural/layers", for naming events. */
export const here = () => (typeof window === "undefined" ? "" : pagePath(window.location.hash).replace(/^\/learn\/?/, "") || "home");

let started = false;

/**
 * Counts what happens on any page: links followed out of the site, time on the page
 * when someone leaves, errors they hit (the first few), and a few facts about how
 * they're browsing. Starts once.
 */
export function startCounting() {
  if (started || typeof window === "undefined") return;
  started = true;
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest?.("a[href]");
      const name = a && linkEvent(a.getAttribute("href"), window.location.href, a.hasAttribute("download"));
      if (name) countEvent(name, here());
    },
    true
  );
  window.addEventListener("pagehide", countTime);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") countTime();
    else if (!pageStart) pageStart = Date.now();
  });
  let errors = 0;
  const onError = (message) => {
    if (errors++ < 5) countEvent("error", here(), scrubError(message));
  };
  window.addEventListener("error", (e) => onError(e.message));
  window.addEventListener("unhandledrejection", (e) => onError(e.reason?.message || e.reason));
  const media = (q) => window.matchMedia?.(q).matches;
  countEvent("browsing", media("(pointer: coarse)") ? "touch" : "mouse");
  if (media("(prefers-reduced-motion: reduce)")) countEvent("browsing", "reduced-motion");
  countEvent("browsing", media("(prefers-color-scheme: dark)") ? "prefers-dark" : "prefers-light");
}

/** Counts something someone did, like finishing a lesson. */
export function countEvent(...parts) {
  const path = eventName(...parts);
  if (path) send({ path, event: true });
}
