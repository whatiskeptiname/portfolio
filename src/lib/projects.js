// Pure helpers that turn the raw GitHub snapshot into what the site shows.

export const OTHER_LANGUAGE = "Other";

export function curateProjects(repos, config) {
  const hidden = new Set(config.hidden ?? []);
  return repos
    .filter((r) => !hidden.has(r.name))
    .filter((r) => !(config.hideForks && r.fork))
    .filter((r) => !(config.hideArchived && r.archived))
    .map((r) => {
      const o = config.overrides?.[r.name] ?? {};
      return {
        name: r.name,
        title: o.title ?? prettifyName(r.name),
        description: o.description ?? r.description ?? "",
        url: r.html_url,
        demo: o.demo ?? r.homepage ?? null,
        image: o.image ?? null,
        language: r.language || OTHER_LANGUAGE,
        topics: r.topics ?? [],
        stars: r.stargazers_count ?? 0,
        pushedAt: r.pushed_at,
      };
    })
    .sort(byStarsThenRecency);
}

export function pickFeatured(projects, config) {
  const count = config.featuredCount ?? 6;
  if (config.featured?.length) {
    const byName = new Map(projects.map((p) => [p.name, p]));
    return config.featured.map((n) => byName.get(n)).filter(Boolean).slice(0, count);
  }
  return projects.filter((p) => p.description).slice(0, count);
}

// Returns [{ language, projects }] — biggest language first, "Other" last.
export function groupByLanguage(projects) {
  const groups = new Map();
  for (const p of projects) {
    if (!groups.has(p.language)) groups.set(p.language, []);
    groups.get(p.language).push(p);
  }
  return [...groups]
    .map(([language, list]) => ({ language, projects: list }))
    .sort((a, b) => {
      if (a.language === OTHER_LANGUAGE) return 1;
      if (b.language === OTHER_LANGUAGE) return -1;
      return b.projects.length - a.projects.length || a.language.localeCompare(b.language);
    });
}

export function prettifyName(name) {
  return name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function byStarsThenRecency(a, b) {
  return b.stars - a.stars || String(b.pushedAt).localeCompare(String(a.pushedAt));
}
