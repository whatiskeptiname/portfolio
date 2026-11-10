// The light part of every chapter: how it started, and each lesson's title and
// one-line lead. It's all the library, the chapter pages and the lesson rail need,
// so they open fast; a chapter's lessons (chapters/<id>.jsx, with their simulations)
// download only when someone opens it. Lessons are listed in reading order, and each
// id here must match a lesson in that chapter's file (chapters.test.js checks).

export const OUTLINE = {
  foundations: {
    history: "Least squares is over two hundred years old; gradient descent dates from the 1840s; most of the rest arrived in the twentieth century. Nearly every model you'll meet, a giant language model included, is built from these few ideas.",
    lessons: [
      { id: "regression", title: "Drawing the best straight line", lead: "Linear regression, and what 'best' means." },
      { id: "gradient-descent", title: "Rolling downhill", lead: "How almost every model actually learns." },
      { id: "logistic", title: "Yes or no, with odds", lead: "Logistic regression: a line bent into a probability." },
      { id: "regularisation", title: "Shrink on purpose", lead: "Regularisation: making a model simpler so it guesses better." },
      { id: "features", title: "Garbage in, garbage out", lead: "Features: getting data into a shape a model can use." },
      { id: "clustering", title: "Finding groups nobody labelled", lead: "Clustering with k-means." },
      { id: "pca", title: "Squashing many columns into two", lead: "Dimensionality reduction with PCA." },
      { id: "anomalies", title: "Spotting the odd one out", lead: "Anomaly detection, when you have few or no examples of trouble." },
    ],
  },
  neural: {
    history: "The artificial neuron is from 1943 and the first learning machine, the perceptron, from 1958. The field nearly died twice, then backpropagation (1986), big datasets and graphics cards (2012) made deep networks the engine behind today's vision and language models.",
    lessons: [
      { id: "neurons", title: "A neuron is a weighted vote", lead: "The artificial neuron, and the one thing it can't do." },
      { id: "layers", title: "Bending the line", lead: "Hidden layers and activation functions: why depth works." },
      { id: "activations", title: "The bend in the wire", lead: "Activation functions, and which one goes where." },
      { id: "backprop", title: "Passing the blame backwards", lead: "Backpropagation: how a network works out which weights to change." },
      { id: "normalisation", title: "Keeping the numbers in range", lead: "Normalisation: batch norm, layer norm, and which network uses which." },
      { id: "training", title: "Teaching a big network", lead: "Training deep networks: optimisers, dropout and early stopping." },
      { id: "sequences", title: "Remembering what came before", lead: "Recurrent networks and LSTMs for sequences." },
    ],
  },
  trees: {
    history: "Decision trees grew up in the 1980s to turn data into rules a person could read. Ensembles of them, from the late 1990s on, made them the go-to model for tables of data, which they still are.",
    lessons: [
      { id: "splits", title: "Twenty questions with data", lead: "How a decision tree picks its questions." },
      { id: "overfitting", title: "Too clever by half", lead: "Depth, overfitting, and the trade between bias and variance." },
      { id: "metrics", title: "94% accurate, 100% useless", lead: "Precision, recall, F1 and ROC curves, and why accuracy lies when one answer is rare." },
      { id: "forests", title: "Wisdom of the random crowd", lead: "Bagging, random forests and the wisdom of a crowd." },
      { id: "boosting", title: "Fail, fix, repeat", lead: "Gradient boosting, and what XGBoost, LightGBM and CatBoost each add." },
      { id: "honest-testing", title: "No peeking at the exam", lead: "Cross-validation, searching for settings, pipelines that don't leak, and saving the result." },
      { id: "explaining", title: "Why did it say that?", lead: "Feature importance and SHAP values." },
    ],
  },
  bayes: {
    history: "Bayes' rule is from 1763, but for two centuries it was mostly too hard to compute with. Computers, and sampling methods from around 1990, turned it into everyday practice wherever being honest about uncertainty matters.",
    lessons: [
      { id: "uncertainty", title: "Two kinds of not knowing", lead: "Uncertainty you can shrink with data, and uncertainty you can't." },
      { id: "estimation", title: "Four out of five isn't 80%", lead: "Maximum likelihood, MAP and the full posterior." },
      { id: "updating", title: "Strong opinions, weakly held", lead: "Sequential updating, conjugate priors and the exponential family." },
      { id: "gaussians", title: "Tall parents, slightly tall children", lead: "The multivariate Gaussian: correlation, marginals and conditioning." },
      { id: "networks", title: "The sprinkler did it", lead: "Bayesian networks, Markov random fields and conditional independence." },
      { id: "gaussian-processes", title: "Join the dots, honestly", lead: "Gaussian processes for regression with honest error bars." },
      { id: "mcmc", title: "The random walk that maps the hills", lead: "Markov chain Monte Carlo, Metropolis–Hastings and modern samplers." },
    ],
  },
  time: {
    history: "Most of the forecasting toolkit was built in the 1950s to 70s for inventory, economics and engineering. Forecasting competitions since 1982 have kept everyone honest, and since 2018 machine learning has joined the winners.",
    lessons: [
      { id: "components", title: "Don't shuffle the calendar", lead: "What a time series is, and the four parts most of them are made of." },
      { id: "stationarity", title: "Making a series sit still", lead: "Stationarity, logs and differencing." },
      { id: "memory", title: "Echoes of last month", lead: "Autocorrelation, partial autocorrelation, and reading AR and MA patterns." },
      { id: "classical", title: "Beat 'same as last year' first", lead: "Naive, seasonal naive, moving averages and exponential smoothing." },
      { id: "arima", title: "ARIMA and friends", lead: "AR, MA, ARIMA and SARIMA, automatic selection, and Prophet." },
      { id: "ml-forecasting", title: "Trees can't predict a record", lead: "Lag features, why trees can't extrapolate, and where deep learning fits." },
      { id: "evaluation", title: "No time travel allowed", lead: "Walk-forward validation and choosing an error metric." },
      { id: "hierarchies", title: "Forecasts that add up", lead: "Hierarchical forecasting: bottom-up, top-down and reconciliation." },
    ],
  },
  vision: {
    history: "The idea of stacked edge detectors goes back to experiments on cats' visual cortex in 1959. It took until 2012, with enough data and graphics cards, for it to beat everything else, and since then vision has moved from recognising objects to outlining and creating them.",
    lessons: [
      { id: "convolution", title: "A picture is a spreadsheet", lead: "Pixels, filters and convolution, the building block of vision models." },
      { id: "deep-networks", title: "Deeper, with shortcuts", lead: "From LeNet to ResNet: skip connections, batch normalisation and transfer learning." },
      { id: "detection", title: "Draw a box around it", lead: "Object detection: boxes, IoU, non-maximum suppression and mAP." },
      { id: "segmentation", title: "Colouring inside the lines", lead: "Semantic, instance and panoptic segmentation, U-Net, dilated convolutions and SAM." },
      { id: "generative", title: "Sculpting pictures out of noise", lead: "Autoencoders, GANs and diffusion models." },
      { id: "transformers", title: "An image is worth 16×16 words", lead: "Vision transformers, Swin, self-supervised learning and CLIP." },
      { id: "shipping", title: "Trust it, then shrink it", lead: "Grad-CAM explanations, ONNX export and quantisation." },
    ],
  },
  language: {
    history: "Computers have handled text since the 1950s, but by counting words. In 2013 word vectors gave words a meaning-shaped place in space; in 2017 the transformer let a model read a whole passage at once; by 2022 large language models trained on much of the web could hold a conversation.",
    lessons: [
      { id: "embeddings", title: "Words as places on a map", lead: "Embeddings: turning meaning into numbers." },
      { id: "tokens", title: "Tokens, not words", lead: "How language models actually read text, and why it costs what it costs." },
      { id: "attention", title: "Who's 'it'?", lead: "Attention: how a transformer reads a sentence all at once." },
      { id: "generation", title: "One word at a time", lead: "How a language model writes: predicting the next token, again and again." },
      { id: "hallucination", title: "Confidently wrong", lead: "Why language models make things up, and what helps." },
      { id: "rag", title: "An open-book exam", lead: "Retrieval-augmented generation: giving the model your documents." },
      { id: "fine-tuning", title: "Teach it, or tell it?", lead: "Prompting, examples in the prompt, or fine-tuning." },
    ],
  },
  wild: {
    history: "For most of machine learning's history the work ended with a good score on a test set. As models moved into products in the 2010s, Google's 2015 paper on the 'hidden technical debt' of ML systems made the point that the model is a small part of the system; MLOps grew up to handle the rest.",
    lessons: [
      { id: "serving", title: "From notebook to service", lead: "Serving a model: latency, throughput and batching." },
      { id: "versioning", title: "Which model was that?", lead: "Versioning data, code and models so results can be repeated." },
      { id: "drift", title: "The world moves on", lead: "Data drift: when live data stops looking like training data." },
      { id: "ab-testing", title: "Let the users decide", lead: "A/B testing a new model against the old one." },
      { id: "retraining", title: "When to retrain", lead: "Keeping a model fresh without wasting effort." },
      { id: "fairness", title: "Fair for whom?", lead: "Checking that a model's mistakes don't fall on one group." },
      { id: "recommenders", title: "People who liked this also liked…", lead: "Recommender systems and the hidden tastes behind ratings." },
    ],
  },
};
