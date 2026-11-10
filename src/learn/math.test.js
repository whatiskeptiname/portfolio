import { describe, expect, it } from "vitest";
import {
  optionOrder,
  acf,
  arma,
  bestSplit,
  betaInterval,
  betaBinomial,
  betaPdf,
  boost,
  bootstrapCoverage,
  confusion,
  convolve,
  crowdRight,
  entropy,
  enumerate,
  estimates,
  gini,
  gp,
  gpPosterior,
  rbf,
  sampleMvn,
  rng,
  growRegTree,
  growTree,
  leastSquares,
  holtWinters,
  iou,
  majorityRight,
  mase,
  metropolis,
  moons,
  nms,
  normalPdf,
  pacf,
  quantize,
  rates,
  receptiveField,
  rmse,
  roc,
  ses,
  smape,
  softmax,
} from "./math";

describe("impurity", () => {
  it("is zero for a pure group and highest for an even mix", () => {
    expect(gini([10, 0])).toBe(0);
    expect(gini([5, 5])).toBeCloseTo(0.5);
    expect(gini([8, 2])).toBeCloseTo(0.32);
    expect(entropy([5, 5])).toBeCloseTo(1);
    expect(entropy([7, 0])).toBe(0);
  });

  it("finds the split that separates two clean groups", () => {
    const pts = [
      { x: 0.1, y: 0.5, c: 0 },
      { x: 0.2, y: 0.4, c: 0 },
      { x: 0.8, y: 0.6, c: 1 },
      { x: 0.9, y: 0.5, c: 1 },
    ];
    const s = bestSplit(pts);
    expect(s.axis).toBe("x");
    expect(s.at).toBeCloseTo(0.5);
    expect(s.score).toBe(0);
  });

  it("a deep tree memorises its training points", () => {
    const pts = moons(120, 0.12, 3);
    const tree = growTree(pts, 20);
    const right = pts.filter((p) => tree.predict(p.x, p.y) === p.c).length;
    expect(right / pts.length).toBeGreaterThan(0.97);
  });
});

describe("crowds", () => {
  it("a majority of fair-ish voters beats one voter", () => {
    expect(majorityRight(1, 0.6)).toBeCloseTo(0.6);
    expect(majorityRight(25, 0.6)).toBeGreaterThan(0.8);
  });

  it("voters who copy each other are no better than one", () => {
    expect(crowdRight(51, 0.6, 1)).toBeCloseTo(0.6);
  });

  it("a bootstrap sample holds about 63% of the rows", () => {
    expect(bootstrapCoverage(10000)).toBeCloseTo(1 - 1 / Math.E, 3);
  });
});

describe("scoring", () => {
  const items = [
    { score: 0.9, c: 1 },
    { score: 0.8, c: 1 },
    { score: 0.7, c: 0 },
    { score: 0.3, c: 1 },
    { score: 0.1, c: 0 },
  ];

  it("counts hits and misses at a threshold", () => {
    expect(confusion(items, 0.5)).toEqual({ tp: 2, fp: 1, tn: 1, fn: 1 });
    const r = rates(confusion(items, 0.5));
    expect(r.precision).toBeCloseTo(2 / 3);
    expect(r.recall).toBeCloseTo(2 / 3);
  });

  it("a perfect ranking has an area of 1, a reversed one 0", () => {
    expect(roc([{ score: 1, c: 1 }, { score: 0, c: 0 }]).auc).toBe(1);
    expect(roc([{ score: 0, c: 1 }, { score: 1, c: 0 }]).auc).toBe(0);
  });
});

describe("boosting", () => {
  it("gets closer to the data with every round", () => {
    const xs = Array.from({ length: 40 }, (_, i) => i / 40);
    const ys = xs.map((x) => Math.sin(6 * x));
    const err = (r) => {
      const m = boost(xs, ys, r, 0.3);
      return rmse(ys, xs.map(m.predict));
    };
    expect(err(30)).toBeLessThan(err(5));
    expect(err(5)).toBeLessThan(err(1));
  });
});

