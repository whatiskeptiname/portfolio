// Going through the header's tiny planet: the sky opens out of it and fills the
// screen, then the 3D world takes over underneath. The world starts downloading
// as soon as someone shows interest, so there's little or nothing left to wait for.
const DURATION = 800;

export const preloadPlanet = () => import("../../city/CityExplorer");

export function enterPlanet(event, hash) {
  // A new-tab click, or someone who'd rather not have motion, just follows the link.
  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  event.preventDefault();
  preloadPlanet();
  const box = event.currentTarget.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  const sky = document.createElement("div");
  sky.className = "portal";
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
