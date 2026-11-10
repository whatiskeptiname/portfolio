# The lessons

How the Learn section is put together, and how to add a chapter or lesson. Back to the [README](../README.md).

Quick, hands-on explainers of how machine learning systems work, for people who use
them (often through AI tools) more than they build them. They live at `#/learn` (all
chapters), `#/learn/<chapter>` and `#/learn/<chapter>/<lesson>`. The Learn section on
the landing page has a small tile per chapter, each with a moving picture of the
chapter's idea (`src/learn/Covers.jsx`) and a one-line hook; clicking one opens the
lessons out of the tile, the same way the planet opens. They're dark unless the
visitor has picked light.

There are eight chapters, 58 lessons, in reading order:

| Chapter | What it covers |
| --- | --- |
| **Fitting in** | Linear and logistic regression, gradient descent, regularisation, features and scaling, k-means clustering, PCA, anomaly detection |
| **Thinking in layers** | Neurons and the perceptron, hidden layers, activation functions and normalisation (traced through a small layer, tap a hidden neuron to light up its connections and see its working written out (weighted sum, mean and spread, activation, the next layer) while the diagram stays in view; and why CNNs, transformers and RNNs each use their own), backpropagation, training deep networks (Adam, dropout, early stopping), recurrent networks and LSTMs |
| **Forests for the trees** | Decision trees, overfitting, metrics, random forests, boosting, honest testing, explaining predictions |
| **Certainly uncertain** | Kinds of uncertainty, estimation, Bayesian updating, Gaussians, Bayesian networks, Gaussian processes, MCMC |
| **Tomorrow, roughly** | Time-series components, stationarity, autocorrelation, classical methods, ARIMA, ML forecasting, evaluation, hierarchies |
| **Seeing is computing** | Convolution, deep networks, detection, segmentation, generative models, vision transformers, shipping models |
| **Words, by numbers** | Embeddings, tokens, attention, text generation, hallucination, retrieval (RAG), prompting versus fine-tuning |
| **Out in the wild** | Serving, versioning, data drift, A/B testing, retraining, fairness, recommender systems |

The maths behind the newer chapters' simulations is in `src/learn/mlmath.js`, tested
in `mlmath.test.js`; where a simulation uses illustrative numbers rather than a real
model (the attention weights, the fine-tuning curves), it says so.

Where a simulation lets you pick something you can see, you tap it in the
diagram itself: a hidden neuron in the traced layer, a word in the attention
sentence, a viewer's name in the recommender grid, the dog or the ball in the
Grad-CAM photo. On a phone each simulation runs edge to edge and its diagram
text is drawn larger (`--svg-text` and `--svg-axis` in `learn.css`), so labels
stay around 10px instead of shrinking to 6.

Chapters and lessons have short, memorable titles, each with its plain textbook name
shown above it (for example *Linear regression* over "Drawing the best straight line";
the names live in `src/learn/topics.js`) and a plain description under it, and each opens with **how it started**: a few dated sentences on where the idea
came from and why. Then every lesson gives a fast path: **in 60 seconds** (the idea in a few plain
sentences, plus three things to remember), **for example** (a concrete story), **try
it** (one or more simulations), and **in practice** (what you'd adjust, what goes
wrong, how you'd notice, and what to ask an AI or a teammate). **The details** (the
formulas and finer points) fold away behind a button. Then **check yourself** (a few
questions; the options work like radio buttons and stay clickable after you've found
the answer, so you can read why each one is right or wrong; only your first try counts.
Options are written with the right one first and shuffled on the page, the same way
every visit, by `optionOrder` in `src/learn/math.js`), **say it back** (pick the explanation you'd give a friend; each choice
says what it gets right or wrong), and **go deeper** (links to well-known sources).
Questions come in four kinds: `choice`, `multi` (pick all that apply), `number`, and
`task`, which embeds a simulation and checks itself as the student plays. Finished
lessons are remembered in the browser (`localStorage`), so chapters show what's done
and where to pick up.

**Adding a chapter:**

1. Add an entry to `src/learn/catalog.js` (id, title, blurb, a short `hook` for the
   landing page, and a `cover` from `Covers.jsx`; add a new cover there if none fits).
2. Add the chapter's light outline to `src/learn/outline.js`: its `history` (how it
   started) and, for each lesson in reading order, its `id`, `title` and one-line
   `lead`. This is all the library, chapter pages and lesson rail need, so they load
   fast; the titles and leads live only here.
3. Write `src/learn/chapters/<id>.jsx` exporting `{ lessons: [...] }` with the same
   lesson ids. Copy the shape of an existing chapter; each lesson needs `id`,
   `history`, `idea`, `gist`, `example`, `play`, `practice` (`adjust`, `wrong`,
   `notice`, `ask`), `quiz`, `explain` and `readMore` (`how` is optional). Write the
   right option first in each question (the page shuffles them), and keep it about as
   long as the others: a test fails if the right answer keeps being the longest.
4. Put its simulations in `src/learn/sims/<id>.jsx`, built from the pieces in
   `src/learn/kit.jsx` (frame, sliders, toggles, readouts, axes) and
   `src/learn/plot.js` (scales, paths, animation loop). Maths goes in
   `src/learn/math.js`, with a test. A simulation that's used in a `task` question
   reports its state with `useReport(onState, {...})`, and shouldn't already pass
   the task's check before anyone touches it.
5. Register it in `LOADERS` in `src/learn/chapters/index.js` and in `CONTENT` in
   `src/learn/chapters/full.js` (the tests' copy of every chapter).

Each chapter downloads on its own the first time someone opens it (or its chapter
page, which fetches it ahead), so the library itself stays small.

`src/learn/chapters.test.js` checks every lesson automatically: all parts present
(including the fast path),
exactly one right answer per choice question, exactly one "right" explanation, the
outline and chapter files listing the same lessons, right answers that aren't given
away by their length or position, and links on https.
