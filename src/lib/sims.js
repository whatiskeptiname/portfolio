// The models behind the case-study simulations (src/components/sims). Pure
// functions so they can be tested; the data is synthetic and only the
// headline numbers come from the CV.

// ---------------------------------------------------------------------------
// AI-Assisted Surgery: how many cameras a capture rig needs.
//
// Cameras sit evenly on a ring round the surgical field, all looking in. A
// point on the surface is seen by every camera within VIEW_HALF of its
// outward normal; reconstruction needs each point seen from at least
// MIN_VIEWS directions.

export const VIEW_HALF = (65 * Math.PI) / 180;
export const MIN_VIEWS = 2;

/** Views per surface sample and the share seen by at least MIN_VIEWS cameras. */
export function rigCoverage(cameras, samples = 360) {
  const views = [];
  for (let i = 0; i < samples; i++) {
    const phi = (i / samples) * Math.PI * 2;
    let n = 0;
    for (let c = 0; c < cameras; c++) {
      const theta = (c / cameras) * Math.PI * 2;
      const d = Math.atan2(Math.sin(phi - theta), Math.cos(phi - theta));
      if (Math.abs(d) <= VIEW_HALF) n++;
    }
    views.push(n);
  }
  const covered = views.filter((n) => n >= MIN_VIEWS).length / samples;
  const mean = views.reduce((s, n) => s + n, 0) / samples;
  return { views, covered, mean, min: Math.min(...views) };
}

/** Fewest cameras that still cover the whole field. */
export function fewestCameras(max = 30) {
  for (let n = 1; n <= max; n++) if (rigCoverage(n).covered === 1) return n;
  return max;
}

/**
 * Illustrative novel-view-synthesis time in minutes: the original per-scene
 * NeRF optimisation took hours; the optimised splatting pipeline runs in
 * 7–20 minutes, scaling with how many views it has to fit.
 */
export function renderMinutes(cameras, optimised) {
  if (!optimised) return 60 * (2 + cameras * 0.12); // hours
  return Math.min(20, Math.max(7, 4 + cameras * 1.4));
}

// ---------------------------------------------------------------------------
// AI Inference Acceleration: what each optimisation does to speed, accuracy
// and size. Chosen so all four together give the CV's numbers: 7× faster,
// accuracy back from 80.26% to 82.88% (within 2% of baseline) at half the
// parameters.

export const BASELINE = { latency: 42, accuracy: 84.4, params: 100 }; // ms, %, % of original
export const TECHNIQUES = [
  { key: "prune", label: "Prune", speed: 2, accuracy: -1.6, params: 0.5 },
  { key: "sparsify", label: "Sparsify", speed: 1.4, accuracy: -1.0, params: 1 },
  { key: "quantize", label: "Quantize INT8", speed: 2.5, accuracy: -1.54, params: 1 },
  { key: "distill", label: "Distil", speed: 1, accuracy: 0, params: 1, recovers: 2.62 },
];

/** Latency (ms), speed-up, accuracy (%) and size (% of params) for the chosen techniques. */
export function optimise(enabled) {
  let speed = 1;
  let accuracy = BASELINE.accuracy;
  let params = BASELINE.params;
  let lost = 0;
  for (const t of TECHNIQUES) {
    if (!enabled[t.key]) continue;
    speed *= t.speed;
    accuracy += t.accuracy;
    lost -= t.accuracy;
    params *= t.params;
  }
  // Distillation wins back most of what compression cost.
  if (enabled.distill) accuracy += Math.min(TECHNIQUES[3].recovers, lost);
  return {
    speed,
    latency: BASELINE.latency / speed,
    accuracy: Math.round(accuracy * 100) / 100,
    params,
    withinBaseline: BASELINE.accuracy - accuracy <= BASELINE.accuracy * 0.02,
  };
}

// ---------------------------------------------------------------------------
// Demand Forecasting: a price change rippling through sales and revenue.

const SEASON = [0.86, 0.82, 0.95, 1.0, 1.06, 1.1, 1.04, 1.02, 0.98, 1.05, 1.18, 1.32];
export const ELASTICITY = -1.35;
export const BASE_PRICE = 40;
const BASE_UNITS = 12000;

/**
 * Twelve months of forecast for a price change (`change`, e.g. -0.1 for
 * 10% off), against the baseline (no change): units, revenue, MoM change,
 * cumulative YTD revenue and the delta to baseline.
 */
export function forecast(change) {
  const price = BASE_PRICE * (1 + change);
  const lift = Math.pow(1 + change, ELASTICITY);
  let ytd = 0;
  let baseYtd = 0;
  return SEASON.map((s, m) => {
    const baseUnits = BASE_UNITS * s * (1 + m * 0.01);
    const units = baseUnits * lift;
    const revenue = units * price;
    const baseRevenue = baseUnits * BASE_PRICE;
    ytd += revenue;
    baseYtd += baseRevenue;
    return { month: m, units, revenue, baseUnits, baseRevenue, ytd, baseYtd, delta: revenue - baseRevenue };
  }).map((row, m, rows) => ({ ...row, mom: m ? row.revenue / rows[m - 1].revenue - 1 : null }));
}

