// The maths behind the foundations, language and "in the wild" chapters:
// small, exact versions of the real methods, so the simulations behave the
// way the real things do. Tested in mlmath.test.js.
import { mean, normal, range, rng, softmax, sum } from "./math";

// --- straight lines and curves ------------------------------------------------

/** Ordinary least squares for y = a + b·x. Returns { a, b }. */
export function fitLine(points) {
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  const sxy = sum(points.map((p) => (p.x - mx) * (p.y - my)));
  const sxx = sum(points.map((p) => (p.x - mx) ** 2));
  const b = sxx ? sxy / sxx : 0;
  return { a: my - b * mx, b };
}

/** Mean squared error of the line a + b·x on the points. */
export const lineMse = (points, a, b) => mean(points.map((p) => (p.y - (a + b * p.x)) ** 2));

/** R²: the share of the spread in y the line explains. */
export function rSquared(points, a, b) {
  const my = mean(points.map((p) => p.y));
  const total = sum(points.map((p) => (p.y - my) ** 2));
  const left = sum(points.map((p) => (p.y - (a + b * p.x)) ** 2));
  return total ? 1 - left / total : 0;
}

/**
 * Gradient descent on a one-dimensional loss f with derivative df: `steps`
 * steps of size `rate` from `start`. Returns the path of x values.
 */
export function descend(df, start, rate, steps) {
  const path = [start];
  let x = start;
  for (let i = 0; i < steps; i++) {
    x -= rate * df(x);
    if (!Number.isFinite(x) || Math.abs(x) > 1e6) break;
    path.push(x);
  }
  return path;
}

export const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/** Log loss of probabilities p for labels y (0/1). */
export function logLoss(ps, ys) {
  const eps = 1e-9;
  return -mean(ps.map((p, i) => (ys[i] ? Math.log(p + eps) : Math.log(1 - p + eps))));
}

/** Logistic regression on one feature by gradient descent. Returns { w, b }. */
export function fitLogistic(points, { steps = 2000, rate = 0.5 } = {}) {
  let w = 0;
  let b = 0;
  const n = points.length;
  for (let s = 0; s < steps; s++) {
    let gw = 0;
    let gb = 0;
    for (const p of points) {
      const e = sigmoid(w * p.x + b) - p.c;
      gw += e * p.x;
      gb += e;
    }
    w -= (rate * gw) / n;
    b -= (rate * gb) / n;
  }
  return { w, b };
}

/**
 * Polynomial regression of the given degree with an L2 (ridge) penalty
 * `lambda`, on x scaled to −1…1. Returns the coefficients, lowest power first.
 */
export function fitPolynomial(points, degree, lambda = 0) {
  const k = degree + 1;
  const A = range(k).map(() => range(k).map(() => 0));
  const r = range(k).map(() => 0);
  for (const p of points) {
    const pw = range(k).map((j) => p.x ** j);
    for (let i = 0; i < k; i++) {
      r[i] += pw[i] * p.y;
      for (let j = 0; j < k; j++) A[i][j] += pw[i] * pw[j];
    }
  }
  for (let i = 1; i < k; i++) A[i][i] += lambda; // (the intercept isn't shrunk)
  return solve(A, r);
}

export const polyAt = (coef, x) => coef.reduce((s, c, j) => s + c * x ** j, 0);

/** Gaussian elimination with partial pivoting. */
export function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

// --- features ---------------------------------------------------------------------

/** Standardise each column: mean 0, standard deviation 1. */
export function standardise(rows) {
  const cols = rows[0].length;
  const stats = range(cols).map((j) => {
    const m = mean(rows.map((r) => r[j]));
    const sd = Math.sqrt(mean(rows.map((r) => (r[j] - m) ** 2))) || 1;
    return { m, sd };
  });
  return { rows: rows.map((r) => r.map((v, j) => (v - stats[j].m) / stats[j].sd)), stats };
}

