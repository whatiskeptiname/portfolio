// The chapters, in reading order. This file is all the landing page needs, so
// it stays small; each chapter's lessons and simulations live in
// chapters/<id>.jsx and only download when someone opens the lessons.
//
// To add a chapter: add a line here, write chapters/<id>.jsx (export default
// { lessons: [...] }, see chapters/trees.jsx for the shape), and register it
// in chapters/index.js. "cover" picks the moving picture from Covers.jsx.

export const CATALOG = [
  {
    id: "trees",
    title: "Trees and forests",
    blurb: "How a model plays twenty questions with your data, why one tree is fragile, and how a crowd of them gets it right.",
    cover: "trees",
  },
  {
    id: "bayes",
    title: "Thinking in probabilities",
    blurb: "Saying how sure you are: updating beliefs with data, uncertainty you can and can't remove, and sampling when the maths won't close.",
    cover: "bayes",
  },
  {
    id: "time",
    title: "Forecasting",
    blurb: "Data where order matters: trend, season and noise, memory in a series, and forecasting models from the simplest to neural networks.",
    cover: "time",
  },
  {
    id: "vision",
    title: "Teaching computers to see",
    blurb: "From one 3×3 filter to finding, outlining and generating objects, and the transformers that now compete with convolutions.",
    cover: "vision",
  },
];
