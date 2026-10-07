// Single source for site data: the build-time GitHub snapshot, profile config
// and résumé.
import snapshot from "./repos.json";
import { projectConfig } from "../content/profile";
import { background, caseStudies, roles, skills } from "../content/resume";
import { curateProjects, groupByLanguage, pickFeatured } from "../lib/projects";
import { careerDistricts } from "../lib/career";
import { languageHue } from "../lib/layout";

export const projects = curateProjects(snapshot.repos, projectConfig);
export const featured = pickFeatured(projects, projectConfig);
export const languageGroups = groupByLanguage(projects);
export const fetchedAt = snapshot.fetched_at;

// The 3D planet: the résumé fills the northern hemisphere (Work, Learning,
// Community), GitHub the southern one (a district per language). Skills
// become roadside billboards.
export const cityGroups = [
  ...careerDistricts(caseStudies, roles, background, ["catdox"]),
  ...languageGroups.map((g) => ({ ...g, side: "south" })),
];
export const cityBillboards = skills.map((s) => ({ id: s.category, title: s.category, items: s.items }));

export function languageColor(language, lightness = 52) {
  return `hsl(${Math.round(languageHue(language) * 360)} 55% ${lightness}%)`;
}
