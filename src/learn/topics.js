// The plain, textbook name of every chapter and lesson, shown alongside its
// playful title so a reader always knows what the subject is called (and what
// to search for). Lessons are keyed "chapter/lesson".

export const CHAPTER_TOPICS = {
  foundations: "Machine learning foundations",
  neural: "Neural networks",
  trees: "Decision trees and ensembles",
  bayes: "Probabilistic machine learning",
  time: "Time series and forecasting",
  vision: "Computer vision",
  language: "NLP and LLMs",
  wild: "MLOps and recommender systems",
};

export const LESSON_TOPICS = {
  "foundations/regression": "Linear regression",
  "foundations/gradient-descent": "Gradient descent",
  "foundations/logistic": "Logistic regression",
  "foundations/regularisation": "Regularisation (ridge and lasso)",
  "foundations/features": "Feature engineering and scaling",
  "foundations/clustering": "k-means clustering",
  "foundations/pca": "Principal component analysis (PCA)",
  "foundations/anomalies": "Anomaly detection",

  "neural/neurons": "Artificial neurons and the perceptron",
  "neural/layers": "Multilayer perceptrons and activation functions",
  "neural/backprop": "Backpropagation",
  "neural/training": "Training deep networks (Adam, dropout, early stopping)",
  "neural/sequences": "Recurrent neural networks and LSTMs",

  "trees/splits": "Decision trees",
  "trees/overfitting": "Overfitting and the bias–variance trade-off",
  "trees/metrics": "Classification metrics",
  "trees/forests": "Bagging and random forests",
  "trees/boosting": "Gradient boosting",
  "trees/honest-testing": "Cross-validation and data leakage",
  "trees/explaining": "Feature importance and SHAP",

  "bayes/uncertainty": "Aleatoric and epistemic uncertainty",
  "bayes/estimation": "Maximum likelihood and MAP estimation",
  "bayes/updating": "Bayesian updating and conjugate priors",
  "bayes/gaussians": "The multivariate Gaussian",
  "bayes/networks": "Bayesian networks",
  "bayes/gaussian-processes": "Gaussian processes",
  "bayes/mcmc": "Markov chain Monte Carlo (MCMC)",

  "time/components": "Time-series decomposition",
  "time/stationarity": "Stationarity and differencing",
  "time/memory": "Autocorrelation (ACF and PACF)",
  "time/classical": "Baselines and exponential smoothing",
  "time/arima": "ARIMA and SARIMA",
  "time/ml-forecasting": "Machine learning for forecasting",
  "time/evaluation": "Forecast evaluation",
  "time/hierarchies": "Hierarchical forecasting",

  "vision/convolution": "Convolution",
  "vision/deep-networks": "Convolutional neural networks (CNNs)",
  "vision/detection": "Object detection",
  "vision/segmentation": "Image segmentation",
  "vision/generative": "Generative models (GANs and diffusion)",
  "vision/transformers": "Vision transformers",
  "vision/shipping": "Explaining and deploying vision models",

  "language/embeddings": "Word embeddings",
  "language/tokens": "Tokenization",
  "language/attention": "Attention and transformers",
  "language/generation": "Text generation and sampling",
  "language/hallucination": "Hallucination in LLMs",
  "language/rag": "Retrieval-augmented generation (RAG)",
  "language/fine-tuning": "Prompting and fine-tuning",

  "wild/serving": "Model serving",
  "wild/versioning": "Model and data versioning",
  "wild/drift": "Data drift monitoring",
  "wild/ab-testing": "A/B testing",
  "wild/retraining": "Continuous training",
  "wild/fairness": "Algorithmic fairness",
  "wild/recommenders": "Recommender systems (collaborative filtering)",
};