describe("probability", () => {
  it("the Beta density integrates to one", () => {
    let s = 0;
    for (let i = 0; i < 1000; i++) s += betaPdf((i + 0.5) / 1000, 3, 5) / 1000;
    expect(s).toBeCloseTo(1, 3);
  });

  it("the prior matters with little data and washes out with lots", () => {
    const small = estimates(4, 5, 2, 8);
    const big = estimates(800, 1000, 2, 8);
    expect(Math.abs(small.map - small.mle)).toBeGreaterThan(0.2);
    expect(Math.abs(big.map - big.mle)).toBeLessThan(0.01);
  });

  it("the interval narrows as data arrives", () => {
    const [a1, b1] = betaInterval(3, 3);
    const [a2, b2] = betaInterval(300, 300);
    expect(b2 - a2).toBeLessThan(b1 - a1);
  });

  it("wet grass explains away: seeing the sprinkler on makes rain less likely", () => {
    const net = {
      rain: { p: () => 0.2 },
      sprinkler: { p: (w) => (w.rain ? 0.01 : 0.4) },
      wet: { p: (w) => (w.rain && w.sprinkler ? 0.99 : w.rain ? 0.8 : w.sprinkler ? 0.9 : 0) },
    };
    const wet = enumerate(net, { wet: true });
    const both = enumerate(net, { wet: true, sprinkler: true });
    expect(wet.rain).toBeGreaterThan(0.2);
    expect(both.rain).toBeLessThan(wet.rain);
  });

  it("a GP passes near its points and is unsure far from them", () => {
    const obs = [{ x: 0, y: 1 }, { x: 1, y: -1 }];
    const [at0, far] = gpPosterior(obs, [0, 8], { length: 0.5, noise: 0.01 });
    expect(at0.mean).toBeCloseTo(1, 1);
    expect(at0.sd).toBeLessThan(0.05);
    expect(far.sd).toBeGreaterThan(0.9);
  });

  it("the full GP agrees with the quick one and gives sensible samples", () => {
    const obs = [{ x: 0, y: 1 }, { x: 1, y: -1 }];
    const k = (a, b) => rbf(a, b, 0.5);
    const full = gp(obs, [0, 0.5, 8], k, 0.01);
    const quick = gpPosterior(obs, [0, 0.5, 8], { length: 0.5, noise: 0.01 });
    full.mean.forEach((m, i) => expect(m).toBeCloseTo(quick[i].mean, 6));
    expect(Math.sqrt(full.cov[2][2])).toBeCloseTo(quick[2].sd, 4);
    const draw = sampleMvn(full.mean, full.cov, rng(2));
    expect(draw[0]).toBeCloseTo(1, 0);
  });

  it("future outcomes stay uncertain even when the rate is known", () => {
    let total = 0;
    for (let k = 0; k <= 10; k++) total += betaBinomial(k, 10, 3, 4);
    expect(total).toBeCloseTo(1, 6);
  });

  it("Metropolis samples land where the density is", () => {
    const { samples } = metropolis((x) => normalPdf(x, 2, 0.5), { start: 0, step: 0.8, n: 6000, seed: 4 });
    const kept = samples.slice(500);
    const m = kept.reduce((s, x) => s + x, 0) / kept.length;
    expect(m).toBeCloseTo(2, 0);
  });
});

