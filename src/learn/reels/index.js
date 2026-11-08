// The animated walkthroughs at the top of every lesson, keyed "chapter/lesson".
// Each has `method` (the whole method in one line, shown above the picture) and
// three scenes. A scene is a component drawn at time t (0–1) and how long it
// plays; its caption is the lesson's matching "what to remember" point, unless
// it sets its own. chapters/index.js attaches these to the lessons.
import { createElement } from "react";
import { Bars, Curves, Flow, Folds, Lines, Overlap, Pixels, Scatter, Tree, Waterfall } from "./kit";
import { Beliefs, BoostFit, BuildSeries, Converge, Correlated, Fan, GPScene, Heat, Network, Noise, Patches, Signal, Slide, Walker } from "./custom";
import { Plateau, Resample, Vote } from "./trees";

/** A scene from a component and its props, playing for `seconds`. */
const scene = (Component, props = {}, seconds = 9) => ({
  Scene: ({ t }) => createElement(Component, { ...props, t }),
  duration: seconds * 1000,
});

// A few fixed point sets, generated once so every visit draws the same picture.
const seeded = (seed) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};
const members = (() => {
  const r = seeded(11);
  return Array.from({ length: 46 }, () => {
    const x = r();
    const y = r();
    return { x, y, c: x < 0.4 && y > 0.3 ? 1 : 0 };
  });
})();
const pct = (v) => `${Math.round(v * 100)}%`;
const sales = (i) => 100 + 0.6 * i + 18 * Math.sin((2 * Math.PI * (i - 2)) / 12);

