import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countEvent, countOnce, countPage, durationBand, eventName, linkEvent, pagePath, scrubError, shortName } from "./visits";

describe("pagePath", () => {
  it("counts the part after #/ as the page", () => {
    expect(pagePath("#/learn/neural/layers")).toBe("/learn/neural/layers");
    expect(pagePath("#/learn")).toBe("/learn");
    expect(pagePath("#/learn/")).toBe("/learn");
  });
  it("drops query settings, so every vehicle and camera is one planet page", () => {
    expect(pagePath("#/planet?vehicle=car&view=fpv")).toBe("/planet");
  });
  it("counts the home page and all its sections as one page", () => {
    expect(pagePath("")).toBe("/");
    expect(pagePath("#")).toBe("/");
    expect(pagePath("#contact")).toBe("/");
  });
});

describe("eventName", () => {
  it("joins plain lower-case parts with slashes", () => {
    expect(eventName("quiz", "neural/layers", "q2", "right")).toBe("quiz/neural/layers/q2/right");
    expect(eventName("sim", "Trace one input: weighted sums!")).toBe("sim/trace-one-input-weighted-sums");
    expect(eventName("", "lesson-done")).toBe("lesson-done");
  });
});

describe("counting", () => {
  // The tests run in Node, so they stand in a bare window for GoatCounter to hang off.
  beforeEach(() => {
    globalThis.window = {};
  });
  afterEach(() => {
    delete globalThis.window;
  });
  it("sends pages and events to GoatCounter, without repeating the same page", () => {
    const count = vi.fn();
    window.goatcounter = { count };
    countPage("#/learn/vision");
    countPage("#/learn/vision");
    countPage("#/learn/vision/convolution");
    countEvent("lesson-done", "vision/convolution");
    expect(count.mock.calls.map((c) => c[0])).toEqual([
      { path: "/learn/vision" },
      { path: "time/learn/vision/under-10s", event: true },
      { path: "/learn/vision/convolution" },
      { path: "lesson-done/vision/convolution", event: true },
    ]);
  });
  it("holds counts until GoatCounter's script has loaded", () => {
    vi.useFakeTimers();
    countPage("#/planet");
    const count = vi.fn();
    window.goatcounter = { count };
    vi.advanceTimersByTime(600);
    expect(count).toHaveBeenCalledWith({ path: "/planet" });
    vi.useRealTimers();
  });
});

describe("durationBand", () => {
  it("rounds a stay into a band", () => {
    expect(durationBand(4000)).toBe("under-10s");
    expect(durationBand(45000)).toBe("30s-1m");
    expect(durationBand(5 * 60000)).toBe("3-10m");
    expect(durationBand(2 * 3600000)).toBe("over-30m");
  });
});

describe("linkEvent", () => {
  const here = "https://susang.com.np/#/learn/neural/layers";
  it("names a link out by its site only", () => {
    expect(linkEvent("https://github.com/whatiskeptiname/portfolio?tab=readme", here)).toBe("out/github.com");
    expect(linkEvent("https://www.linkedin.com/in/someone", here)).toBe("out/linkedin.com");
  });
  it("tells email, phone and downloads apart", () => {
    expect(linkEvent("mailto:someone@example.com", here)).toBe("email");
    expect(linkEvent("tel:+977000", here)).toBe("phone");
    expect(linkEvent("/files/susan-cv.pdf", here)).toBe("download/susan-cv.pdf");
    expect(linkEvent("/anything", here, true)).toBe("download/anything");
  });
  it("ignores links within the site", () => {
    expect(linkEvent("#/learn/vision", here)).toBeNull();
    expect(linkEvent("https://susang.com.np/#contact", here)).toBeNull();
  });
});

describe("counting once and timing", () => {
  beforeEach(() => {
    globalThis.window = {};
  });
  afterEach(() => {
    delete globalThis.window;
    vi.useRealTimers();
  });
  it("counts a repeated action once per page, and again on the next page", () => {
    const count = vi.fn();
    window.goatcounter = { count };
    countPage("#/learn/trees");
    countOnce("control", "trees", "depth");
    countOnce("control", "trees", "depth");
    countPage("#/learn/trees/splits");
    countOnce("control", "trees", "depth");
    const events = count.mock.calls.map((c) => c[0].path).filter((p) => p.startsWith("control"));
    expect(events).toEqual(["control/trees/depth", "control/trees/depth"]);
  });
  it("counts how long the last page was open when the page changes", () => {
    vi.useFakeTimers();
    const count = vi.fn();
    window.goatcounter = { count };
    countPage("#/learn/bayes");
    vi.advanceTimersByTime(90000);
    countPage("#/planet");
    expect(count).toHaveBeenCalledWith({ path: "time/learn/bayes/1-3m", event: true });
  });
});

describe("names", () => {
  it("keeps the dots in a site's name", () => {
    expect(eventName("out/github.com", "home")).toBe("out/github.com/home");
  });
  it("cuts long names at a word", () => {
    expect(shortName("Compare activation functions and how much gradient survives")).toBe("compare-activation-functions-and-how");
    expect(shortName("Short one")).toBe("short-one");
  });
});

describe("scrubError", () => {
  it("takes addresses and long numbers out of an error before it's counted", () => {
    expect(scrubError("Failed to load https://example.com/a?b=c for someone@example.com, code 123456")).toBe("Failed to load <link> for <email> code <number>");
    expect(scrubError(undefined)).toBe("unknown");
  });
});