describe("time series", () => {
  it("an AR(1) series has a slowly fading ACF and one PACF spike", () => {
    const xs = arma(3000, 0.8, 0, 7);
    const r = acf(xs, 5);
    const p = pacf(xs, 5);
    expect(r[0]).toBeCloseTo(1);
    expect(r[1]).toBeCloseTo(0.8, 1);
    expect(r[3]).toBeGreaterThan(0.35);
    expect(p[0]).toBeCloseTo(0.8, 1);
    expect(Math.abs(p[2])).toBeLessThan(0.08);
  });

  it("smoothing with alpha 1 just repeats the last value", () => {
    expect(ses([1, 5, 3], 1).level).toBe(3);
  });

  it("Holt–Winters picks up a clean repeating season", () => {
    const xs = Array.from({ length: 48 }, (_, t) => 10 + [0, 3, 0, -3][t % 4]);
    const { forecast } = holtWinters(xs, 4, 0.3, 0.1, 0.3, 4);
    forecast.forEach((f, h) => expect(f).toBeCloseTo(10 + [0, 3, 0, -3][(48 + h) % 4], 0));
  });

  it("MASE is 1 for a forecaster exactly as good as 'same as last time'", () => {
    const train = [1, 2, 3, 4];
    expect(mase([5], [4], train)).toBeCloseTo(1);
    expect(smape([100], [100])).toBe(0);
  });
});

describe("regression", () => {
  it("least squares recovers a line", () => {
    const X = [0, 1, 2, 3, 4].map((x) => [1, x]);
    const w = leastSquares(X, [1, 3, 5, 7, 9]);
    expect(w[0]).toBeCloseTo(1, 5);
    expect(w[1]).toBeCloseTo(2, 5);
  });

  it("a regression tree can't predict beyond what it has seen", () => {
    const rows = Array.from({ length: 50 }, (_, i) => [i]);
    const ys = rows.map(([x]) => 2 * x);
    const predict = growRegTree(rows, ys, 6, 2);
    expect(predict([25])).toBeCloseTo(50, -1);
    expect(predict([500])).toBeLessThanOrEqual(98);
  });
});

describe("vision", () => {
  it("an edge kernel fires on an edge and nowhere else", () => {
    const img = [
      [0, 0, 1, 1],
      [0, 0, 1, 1],
      [0, 0, 1, 1],
    ];
    const out = convolve(img, [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1],
    ]);
    expect(out[1][1]).toBeGreaterThan(0);
    expect(out[1][0]).toBe(0);
  });

  it("IoU is 1 for the same box, 0 for apart, 1/3 for half-shifted", () => {
    const a = { x: 0, y: 0, w: 2, h: 2 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { x: 5, y: 5, w: 2, h: 2 })).toBe(0);
    expect(iou(a, { x: 1, y: 0, w: 2, h: 2 })).toBeCloseTo(1 / 3);
  });

  it("NMS keeps one box per object", () => {
    const boxes = [
      { x: 0, y: 0, w: 10, h: 10, score: 0.9 },
      { x: 1, y: 1, w: 10, h: 10, score: 0.8 },
      { x: 50, y: 50, w: 10, h: 10, score: 0.7 },
    ];
    expect(nms(boxes, 0.5).kept.map((b) => b.score)).toEqual([0.9, 0.7]);
  });

  it("dilation widens what a layer sees without more weights", () => {
    expect(receptiveField([1, 1, 1])).toBe(7);
    expect(receptiveField([1, 2, 4])).toBe(15);
  });

  it("fewer bits means bigger rounding error", () => {
    const w = Array.from({ length: 200 }, (_, i) => Math.sin(i * 1.7));
    expect(rmse(w, quantize(w, 4))).toBeGreaterThan(rmse(w, quantize(w, 8)));
  });

  it("softmax sums to one and sharpens at low temperature", () => {
    const p = softmax([1, 2, 3]);
    expect(p.reduce((a, b) => a + b)).toBeCloseTo(1);
    expect(softmax([1, 2, 3], 0.1)[2]).toBeGreaterThan(p[2]);
  });
});

describe("optionOrder", () => {
  it("is a shuffle of every option, the same each time for the same question", () => {
    const a = optionOrder("Which activation do transformers use?", 4);
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
    expect(optionOrder("Which activation do transformers use?", 4)).toEqual(a);
  });
  it("puts the first option in every position across many questions", () => {
    const firstAt = [0, 0, 0, 0];
    for (let q = 0; q < 400; q++) firstAt[optionOrder(`question ${q}`, 4).indexOf(0)]++;
    for (const n of firstAt) expect(n).toBeGreaterThan(60);
  });
});
