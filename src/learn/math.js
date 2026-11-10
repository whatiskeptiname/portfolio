// The maths behind the lesson simulations. Plain functions, so they can be tested.

/** A seeded random stream in [0, 1), so a simulation looks the same each time it opens. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One draw from a standard normal, from a uniform stream. */
export function normal(rand) {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const sum = (xs) => xs.reduce((s, x) => s + x, 0);
export const mean = (xs) => (xs.length ? sum(xs) / xs.length : 0);
export const range = (n) => Array.from({ length: n }, (_, i) => i);

// ---------------------------------------------------------------------------
// Trees

/** How mixed a group is: 0 when every member is the same class. */
export function gini(counts) {
  const n = sum(counts);
  if (!n) return 0;
  return 1 - sum(counts.map((c) => (c / n) ** 2));
}

/** The same idea in bits: how many yes/no questions it takes to name a member's class. */
export function entropy(counts) {
  const n = sum(counts);
  if (!n) return 0;
  return 0 - sum(counts.filter((c) => c > 0).map((c) => (c / n) * Math.log2(c / n))) || 0;
}

/** How often a majority of n independent voters, each right with chance p, is right. */
export function majorityRight(n, p) {
  let total = 0;
  for (let k = Math.floor(n / 2) + 1; k <= n; k++) total += Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
  // A tie (even n) is settled by a coin toss.
  if (n % 2 === 0) total += 0.5 * Math.exp(logChoose(n, n / 2) + (n / 2) * Math.log(p) + (n / 2) * Math.log(1 - p));
  return total;
}

/**
 * Voters who share some of their mistakes: with chance `rho` every voter copies
 * one shared answer, otherwise each votes on their own.
 */
export function crowdRight(n, p, rho) {
  return rho * p + (1 - rho) * majorityRight(n, p);
}

/** The share of rows that make it into a bootstrap sample of the same size. */
export const bootstrapCoverage = (n) => 1 - (1 - 1 / n) ** n;

/**
 * A classification tree on 2D points ({x, y, c} with c 0 or 1), split by Gini,
 * grown to `depth`. Returns a function that predicts the class at (x, y).
 */
export function growTree(points, depth, minLeaf = 1) {
  const leaf = (pts) => {
    const ones = pts.filter((p) => p.c === 1).length;
    return { leaf: true, c: ones * 2 >= pts.length ? 1 : 0, n: pts.length };
  };
  const build = (pts, d) => {
    if (d === 0 || pts.length <= minLeaf * 2) return leaf(pts);
    const best = bestSplit(pts, minLeaf);
    if (!best) return leaf(pts);
    const left = pts.filter((p) => p[best.axis] < best.at);
    const right = pts.filter((p) => p[best.axis] >= best.at);
    return { axis: best.axis, at: best.at, left: build(left, d - 1), right: build(right, d - 1) };
  };
  const root = build(points, depth);
  const predict = (x, y) => {
    let node = root;
    while (!node.leaf) node = (node.axis === "x" ? x : y) < node.at ? node.left : node.right;
    return node.c;
  };
  return { root, predict };
}

/** The split that leaves the two sides least mixed (weighted Gini), or null if none helps. */
export function bestSplit(points, minLeaf = 1) {
  const parent = gini(countClasses(points));
  let best = null;
  for (const axis of ["x", "y"]) {
    const sorted = [...points].sort((a, b) => a[axis] - b[axis]);
    const right = countClasses(sorted);
    const left = [0, 0];
    for (let i = 0; i < sorted.length - 1; i++) {
      left[sorted[i].c]++;
      right[sorted[i].c]--;
      if (sorted[i][axis] === sorted[i + 1][axis]) continue;
      const nl = i + 1;
      const nr = sorted.length - nl;
      if (nl < minLeaf || nr < minLeaf) continue;
      const score = (nl * gini(left) + nr * gini(right)) / sorted.length;
      if (score < parent - 1e-9 && (!best || score < best.score)) {
        best = { axis, at: (sorted[i][axis] + sorted[i + 1][axis]) / 2, score };
      }
    }
  }
  return best;
}

export function countClasses(points) {
  const counts = [0, 0];
  for (const p of points) counts[p.c]++;
  return counts;
}

/** The share of points a predictor gets right. */
export function accuracy(points, predict) {
  if (!points.length) return 0;
  return points.filter((p) => predict(p.x, p.y) === p.c).length / points.length;
}

/** Two interleaved half moons with label noise: a classic shape a straight line can't split. */
export function moons(n, noise, seed) {
  const rand = rng(seed);
  return range(n).map((i) => {
    const c = i % 2;
    const t = Math.PI * rand();
    const x = c ? 1 - Math.cos(t) : Math.cos(t);
    const y = c ? 0.5 - Math.sin(t) : Math.sin(t);
    return { x: (x + 1.2) / 3.4 + normal(rand) * noise, y: (y + 0.7) / 1.9 + normal(rand) * noise, c };
  });
}

// ---------------------------------------------------------------------------
// Scoring a classifier

/** Counts of each kind of hit and miss when scores at or above `threshold` mean "yes". */
export function confusion(items, threshold) {
  const m = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const { score, c } of items) {
    if (score >= threshold) m[c ? "tp" : "fp"]++;
    else m[c ? "fn" : "tn"]++;
  }
  return m;
}

