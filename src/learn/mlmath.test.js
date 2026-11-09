import { describe, expect, it } from "vitest";
import { range, rng } from "./math";
import {
  abTest,
  accuracyOverTime,
  batching,
  descend,
  factorise,
  fitLine,
  fitLogistic,
  fitPolynomial,
  groupRates,
  histogram,
  kmeansStep,
  lineMse,
  nearest,
  nextTokenProbs,
  normalCdf,
  polyAt,
  principalAngle,
  psi,
  retrieve,
  rSquared,
  sigmoid,
  standardise,
  tokenize,
  varianceAlong,
  zScores,
} from "./mlmath";

describe("lines and curves", () => {
  it("fits the exact line through points on a line, with R² of 1", () => {
    const pts = [0, 1, 2, 3].map((x) => ({ x, y: 2 + 3 * x }));
    const { a, b } = fitLine(pts);
    expect(a).toBeCloseTo(2, 9);
    expect(b).toBeCloseTo(3, 9);
    expect(lineMse(pts, a, b)).toBeCloseTo(0, 9);
    expect(rSquared(pts, a, b)).toBeCloseTo(1, 9);
  });

  it("descends to the bottom of a bowl with a sensible step, and blows up with too big a one", () => {
    const df = (x) => 2 * (x - 3); // (x − 3)²
    expect(descend(df, -4, 0.1, 100).at(-1)).toBeCloseTo(3, 4);
    const wild = descend(df, -4, 1.1, 40);
    expect(Math.abs(wild.at(-1) - 3)).toBeGreaterThan(10);
  });

  it("fits a logistic curve that puts the 50% point between the classes", () => {
    const pts = range(20).map((i) => ({ x: i / 2, c: i >= 10 ? 1 : 0 }));
    const { w, b } = fitLogistic(pts);
    expect(w).toBeGreaterThan(0);
    const mid = -b / w;
    expect(mid).toBeGreaterThan(4);
    expect(mid).toBeLessThan(5.5);
    expect(sigmoid(0)).toBe(0.5);
  });

  it("shrinks wiggly polynomial coefficients as the penalty grows", () => {
    const rand = rng(2);
    const pts = range(12).map((i) => {
      const x = -1 + (2 * i) / 11;
      return { x, y: Math.sin(2 * x) + (rand() - 0.5) * 0.4 };
    });
    const loose = fitPolynomial(pts, 9, 0);
    const tight = fitPolynomial(pts, 9, 1);
    const size = (c) => c.slice(1).reduce((s, v) => s + v * v, 0);
    expect(size(tight)).toBeLessThan(size(loose));
    // An unpenalised quadratic recovers y = 1 + 2x + 3x².
    const q = fitPolynomial(range(5).map((i) => ({ x: i / 4, y: 1 + 2 * (i / 4) + 3 * (i / 4) ** 2 })), 2, 0);
    expect(polyAt(q, 0.5)).toBeCloseTo(1 + 1 + 0.75, 6);
  });
});

describe("features, groups and directions", () => {
  it("standardises columns, and changes who your nearest neighbour is", () => {
    // Income in rupees (huge numbers) and age in years (small ones).
    const rows = [
      [50000, 30], // the person we're matching
      [50500, 70], // same income, very different age
      [55000, 31], // a little richer, same age
      [20000, 40],
      [90000, 35],
    ];
    expect(nearest(rows.slice(1), rows[0])).toBe(0); // raw: income dominates
    const { rows: z } = standardise(rows);
    expect(nearest(z.slice(1), z[0])).toBe(1); // scaled: age counts too
  });

  it("k-means moves centres to the middle of their points and never increases the spread", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 10, y: 0 },
      { x: 10, y: 1 },
    ];
    let s = kmeansStep(pts, [{ x: 1, y: 0 }, { x: 2, y: 0 }]);
    const first = s.inertia;
    s = kmeansStep(pts, s.centres);
    s = kmeansStep(pts, s.centres);
    expect(s.inertia).toBeLessThanOrEqual(first);
    expect(s.centres.map((c) => Math.round(c.x)).sort((a, b) => a - b)).toEqual([0, 10]);
  });

  it("finds the direction of greatest spread", () => {
    const pts = range(20).map((i) => ({ x: i, y: i + (i % 2 ? 0.2 : -0.2) }));
    const a = principalAngle(pts);
    expect(a).toBeCloseTo(Math.PI / 4, 1);
    expect(varianceAlong(pts, a).share).toBeGreaterThan(0.99);
    expect(varianceAlong(pts, a + Math.PI / 2).share).toBeLessThan(0.01);
  });

  it("flags the odd value out by its z-score", () => {
    const z = zScores([10, 11, 9, 10, 10, 30]);
    expect(Math.abs(z[5])).toBeGreaterThan(2);
    expect(Math.abs(z[0])).toBeLessThan(1);
  });
});

