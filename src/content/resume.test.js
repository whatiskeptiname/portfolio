import { describe, expect, it } from "vitest";
import { alongside, buildPath, caseStudies, caseStudyOrder, skills, strengths } from "./resume";
import { FIGURES } from "../components/site/figureMap";

describe("the landing page's content", () => {
  it("shows every skill category once in the Toolbox", () => {
    const placed = [...buildPath.flatMap((step) => step.categories), ...alongside];
    expect([...placed].sort()).toEqual(skills.map((s) => s.category).sort());
  });

  it("links each strength to a different, real case study", () => {
    const links = strengths.map((s) => s.work).filter(Boolean);
    expect(new Set(links).size).toBe(links.length);
    for (const id of links) expect(caseStudies.some((c) => c.id === id), id).toBe(true);
  });

  it("shows every case study once in the Work section", () => {
    expect([...caseStudyOrder].sort()).toEqual(caseStudies.map((c) => c.id).sort());
  });

  it("gives every strength a picture", () => {
    for (const s of strengths) expect(FIGURES[s.figure], s.title).toBeTypeOf("function");
  });
});