export const REELS = {
  // ---------------------------------------------------------------- trees
  "trees/splits": {
    method: "Try every yes/no question, keep the one that leaves the purest groups, then repeat inside each group.",
    scenes: [
      scene(Scatter, {
        points: members,
        xLabel: "months as a member →",
        yLabel: "support calls ↑",
        lines: [
          { x1: 0.4, y1: 0, x2: 0.4, y2: 1, label: "Q1: joined < 18 months?", lx: 0.42, ly: 0.95 },
          { x1: 0, y1: 0.3, x2: 0.4, y2: 0.3, label: "Q2: calls > 3?", lx: 0.02, ly: 0.27 },
        ],
        regions: [
          { x: 0, y: 0.3, w: 0.4, h: 0.7, cls: "region-b" },
          { x: 0, y: 0, w: 0.4, h: 0.3, cls: "region-a" },
          { x: 0.4, y: 0, w: 0.6, h: 1, cls: "region-a" },
        ],
      }),
      scene(Flow, { steps: [["Try a question", "every column, every cut-off"], ["Score both sides", "how mixed (Gini)"], ["Keep the purest", "no planning ahead"], ["Repeat inside", "each new group"]] }),
      scene(Tree, {
        root: { q: "joined < 18 months?", yes: { q: "calls > 3?", yes: { leaf: "cancels", c: 1 }, no: { leaf: "stays", c: 0 } }, no: { leaf: "stays", c: 0 } },
        note: "A rule you can read out loud",
      }),
    ],
  },
  "trees/overfitting": {
    method: "Grow the tree only as deep as helps on data it hasn't seen; stop before it memorises.",
    scenes: [
      scene(Curves, {
        x: [1, 12],
        y: [0.6, 1.02],
        xLabel: "depth (questions in a row)",
        xTicks: [1, 4, 8, 12],
        yTicks: [0.7, 0.8, 0.9, 1],
        fmtY: pct,
        stagger: true,
        lines: [
          { f: (d) => 1 - 0.35 * Math.exp(-d / 2.6), cls: "line-muted", label: "training data" },
          { f: (d) => 0.89 - 0.0045 * (d - 4.5) ** 2, cls: "line-a", label: "new data" },
        ],
      }),
      scene(Bars, { bars: [{ label: "on its training data", value: 100, cls: "bar-muted", text: "100%" }, { label: "on new data", value: 71, cls: "bar-a", text: "71%" }], max: 110, note: "The gap is the memorising" }),
      scene(Curves, {
        x: [1, 12],
        y: [0.6, 1],
        xLabel: "depth",
        xTicks: [1, 4, 8, 12],
        yTicks: [0.7, 0.8, 0.9],
        fmtY: pct,
        lines: [{ f: (d) => 0.89 - 0.0045 * (d - 4.5) ** 2, cls: "line-a", label: "new data" }],
        marks: [{ x: 4.5, label: "stop here" }],
        note: "Limit depth, require rows per leaf, or prune",
      }),
    ],
  },
  "trees/metrics": {
    method: "Count the four kinds of answer, then choose the cut-off from what a miss and a false alarm each cost.",
    scenes: [
      scene(Bars, { bars: [{ label: "accuracy of 'never fraud'", value: 94, cls: "bar-muted", text: "94%" }, { label: "fraud it catches", value: 0.5, cls: "bar-bad", text: "0%" }], max: 105, note: "High accuracy, useless model" }),
      scene(Flow, { steps: [["Precision", "of what I flagged, how much was fraud?"], ["Recall", "of all the fraud, how much did I flag?"], ["F1", "high only if both are"]] }),
      scene(Curves, {
        x: [0, 1],
        y: [0, 1.05],
        xLabel: "cut-off: flag when the score is above…",
        xTicks: [0, 0.5, 1],
        yTicks: [0, 0.5, 1],
        fmtY: pct,
        stagger: true,
        lines: [
          { f: (c) => 1 - c ** 2.2, cls: "line-a", label: "recall", dy: -14 },
          { f: (c) => 0.08 + 0.9 * c ** 0.8, cls: "line-b", label: "precision" },
        ],
        note: "Lower the cut-off: catch more, but raise more false alarms",
      }),
    ],
  },
  "trees/forests": {
    method: "Grow many deep trees on random resamples, let them vote, and the different mistakes cancel.",
    scenes: [scene(Resample, {}, 9), scene(Vote, {}, 13), scene(Plateau, {}, 8)],
  },
  "trees/boosting": {
    method: "Start with an average, then add small trees one at a time, each fitted to what the model still gets wrong.",
    scenes: [
      scene(BoostFit, { rate: 0.3, maxRounds: 60, note: "Thin lines: what the next tree tries to fix" }, 11),
      scene(Flow, { steps: [["XGBoost", "penalised leaves, a dependable default"], ["LightGBM", "histograms and leaf-wise growth: fast on big data"], ["CatBoost", "handles categorical columns safely"]] }),
      scene(Curves, {
        x: [0, 300],
        y: [0.2, 0.7],
        xLabel: "trees added",
        xTicks: [0, 100, 200, 300],
        yTicks: [0.3, 0.5],
        stagger: true,
        lines: [
          { f: (r) => 0.27 + 0.35 * Math.exp(-r / 12) + 0.0004 * r, cls: "line-bad", label: "learning rate 1: climbs back" },
          { f: (r) => 0.25 + 0.4 * Math.exp(-r / 70), cls: "line-a", label: "learning rate 0.1" },
        ],
        marks: [{ x: 240, label: "early stopping" }],
        note: "Error on validation data: stop where it stops improving",
      }),
    ],
  },
  "trees/honest-testing": {
    method: "Rotate which rows are held out, keep every preparation step inside that rotation, and test once at the end.",
    scenes: [
      scene(Flow, { tone: "bad", steps: [["Fill gaps using all rows", "test rows included"], ["Then split", "train and test"], ["Test rows already shaped training", "a leak"], ["Score looks too good", "and won't hold up"]] }),
      scene(Folds, { rows: 5, cols: 5, kind: "kfold", note: "Every row gets a turn as the check" }),
      scene(Flow, { steps: [["Tune with cross-validation", "inside a pipeline"], ["Pick the best settings", "random or Bayesian search"], ["Test once", "on rows never touched"]] }),
    ],
  },
  "trees/explaining": {
    method: "Start from the average prediction and give each feature credit for how far it moved this one.",
    scenes: [
      scene(Waterfall, {
        start: { label: "Average customer", value: 26 },
        steps: [
          { label: "Monthly contract", value: 17 },
          { label: "Only 4 months in", value: 18 },
          { label: "3 support calls", value: 7 },
          { label: "No autopay", value: 5 },
        ],
      }),
      scene(Lines, { lines: [["26% average", "muted"], "+ 17 + 18 + 7 + 5", ["= 73% for this customer", "accent"]], big: true, note: "The pushes always add up to the prediction" }),
      scene(Flow, { tone: "b", steps: [["The model leans on 'calls'", "that's what SHAP shows"], ["That isn't a cause", "unhappy customers call and leave"], ["Causes need experiments", "not explanations"]] }),
    ],
  },

  // ---------------------------------------------------------------- bayes
  "bayes/uncertainty": {
    method: "Separate what more data would teach you from what is random however much you know.",
    scenes: [
      scene(Beliefs, { curves: [{ a: 8, b: 4, label: "10 shots" }, { a: 36, b: 16, label: "50 shots" }, { a: 211, b: 91, label: "300 shots", fill: true }], xLabel: "the player's true rate" }),
      scene(Bars, {
        bars: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => ({ label: String(k), value: [0, 0.1, 1.4, 9, 36.8, 102.9, 200.1, 266.8, 233.5, 121.1, 28.2][k] / 10, cls: "bar-b", text: " " })),
        sequential: false,
        note: "Baskets in the next 10 shots, rate known: still a spread",
      }),
      scene(Flow, { steps: [["Thin data?", "collect more: it shrinks"], ["Random outcome?", "plan for a range: it won't shrink"], ["Report both", "not just one number"]] }),
    ],
  },
  "bayes/estimation": {
    method: "Combine what you believed before (the prior) with the data (the likelihood) into a range of plausible values (the posterior).",
    scenes: [
      scene(Lines, { lines: ["4 of 5 visitors signed up", ["= 80% sign-up rate?", "bad"], ["Too little data to believe", "muted"]], big: true }),
      scene(Beliefs, { curves: [{ a: 2, b: 8, cls: "line-muted", dashed: true, label: "prior" }, { a: 5, b: 2, cls: "line-b", label: "data alone" }, { a: 6, b: 9, cls: "line-a", fill: true, label: "posterior" }], xLabel: "sign-up rate" }),
      scene(Beliefs, { curves: [{ a: 6, b: 9, label: "5 visitors" }, { a: 12, b: 48, label: "50" }, { a: 102, b: 408, label: "500", fill: true }], xLabel: "sign-up rate", note: "More data: a narrower range" }),
    ],
  },
  "bayes/updating": {
    method: "Treat today's conclusion as tomorrow's starting point, and add each new piece of evidence as it arrives.",
    scenes: [
      scene(Converge, {}, 12),
      scene(Flow, { steps: [["Start: two different beliefs", "a sceptic and an optimist"], ["See the same evidence", "each result nudges both"], ["End up agreeing", "the evidence outweighs the start"]] }),
      scene(Lines, { lines: ["Beta(a, b)", "+ k successes, n − k failures", ["→ Beta(a + k, b + n − k)", "accent"]], big: true, note: "For common cases, updating is just adding counts" }),
    ],
  },
  "bayes/gaussians": {
    method: "Describe linked quantities by their averages and how they move together, then condition on what you learn.",
    scenes: [
      scene(Correlated, { rho: 0.6 }, 10),
      scene(Curves, {
        x: [0, 0.99],
        y: [0, 1.05],
        xLabel: "how strongly they're linked (correlation)",
        yLabel: "spread left, knowing the other",
        xTicks: [0, 0.5, 0.87],
        yTicks: [0.5, 1],
        fmtY: pct,
        lines: [{ f: (r) => Math.sqrt(1 - r * r), cls: "line-a" }],
        marks: [{ x: 0.87, label: "halved at 0.87" }],
      }),
      scene(Lines, { lines: ["σ√(1 − ρ²)", ["ρ = 0.5 → only 13% narrower", "muted"], ["ρ = 0.87 → half as wide", "accent"]], big: true }),
    ],
  },
  "bayes/networks": {
    method: "Draw what directly causes what, then let the arrows carry evidence in either direction.",
    scenes: [
      scene(Network, {}),
      scene(Bars, { bars: [{ label: "chance of rain, knowing nothing", value: 20, cls: "bar-muted", text: "20%" }, { label: "…seeing wet grass", value: 35, cls: "bar-a", text: "35%" }, { label: "…and the sprinkler was on", value: 0.7, cls: "bar-b", text: "0.7%" }], max: 45 }),
      scene(Flow, { steps: [["See wet grass", "both causes more likely"], ["Learn the sprinkler was on", "it explains the wet grass"], ["Rain becomes unlikely again", "explaining away"]] }),
    ],
  },
  "bayes/gaussian-processes": {
    method: "Assume nearby inputs give similar outputs, and let each measurement pin the curve down with an honest error band.",
    scenes: [
      scene(GPScene, { show: "points" }, 10),
      scene(GPScene, { show: "points", length: 0.08, note: "Narrow near measurements, wide in the gaps" }),
      scene(GPScene, { show: "length", note: "The kernel's reach sets how smooth the curve is" }),
    ],
  },
  "bayes/mcmc": {
    method: "Wander over the possible answers, accepting uphill steps always and downhill ones sometimes; where you spend time is the answer.",
    scenes: [
      scene(Walker, {}, 12),
      scene(Flow, { steps: [["Propose a step", "a random nudge"], ["Uphill?", "always take it"], ["Downhill?", "take it sometimes"], ["Count the visits", "they trace the shape"]] }),
      scene(Flow, { steps: [["Run several chains", "from different starts"], ["Do they agree?", "R̂ close to 1.00"], ["Enough samples?", "check effective sample size"]] }),
    ],
  },

  // ---------------------------------------------------------------- time
  "time/components": {
    method: "Pull a series apart into trend, season and noise, and only ever learn from the past.",
    scenes: [
      scene(Flow, { tone: "b", steps: [["Order matters", "today depends on yesterday"], ["Never shuffle", "or split at random"], ["Fill gaps from the past", "never the future"]] }),
      scene(BuildSeries, {}, 10),
      scene(Curves, {
        x: [0, 95],
        y: [-20, 70],
        xLabel: "month",
        stagger: true,
        lines: [
          { f: (i) => 40 + 0.3 * i, cls: "line-a", label: "trend" },
          { f: (i) => 12 * Math.sin((2 * Math.PI * i) / 12), cls: "line-b", label: "season" },
        ],
        note: "Decomposition: look at each part on its own",
      }),
    ],
  },
  "time/stationarity": {
    method: "Transform the series until it behaves the same over time, forecast that, then undo the steps.",
    scenes: [
      scene(Curves, { x: [0, 120], y: [-6, 20], xLabel: "month", lines: [{ points: Array.from({ length: 121 }, (_, i) => [i, 6 * Math.sin(i / 17) + i * 0.09 + 2 * Math.sin(i / 3.1)]), cls: "line-ink", label: "a share price wanders" }] }),
      scene(Curves, { x: [0, 120], y: [-6, 20], xLabel: "month", lines: [{ points: Array.from({ length: 121 }, (_, i) => [i, 6 + 2.2 * Math.sin(i * 1.7) * Math.cos(i * 0.37)]), cls: "line-a", label: "its monthly change sits still", dy: -22 }] }),
      scene(Flow, { steps: [["Log", "steady a growing spread"], ["Difference", "remove the trend"], ["Seasonal difference", "remove the season"], ["Forecast, then undo", "back to real units"]] }),
    ],
  },
  "time/memory": {
    method: "Measure how much each value resembles the ones before it, and read the model's shape off the pattern.",
    scenes: [
      scene(Bars, { bars: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({ label: `lag ${k}`, value: 0.7 ** k, cls: "bar-a", text: (0.7 ** k).toFixed(2) })), max: 0.85, note: "ACF of an AR(1): memory fades slowly" }),
      scene(Bars, { bars: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({ label: `lag ${k}`, value: k === 1 ? 0.7 : 0.02, cls: "bar-b", text: k === 1 ? "0.70" : "0" })), max: 0.85, note: "Its PACF: one direct link, then nothing" }),
      scene(Flow, { steps: [["Fading ACF, one PACF spike", "AR(1)"], ["One ACF spike, fading PACF", "MA(1)"], ["Check the leftovers", "no spikes should remain"]] }),
    ],
  },
  "time/classical": {
    method: "Start with the simplest forecasts, then add a level, a trend and a season that update as data arrives.",
    scenes: [
      scene(Curves, {
        x: [0, 47],
        y: [60, 160],
        xLabel: "month",
        stagger: true,
        lines: [
          { f: sales, cls: "line-ink", label: "sales" },
          { points: Array.from({ length: 13 }, (_, h) => [35 + h, sales(35)]), cls: "line-muted", label: "same as last month", dy: 26 },
          { points: Array.from({ length: 13 }, (_, h) => [35 + h, sales(23 + h)]), cls: "line-b", label: "same month last year" },
        ],
        marks: [{ x: 35, label: "forecast from here" }],
      }),
      scene(Bars, { bars: [0, 1, 2, 3, 4, 5].map((k) => ({ label: `${k} back`, value: 0.5 * 0.5 ** k, cls: "bar-a", text: (0.5 * 0.5 ** k).toFixed(2) })), max: 0.6, note: "Exponential smoothing (α = 0.5): recent months count most" }),
      scene(Bars, { bars: [{ label: "last value", value: 19, cls: "bar-muted" }, { label: "same month last year", value: 9.6, cls: "bar-muted" }, { label: "Holt–Winters", value: 3.9, cls: "bar-a" }], note: "Average miss over the next 12 months" }),
    ],
  },
  "time/arima": {
    method: "Difference until steady, then predict from past values and past surprises.",
    scenes: [
      scene(Flow, { steps: [["I: difference", "until the series sits still"], ["AR: past values", "today echoes last month"], ["MA: past surprises", "shocks echo briefly"]] }),
      scene(Fan, { model: "ar", note: "Steady series drift back to the average; their range stops growing" }, 10),
      scene(Flow, { steps: [["AutoARIMA", "tries orders, keeps the best by AIC"], ["Prophet", "trend + seasons + holidays"], ["TBATS", "several seasons at once"]] }),
    ],
  },
  "time/ml-forecasting": {
    method: "Turn the series into a table of past values, fit any model to it, and predict changes rather than levels.",
    scenes: [
      scene(Flow, { steps: [["Last month", "y(t−1)"], ["Same month last year", "y(t−12)"], ["Calendar", "month, holidays"], ["Model → next month", "y(t)"]] }),
      scene(Curves, {
        x: [0, 130],
        y: [80, 200],
        xLabel: "month",
        stagger: true,
        lines: [
          { f: (i) => 100 + 0.6 * i + 14 * Math.sin((2 * Math.PI * i) / 12), cls: "line-ink" },
          { points: Array.from({ length: 37 }, (_, h) => [94 + h, Math.min(168, 100 + 0.6 * (94 + h) + 14 * Math.sin((2 * Math.PI * (94 + h)) / 12))]), cls: "line-bad" },
        ],
        note: "Red: a tree on past values, stuck at its record high",
      }),
      scene(Curves, {
        x: [0, 130],
        y: [80, 200],
        xLabel: "month",
        stagger: true,
        lines: [
          { f: (i) => 100 + 0.6 * i + 14 * Math.sin((2 * Math.PI * i) / 12), cls: "line-ink" },
          { points: Array.from({ length: 37 }, (_, h) => [94 + h, 101 + 0.6 * (94 + h) + 13 * Math.sin((2 * Math.PI * (94 + h)) / 12)]), cls: "line-a" },
        ],
        note: "Teal: a tree on yearly changes keeps climbing with the trend",
      }),
    ],
  },
  "time/evaluation": {
    method: "Pretend to stand at several past dates, forecast only from what was known then, and score what followed.",
    scenes: [
      scene(Folds, { rows: 4, cols: 16, kind: "walk", note: "Walk forward: train on the past, test on what comes next" }),
      scene(Flow, { steps: [["Train on the past", "up to a cut-off"], ["Forecast the next stretch", "score it"], ["Move the cut-off forward", "repeat"]] }),
      scene(Bars, { bars: [{ label: "MAE: same as before", value: 5.5, cls: "bar-a", text: "5.5" }, { label: "MAPE, ordinary months", value: 6, cls: "bar-muted", text: "≈ 6%" }, { label: "MAPE with a month near zero", value: 55, cls: "bar-bad", text: "≈ 55%" }], note: "Same errors; percentages blow up near zero" }),
    ],
  },
  "time/hierarchies": {
    method: "Forecast every level, then adjust them all as little as possible so the parts add up to the totals.",
    scenes: [
      scene(Tree, { root: { q: "Total: 318", yes: { q: "North: 196", yes: { leaf: "A: 111", c: 0 }, no: { leaf: "B: 91", c: 0 } }, no: { q: "South: 92", yes: { leaf: "C: 58", c: 0 }, no: { leaf: "D: 30", c: 0 } } }, note: "Forecast separately: stores add up to 290, not 318" }),
      scene(Flow, { steps: [["Bottom-up", "add up the stores"], ["Top-down", "split the total by usual shares"], ["Reconcile", "nudge every level until it adds up"]] }),
      scene(Bars, { bars: [{ label: "separately", value: 8.9, cls: "bar-muted" }, { label: "bottom-up", value: 8.0, cls: "bar-muted" }, { label: "top-down", value: 7.7, cls: "bar-muted" }, { label: "reconciled", value: 4.8, cls: "bar-a" }], note: "Average miss across all seven numbers" }),
    ],
  },

  // ---------------------------------------------------------------- vision
  "vision/convolution": {
    method: "Slide small learned pattern detectors over the image, and stack them from edges up to objects.",
    scenes: [
      scene(Pixels, { cols: 16, rows: 10, paint: (x, y) => ((x - 7.5) ** 2 / 1.6 + (y - 4.5) ** 2 < 12 ? "px-on" : null), note: "To a computer, a picture is a grid of numbers" }),
      scene(Slide, {}, 11),
      scene(Flow, { steps: [["Edges", "first layers"], ["Textures", "then patterns of edges"], ["Parts", "eyes, wheels"], ["Objects", "a cat, a car"]] }),
    ],
  },
  "vision/deep-networks": {
    method: "Stack many layers, give the learning signal a shortcut past each one, and start from a model that's already trained.",
    scenes: [
      scene(Signal, { compare: true, note: "Skip connections carry the learning signal back to the first layers" }, 12),
      scene(Flow, { steps: [["Pretrained on ImageNet", "1.2 million labelled photos"], ["General features", "edges up to object parts"], ["Reuse them", "for your own task"]] }),
      scene(Flow, { steps: [["Little data?", "retrain only the last layer"], ["More data?", "fine-tune more layers"], ["Gently", "a small learning rate"]] }),
    ],
  },
  "vision/detection": {
    method: "Predict many boxes with scores, delete the duplicates, and count a box as right when it overlaps the truth enough.",
    scenes: [
      scene(Flow, { steps: [["Box", "where"], ["Label", "what"], ["Confidence", "how sure"]] }),
      scene(Overlap, {}, 10),
      scene(Flow, { steps: [["Many overlapping guesses", "for each object"], ["Keep the most confident", "drop boxes overlapping it"], ["One box per object", "non-maximum suppression"]] }),
    ],
  },
  "vision/segmentation": {
    method: "Label every pixel: shrink the image to see context, grow it back, and pass fine detail across with skip links.",
    scenes: [
      scene(Pixels, { cols: 24, rows: 12, reveal: "diag", paint: (x, y) => (y >= 5 && y <= 9 && x >= 2 && x <= 8 ? "px-out" : y >= 6 && y <= 10 && x >= 14 && x <= 21 ? "px-out" : y >= 3 && y <= 10 && x >= 11 && x <= 12 ? "heat-b" : y >= 10 ? "bar-muted" : null), note: "Semantic: both cars share one colour" }),
      scene(Pixels, { cols: 24, rows: 12, reveal: "diag", paint: (x, y) => (y >= 5 && y <= 9 && x >= 2 && x <= 8 ? "px-out" : y >= 6 && y <= 10 && x >= 14 && x <= 21 ? "bar-bad" : y >= 3 && y <= 10 && x >= 11 && x <= 12 ? "heat-b" : null), note: "Instance: each car gets its own" }),
      scene(Flow, { steps: [["Click a point or draw a box", "the prompt"], ["SAM reads image and prompt", "one big pretrained model"], ["A mask for that object", "no retraining needed"]] }),
    ],
  },
  "vision/generative": {
    method: "Learn to turn random numbers into pictures; diffusion does it by removing noise a little at a time.",
    scenes: [
      scene(Flow, { steps: [["VAE", "a smooth map of codes"], ["GAN", "a generator against a critic"], ["Diffusion", "remove noise step by step"]] }),
      scene(Noise, { reverse: true, note: "Start from pure noise, remove a little predicted noise each step" }, 10),
      scene(Flow, { steps: [["Generate thousands", "of images"], ["Describe them", "with an Inception network"], ["Compare with real ones", "FID: lower is better"], ["And look", "at many random samples"]] }),
    ],
  },
  "vision/transformers": {
    method: "Cut the image into patches, treat them like words, and let every patch attend to every other.",
    scenes: [
      scene(Patches, { attend: false, note: "Cut into 16 patches, read like a sentence" }, 9),
      scene(Patches, { attend: true, note: "Each patch weighs every other: context from anywhere" }, 9),
      scene(Bars, { bars: [{ label: "'a photo of a cat'", value: 54, cls: "bar-a", text: "54%" }, { label: "'a photo of a dog'", value: 45, cls: "bar-muted", text: "45%" }, { label: "'a photo of a bicycle'", value: 1, cls: "bar-muted", text: "0%" }], note: "CLIP: classify by comparing with sentences" }),
    ],
  },
  "vision/shipping": {
    method: "Check what the model looks at, export it to a portable format, and shrink it to 8 bits for speed.",
    scenes: [
      scene(Heat, {}, 9),
      scene(Flow, { steps: [["Trained model", "PyTorch"], ["Export", "ONNX"], ["Check outputs match", "on real inputs"], ["Run anywhere", "server, phone, camera"]] }),
      scene(Bars, { bars: [{ label: "32-bit floats", value: 100, cls: "bar-muted", text: "100 MB" }, { label: "8-bit integers", value: 25, cls: "bar-a", text: "25 MB" }], max: 115, note: "A 25-million-weight model, four times smaller" }),
    ],
  },
};