export function rates({ tp, fp, tn, fn }) {
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    accuracy: (tp + tn) / Math.max(1, tp + fp + tn + fn),
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    fpr: fp + tn ? fp / (fp + tn) : 0,
  };
}

/** The ROC curve, from the strictest threshold to the most lenient, and the area under it. */
export function roc(items) {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const pos = items.filter((i) => i.c).length;
  const neg = items.length - pos;
  const curve = [{ fpr: 0, tpr: 0 }];
  let tp = 0;
  let fp = 0;
  for (const item of sorted) {
    if (item.c) tp++;
    else fp++;
    curve.push({ fpr: neg ? fp / neg : 0, tpr: pos ? tp / pos : 0 });
  }
  let auc = 0;
  for (let i = 1; i < curve.length; i++) auc += (curve[i].fpr - curve[i - 1].fpr) * (curve[i].tpr + curve[i - 1].tpr) / 2;
  return { curve, auc };
}

// ---------------------------------------------------------------------------
// Boosting: small trees, each fitted to what the ones before it got wrong

/** The one-split tree (a stump) on 1D data that best fits `targets`. */
export function fitStump(xs, targets) {
  const order = range(xs.length).sort((a, b) => xs[a] - xs[b]);
  const total = sum(targets);
  let leftSum = 0;
  let best = { at: Infinity, left: total / xs.length, right: total / xs.length, sse: Infinity };
  for (let k = 0; k < order.length - 1; k++) {
    leftSum += targets[order[k]];
    const nl = k + 1;
    const nr = order.length - nl;
    if (xs[order[k]] === xs[order[k + 1]]) continue;
    const l = leftSum / nl;
    const r = (total - leftSum) / nr;
    let sse = 0;
    for (let j = 0; j < order.length; j++) {
      const t = targets[order[j]];
      sse += (t - (j <= k ? l : r)) ** 2;
    }
    if (sse < best.sse) best = { at: (xs[order[k]] + xs[order[k + 1]]) / 2, left: l, right: r, sse };
  }
  return best;
}

/** Gradient boosting with stumps for squared error: the predictions after each round. */
export function boost(xs, ys, rounds, rate) {
  const start = mean(ys);
  const stumps = [];
  const pred = xs.map(() => start);
  for (let r = 0; r < rounds; r++) {
    const residuals = ys.map((y, i) => y - pred[i]);
    const s = fitStump(xs, residuals);
    stumps.push(s);
    xs.forEach((x, i) => (pred[i] += rate * (x < s.at ? s.left : s.right)));
  }
  const predict = (x) => start + rate * sum(stumps.map((s) => (x < s.at ? s.left : s.right)));
  return { stumps, predict, start };
}

