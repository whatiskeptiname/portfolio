// Every chapter in the catalogue's order, in two layers. CHAPTERS is the light
// outline (titles, leads, plain topic names) that the library, chapter pages and
// lesson rail need, and it's in the first download. loadChapter fetches one
// chapter's lessons in full (text, simulations, quizzes, walkthroughs) the first
// time someone opens it, so nobody downloads all eight chapters to read one.
import { CATALOG } from "../catalog";
import { OUTLINE } from "../outline";
import { LESSON_TOPICS } from "../topics";

export const CHAPTERS = CATALOG.filter((c) => OUTLINE[c.id]).map((c) => ({
  ...c,
  history: OUTLINE[c.id].history,
  lessons: OUTLINE[c.id].lessons.map((l) => ({ ...l, topic: LESSON_TOPICS[`${c.id}/${l.id}`] })),
}));

/** A chapter's lessons in full: the outline, the lesson's own file, and its walkthrough (keyed "chapter/lesson"). */
export function fullLessons(chapter, content, reels) {
  const byId = Object.fromEntries(content.lessons.map((l) => [l.id, l]));
  return chapter.lessons.map((l) => {
    const reel = reels[`${chapter.id}/${l.id}`];
    return { ...byId[l.id], ...l, ...(reel ? { reel } : {}) };
  });
}

const LOADERS = {
  foundations: () => import("./foundations"),
  neural: () => import("./neural"),
  trees: () => import("./trees"),
  bayes: () => import("./bayes"),
  time: () => import("./time"),
  vision: () => import("./vision"),
  language: () => import("./language"),
  wild: () => import("./wild"),
};

const loaded = new Map();

/** Fetches a chapter's lessons in full, once; later calls get the same promise. */
export function loadChapter(chapter) {
  if (!loaded.has(chapter.id)) {
    const job = Promise.all([LOADERS[chapter.id](), import("../reels")]).then(([m, r]) => fullLessons(chapter, m.default, r.REELS));
    // A failed download (say, offline) shouldn't stick: let the next visit try again.
    job.catch(() => loaded.delete(chapter.id));
    loaded.set(chapter.id, job);
  }
  return loaded.get(chapter.id);
}

export const CHAPTER_IDS = Object.keys(LOADERS);
