// Every lesson has what the page needs, and every question can be answered.
// New chapters are checked automatically once they're in the catalogue.
import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { CHAPTERS } from "./chapters";

describe("the lessons", () => {
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
          expect(lesson.lead).toBeTruthy();
          expect(lesson.idea).toBeTruthy();
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
});