// ---------------------------------------------------------------------------
// Probability

/** log Γ(x), by Lanczos' approximation. */
export function logGamma(x) {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export const logChoose = (n, k) => logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);

export function betaPdf(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) + logGamma(a + b) - logGamma(a) - logGamma(b));
}

export const normalPdf = (x, mu = 0, sd = 1) => Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));

/** The three ways to estimate a rate from k successes in n tries, with a Beta(a, b) prior. */
export function estimates(k, n, a, b) {
  return {
    mle: n ? k / n : NaN,
    map: a + k - 1 > 0 && b + n - k - 1 >= 0 ? (a + k - 1) / (a + b + n - 2) : NaN,
    posterior: { a: a + k, b: b + n - k },
    posteriorMean: (a + k) / (a + b + n),
  };
}

/** The interval holding the middle `mass` of a Beta(a, b), found numerically. */
export function betaInterval(a, b, mass = 0.94, steps = 2000) {
  const xs = range(steps).map((i) => (i + 0.5) / steps);
  const pdf = xs.map((x) => betaPdf(x, a, b));
  const total = sum(pdf);
  let acc = 0;
  let lo = 0;
  let hi = 1;
  const tail = (1 - mass) / 2;
  for (let i = 0; i < steps; i++) {
    acc += pdf[i] / total;
    if (acc < tail) lo = xs[i];
    if (acc < 1 - tail) hi = xs[i];
  }
  return [lo, hi];
}

/** The chance of each answer in a small Bayesian network, by adding up every possible world. */
export function enumerate(network, evidence) {
  const names = Object.keys(network);
  const worlds = [];
  const visit = (i, world) => {
    if (i === names.length) return worlds.push({ ...world });
    for (const value of [true, false]) {
      world[names[i]] = value;
      visit(i + 1, world);
    }
  };
  visit(0, {});
  const weight = (world) =>
    names.reduce((w, name) => {
      const node = network[name];
      const p = node.p(world);
      return w * (world[name] ? p : 1 - p);
    }, 1);
  const kept = worlds.filter((w) => Object.entries(evidence).every(([k, v]) => w[k] === v));
  const total = sum(kept.map(weight));
  return Object.fromEntries(names.map((name) => [name, total ? sum(kept.filter((w) => w[name]).map(weight)) / total : 0]));
}

// ---------------------------------------------------------------------------
// Gaussian processes

export const rbf = (a, b, length, height = 1) => height * height * Math.exp(-((a - b) ** 2) / (2 * length * length));

/** Cholesky factor L of a symmetric positive-definite matrix (L Lᵀ = A). */
export function cholesky(A) {
  const n = A.length;
  const L = A.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
    }
  }
  return L;
}

function solveLower(L, b) {
  const x = [];
  for (let i = 0; i < L.length; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * x[k];
    x.push(s / L[i][i]);
  }
  return x;
}