describe("language", () => {
  const vocab = new Set(["the", " cat", " sat", " un", "believ", "able", " on", " mat"]);

  it("tokenizes common words whole and rare ones into pieces", () => {
    expect(tokenize("the cat sat", vocab)).toEqual(["the", " cat", " sat"]);
    expect(tokenize(" unbelievable", vocab)).toEqual([" un", "believ", "able"]);
    expect(tokenize("xz", vocab)).toEqual(["x", "z"]);
  });

  it("sharpens at low temperature and flattens at high", () => {
    const s = [3, 2, 1];
    expect(nextTokenProbs(s, 0)).toEqual([1, 0, 0]);
    expect(nextTokenProbs(s, 0.5)[0]).toBeGreaterThan(nextTokenProbs(s, 2)[0]);
    expect(nextTokenProbs(s, 1).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it("retrieves the documents that share the question's words", () => {
    const docs = ["Refunds are paid within 14 days.", "Our office opens at nine.", "Delivery takes three days."];
    expect(retrieve("How many days until my refund is paid?", docs, 1)[0].i).toBe(0);
  });
});

describe("in production", () => {
  it("measures no drift between a histogram and itself, and a lot after a shift", () => {
    const a = [10, 20, 40, 20, 10];
    expect(psi(a, a)).toBeCloseTo(0, 9);
    expect(psi(a, [40, 30, 20, 8, 2])).toBeGreaterThan(0.25);
    expect(histogram([0.1, 0.5, 0.9], 0, 1, 2)).toEqual([1, 2]);
  });

  it("A/B: a big real difference is significant, a tiny sample isn't", () => {
    expect(abTest(100, 1000, 140, 1000).p).toBeLessThan(0.05);
    expect(abTest(5, 50, 7, 50).p).toBeGreaterThan(0.05);
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
  });

  it("one cut-off gives different error rates to groups with different score spreads", () => {
    const a = [{ score: 0.8, y: 1 }, { score: 0.3, y: 0 }];
    const b = [{ score: 0.45, y: 1 }, { score: 0.2, y: 0 }];
    expect(groupRates(a, 0.5).fnr).toBe(0);
    expect(groupRates(b, 0.5).fnr).toBe(1);
  });

  it("factorisation learns the ratings it's given", () => {
    const ratings = [];
    for (let u = 0; u < 6; u++) for (let i = 0; i < 6; i++) if ((u + i) % 3) ratings.push({ u, i, r: u < 3 === i < 3 ? 5 : 1 });
    const m = factorise(ratings, 6, 6, 2, { steps: 800 });
    expect(m.rmse).toBeLessThan(0.6);
    // A held-out pair in the same taste group is predicted high.
    expect(m.predict(0, 0)).toBeGreaterThan(m.predict(0, 3));
  });

  it("bigger batches serve more requests a second, but make each wait longer when traffic is light", () => {
    const one = batching(1, 20, 4, 20);
    const many = batching(16, 20, 4, 20);
    expect(many.capacity).toBeGreaterThan(one.capacity);
    expect(many.latency).toBeGreaterThan(one.latency);
    expect(batching(1, 100, 4, 20).latency).toBe(Infinity); // over capacity: the queue never empties
  });

  it("retraining resets the decay", () => {
    expect(accuracyOverTime(10, 0.9, 0.01, 0).at(-1)).toBeCloseTo(0.81, 9);
    expect(accuracyOverTime(10, 0.9, 0.01, 5).at(-1)).toBeCloseTo(0.86, 9);
  });
});

import { memoryLeft, trainMlp, xorPoints } from "./mlmath";

describe("neural networks", () => {
  it("can't solve XOR without a hidden layer that bends, and can with one", () => {
    const pts = xorPoints(80, 4);
    const flat = trainMlp(pts, 4, { activation: "linear", steps: 400 });
    const bent = trainMlp(pts, 6, { steps: 1500, rate: 1 });
    expect(flat.accuracy).toBeLessThan(0.75);
    expect(bent.accuracy).toBeGreaterThan(0.9);
    expect(bent.history.at(-1).loss).toBeLessThan(bent.history[0].loss);
  });

  it("a plain recurrent net forgets fast; a forget gate near 1 remembers", () => {
    expect(memoryLeft(20, 0.7)).toBeLessThan(0.001);
    expect(memoryLeft(20, 0.98)).toBeGreaterThan(0.6);
  });
});
