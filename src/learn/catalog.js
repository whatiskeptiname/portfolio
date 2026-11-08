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

export const CATALOG = [
  {
    id: "trees",
    title: "Forests for the trees",
    blurb: "How a model plays twenty questions with your data, why one tree is fragile, and how a crowd of them gets it right.",
    hook: "How tree models decide, and why a crowd of them wins.",
    cover: "trees",
  },
  {
    id: "bayes",
    title: "Certainly uncertain",
    blurb: "Saying how sure you are: updating beliefs with data, uncertainty you can and can't remove, and sampling when the maths won't close.",
    hook: "How models say how sure they are.",
    cover: "bayes",
  },
  {
    id: "time",
    title: "Tomorrow, roughly",
    blurb: "Data where order matters: trend, season and noise, memory in a series, and forecasting models from the simplest to neural networks.",
    hook: "How forecasts are made, and how to tell a good one.",
    cover: "time",
  },
  {
    id: "vision",
    title: "Seeing is computing",
    blurb: "From one 3×3 filter to finding, outlining and generating objects, and the transformers that now compete with convolutions.",
    hook: "How vision models find, outline and make images.",
    cover: "vision",
  },
];