function solveUpper(L, b) {
  const n = L.length;
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

/** A periodic kernel: points a whole period apart are treated as alike. */
export const periodic = (a, b, length, period, height = 1) => height * height * Math.exp((-2 * Math.sin((Math.PI * Math.abs(a - b)) / period) ** 2) / (length * length));

/**
 * The full GP posterior over test points for any kernel k(a, b): the mean at
 * each point and the covariance between every pair (for drawing samples).
 */
export function gp(observed, tests, kernel, noise = 0.05) {
  const xs = observed.map((p) => p.x);
  const Kss = tests.map((a) => tests.map((b) => kernel(a, b)));
  if (!xs.length) return { mean: tests.map(() => 0), cov: Kss };
  const K = xs.map((a, i) => xs.map((b, j) => kernel(a, b) + (i === j ? noise * noise : 0)));
  const L = cholesky(K);
  const alpha = solveUpper(L, solveLower(L, observed.map((p) => p.y)));
  const V = tests.map((t) => solveLower(L, xs.map((x) => kernel(x, t))));
  const mean = tests.map((t) => sum(xs.map((x, j) => kernel(x, t) * alpha[j])));
  const cov = tests.map((_, i) => tests.map((__, j) => Kss[i][j] - sum(V[i].map((v, k) => v * V[j][k]))));
  return { mean, cov };
}

/** Draws from a multivariate normal with this mean and covariance. */
export function sampleMvn(mean, cov, rand) {
  const L = cholesky(cov.map((row, i) => row.map((v, j) => v + (i === j ? 1e-6 : 0))));
  const z = mean.map(() => normal(rand));
  return mean.map((m, i) => m + sum(L[i].slice(0, i + 1).map((l, k) => l * z[k])));
}

/** Chance of k successes in n future tries when the rate itself is Beta(a, b). */
export function betaBinomial(k, n, a, b) {
  return Math.exp(logChoose(n, k) + logGamma(k + a) + logGamma(n - k + b) - logGamma(n + a + b) + logGamma(a + b) - logGamma(a) - logGamma(b));
}

/** Solves A x = b for a symmetric positive-definite A. */
export function solveSPD(A, b) {
  const L = cholesky(A);
  return solveUpper(L, solveLower(L, b));
}

/** Ordinary least squares: the weights w minimising |X w − y|², with a tiny ridge for stability. */
export function leastSquares(X, y, ridge = 1e-8) {
  const p = X[0].length;
  const XtX = range(p).map((i) => range(p).map((j) => sum(X.map((r) => r[i] * r[j])) + (i === j ? ridge : 0)));
  const Xty = range(p).map((i) => sum(X.map((r, k) => r[i] * y[k])));
  return solveSPD(XtX, Xty);
}

/**
 * A regression tree on rows of numbers: each split picks the feature and
 * threshold that most reduce squared error, and each leaf predicts its mean.
 */
export function growRegTree(rows, ys, depth, minLeaf = 3) {
  const build = (idx, d) => {
    const m = mean(idx.map((i) => ys[i]));
    if (d === 0 || idx.length < minLeaf * 2) return { leaf: true, value: m };
    let best = null;
    for (let f = 0; f < rows[0].length; f++) {
      const sorted = [...idx].sort((a, b) => rows[a][f] - rows[b][f]);
      const total = sum(sorted.map((i) => ys[i]));
      const totalSq = sum(sorted.map((i) => ys[i] * ys[i]));
      let ls = 0;
      let lsq = 0;
      for (let k = 0; k < sorted.length - 1; k++) {
        const y = ys[sorted[k]];
        ls += y;
        lsq += y * y;
        const nl = k + 1;
        const nr = sorted.length - nl;
        if (nl < minLeaf || nr < minLeaf || rows[sorted[k]][f] === rows[sorted[k + 1]][f]) continue;
        const sse = lsq - (ls * ls) / nl + (totalSq - lsq) - ((total - ls) * (total - ls)) / nr;
        if (!best || sse < best.sse) best = { f, at: (rows[sorted[k]][f] + rows[sorted[k + 1]][f]) / 2, sse };
      }
    }
    if (!best) return { leaf: true, value: m };
    const left = idx.filter((i) => rows[i][best.f] < best.at);
    const right = idx.filter((i) => rows[i][best.f] >= best.at);
    return { f: best.f, at: best.at, left: build(left, d - 1), right: build(right, d - 1) };
  };
  const root = build(range(rows.length), depth);
  return (row) => {
    let node = root;
    while (!node.leaf) node = row[node.f] < node.at ? node.left : node.right;
    return node.value;
  };
}

/** The GP's best guess and its spread at each test point, given the observed points. */
export function gpPosterior(observed, tests, { length = 1, height = 1, noise = 0.05 } = {}) {
  if (!observed.length) return tests.map(() => ({ mean: 0, sd: height }));
  const xs = observed.map((p) => p.x);
  const K = xs.map((a, i) => xs.map((b, j) => rbf(a, b, length, height) + (i === j ? noise * noise : 0)));
  const L = cholesky(K);
  const alpha = solveUpper(L, solveLower(L, observed.map((p) => p.y)));
  return tests.map((t) => {
    const k = xs.map((x) => rbf(x, t, length, height));
    const v = solveLower(L, k);
    const variance = rbf(t, t, length, height) - sum(v.map((x) => x * x));
    return { mean: sum(k.map((x, i) => x * alpha[i])), sd: Math.sqrt(Math.max(variance, 0)) };
  });
}

// ---------------------------------------------------------------------------
// Sampling

/** A Metropolis random walk over a 1D density: the samples and how many moves were accepted. */
export function metropolis(density, { start = 0, step = 1, n = 1000, seed = 1 } = {}) {
  const rand = rng(seed);
  let x = start;
  let px = density(x);
  let accepted = 0;
  const samples = [];
  const proposals = [];
  for (let i = 0; i < n; i++) {
    const y = x + normal(rand) * step;
    const py = density(y);
    const ok = rand() < py / px;
    proposals.push({ from: x, to: y, ok });
    if (ok) {
      x = y;
      px = py;
      accepted++;
    }
    samples.push(x);
  }
  return { samples, proposals, acceptance: accepted / n };
}

// ---------------------------------------------------------------------------
// Time series

/** Autocorrelation at lags 0..maxLag. */
export function acf(series, maxLag) {
  const m = mean(series);
  const d = series.map((x) => x - m);
  const c0 = sum(d.map((x) => x * x));
  return range(maxLag + 1).map((lag) => {
    let s = 0;
    for (let t = lag; t < d.length; t++) s += d[t] * d[t - lag];
    return c0 ? s / c0 : 0;
  });
}

/** Partial autocorrelation at lags 1..maxLag (Durbin–Levinson), index 0 is lag 1. */
export function pacf(series, maxLag) {
  const r = acf(series, maxLag);
  const out = [];
  let phi = [];
  for (let k = 1; k <= maxLag; k++) {
    let num = r[k];
    let den = 1;
    for (let j = 1; j < k; j++) {
      num -= phi[j - 1] * r[k - j];
      den -= phi[j - 1] * r[j];
    }
    const pkk = den ? num / den : 0;
    phi = [...phi.map((p, j) => p - pkk * phi[k - 2 - j]), pkk];
    out.push(pkk);
  }
  return out;
}

/** A simulated ARMA(1,1) series: x_t = phi x_{t-1} + e_t + theta e_{t-1}. */
export function arma(n, phi, theta, seed) {
  const rand = rng(seed);
  const xs = [];
  let x = 0;
  let prevE = 0;
  for (let t = 0; t < n + 50; t++) {
    const e = normal(rand);
    x = phi * x + e + theta * prevE;
    prevE = e;
    if (t >= 50) xs.push(x);
  }
  return xs;
}

export const difference = (xs, lag = 1) => xs.slice(lag).map((x, i) => x - xs[i]);

export function rolling(xs, window, fn) {
  return xs.map((_, i) => (i + 1 < window ? null : fn(xs.slice(i + 1 - window, i + 1))));
}

export const variance = (xs) => {
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
};

/** Simple exponential smoothing: the level after each point, and the flat forecast. */
export function ses(xs, alpha) {
  let level = xs[0];
  const fitted = [level];
  for (let t = 1; t < xs.length; t++) {
    fitted.push(level);
    level = alpha * xs[t] + (1 - alpha) * level;
  }
  return { fitted, level };
}

/** Holt–Winters (additive): level, trend and a repeating season. */
export function holtWinters(xs, period, alpha, beta, gamma, horizon) {
  let level = mean(xs.slice(0, period));
  let trend = (mean(xs.slice(period, 2 * period)) - level) / period || 0;
  const season = xs.slice(0, period).map((x) => x - level);
  const fitted = [];
  for (let t = 0; t < xs.length; t++) {
    const s = season[t % period];
    fitted.push(level + trend + s);
    const prevLevel = level;
    level = alpha * (xs[t] - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    season[t % period] = gamma * (xs[t] - level) + (1 - gamma) * s;
  }
  const forecast = range(horizon).map((h) => level + (h + 1) * trend + season[(xs.length + h) % period]);
  return { fitted, forecast };
}

export const mae = (a, f) => mean(a.map((x, i) => Math.abs(x - f[i])));
export const rmse = (a, f) => Math.sqrt(mean(a.map((x, i) => (x - f[i]) ** 2)));
export const mape = (a, f) => 100 * mean(a.map((x, i) => Math.abs((x - f[i]) / x)));
export const smape = (a, f) => 100 * mean(a.map((x, i) => (2 * Math.abs(x - f[i])) / (Math.abs(x) + Math.abs(f[i]) || 1)));
/** Error relative to what "same as last time" would have scored on the training data. */
export function mase(a, f, train, season = 1) {
  const naive = mean(train.slice(season).map((x, i) => Math.abs(x - train[i])));
  return naive ? mae(a, f) / naive : NaN;
}

// ---------------------------------------------------------------------------
// Vision

/** Slides a square kernel over a grayscale image (rows of numbers), zero padding the edges. */
export function convolve(image, kernel) {
  const h = image.length;
  const w = image[0].length;
  const r = Math.floor(kernel.length / 2);
  return range(h).map((y) =>
    range(w).map((x) => {
      let s = 0;
      for (let ky = -r; ky <= r; ky++)
        for (let kx = -r; kx <= r; kx++) {
          const yy = y + ky;
          const xx = x + kx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) s += image[yy][xx] * kernel[ky + r][kx + r];
        }
      return s;
    })
  );
}

/** Overlap of two boxes {x, y, w, h}: shared area over combined area. */
export function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union ? inter / union : 0;
}

