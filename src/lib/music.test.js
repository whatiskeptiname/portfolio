import { describe, expect, it } from "vitest";
import { formatTime, nextIndex, parseYouTubeId, previousIndex } from "./music";
import { STATIONS } from "../content/music";

describe("track order", () => {
  it("steps forward and wraps", () => {
    expect(nextIndex(0, 4, false)).toBe(1);
    expect(nextIndex(3, 4, false)).toBe(0);
    expect(previousIndex(0, 4)).toBe(3);
  });

  it("shuffles without repeating the current track", () => {
    for (let k = 0; k < 50; k++) {
      const v = Math.random();
      expect(nextIndex(2, 4, true, () => v)).not.toBe(2);
    }
    expect(nextIndex(0, 1, true)).toBe(0);
  });
});

it("formats times", () => {
  expect(formatTime(0)).toBe("0:00");
  expect(formatTime(227)).toBe("3:47");
  expect(formatTime(NaN)).toBe("0:00");
});

describe("parseYouTubeId", () => {
  it("accepts every common link shape and bare IDs", () => {
    const id = "hbX0BTGpkFw";
    for (const input of [
      id,
      `https://www.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/watch?v=${id}&list=PL123&t=42s`,
      `https://youtu.be/${id}?si=abc`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://music.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
      `youtube.com/watch?v=${id}`,
    ]) {
      expect(parseYouTubeId(input)).toBe(id);
    }
  });

  it("rejects things that aren't YouTube videos", () => {
    for (const input of ["", "hello", "https://vimeo.com/123", "https://www.youtube.com/@channel", "https://youtu.be/short"]) {
      expect(parseYouTubeId(input)).toBeNull();
    }
  });
});

describe("catalogue", () => {
  const tracks = STATIONS.flatMap((s) => s.tracks);
  it("has Nepali, Hindi and English stations", () => {
    expect(STATIONS.map((s) => s.id)).toEqual(["nepali", "hindi", "english"]);
  });

  it("lists valid, unique video IDs with titles and artists", () => {
    for (const t of tracks) {
      expect(parseYouTubeId(t.id)).toBe(t.id);
      expect(t.title && t.artist).toBeTruthy();
    }
    expect(new Set(tracks.map((t) => t.id)).size).toBe(tracks.length);
  });
});
