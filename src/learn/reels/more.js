// Walkthroughs for the foundations, language and "in the wild" chapters, in
// the same shape as reels/index.js: a one-line method and one scene per
// "what to remember" point, in order.
import { createElement } from "react";
import { range, rng, normal } from "../math";
import { Bars, Curves, Flow, Lines, Scatter } from "./kit";

const scene = (Component, props = {}, seconds = 9) => ({
  Scene: ({ t }) => createElement(Component, { ...props, t }),
  duration: seconds * 1000,
});

const cloud = (seed, n, f) => {
  const r = rng(seed);
  return range(n).map(() => f(r));
};
const linePts = cloud(21, 22, (r) => {
  const x = 0.05 + r() * 0.9;
  return { x, y: Math.max(0.03, Math.min(0.97, 0.15 + 0.7 * x + normal(r) * 0.07)), c: 1 };
});
const groups = cloud(31, 45, (r) => {
  const c = [
    [0.25, 0.7],
    [0.72, 0.72],
    [0.55, 0.25],
  ][Math.floor(r() * 3)];
  return { x: c[0] + normal(r) * 0.06, y: c[1] + normal(r) * 0.06, c: c[1] < 0.4 ? 1 : 0 };
});
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export const MORE_REELS = {
  // --- foundations -------------------------------------------------------------
  "foundations/regression": {
    method: "Draw the line that makes the squared errors as small as possible, then read each weight as a rate of change.",
    scenes: [
      scene(Lines, { lines: ["price = 20 + 0.9 × area", ["a starting value + a weight × each input", "muted"]], big: true }),
      scene(Scatter, { points: linePts, lines: [{ x1: 0, y1: 0.15, x2: 1, y2: 0.85, label: "least squares" }], xLabel: "floor area →", yLabel: "price ↑", note: "The line with the smallest total squared miss" }),
      scene(Lines, { lines: ["weight on area = 0.9", ["+0.9 lakh per extra m²", "accent"], ["…other inputs held the same", "muted"]], big: true }),
    ],
  },
  "foundations/gradient-descent": {
    method: "Measure how wrong you are, take a small step downhill, repeat until it stops getting better.",
    scenes: [
      scene(Flow, { steps: [["Predict", "with the current weights"], ["Measure the loss", "how wrong, on average"], ["Find the slope", "which way is down"], ["Step downhill", "and repeat"]] }),
      scene(Curves, { x: [0, 10], y: [0, 6], xLabel: "the weight", yLabel: "loss", lines: [{ f: (x) => 0.18 * (x - 6) ** 2 + 0.6, cls: "line-muted" }, { points: [0, 1.6, 2.9, 3.9, 4.6, 5.1, 5.5, 5.75, 5.9, 6].map((x) => [x, 0.18 * (x - 6) ** 2 + 0.6]), cls: "line-a", label: "steps shrink near the bottom" }] }),
      scene(Bars, { bars: [{ label: "too small: crawls", value: 30, cls: "bar-muted", text: "slow" }, { label: "about right", value: 90, cls: "bar-a", text: "fast" }, { label: "too big: overshoots", value: 15, cls: "bar-bad", text: "blows up" }], max: 110, note: "The learning rate is the setting that matters most" }),
    ],
  },
  "foundations/logistic": {
    method: "Compute a score like a line, squash it through an S-curve into a probability, then choose a cut-off.",
    scenes: [
      scene(Curves, { x: [-6, 6], y: [-0.05, 1.05], xLabel: "score (a line)", yLabel: "probability", lines: [{ f: (x) => sigmoid(x), label: "σ(score)" }], marks: [{ x: 0, label: "score 0 = 50%" }] }),
      scene(Lines, { lines: ["said 0.9, it happened: cost 0.1", ["said 0.01, it happened: cost 4.6", "bad"], ["confident and wrong costs most", "muted"]] }),
      scene(Flow, { steps: [["Model", "gives a probability"], ["You choose a cut-off", "e.g. 0.5, or 0.2 to catch more"], ["Yes / no", "a business decision"]] }),
    ],
  },
  "foundations/regularisation": {
    method: "Add a charge for big weights, so the model only bends where the data insists; tune the charge on held-out data.",
    scenes: [
      scene(Curves, { x: [-1, 1], y: [-2, 2], xLabel: "x", yLabel: "y", lines: [{ f: (x) => Math.sin(2.4 * x), cls: "line-muted", label: "truth" }, { f: (x) => Math.sin(2.4 * x) + 0.6 * Math.sin(17 * x), cls: "line-bad", label: "fits the noise" }] }),
      scene(Lines, { lines: ["loss = error + λ × (size of weights)", ["big weights cost extra", "accent"]], big: true }),
      scene(Curves, { x: [0, 10], y: [0, 1], xLabel: "penalty strength →", yLabel: "error on new data", lines: [{ f: (x) => 0.25 + 0.05 * (x - 4) ** 2 / 4 + (x < 4 ? 0.04 * (4 - x) : 0), label: "too little · just right · too much" }], marks: [{ x: 4, label: "best λ" }] }),
    ],
  },
  "foundations/features": {
    method: "Turn every column into sensible numbers on comparable scales, fitted on training data only, and build inputs that mean something.",
    scenes: [
      scene(Flow, { steps: [["Text", "→ one column per category"], ["Dates", "→ weekday, month, holiday"], ["Missing", "→ fill + a 'was missing' flag"], ["All numbers", "ready for the model"]] }),
      scene(Bars, { bars: [{ label: "income difference (Rs)", value: 400, cls: "bar-bad", text: "400" }, { label: "age difference (years)", value: 38, cls: "bar-muted", text: "38" }], max: 440, note: "Unscaled, income drowns age out" }),
      scene(Lines, { lines: ["'days since last order'", ["beats a cleverer model", "accent"], ["meaning comes from knowing the problem", "muted"]], big: true }),
    ],
  },
  "foundations/clustering": {
    method: "Join each point to its nearest centre, move each centre to the middle of its points, repeat until nothing moves.",
    scenes: [
      scene(Scatter, { points: groups.map((p) => ({ ...p, c: 0 })), note: "No labels: just shoppers" }),
      scene(Flow, { steps: [["Place k centres", "anywhere"], ["Assign", "each point to its nearest"], ["Update", "centre = average of its points"], ["Repeat", "until nothing changes"]] }),
      scene(Bars, { bars: [{ label: "k = 2", value: 2, cls: "bar-muted", text: "2 groups" }, { label: "k = 3", value: 3, cls: "bar-a", text: "3 groups" }, { label: "k = 8", value: 8, cls: "bar-bad", text: "8 groups!" }], note: "It always finds k groups, real or not" }),
    ],
  },
  "foundations/pca": {
    method: "Find the directions in which the data spreads most, and keep only the top few as new columns.",
    scenes: [
      scene(Scatter, { points: linePts.map((p) => ({ ...p, c: 0 })), lines: [{ x1: 0, y1: 0.15, x2: 1, y2: 0.85, label: "most spread" }], note: "Two columns that move together" }),
      scene(Bars, { bars: [{ label: "component 1", value: 82, cls: "bar-a", text: "82%" }, { label: "component 2", value: 11, cls: "bar-muted", text: "11%" }, { label: "component 3", value: 5, cls: "bar-muted", text: "5%" }, { label: "the rest", value: 2, cls: "bar-muted", text: "2%" }], max: 95, note: "Keep the first one or two" }),
      scene(Lines, { lines: ["component 1 = 0.7·height + 0.7·arm span", ["a mixture: 'overall size'", "muted"], ["great for plotting, harder to name", "accent"]] }),
    ],
  },
  "foundations/anomalies": {
    method: "Learn what normal looks like, flag whatever is far from it, and send the flags to someone who can judge them.",
    scenes: [
      scene(Curves, { x: [-4, 4], y: [0, 0.45], xLabel: "payment amount (standard deviations)", yLabel: "how common", lines: [{ f: (x) => Math.exp(-x * x / 2) / 2.5066, label: "normal" }], marks: [{ x: 3, label: "flag beyond 3" }] }),
      scene(Bars, { bars: [{ label: "normal payments", value: 99, cls: "bar-muted", text: "thousands" }, { label: "known frauds", value: 2, cls: "bar-bad", text: "a handful" }], max: 110, note: "Too few bad examples to learn from" }),
      scene(Flow, { tone: "b", steps: [["Unusual", "a big fridge"], ["Not bad", "an honest buyer"], ["Bad", "a stolen card"], ["Unusual ≠ bad", "a person decides"]] }),
    ],
  },

  // --- neural networks -----------------------------------------------------------
  "neural/neurons": {
    method: "Weigh each input, add them up with a bias, and fire if the total is high enough; training finds the weights.",
    scenes: [
      scene(Lines, { lines: ["0.9 × score 1 + 0.6 × score 2 + 0.1", ["> 0 → fire (admit)", "accent"]], big: true }),
      scene(Flow, { steps: [["Weighted sum", "inputs × weights + bias"], ["Activation", "how strongly to fire"], ["Gradient descent", "finds the weights"]] }),
      scene(Scatter, { points: [{ x: 0.2, y: 0.2, c: 1 }, { x: 0.25, y: 0.3, c: 1 }, { x: 0.8, y: 0.8, c: 1 }, { x: 0.75, y: 0.7, c: 1 }, { x: 0.2, y: 0.8, c: 0 }, { x: 0.3, y: 0.75, c: 0 }, { x: 0.8, y: 0.2, c: 0 }, { x: 0.7, y: 0.3, c: 0 }], lines: [{ x1: 0, y1: 0.5, x2: 1, y2: 0.55, label: "one line: not enough" }], note: "XOR: no single line splits it" }),
    ],
  },
  "neural/layers": {
    method: "Stack neurons in layers with a bend (activation) between them, so each layer reshapes what the last one drew.",
    scenes: [
      scene(Flow, { steps: [["Inputs", "two numbers"], ["Hidden layer", "several lines"], ["Activation", "bends them"], ["Output", "combines them"]] }),
      scene(Lines, { lines: ["no activation: W′(Wx) = one linear map", ["ten layers = one layer", "bad"], ["with ReLU or tanh: shapes", "accent"]] }),
      scene(Bars, { bars: [{ label: "no hidden layer", value: 65, cls: "bar-muted", text: "65%" }, { label: "2 hidden neurons", value: 84, cls: "bar-muted", text: "84%" }, { label: "4 hidden neurons", value: 100, cls: "bar-a", text: "100%" }], max: 115, note: "Right on the XOR points" }),
    ],
  },
  "neural/backprop": {
    method: "Compute the error at the output, pass it backwards with the chain rule so every weight gets its share, then step each weight downhill.",
    scenes: [
      scene(Lines, { lines: ["output −0.14, wanted 0.80", ["error −0.94: who's to blame?", "bad"]], big: true }),
      scene(Flow, { tone: "b", steps: [["Output", "error"], ["× weight 2", "its share"], ["× tanh's slope", "passed back"], ["× weight 1", "its share"]] }),
      scene(Flow, { steps: [["Forward", "make a prediction"], ["Backward", "blame every weight"], ["Step", "w ← w − η · blame"], ["Repeat", "millions of times"]] }),
    ],
  },
  "neural/training": {
    method: "Train with a good optimiser, watch training and validation loss together, hold memorising back with dropout, and keep the best epoch.",
    scenes: [
      scene(Curves, { x: [0, 60], y: [0, 1], xLabel: "epochs", yLabel: "loss", lines: [{ f: (e) => 0.03 + 0.97 * Math.exp(-0.05 * e), label: "training" }, { f: (e) => 0.11 + 0.89 * Math.exp(-0.05 * e) + 0.006 * Math.max(0, e - 30) ** 1.25, cls: "line-b", label: "validation", dy: -10 }], marks: [{ x: 30, label: "starts memorising" }] }),
      scene(Bars, { bars: [{ label: "plain SGD", value: 30, cls: "bar-muted", text: "30 epochs" }, { label: "Adam", value: 12, cls: "bar-a", text: "12 epochs" }], max: 36, note: "Epochs to the best validation loss" }),
      scene(Flow, { steps: [["Dropout", "no neuron can lean on another"], ["Early stopping", "keep the best epoch"], ["Weight decay", "small weights"]] }),
    ],
  },
  "neural/sequences": {
    method: "Read the sequence one step at a time, carrying a memory; use gates (LSTM) so the memory can last.",
    scenes: [
      scene(Flow, { steps: [["Word 1", "update memory"], ["Word 2", "update memory"], ["…", "same weights each step"], ["Word 30", "still remember word 1?"]] }),
      scene(Curves, { x: [0, 40], y: [0, 1], xLabel: "steps later", yLabel: "signal left", lines: [{ f: (s) => 0.8 ** s, cls: "line-b", label: "plain RNN" }] }),
      scene(Curves, { x: [0, 40], y: [0, 1], xLabel: "steps later", yLabel: "signal left", lines: [{ f: (s) => 0.8 ** s, cls: "line-b" }, { f: (s) => 0.98 ** s, label: "LSTM, gate ≈ 0.98" }] }),
    ],
  },

  // --- language ------------------------------------------------------------------
  "language/embeddings": {
    method: "Give every word a position, learned from the company it keeps, so that similar meanings sit close together.",
    scenes: [
      scene(Lines, { lines: ["'momo' → (0.12, −0.60, 0.33, …)", ["hundreds of numbers per word", "muted"]], big: true }),
      scene(Scatter, { points: [{ x: 0.2, y: 0.25, c: 1 }, { x: 0.26, y: 0.2, c: 1 }, { x: 0.3, y: 0.3, c: 1 }, { x: 0.75, y: 0.7, c: 0 }, { x: 0.8, y: 0.78, c: 0 }, { x: 0.7, y: 0.8, c: 0 }], note: "momo, dal, rice here · bus, taxi, train there" }),
      scene(Flow, { steps: [["Embed the search", "'dumplings'"], ["Embed every dish", "once"], ["Rank by closeness", "momo comes first"]] }),
    ],
  },
  "language/tokens": {
    method: "Split text into pieces from a fixed vocabulary; everything the model reads, and everything you pay for, is counted in those pieces.",
    scenes: [
      scene(Lines, { lines: ["unbelievable", ["un · believ · able", "accent"], ["common words whole, rare ones in pieces", "muted"]], big: true }),
      scene(Bars, { bars: [{ label: "words you wrote", value: 600, cls: "bar-muted", text: "600" }, { label: "tokens you pay for", value: 800, cls: "bar-a", text: "≈ 800" }], max: 900, note: "1 token ≈ ¾ of an English word" }),
      scene(Bars, { bars: [{ label: "English", value: 1.3, cls: "bar-a", text: "1.3" }, { label: "Nepali (Devanagari)", value: 4, cls: "bar-bad", text: "several ×" }], max: 4.6, note: "Tokens per word, roughly" }),
    ],
  },
  "language/attention": {
    method: "Let every word score how relevant every other word is, and rebuild its meaning as a weighted mix of them.",
    scenes: [
      scene(Lines, { lines: ["The animal didn't cross the street", "because it was too tired", ["'it' looks at every word", "accent"]] }),
      scene(Bars, { bars: [{ label: "animal", value: 62, cls: "bar-a", text: "62%" }, { label: "street", value: 5, cls: "bar-muted", text: "5%" }, { label: "tired", value: 10, cls: "bar-muted", text: "10%" }], max: 75, note: "…too tired: 'it' is the animal. …too wide: the street." }),
      scene(Flow, { steps: [["All words at once", "in parallel"], ["Many heads", "each looks for something"], ["Many layers", "meaning builds up"]] }),
    ],
  },
  "language/generation": {
    method: "Score every possible next token, pick one, append it, and ask again, thousands of times.",
    scenes: [
      scene(Bars, { bars: [{ label: "Kathmandu", value: 72, cls: "bar-a", text: "72%" }, { label: "a", value: 12, cls: "bar-muted", text: "12%" }, { label: "home", value: 5, cls: "bar-muted", text: "5%" }, { label: "beautiful", value: 4, cls: "bar-muted", text: "4%" }], max: 82, note: "The capital of Nepal is …" }),
      scene(Flow, { steps: [["Predict", "probabilities"], ["Pick", "one token"], ["Append", "to the text"], ["Repeat", "until done"]] }),
      scene(Bars, { bars: [{ label: "temperature 0", value: 100, cls: "bar-a", text: "always Kathmandu" }, { label: "temperature 1", value: 72, cls: "bar-muted", text: "usually" }, { label: "temperature 2", value: 38, cls: "bar-bad", text: "often not" }], max: 110 }),
    ],
  },
  "language/hallucination": {
    method: "The model writes what's plausible; ground it in the source and let it say 'I don't know', then check.",
    scenes: [
      scene(Lines, { lines: ["plausible ≠ true", ["seen 10,000 times: plausible and true", "accent"], ["seen once: plausible and a guess", "bad"]] }),
      scene(Bars, { bars: [{ label: "1951", value: 20, cls: "bar-muted", text: "20%" }, { label: "1956", value: 30, cls: "bar-bad", text: "30%" }, { label: "1959 (right)", value: 25, cls: "bar-a", text: "25%" }, { label: "1962", value: 17, cls: "bar-muted", text: "17%" }], max: 36, note: "No source: it still answers, confidently" }),
      scene(Flow, { steps: [["Give it the source", "copy, don't recall"], ["Allow 'not stated'", "no reward for guessing"], ["Check the quotes", "for anything that matters"]] }),
    ],
  },
  "language/rag": {
    method: "Search your documents for the passages that match the question, put them in the prompt, and answer from them.",
    scenes: [
      scene(Flow, { steps: [["Question", "'when is my refund paid?'"], ["Search", "your documents"], ["Top passages", "into the prompt"], ["Answer", "from them, with sources"]] }),
      scene(Lines, { lines: ["update the policy document", ["the answers change the same day", "accent"], ["no retraining", "muted"]], big: true }),
      scene(Bars, { bars: [{ label: "right passage retrieved", value: 92, cls: "bar-a", text: "good answer" }, { label: "right passage missed", value: 10, cls: "bar-bad", text: "can't answer" }], max: 105, note: "The answer is only as good as the search" }),
    ],
  },
  "language/fine-tuning": {
    method: "Tell it with instructions and examples first; train it further only when you have plenty of good examples of a narrow task.",
    scenes: [
      scene(Flow, { steps: [["Instructions", "what you want"], ["A few examples", "in the prompt"], ["Nothing changes", "inside the model"]] }),
      scene(Flow, { tone: "b", steps: [["Thousands of examples", "input → right output"], ["Train further", "gradient descent"], ["New weights", "behaviour built in"]] }),
      scene(Curves, { x: [0, 3.5], y: [0.4, 1], xLabel: "labelled examples (log scale)", yLabel: "accuracy", lines: [{ f: (x) => 0.62 + 0.18 * (Math.min(10 ** x, 30) / (Math.min(10 ** x, 30) + 4)), cls: "line-b", label: "prompting" }, { f: (x) => 0.45 + 0.49 * (10 ** x / (10 ** x + 300)), cls: "line-a", label: "fine-tuning", dy: 22 }] }),
    ],
  },

  // --- in the wild -------------------------------------------------------------------
  "wild/serving": {
    method: "Run the model as a service with a time budget, batching requests to use the hardware without making each one wait too long.",
    scenes: [
      scene(Flow, { steps: [["Request", "a photo"], ["Queue", "and batch"], ["Model", "on a GPU"], ["Answer", "within 200 ms"]] }),
      scene(Bars, { bars: [{ label: "batch of 1", value: 67, cls: "bar-muted", text: "67/s" }, { label: "batch of 8", value: 222, cls: "bar-a", text: "222/s" }, { label: "batch of 32", value: 296, cls: "bar-a", text: "296/s" }], max: 330, note: "Requests a second it can handle" }),
      scene(Lines, { lines: ["7 pm: big batches keep up", "3 am: big batches mean waiting", ["send what you have after 20 ms", "accent"]] }),
    ],
  },
  "wild/versioning": {
    method: "Record the data version, code commit, settings and seed for every model, so any model can be rebuilt and traced.",
    scenes: [
      scene(Lines, { lines: ["model = train(data, code, settings, seed)", ["four things decide it", "muted"]], big: true }),
      scene(Bars, { bars: [{ label: "run 1", value: 87.6, cls: "bar-muted", text: "87.6%" }, { label: "run 2", value: 85.9, cls: "bar-muted", text: "85.9%" }, { label: "run 3", value: 88.4, cls: "bar-muted", text: "88.4%" }], max: 95, note: "Same 'model', nothing pinned" }),
      scene(Flow, { steps: [["data v12", "snapshot"], ["commit 4f2a9c", "code"], ["seed 42", "settings logged"], ["Registry", "rebuild · compare · roll back"]] }),
    ],
  },
  "wild/drift": {
    method: "Compare what the model sees now with what it was trained on, and investigate when they part ways.",
    scenes: [
      scene(Curves, { x: [0, 80], y: [0, 0.06], xLabel: "customer age", yLabel: "share", lines: [{ f: (x) => Math.exp(-((x - 40) ** 2) / 120) / 19.4, cls: "line-muted", label: "trained on" }, { f: (x) => Math.exp(-((x - 24) ** 2) / 90) / 16.8, cls: "line-bad", label: "now" }] }),
      scene(Curves, { x: [0, 12], y: [0.6, 0.95], xLabel: "months in production", yLabel: "accuracy", lines: [{ f: (x) => 0.91 - 0.0015 * x * x, cls: "line-bad", label: "no error message" }] }),
      scene(Lines, { lines: ["drift score (PSI) this week: 0.31", ["> 0.25: investigate", "bad"], ["no labels needed", "accent"]], big: true }),
    ],
  },
  "wild/ab-testing": {
    method: "Split users at random between old and new, compare what they do, and decide only once you have enough of them.",
    scenes: [
      scene(Bars, { bars: [{ label: "test-set score, new model", value: 92, cls: "bar-a", text: "better" }, { label: "sales, new model", value: 50, cls: "bar-muted", text: "?" }], max: 105, note: "A better score isn't proof" }),
      scene(Flow, { steps: [["Users", "split at random"], ["A: old model", "half of them"], ["B: new model", "the other half"], ["Compare", "what they do"]] }),
      scene(Bars, { bars: [{ label: "1,000 users each", value: 30, cls: "bar-muted", text: "spots it 30% of the time" }, { label: "10,000 users each", value: 95, cls: "bar-a", text: "95%" }], max: 110, note: "A real 1-point improvement" }),
    ],
  },
  "wild/retraining": {
    method: "Retrain on fresh data often enough to stay above the line, check each new model before it ships, and no more often than pays.",
    scenes: [
      scene(Curves, { x: [0, 180], y: [0.6, 0.95], xLabel: "days", yLabel: "accuracy", lines: [{ f: (x) => 0.92 - 0.0015 * x, cls: "line-bad", label: "never retrained" }] }),
      scene(Curves, { x: [0, 180], y: [0.6, 0.95], xLabel: "days", yLabel: "accuracy", lines: [{ f: (x) => 0.92 - 0.0015 * (x % 30), label: "retrained monthly" }] }),
      scene(Flow, { steps: [["Fresh data", "train"], ["Test", "recent held-out days"], ["Compare", "with the current model"], ["Promote", "only if as good"]] }),
    ],
  },
  "wild/fairness": {
    method: "Break the errors down by group, choose which kind of equality matters for this decision, and fix the data or the decision.",
    scenes: [
      scene(Bars, { bars: [{ label: "overall accuracy", value: 85, cls: "bar-a", text: "85%" }, { label: "good payers refused, city", value: 12, cls: "bar-muted", text: "12%" }, { label: "good payers refused, rural", value: 40, cls: "bar-bad", text: "40%" }], max: 95, note: "Accurate overall, unequal underneath" }),
      scene(Lines, { lines: ["thin credit history", "→ lower, less sure scores", ["→ one cut-off refuses more", "bad"]] }),
      scene(Flow, { steps: [["Measure", "errors per group"], ["Choose", "which equality matters"], ["Fix", "data · thresholds · review"]] }),
    ],
  },
  "wild/recommenders": {
    method: "Learn a few hidden tastes for every person and item from everyone's ratings, and predict the blanks from how they match.",
    scenes: [
      scene(Lines, { lines: ["Anu rated: Action A ★5, Action B ★4", ["Action C: not seen yet", "muted"], ["predict: ★3.8 → recommend", "accent"]] }),
      scene(Flow, { steps: [["Ratings grid", "mostly blank"], ["Learn from everyone", "who agreed before?"], ["Fill the blanks", "best guesses first"]] }),
      scene(Lines, { lines: ["rating ≈ average + (your tastes · its qualities)", ["tastes nobody named: 'action', 'romance'", "muted"]] }),
    ],
  },
};
