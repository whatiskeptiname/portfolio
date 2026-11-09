// The chapters, in reading order. This file is all the landing page needs, so
// it stays small; each chapter's lessons and simulations live in
// chapters/<id>.jsx and only download when someone opens the lessons.
//
// "hook" is the one-liner on the landing page's small tiles; "blurb" is the
// longer description in the lessons themselves.
//
// To add a chapter: add a line here, write chapters/<id>.jsx (export default
// { lessons: [...] }, see chapters/trees.jsx for the shape), and register it
// in chapters/index.js. "cover" picks the moving picture from Covers.jsx.

import { CHAPTER_TOPICS } from "./topics";

// (Each chapter also carries `topic`, its plain textbook name, from topics.js.)
export const CATALOG = [
  {
    id: "foundations",
    topic: CHAPTER_TOPICS.foundations,
    title: "Fitting in",
    blurb: "The ideas every model is built from: fitting a line, learning by rolling downhill, probabilities, shrinkage, good inputs, and finding groups and outliers with no labels at all.",
    hook: "The few ideas every model is built from.",
    cover: "foundations",
  },
  {
    id: "neural",
    topic: CHAPTER_TOPICS.neural,
    title: "Thinking in layers",
    blurb: "Neural networks from the ground up: one neuron and what it can't do, hidden layers that bend the line, backpropagation, training deep networks without memorising, and remembering sequences.",
    hook: "How neural networks learn, from one neuron up.",
    cover: "neural",
  },
  {
    id: "trees",
    topic: CHAPTER_TOPICS.trees,
    title: "Forests for the trees",
    blurb: "How a model plays twenty questions with your data, why one tree is fragile, and how a crowd of them gets it right.",
    hook: "How tree models decide, and why a crowd of them wins.",
    cover: "trees",
  },
  {
    id: "bayes",
    topic: CHAPTER_TOPICS.bayes,
    title: "Certainly uncertain",
    blurb: "Saying how sure you are: updating beliefs with data, uncertainty you can and can't remove, and sampling when the maths won't close.",
    hook: "How models say how sure they are.",
    cover: "bayes",
  },
  {
    id: "time",
    topic: CHAPTER_TOPICS.time,
    title: "Tomorrow, roughly",
    blurb: "Data where order matters: trend, season and noise, memory in a series, and forecasting models from the simplest to neural networks.",
    hook: "How forecasts are made, and how to tell a good one.",
    cover: "time",
  },
  {
    id: "vision",
    topic: CHAPTER_TOPICS.vision,
    title: "Seeing is computing",
    blurb: "From one 3×3 filter to finding, outlining and generating objects, and the transformers that now compete with convolutions.",
    hook: "How vision models find, outline and make images.",
    cover: "vision",
  },
  {
    id: "language",
    topic: CHAPTER_TOPICS.language,
    title: "Words, by numbers",
    blurb: "How language models work: words as points in space, tokens, attention, writing one token at a time, why they make things up, and how retrieval and fine-tuning fix what they don't know.",
    hook: "How language models read, write and make things up.",
    cover: "language",
  },
  {
    id: "wild",
    topic: CHAPTER_TOPICS.wild,
    title: "Out in the wild",
    blurb: "What happens after the notebook: serving a model, versioning it, noticing when the world drifts, testing on real users, retraining, checking it's fair, and the recommenders that run most of the web.",
    hook: "Keeping a model useful once real people use it.",
    cover: "wild",
  },
];
