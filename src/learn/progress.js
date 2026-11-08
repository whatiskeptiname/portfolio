// Which lessons you've finished, remembered in this browser only. If storage
// isn't available (private mode, blocked site data) it simply isn't remembered.
import { useCallback, useSyncExternalStore } from "react";

const KEY = "learn-progress";
const listeners = new Set();
let cache = null;

function read() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not remembered; the page still works.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Progress for every lesson, keyed "chapter/lesson": { quiz: n right of m, done }. */
export function useProgress() {
  const all = useSyncExternalStore(subscribe, read, () => ({}));
  const mark = useCallback((key, patch) => write({ ...read(), [key]: { ...read()[key], ...patch } }), []);
  return [all, mark];
}

export const lessonKey = (chapter, lesson) => `${chapter.id}/${lesson.id}`;
