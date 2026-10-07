import { describe, expect, it } from "vitest";
import { careerDistricts, formatPeriod, timelineRows, yearsSince } from "./career";

const now = new Date(2026, 9, 5); // Oct 2026

describe("dates", () => {
  it("formats periods", () => {
    expect(formatPeriod("2022-06", null)).toBe("Jun 2022 – Present");
    expect(formatPeriod("2023-12", "2023-12")).toBe("Dec 2023");
  });

  it("counts whole years", () => {
    expect(yearsSince("2022-06", now)).toBe(4);
  });
});

describe("timelineRows", () => {
  const { startYear, endYear, rows } = timelineRows(
    [
      { id: "b", label: "B", start: "2022-06", end: null },
      { id: "a", label: "A", start: "2017-11", end: "2022-04" },
    ],
    now
  );

  it("spans from the first start year to after the latest end", () => {
    expect([startYear, endYear]).toEqual([2017, 2027]);
  });

  it("sorts by start and keeps bars inside the axis", () => {
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    for (const r of rows) {
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.left + r.width).toBeLessThanOrEqual(100);
    }
    expect(rows[1].ongoing).toBe(true);
  });
});

describe("careerDistricts", () => {
  const groups = careerDistricts(
    [
      { id: "x", title: "X", org: "Org", weight: 10, highlights: [], tags: [] },
      { id: "prize", title: "P", org: "Hack", weight: 5, highlights: [], tags: [] },
    ],
    [
      { id: "r1", title: "Eng", org: "Org", start: "2022-01", end: null, projects: ["x"] },
      { id: "r2", title: "TA", org: "Org", start: "2024-05", end: "2024-10", highlights: ["h"] },
    ],
    [
      { id: "edu", kind: "Education", title: "BE", org: "Uni", start: "2017-11", end: "2022-04", weight: 5 },
      { id: "club", kind: "Leadership", title: "Pres", org: "Club", start: "2021-03", end: "2022-05", weight: 5 },
    ],
    ["prize"]
  );
  const byName = Object.fromEntries(groups.map((g) => [g.language, g.projects.map((p) => p.name)]));

  it("splits the résumé into Work, Learning and Community districts in the north", () => {
    expect(byName).toEqual({
      Work: ["career:x"],
      Learning: ["career:r2", "career:edu"],
      Community: ["career:prize", "career:club"],
    });
    expect(groups.every((g) => g.side === "north" && g.kind === "career")).toBe(true);
  });

  it("links each landmark back to the right page section", () => {
    const work = groups[0].projects[0];
    expect(work.period).toBe("Jan 2022 – Present");
    expect(work.link).toBe("#case-x");
    expect(groups[1].projects.map((p) => p.link)).toEqual(["#experience", "#background"]);
  });
});
