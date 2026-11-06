// The site's pages, each with one name used everywhere: the header link, the
// section's heading, its URL and the browser tab's title.

export const SECTIONS = [
  { id: "work", label: "Work" },
  { id: "experience", label: "Experience" },
  { id: "toolbox", label: "Toolbox" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
];

export const PLANET = { hash: "#/planet", label: "3D planet" };

// Addresses that have been public, so links already shared keep working.
const MOVED = { "#/city": PLANET.hash, "#open-source": "#projects" };

/** The current address for a location hash, keeping any ?options on it. */
export function canonicalHash(hash) {
  const [path, query] = hash.split("?");
  const to = MOVED[path] ?? path;
  return query === undefined ? to : `${to}?${query}`;
}

export function isPlanet(hash) {
  const path = hash.split("?")[0];
  return path === PLANET.hash;
}

/** What the browser tab says: the page's name, or the site's on the home page. */
export function pageTitle(name, label) {
  return label ? `${label} · ${name}` : `${name} · Portfolio`;
}
