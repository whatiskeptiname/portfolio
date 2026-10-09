import { describe, expect, it } from "vitest";
import {
  BASELINE,
  DEFAULT_WEIGHTS,
  RECEIPT,
  explainForecast,
  fewestCameras,
  forecast,
  mapSchema,
  optimise,
  renderMinutes,
  rigCoverage,
  tableCells,
} from "./sims";

describe("surgical capture rig", () => {
  it("needs six cameras for full two-view coverage, and 30 is mostly redundant", () => {
    expect(fewestCameras()).toBe(6);
    expect(rigCoverage(5).covered).toBeLessThan(1);
    for (const n of [6, 7, 8, 9]) expect(rigCoverage(n).covered).toBe(1);
    expect(rigCoverage(30).mean).toBeGreaterThan(rigCoverage(9).mean * 3);
  });

  it("renders in 7–20 minutes once optimised, hours before", () => {
    for (const n of [6, 9, 30]) {
      expect(renderMinutes(n, true)).toBeGreaterThanOrEqual(7);
      expect(renderMinutes(n, true)).toBeLessThanOrEqual(20);
      expect(renderMinutes(n, false)).toBeGreaterThan(120);
    }
  });
});

describe("inference acceleration", () => {
  it("prune + sparsify + quantize is 7× faster at 80.26%; distillation brings it to 82.88% at half the size", () => {
    const compressed = optimise({ prune: true, sparsify: true, quantize: true });
    expect(compressed.speed).toBeCloseTo(7);
    expect(compressed.accuracy).toBe(80.26);
    expect(compressed.withinBaseline).toBe(false);
    const all = optimise({ prune: true, sparsify: true, quantize: true, distill: true });
    expect(all.accuracy).toBe(82.88);
    expect(all.params).toBe(50);
    expect(all.withinBaseline).toBe(true);
  });

  it("does nothing with nothing switched on", () => {
    expect(optimise({})).toMatchObject({ speed: 1, latency: BASELINE.latency, accuracy: BASELINE.accuracy, params: 100 });
  });
});

describe("demand forecasting", () => {
  it("a price cut sells more units; YTD adds up and MoM follows the months", () => {
    const rows = forecast(-0.1);
    expect(rows).toHaveLength(12);
    expect(rows[0].units).toBeGreaterThan(rows[0].baseUnits);
    expect(rows[11].ytd).toBeCloseTo(rows.reduce((s, r) => s + r.revenue, 0));
    expect(rows[0].mom).toBeNull();
    expect(rows[1].mom).toBeCloseTo(rows[1].revenue / rows[0].revenue - 1);
  });

  it("no change matches the baseline exactly", () => {
    for (const r of forecast(0)) expect(r.delta).toBeCloseTo(0);
  });

  it("answers in plain language with the forecast's own numbers", () => {
    expect(explainForecast(-0.1, "worth")).toMatch(/^Yes/);
    expect(explainForecast(0.1, "worth")).toMatch(/^Probably not/);
    expect(explainForecast(-0.1, "peak")).toMatch(/Dec/);
    expect(explainForecast(-0.1, "ytd")).toMatch(/ahead/);
  });
});

describe("schema mapping", () => {
  it("gets 70% right out of the box", () => {
    expect(mapSchema(DEFAULT_WEIGHTS).accuracy).toBeCloseTo(0.7);
  });

  it("tuning the config can do better", () => {
    expect(mapSchema({ name: 0, type: 0.2, semantic: 0.15, threshold: 0.3 }).accuracy).toBeGreaterThan(0.7);
  });
});

describe("table structure", () => {
  it("one cell per receipt entry, inside the table", () => {
    const cells = tableCells(10, 20, 200, 120);
    expect(cells).toHaveLength(RECEIPT.length * RECEIPT[0].length);
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(10);
      expect(c.x + c.w).toBeLessThanOrEqual(210.0001);
      expect(c.y + c.h).toBeLessThanOrEqual(140.0001);
    }
  });
});
