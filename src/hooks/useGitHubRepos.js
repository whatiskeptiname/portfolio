// src/hooks/useGitHubRepos.js
import { useState, useEffect } from "react";

/**
 * Custom hook to fetch GitHub repos for a given username.
 * Groups them by primary language (or "Other" if no language).
 * Returns { groupedRepos, loading, error }.
 */
export default function useGitHubRepos(username) {
  const [groupedRepos, setGroupedRepos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!username) {
      setError(new Error("No GitHub username provided."));
      setLoading(false);
      return;
    }

    async function fetchRepos() {
      try {
        const perPage = 100;
        let page = 1;
        let allRepos = [];

        // If you want private repos, uncomment below and set .env → VITE_GITHUB_TOKEN
        // const token = import.meta.env.VITE_GITHUB_TOKEN;
        // const headers = token
        //   ? { Authorization: `Bearer ${token}` }
        //   : {};
        //
        // For now, fetch only public repos:
        const headers = {};

        while (true) {
          const response = await fetch(
            `https://api.github.com/users/${username}/repos?per_page=${perPage}&page=${page}`,
            { headers }
          );
          if (!response.ok) {
            throw new Error(
              `GitHub API returned ${response.status}: ${await response.text()}`
            );
          }
          const data = await response.json();
          if (data.length === 0) break;
          allRepos = allRepos.concat(data);
          if (data.length < perPage) break;
          page++;
        }

        // Group by language
        const grouped = {};
        allRepos.forEach((repo) => {
          const lang = repo.language || "Other";
          if (!grouped[lang]) grouped[lang] = [];
          grouped[lang].push({
            name: repo.name,
            description: repo.description,
            html_url: repo.html_url,
            language: lang,
            stargazers_count: repo.stargazers_count,
          });
        });

        setGroupedRepos(grouped);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching GitHub repos:", err);
        setError(err);
        setLoading(false);
      }
    }

    fetchRepos();
  }, [username]);

  return { groupedRepos, loading, error };
}
