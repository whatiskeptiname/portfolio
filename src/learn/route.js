// Where you are in the lessons, read from and written to the address:
// #/learn, #/learn/<chapter>, #/learn/<chapter>/<lesson>.

export const LEARN_HASH = "#/learn";

export function isLearn(hash) {
  const path = hash.split("?")[0];
  return path === LEARN_HASH || path.startsWith(`${LEARN_HASH}/`);
}

export function parseLearn(hash) {
  const [, , chapter = null, lesson = null] = hash.split("?")[0].replace(/^#/, "").split("/");
  return { chapter: chapter || null, lesson: lesson || null };
}

export function learnHash(chapter, lesson) {
  if (!chapter) return LEARN_HASH;
  return lesson ? `${LEARN_HASH}/${chapter}/${lesson}` : `${LEARN_HASH}/${chapter}`;
}

/** The chapter and lesson an address points at, falling back to what exists. */
export function resolve(chapters, hash) {
  const { chapter: cid, lesson: lid } = parseLearn(hash);
  const chapter = chapters.find((c) => c.id === cid) ?? null;
  if (!chapter) return { chapter: null, lesson: null };
  const lesson = chapter.lessons.find((l) => l.id === lid) ?? null;
  return { chapter, lesson };
}

/** The lessons either side of this one, across chapter boundaries. */
export function neighbours(chapters, chapter, lesson) {
  const flat = chapters.flatMap((c) => c.lessons.map((l) => ({ chapter: c, lesson: l })));
  const i = flat.findIndex((x) => x.chapter.id === chapter.id && x.lesson.id === lesson.id);
  return { prev: flat[i - 1] ?? null, next: flat[i + 1] ?? null };
}
