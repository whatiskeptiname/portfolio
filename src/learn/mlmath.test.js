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

import { ACTIVATIONS, gradientThrough, spreadThroughLayers, TRACE, traceLayer, traceWorking } from "./mlmath";

describe("activations and normalisation", () => {
  it("knows each activation's value and slope", () => {
    expect(ACTIVATIONS.sigmoid.df(0)).toBeCloseTo(0.25, 6);
    expect(ACTIVATIONS.relu.f(-3)).toBe(0);
    expect(ACTIVATIONS.relu.df(2)).toBe(1);
    expect(ACTIVATIONS.gelu.f(0)).toBeCloseTo(0, 4);
    expect(ACTIVATIONS.gelu.f(3)).toBeCloseTo(3 * 0.99865, 2);
  });

  it("sigmoid's gradient vanishes through depth far faster than ReLU's", () => {
    expect(gradientThrough("sigmoid", 10)).toBeLessThan(1e-6);
    expect(gradientThrough("tanh", 10)).toBeLessThan(0.1);
    expect(gradientThrough("relu", 10)).toBeGreaterThan(0.9);
    expect(gradientThrough("relu", 10)).toBeLessThan(1.1);
  });

  it("without normalisation values explode or vanish with depth; with it they stay put", () => {
    const big = spreadThroughLayers({ depth: 20, scale: 2 }).spreads;
    const small = spreadThroughLayers({ depth: 20, scale: 0.8 }).spreads;
    expect(big.at(-1)).toBeGreaterThan(100);
    expect(small.at(-1)).toBeLessThan(0.01);
    for (const norm of ["batch", "layer"]) {
      const s = spreadThroughLayers({ depth: 20, scale: 2, norm }).spreads;
      expect(s.at(-1)).toBeGreaterThan(0.5);
      expect(s.at(-1)).toBeLessThan(2);
    }
  });

  it("batch norm depends on the batch, more so in tiny batches; layer norm doesn't", () => {
    const tiny = spreadThroughLayers({ depth: 6, norm: "batch", batch: 2 }).batchEffect;
    const big = spreadThroughLayers({ depth: 6, norm: "batch", batch: 64 }).batchEffect;
    expect(tiny).toBeGreaterThan(big);
    expect(spreadThroughLayers({ depth: 6, norm: "layer", batch: 2 }).batchEffect).toBeLessThan(1e-9);
  });
});

describe("traceLayer", () => {
  it("adds each input times its connection's weight, plus the bias", () => {
    const { Z } = traceLayer("none", "none");
    expect(Z[0][0]).toBeCloseTo(2.05, 6);
    expect(Z[0][1]).toBeCloseTo(-1.15, 6);
  });
  it("collapses to one linear layer without an activation", () => {
    const { Y } = traceLayer("none", "none");
    TRACE.X.forEach((x, i) => expect(Y[i][0]).toBeCloseTo(1.47 * x[0] - 0.43 * x[1] - 0.53 * x[2] + 0.24, 6));
  });
  it("switches off negative neurons with ReLU, and changes nothing when all are positive", () => {
    const relu = traceLayer("relu", "none");
    const lin = traceLayer("none", "none");
    expect(relu.A[0]).toEqual([expect.closeTo(2.05, 6), 0, 0]);
    expect(relu.Y[2][0]).toBeCloseTo(lin.Y[2][0], 6);
  });
  it("normalises down the batch for batch norm and across each input for layer norm", () => {
    const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
    const batch = traceLayer("relu", "batch").N;
    const layer = traceLayer("relu", "layer").N;
    for (let j = 0; j < 3; j++) expect(mean(batch.map((r) => r[j]))).toBeCloseTo(0, 6);
    for (const row of layer) expect(mean(row)).toBeCloseTo(0, 6);
    expect(batch[0][0]).toBeCloseTo(1.06, 2);
    expect(layer[0][0]).toBeCloseTo(1.41, 2);
  });
});

describe("traceWorking", () => {
  it("writes the weighted sum with the real weights and inputs", () => {
    const [sum] = traceWorking("none", "none", 0, 0);
    expect(sum.sub).toBe("z1 = 0.80·1.00 + (−0.50)·(−2.00) + 0.30·0.50 + 0.10");
    expect(sum.result).toBeCloseTo(2.05, 6);
  });
  it("takes batch norm's mean down the batch and layer norm's across the input", () => {
    const batch = traceWorking("relu", "batch", 0, 0)[1];
    expect(batch.sub).toContain("μ = (2.05 − 0.30 + 1.90 − 0.39) / 4 = 0.815\nσ = √(mean of (value − μ)²) = 1.162");
    expect(batch.result).toBeCloseTo(1.06, 2);
    const layer = traceWorking("relu", "layer", 0, 0)[1];
    expect(layer.sub).toContain("μ = (2.05 − 1.15 − 1.10) / 3 = −0.067");
    expect(layer.sub).toContain("ẑ = (2.05 − (−0.067)) / 1.497");
    expect(layer.result).toBeCloseTo(1.41, 2);
  });
  it("applies the chosen activation and ends with both outputs", () => {
    const steps = traceWorking("relu", "none", 0, 1);
    expect(steps[2].sub).toBe("a = max(0, −1.15)");
    expect(steps[2].result).toBe(0);
    expect(steps[3].sub).toContain("y1 = 1.00·2.05 + (−0.70)·0.00 + 0.50·0.00 + 0.00 = 2.05");
  });
});
