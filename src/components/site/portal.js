// Going through a door on the landing page: a new sky opens out of what you
// clicked and fills the screen, then the new place takes over underneath. Each
// place starts downloading as soon as someone shows interest, so there's little
// or nothing left to wait for.
const DURATION = 800;

export const preloadPlanet = () => import("../../city/CityExplorer");
export const preloadLearn = () => import("../../learn/Learn");

function openInto(event, hash, preload, variant) {
  // A new-tab click, or someone who'd rather not have motion, just follows the link.
  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  event.preventDefault();
  preload();
  const box = event.currentTarget.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  const sky = document.createElement("div");
  sky.className = variant ? `portal portal-${variant}` : "portal";
  sky.setAttribute("aria-hidden", "true");
  sky.style.setProperty("--x", `${x}px`);
  sky.style.setProperty("--y", `${y}px`);
  document.body.append(sky);

  const opening = sky.animate(
    [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${reach}px at ${x}px ${y}px)` }],
    { duration: DURATION, easing: "cubic-bezier(0.7, 0, 0.2, 1)", fill: "forwards" }
  );
  opening.finished.then(() => {
    window.location.hash = hash;
    sky.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 200, fill: "forwards" }).finished.then(() => sky.remove());
  });
}

export const enterPlanet = (event, hash) => openInto(event, hash, preloadPlanet);
// The lessons are dark unless the visitor picked light, so open into whichever they'll get.
function learnTheme() {
  try {
    return localStorage.getItem("theme") === "light" ? "learn-light" : "learn";
  } catch {
    return "learn";
  }
}

export const enterLearn = (event, hash) => openInto(event, hash, preloadLearn, learnTheme());