/** A plain-language answer about a forecast, the way the LLM layer would. */
export function explainForecast(change, question) {
  const rows = forecast(change);
  const pct = (v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
  const money = (v) => `$${(Math.abs(v) / 1e6).toFixed(2)}M`;
  const year = rows[11];
  const yearDelta = year.ytd - year.baseYtd;
  const best = rows.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  const unitsChange = rows[0].units / rows[0].baseUnits - 1;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const priceText = change === 0 ? "keeping the price" : `${change < 0 ? "cutting" : "raising"} the price ${Math.abs(change * 100).toFixed(0)}%`;
  if (question === "worth") {
    if (change === 0) return "This is the baseline: no price change, so there's nothing to compare yet. Move the slider to test one.";
    return yearDelta >= 0
      ? `Yes, on revenue: ${priceText} moves units ${pct(unitsChange)} and adds ${money(yearDelta)} over the year (${pct(yearDelta / year.baseYtd)} vs baseline).`
      : `Probably not: ${priceText} moves units ${pct(unitsChange)} but loses ${money(yearDelta)} of revenue over the year (${pct(yearDelta / year.baseYtd)} vs baseline).`;
  }
  if (question === "peak") {
    return `${MONTHS[best.month]} is the strongest month at ${money(best.revenue)}, ${pct(best.mom ?? 0)} on the month before; the holiday season carries Q4.`;
  }
  return `By December, year-to-date revenue reaches ${money(year.ytd)} against a ${money(year.baseYtd)} baseline: ${yearDelta >= 0 ? "ahead" : "behind"} by ${money(yearDelta)}.`;
}

// ---------------------------------------------------------------------------
// Database Schema Mapping: three matching stages, weighted by a config.

export const CANONICAL = [
  { field: "customer_id", type: "id", synonyms: ["customer", "client", "cust", "account"] },
  { field: "full_name", type: "text", synonyms: ["name", "customer name", "nm"] },
  { field: "email", type: "email", synonyms: ["mail", "e-mail", "contact"] },
  { field: "phone", type: "phone", synonyms: ["mobile", "tel", "contact number"] },
  { field: "birth_date", type: "date", synonyms: ["dob", "birthday", "born"] },
  { field: "signup_date", type: "date", synonyms: ["joined", "registered", "signup"] },
  { field: "country", type: "text", synonyms: ["nation", "ctry", "region"] },
  { field: "order_total", type: "money", synonyms: ["amount", "amt", "total", "value"] },
  { field: "currency", type: "code", synonyms: ["ccy", "cur"] },
  { field: "is_active", type: "bool", synonyms: ["active", "status", "enabled"] },
];

// Source columns as they arrive, with their profiled type and the right answer.
export const SOURCE = [
  { column: "cust_no", type: "id", truth: "customer_id" },
  { column: "cust_nm", type: "text", truth: "full_name" },
  { column: "e_mail_addr", type: "email", truth: "email" },
  { column: "contact_no", type: "phone", truth: "phone" },
  { column: "dob", type: "date", truth: "birth_date" },
  { column: "created_on", type: "date", truth: "signup_date" },
  { column: "ctry_code", type: "code", truth: "country" },
  { column: "amt_usd", type: "money", truth: "order_total" },
  { column: "ccy", type: "code", truth: "currency" },
  { column: "status_flag", type: "text", truth: "is_active" },
];

export const DEFAULT_WEIGHTS = { name: 0.4, type: 0.35, semantic: 0.25, threshold: 0.4 };

const grams = (s) => {
  const t = `  ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const out = new Set();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
};
const jaccard = (a, b) => {
  const A = grams(a);
  const B = grams(b);
  let n = 0;
  for (const g of A) if (B.has(g)) n++;
  return n / (A.size + B.size - n || 1);
};
const tokens = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** The three stage scores (0–1) for one source column against one canonical field. */
export function stageScores(src, canon) {
  const name = jaccard(src.column, canon.field);
  const type = src.type === canon.type ? 1 : (src.type === "text" || canon.type === "text") ? 0.3 : 0;
  const words = tokens(src.column);
  const semantic = canon.synonyms.some((syn) => tokens(syn).every((w) => words.some((x) => x === w || (w.length > 2 && x.startsWith(w)))))
    ? 1
    : 0;
  return { name, type, semantic };
}

/** Best canonical match for every source column under `weights`, and the accuracy. */
export function mapSchema(weights = DEFAULT_WEIGHTS) {
  const total = weights.name + weights.type + weights.semantic || 1;
  const rows = SOURCE.map((src) => {
    const ranked = CANONICAL.map((canon) => {
      const s = stageScores(src, canon);
      const score = (s.name * weights.name + s.type * weights.type + s.semantic * weights.semantic) / total;
      return { field: canon.field, score, stages: s };
    }).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const match = best.score >= weights.threshold ? best.field : null;
    return { ...src, match, score: best.score, stages: best.stages, correct: match === src.truth };
  });
  return { rows, accuracy: rows.filter((r) => r.correct).length / rows.length };
}

// ---------------------------------------------------------------------------
// Table Detection: a receipt's line items, and the grid the model recovers.

export const RECEIPT = [
  ["Item", "Qty", "Rate", "Amount"],
  ["Rice 5kg", "2", "850", "1,700"],
  ["Lentils 1kg", "3", "210", "630"],
  ["Cooking oil 1L", "1", "320", "320"],
  ["Tea 500g", "2", "275", "550"],
  ["Sugar 1kg", "4", "120", "480"],
];

/** Cell boxes for a table at (x, y, w, h), one per RECEIPT cell, with column widths in proportion. */
export function tableCells(x, y, w, h, widths = [0.46, 0.14, 0.18, 0.22]) {
  const rowH = h / RECEIPT.length;
  const cells = [];
  RECEIPT.forEach((row, r) => {
    let cx = x;
    row.forEach((text, c) => {
      const cw = w * widths[c];
      cells.push({ r, c, text, x: cx, y: y + r * rowH, w: cw, h: rowH });
      cx += cw;
    });
  });
  return cells;
}
