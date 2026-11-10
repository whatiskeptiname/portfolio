// Every lesson has what the page needs, and every question can be answered.
// New chapters are checked automatically once they're in the catalogue.
import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { CHAPTERS as OUTLINE_CHAPTERS } from "./chapters";
import { CONTENT, FULL_CHAPTERS as CHAPTERS } from "./chapters/full";
import { optionOrder } from "./math";

describe("the lessons", () => {
  it("every catalogue entry has a title, a blurb and a short hook for the landing page", () => {
    for (const c of CATALOG) {
      expect(c.title).toBeTruthy();
      expect(c.topic).toBeTruthy();
      expect(c.blurb).toBeTruthy();
      expect(c.hook).toBeTruthy();
      expect(c.hook.length).toBeLessThan(70);
    }
  });

  it("every catalogue entry has its lessons", () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(CATALOG.map((c) => c.id));
  });

  it("chapter and lesson ids are unique and safe in an address", () => {
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
    for (const c of CHAPTERS) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/);
      expect(new Set(c.lessons.map((l) => l.id)).size).toBe(c.lessons.length);
      for (const l of c.lessons) expect(l.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  for (const chapter of CHAPTERS) {
    describe(chapter.title, () => {
      for (const lesson of chapter.lessons) {
        it(`${lesson.title} is complete`, () => {
          expect(lesson.title).toBeTruthy();
          expect(lesson.topic).toBeTruthy(); // its plain textbook name
          expect(lesson.lead).toBeTruthy();
          expect(lesson.history).toBeTruthy();
          // The walkthrough: the method in one line, and a scene for each point to remember.
          expect(lesson.reel?.method).toBeTruthy();
          expect(lesson.reel.scenes.length).toBe(lesson.gist.length);
          expect(lesson.idea).toBeTruthy();
          // The fast path: three things to remember, and what it's like in practice.
          expect(lesson.gist.length).toBeGreaterThanOrEqual(2);
          for (const key of ["adjust", "wrong", "notice", "ask"]) expect(lesson.practice[key].length).toBeGreaterThan(0);
          expect(lesson.example).toBeTruthy();
          expect(lesson.play.length).toBeGreaterThan(0);
          for (const p of lesson.play) {
            expect(typeof p.Sim).toBe("function");
            expect(p.try).toBeTruthy();
          }
          expect(lesson.quiz.length).toBeGreaterThan(0);
          for (const q of lesson.quiz) {
            expect(q.q).toBeTruthy();
            if (q.kind === "choice") {
              expect(q.options.filter((o) => o.ok)).toHaveLength(1);
              for (const o of q.options) expect(o.why).toBeTruthy();
            } else if (q.kind === "multi") {
              expect(q.options.some((o) => o.ok)).toBe(true);
              for (const o of q.options) expect(o.why).toBeTruthy();
            } else if (q.kind === "number") {
              expect(Number.isFinite(q.answer)).toBe(true);
              expect(q.tolerance).toBeGreaterThanOrEqual(0);
              expect(q.why).toBeTruthy();
            } else if (q.kind === "task") {
              expect(typeof q.Sim).toBe("function");
              expect(typeof q.check).toBe("function");
              expect(q.done).toBeTruthy();
            } else {
              throw new Error(`unknown question kind ${q.kind}`);
            }
          }
          expect(lesson.explain.options.filter((o) => o.verdict === "right")).toHaveLength(1);
          for (const o of lesson.explain.options) {
            expect(["right", "partly", "wrong"]).toContain(o.verdict);
            expect(o.why).toBeTruthy();
          }
          expect(lesson.readMore.length).toBeGreaterThan(0);
          for (const r of lesson.readMore) expect(r.url).toMatch(/^https:\/\//);
        });
      }
    });
  }
  it("the right answer isn't always in the same place once the options are shown", () => {
    // Lessons are written with the right option first; the page shuffles them.
    const at = {};
    for (const ch of Object.values(CHAPTERS))
      for (const l of ch.lessons) {
        const qs = [...(l.quiz || []).filter((q) => q.kind === "choice"), ...(l.explain ? [{ q: l.explain.q, options: l.explain.options.map((o) => ({ ok: o.verdict === "right" })) }] : [])];
        for (const q of qs) {
          const shown = optionOrder(q.q, q.options.length).findIndex((i) => q.options[i].ok);
          at[shown] = (at[shown] || 0) + 1;
        }
      }
    const total = Object.values(at).reduce((a, b) => a + b, 0);
    for (const n of Object.values(at)) expect(n / total).toBeLessThan(0.4);
  });
  it("the outline and each chapter's file list the same lessons, in one place each", () => {
    // Titles and leads live only in outline.js; everything else only in chapters/<id>.jsx.
    for (const c of OUTLINE_CHAPTERS) {
      const content = CONTENT[c.id].lessons;
      expect(content.map((l) => l.id).sort()).toEqual(c.lessons.map((l) => l.id).sort());
      for (const l of content) {
        expect(l.title).toBeUndefined();
        expect(l.lead).toBeUndefined();
      }
      for (const l of c.lessons) {
        expect(l.title).toBeTruthy();
        expect(l.lead).toBeTruthy();
      }
    }
  });
  it("the right answer doesn't give itself away by being the longest", () => {
    // Written answers drift towards a long, careful right option and short wrong ones.
    // Within each kind of question, the right one may be longest in at most 40% of them,
    // and never by a wide margin.
    for (const kind of ["choice", "explain"]) {
      let longest = 0;
      let n = 0;
      for (const c of CHAPTERS)
        for (const l of c.lessons) {
          const qs = kind === "choice" ? (l.quiz || []).filter((q) => q.kind === "choice") : [l.explain];
          for (const q of qs) {
            const isRight = (o) => (kind === "choice" ? o.ok : o.verdict === "right");
            const right = q.options.find(isRight).t.length;
            const other = Math.max(...q.options.filter((o) => !isRight(o)).map((o) => o.t.length));
            n++;
            if (right > other) longest++;
            expect(right / other, q.q).toBeLessThanOrEqual(1.5);
          }
        }
      expect(longest / n, kind).toBeLessThanOrEqual(0.4);
    }
  });
});
