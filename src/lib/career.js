// Pure helpers for résumé data: dates, the timeline chart and the city's
// Career district.

// "2022-06" → months since year 0. null → `now`.
export function toMonths(ym, now = new Date()) {
  if (!ym) return now.getFullYear() * 12 + now.getMonth();
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + (m - 1);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonth(ym) {
  if (!ym) return "Present";
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatPeriod(start, end) {
  return start === end ? formatMonth(start) : `${formatMonth(start)} – ${formatMonth(end)}`;
}

export function yearsSince(ym, now = new Date()) {
  return Math.floor((toMonths(null, now) - toMonths(ym)) / 12);
}

/**
 * Lays entries out on a shared time axis for the timeline chart.
 * @returns {{ startYear, endYear, rows: { id, label, sub, kind, left, width }[] }}
 *          with left/width as percentages of the axis.
 */
export function timelineRows(entries, now = new Date()) {
  const startYear = Math.min(...entries.map((e) => Number(e.start.slice(0, 4))));
  const endYear = Math.max(...entries.map((e) => (e.end ? Number(e.end.slice(0, 4)) : now.getFullYear()))) + 1;
  const axisStart = startYear * 12;
  const span = (endYear - startYear) * 12;
  const rows = [...entries]
    .sort((a, b) => toMonths(a.start) - toMonths(b.start))
    .map((e) => {
      const from = toMonths(e.start) - axisStart;
      const to = toMonths(e.end, now) - axisStart + 1;
      return {
        id: e.id,
        label: e.label,
        sub: e.sub,
        kind: e.kind,
        ongoing: !e.end,
        left: (from / span) * 100,
        width: Math.max(1.5, ((to - from) / span) * 100),
      };
    });
  return { startYear, endYear, rows };
}

// Which northern district each résumé item belongs to.
const DISTRICT_OF = {
  Work: "Work",
  Teaching: "Learning",
  Education: "Learning",
  Fellowship: "Learning",
  Publication: "Learning",
  Leadership: "Community",
  Award: "Community",
};
export const CAREER_DISTRICTS = ["Work", "Learning", "Community"];

/**
 * Turns résumé items into district groups for the northern (résumé)
 * hemisphere of the planet. Each item becomes a "project" with kind "career"
 * so the scene and info panel can style it.
 */
export function careerDistricts(caseStudies, roles, background, awards = []) {
  const roleFor = (id) => roles.find((r) => r.projects?.includes(id));
  const awardIds = new Set(awards);
  const items = [
    ...caseStudies.map((c) => {
      const role = roleFor(c.id);
      return {
        name: `career:${c.id}`,
        kind: "career",
        category: awardIds.has(c.id) ? "Award" : "Work",
        link: `#case-${c.id}`,
        title: c.title,
        subtitle: c.org,
        period: role ? formatPeriod(role.start, role.end) : null,
        description: c.metric ? `${c.metric.value} ${c.metric.label}` : "",
        highlights: c.highlights,
        topics: c.tags,
        weight: c.weight,
        stars: 0,
      };
    }),
    ...roles
      .filter((r) => r.highlights?.length)
      .map((r) => ({
        name: `career:${r.id}`,
        kind: "career",
        category: "Teaching",
        link: "#experience",
        title: r.title,
        subtitle: r.org,
        period: formatPeriod(r.start, r.end),
        description: "",
        highlights: r.highlights,
        topics: [],
        weight: 12,
        stars: 0,
      })),
    ...background.map((b) => ({
      name: `career:${b.id}`,
      kind: "career",
      category: b.kind,
      link: "#background",
      title: b.title,
      subtitle: b.org,
      period: formatPeriod(b.start, b.end),
      description: "",
      highlights: b.highlights ?? [],
      topics: [],
      weight: b.weight,
      stars: 0,
    })),
  ];
  return CAREER_DISTRICTS.map((district) => ({
    language: district,
    side: "north",
    kind: "career",
    unit: "landmark",
    projects: items.filter((i) => (DISTRICT_OF[i.category] ?? "Work") === district),
  })).filter((g) => g.projects.length);
}