/** Non-maximum suppression: keep the most confident box, drop the ones overlapping it, repeat. */
export function nms(boxes, threshold) {
  const left = [...boxes].sort((a, b) => b.score - a.score);
  const kept = [];
  const steps = [];
  while (left.length) {
    const best = left.shift();
    kept.push(best);
    const dropped = [];
    for (let i = left.length - 1; i >= 0; i--) {
      if (iou(best, left[i]) > threshold) dropped.push(...left.splice(i, 1));
    }
    steps.push({ kept: best, dropped });
  }
  return { kept, steps };
}

/** The cells a stack of 3×3 convolutions can see from one output pixel, per layer's dilation. */
export function receptiveField(dilations) {
  return 1 + sum(dilations.map((d) => 2 * d));
}

/** Rounds weights to 2^bits evenly spaced levels across their range (symmetric, like INT8). */
export function quantize(values, bits) {
  const max = Math.max(...values.map(Math.abs)) || 1;
  const levels = 2 ** (bits - 1) - 1;
  const scale = max / levels;
  return values.map((v) => Math.round(v / scale) * scale);
}

/** Cosine similarity of two vectors. */
export function cosine(a, b) {
  const dot = sum(a.map((x, i) => x * b[i]));
  const na = Math.sqrt(sum(a.map((x) => x * x)));
  const nb = Math.sqrt(sum(b.map((x) => x * x)));
  return na && nb ? dot / (na * nb) : 0;
}

export function softmax(xs, temperature = 1) {
  const m = Math.max(...xs);
  const e = xs.map((x) => Math.exp((x - m) / temperature));
  const s = sum(e);
  return e.map((x) => x / s);
}

/**
 * The order to show a question's options in: a shuffle seeded by the question's own
 * text, so it's the same on every visit but the right answer isn't always first
 * (the lessons are written with it first).
 */
export function optionOrder(key, n) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const rand = rng(h >>> 0);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
