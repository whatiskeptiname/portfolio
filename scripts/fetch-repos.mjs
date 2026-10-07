// Fetches public repositories at build time and writes a trimmed snapshot to
// src/data/repos.json, so visitors never hit the GitHub API (or its rate limit).
//
//   node scripts/fetch-repos.mjs            # uses GITHUB_TOKEN if set
//   GITHUB_USER=someone node scripts/...    # override the user
import { writeFile } from "node:fs/promises";

const user = process.env.GITHUB_USER || "whatiskeptiname";
const token = process.env.GITHUB_TOKEN;
const out = new URL("../src/data/repos.json", import.meta.url);

const headers = { Accept: "application/vnd.github+json", "User-Agent": "portfolio-build" };
if (token) headers.Authorization = `Bearer ${token}`;

async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}: ${await res.text()}`);
  return res.json();
}

const repos = [];
for (let page = 1; ; page++) {
  const batch = await getJson(
    `https://api.github.com/users/${user}/repos?per_page=100&page=${page}&type=owner`
  );
  repos.push(...batch);
  if (batch.length < 100) break;
}

const trimmed = repos
  .map((r) => ({
    name: r.name,
    description: r.description,
    html_url: r.html_url,
    homepage: r.homepage || null,
    language: r.language,
    topics: r.topics ?? [],
    stargazers_count: r.stargazers_count,
    forks_count: r.forks_count,
    fork: r.fork,
    archived: r.archived,
    created_at: r.created_at,
    pushed_at: r.pushed_at,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

await writeFile(out, JSON.stringify({ user, fetched_at: new Date().toISOString(), repos: trimmed }, null, 2) + "\n");
console.log(`Wrote ${trimmed.length} repos for ${user} → ${out.pathname}`);