/** Index of the row nearest `q` (Euclidean). */
export function nearest(rows, q) {
  let best = 0;
  let bd = Infinity;
  rows.forEach((r, i) => {
    const d = sum(r.map((v, j) => (v - q[j]) ** 2));
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

// --- groups and directions ------------------------------------------------------

/** One round of k-means: assign each point to its nearest centre, then move each centre to its points' mean. */
export function kmeansStep(points, centres) {
  const label = points.map((p) => {
    let best = 0;
    let bd = Infinity;
    centres.forEach((c, k) => {
      const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    return best;
  });
  const next = centres.map((c, k) => {
    const mine = points.filter((_, i) => label[i] === k);
    return mine.length ? { x: mean(mine.map((p) => p.x)), y: mean(mine.map((p) => p.y)) } : c;
  });
  const inertia = sum(points.map((p, i) => (p.x - next[label[i]].x) ** 2 + (p.y - next[label[i]].y) ** 2));
  return { label, centres: next, inertia };
}

/** Variance of 2-D points along the direction at `angle` (radians), and the total variance. */
export function varianceAlong(points, angle) {
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const along = mean(points.map((p) => ((p.x - mx) * ux + (p.y - my) * uy) ** 2));
  const total = mean(points.map((p) => (p.x - mx) ** 2 + (p.y - my) ** 2));
  return { along, total, share: total ? along / total : 0 };
}

/** The first principal direction of 2-D points: the angle of greatest variance. */
export function principalAngle(points) {
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  const sxx = mean(points.map((p) => (p.x - mx) ** 2));
  const syy = mean(points.map((p) => (p.y - my) ** 2));
  const sxy = mean(points.map((p) => (p.x - mx) * (p.y - my)));
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

/** z-scores of values. */
export function zScores(values) {
  const m = mean(values);
  const sd = Math.sqrt(mean(values.map((v) => (v - m) ** 2))) || 1;
  return values.map((v) => (v - m) / sd);
}

// --- language ----------------------------------------------------------------------

/**
 * Greedy longest-match tokenizer over a vocabulary of word pieces, the way
 * byte-pair tokenizers end up behaving: common words are one token, rare
 * words split into pieces, and anything unknown falls back to single letters.
 * A leading space belongs to the token after it.
 */
export function tokenize(text, vocab) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    let best = text[i];
    for (let len = Math.min(16, text.length - i); len > 1; len--) {
      const piece = text.slice(i, i + len);
      if (vocab.has(piece.toLowerCase())) {
        best = piece;
        break;
      }
    }
    out.push(best);
    i += best.length;
  }
  return out;
}

/** Next-token probabilities from scores at a temperature (0 means always the top one). */
export function nextTokenProbs(scores, temperature) {
  if (temperature <= 0.01) {
    const top = scores.indexOf(Math.max(...scores));
    return scores.map((_, i) => (i === top ? 1 : 0));
  }
  return softmax(scores, temperature);
}

/** Draw an index from probabilities. */
export function sample(probs, rand) {
  let r = rand();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r <= 0) return i;
  }
  return probs.length - 1;
}

/** Words of a text, lower-case, without punctuation. */
export const words = (text) => text.toLowerCase().match(/[a-z0-9']+/g) ?? [];

const STOP = new Set("a an the is are was were of to in on for and or with what how do does did i my it its be can at by from this that".split(" "));

/** Bag-of-words vector (as a map) without very common words. */
export function bag(text) {
  const m = new Map();
  for (const w of words(text)) if (!STOP.has(w)) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
}

/** Cosine similarity of two bags of words. */
export function bagCosine(a, b) {
  let dot = 0;
  for (const [w, v] of a) dot += v * (b.get(w) ?? 0);
  const na = Math.sqrt(sum([...a.values()].map((v) => v * v)));
  const nb = Math.sqrt(sum([...b.values()].map((v) => v * v)));
  return na && nb ? dot / (na * nb) : 0;
}

/** The `k` documents most similar to the question: [{ i, score }], best first. */
export function retrieve(question, docs, k) {
  const q = bag(question);
  return docs
    .map((d, i) => ({ i, score: bagCosine(q, bag(d)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// --- in production -------------------------------------------------------------------

/**
 * Population stability index between two histograms (counts per bin): the
 * usual drift alarm. Under 0.1 is stable, 0.1–0.25 worth a look, over 0.25 a
 * real shift.
 */
export function psi(expected, actual) {
  const te = sum(expected);
  const ta = sum(actual);
  return sum(
    expected.map((e, i) => {
      const p = Math.max(1e-4, e / te);
      const q = Math.max(1e-4, actual[i] / ta);
      return (q - p) * Math.log(q / p);
    })
  );
}

/** Counts of values in `bins` equal bins over [lo, hi). */
export function histogram(values, lo, hi, bins) {
  const out = range(bins).map(() => 0);
  for (const v of values) {
    const k = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)));
    out[k]++;
  }
  return out;
}

/** Normal samples with a given mean and spread. */
export function gaussianSample(n, mu, sd, seed) {
  const rand = rng(seed);
  return range(n).map(() => mu + sd * normal(rand));
}

/**
 * Two-proportion z-test for an A/B test: conversions kA of nA against kB of
 * nB. Returns the difference, its 95% interval and the two-sided p-value.
 */
export function abTest(kA, nA, kB, nB) {
  const pA = kA / nA;
  const pB = kB / nB;
  const pooled = (kA + kB) / (nA + nB);
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB)) || 1e-9;
  const z = (pB - pA) / sePooled;
  const se = Math.sqrt((pA * (1 - pA)) / nA + (pB * (1 - pB)) / nB);
  return { pA, pB, diff: pB - pA, lo: pB - pA - 1.96 * se, hi: pB - pA + 1.96 * se, z, p: 2 * (1 - normalCdf(Math.abs(z))) };
}

/** Standard normal CDF (Abramowitz–Stegun). */
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Error rates of a cut-off on scored people: { fpr, fnr, flagged } for those with label 1 = positive. */
export function groupRates(people, cut) {
  const pos = people.filter((p) => p.y === 1);
  const neg = people.filter((p) => p.y === 0);
  const fn = pos.filter((p) => p.score < cut).length;
  const fp = neg.filter((p) => p.score >= cut).length;
  return { fnr: pos.length ? fn / pos.length : 0, fpr: neg.length ? fp / neg.length : 0, flagged: people.filter((p) => p.score >= cut).length / (people.length || 1) };
}

/**
 * Matrix factorisation by alternating gradient steps: ratings [{ u, i, r }]
 * for nUsers × nItems, `k` hidden tastes. Returns { U, V, predict(u, i), rmse }.
 */
export function factorise(ratings, nUsers, nItems, k = 2, { steps = 400, rate = 0.03, reg = 0.05, seed = 3 } = {}) {
  const rand = rng(seed);
  const U = range(nUsers).map(() => range(k).map(() => (rand() - 0.5) * 0.2));
  const V = range(nItems).map(() => range(k).map(() => (rand() - 0.5) * 0.2));
  const mu = mean(ratings.map((x) => x.r));
  const dot = (a, b) => sum(a.map((v, j) => v * b[j]));
  for (let s = 0; s < steps; s++) {
    for (const { u, i, r } of ratings) {
      const e = r - (mu + dot(U[u], V[i]));
      for (let j = 0; j < k; j++) {
        const uu = U[u][j];
        U[u][j] += rate * (e * V[i][j] - reg * uu);
        V[i][j] += rate * (e * uu - reg * V[i][j]);
      }
    }
  }
  const predict = (u, i) => mu + dot(U[u], V[i]);
  const rmse = Math.sqrt(mean(ratings.map(({ u, i, r }) => (r - predict(u, i)) ** 2)));
  return { U, V, predict, rmse, mu };
}

/** Throughput and latency of a model server batching requests: per-request cost `perItem`, fixed cost per batch `perBatch` (ms). */
export function batching(batch, arrivalsPerSec, perItem, perBatch) {
  const serviceMs = perBatch + perItem * batch;
  const capacity = (1000 * batch) / serviceMs; // requests a second it can handle
  const fillMs = ((batch - 1) / Math.max(1e-6, arrivalsPerSec)) * 1000 * 0.5; // average wait for the batch to fill
  const load = arrivalsPerSec / capacity;
  const queueMs = load < 1 ? (serviceMs * load) / (2 * (1 - load)) : Infinity;
  return { capacity, latency: serviceMs + fillMs + queueMs, load };
}

/** Accuracy over `days` when the model starts at `start`, decays by `decay` a day, and is retrained every `every` days (0 = never). */
export function accuracyOverTime(days, start, decay, every) {
  return range(days).map((d) => start - decay * (every > 0 ? d % every : d));
}

export { sigmoid as logistic };

// --- neural networks -------------------------------------------------------------

/** XOR-like data: two classes in opposite corners, which no single straight line can separate. */
export function xorPoints(n = 80, seed = 4) {
  const rand = rng(seed);
  return range(n).map(() => {
    const x = rand() * 2 - 1;
    const y = rand() * 2 - 1;
    return { x, y, c: x * y > 0 ? 1 : 0 };
  });
}

/**
 * A network with one hidden layer of `hidden` tanh units and a sigmoid
 * output, trained by full-batch gradient descent (backpropagation) on 2-D
 * points { x, y, c }. Returns { predict(x, y), loss, accuracy, history }.
 */
export function trainMlp(points, hidden, { steps = 600, rate = 0.5, seed = 1, activation = "tanh" } = {}) {
  const rand = rng(seed);
  const act = activation === "linear" ? (z) => z : Math.tanh;
  const dact = activation === "linear" ? () => 1 : (a) => 1 - a * a; // from the activation's output
  const W1 = range(hidden).map(() => [(rand() - 0.5) * 2, (rand() - 0.5) * 2]);
  const b1 = range(hidden).map(() => (rand() - 0.5) * 0.5);
  const W2 = range(hidden).map(() => (rand() - 0.5) * 2);
  let b2 = 0;
  const forward = (x, y) => {
    const h = W1.map((w, j) => act(w[0] * x + w[1] * y + b1[j]));
    const p = sigmoid(h.reduce((s, v, j) => s + v * W2[j], b2));
    return { h, p };
  };
  const history = [];
  const n = points.length;
  for (let s = 0; s < steps; s++) {
    const gW1 = W1.map(() => [0, 0]);
    const gb1 = b1.map(() => 0);
    const gW2 = W2.map(() => 0);
    let gb2 = 0;
    let loss = 0;
    for (const pt of points) {
      const { h, p } = forward(pt.x, pt.y);
      loss -= pt.c ? Math.log(p + 1e-9) : Math.log(1 - p + 1e-9);
      const d = p - pt.c; // the error at the output, passed back
      gb2 += d;
      for (let j = 0; j < hidden; j++) {
        gW2[j] += d * h[j];
        const dh = d * W2[j] * dact(h[j]);
        gW1[j][0] += dh * pt.x;
        gW1[j][1] += dh * pt.y;
        gb1[j] += dh;
      }
    }
    for (let j = 0; j < hidden; j++) {
      W2[j] -= (rate * gW2[j]) / n;
      W1[j][0] -= (rate * gW1[j][0]) / n;
      W1[j][1] -= (rate * gW1[j][1]) / n;
      b1[j] -= (rate * gb1[j]) / n;
    }
    b2 -= (rate * gb2) / n;
    if (s % 10 === 0 || s === steps - 1) history.push({ step: s, loss: loss / n });
  }
  const predict = (x, y) => forward(x, y).p;
  const accuracy = points.filter((p) => (predict(p.x, p.y) >= 0.5 ? 1 : 0) === p.c).length / n;
  return { predict, loss: history.at(-1).loss, accuracy, history };
}

/**
 * How much of a signal from `steps` ago survives in a recurrent network: a
 * plain RNN multiplies it by roughly the same factor every step (so it
 * vanishes or explodes); an LSTM's cell keeps it times its forget gate.
 */
export function memoryLeft(steps, factor) {
  return factor ** steps;
}
