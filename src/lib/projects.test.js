import { describe, expect, it } from "vitest";
import { curateProjects, groupByLanguage, pickFeatured, prettifyName } from "./projects";

const repo = (name, extra = {}) => ({
  name,
  description: `${name} desc`,
  html_url: `https://github.com/u/${name}`,
  language: "C++",
  stargazers_count: 0,
  fork: false,
  archived: false,
  pushed_at: "2022-01-01T00:00:00Z",
  ...extra,
});

describe("curateProjects", () => {
  it("drops hidden repos and forks, applies overrides, sorts by stars", () => {
    const out = curateProjects(
      [repo("a"), repo("b", { stargazers_count: 5 }), repo("fork", { fork: true }), repo("secret")],
      { hidden: ["secret"], hideForks: true, overrides: { a: { description: "custom" } } }
    );
    expect(out.map((p) => p.name)).toEqual(["b", "a"]);
    expect(out[1].description).toBe("custom");
  });

  it("labels repos without a language as Other", () => {
    const [p] = curateProjects([repo("x", { language: null })], {});
    expect(p.language).toBe("Other");
  });
});

describe("pickFeatured", () => {
  const projects = curateProjects([repo("a"), repo("b"), repo("c", { description: null })], {});

  it("uses the configured order when given", () => {
    expect(pickFeatured(projects, { featured: ["b", "missing", "a"] }).map((p) => p.name)).toEqual(["b", "a"]);
  });

  it("falls back to described projects, capped by featuredCount", () => {
    expect(pickFeatured(projects, { featuredCount: 1 }).map((p) => p.name)).toHaveLength(1);
    expect(pickFeatured(projects, {}).map((p) => p.name)).not.toContain("c");
  });
});

describe("groupByLanguage", () => {
  it("orders by size and puts Other last", () => {
    const projects = curateProjects(
      [repo("o", { language: null }), repo("p1", { language: "Python" }), repo("c1"), repo("c2")],
      {}
    );
    expect(groupByLanguage(projects).map((g) => g.language)).toEqual(["C++", "Python", "Other"]);
  });
});

it("prettifies repo names", () => {
  expect(prettifyName("Obstacle-and-fall_avoiding--bot")).toBe("Obstacle and fall avoiding bot");
});
