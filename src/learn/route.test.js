import { describe, expect, it } from "vitest";
import { isLearn, learnHash, neighbours, parseLearn, resolve } from "./route";

const chapters = [
  { id: "a", lessons: [{ id: "one" }, { id: "two" }] },
  { id: "b", lessons: [{ id: "three" }] },
];

describe("lesson addresses", () => {
  it("recognises the lessons and nothing else", () => {
    expect(isLearn("#/learn")).toBe(true);
    expect(isLearn("#/learn/a/one")).toBe(true);
    expect(isLearn("#/learning")).toBe(false);
    expect(isLearn("#/planet")).toBe(false);
    expect(isLearn("#learn")).toBe(false);
  });

  it("reads and writes the same address", () => {
    expect(parseLearn(learnHash("a", "two"))).toEqual({ chapter: "a", lesson: "two" });
    expect(parseLearn(learnHash("a"))).toEqual({ chapter: "a", lesson: null });
    expect(parseLearn(learnHash())).toEqual({ chapter: null, lesson: null });
  });

  it("falls back when a chapter or lesson doesn't exist", () => {
    expect(resolve(chapters, "#/learn/zzz/one")).toEqual({ chapter: null, lesson: null });
    expect(resolve(chapters, "#/learn/a/zzz").lesson).toBe(null);
    expect(resolve(chapters, "#/learn/a/two").lesson.id).toBe("two");
  });

  it("steps across chapter boundaries", () => {
    const { prev, next } = neighbours(chapters, chapters[0], chapters[0].lessons[1]);
    expect(prev.lesson.id).toBe("one");
    expect(next.lesson.id).toBe("three");
    expect(neighbours(chapters, chapters[1], chapters[1].lessons[0]).next).toBe(null);
  });
});
