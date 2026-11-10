// Chapter: the foundations every other chapter stands on — fitting a line,
// learning by gradient descent, probabilities, shrinkage, features, and
// learning without labels.
import React from "react";
import { Eq, M } from "../kit";
import { DescentSim, KMeansSim, LineSim, LogisticSim, OutlierSim, PcaSim, RidgeSim, ScaleSim } from "../sims/foundations";

export default {
  lessons: [
    {
      id: "regression",
      history: "In 1801 the young Carl Friedrich Gauss predicted where the lost dwarf planet Ceres would reappear, using the method of least squares; Adrien-Marie Legendre published the method first, in 1805. Francis Galton gave 'regression' its name in the 1880s, studying how children's heights relate to their parents'.",
      gist: [
        "A linear model predicts with a starting value plus a weight times each input.",
        "'Best' means the smallest sum of squared errors, and there's an exact formula for it.",
        "Each weight reads as 'how much the prediction moves per unit of this input, the others held still'.",
      ],
      practice: {
        adjust: ["Which inputs go in, and whether any need transforming first (a log of income, say).", "Whether to add a penalty (next lessons) when there are many inputs."],
        wrong: [
          "Two inputs that move together (floor area and number of rooms) make both weights unstable and hard to read.",
          "Extrapolating: the line keeps going past the data, the world usually doesn't.",
          "A few extreme points can drag the whole line, because squaring makes big errors count a lot.",
        ],
        notice: ["Plot the errors against the prediction: a pattern (a curve, a funnel) means a straight line is the wrong shape.", "Weights that flip sign when you add or drop a column."],
        ask: ["Plot the residuals against each input.", "Which rows have the biggest errors, and are they data mistakes?"],
      },
      idea: (
        <p>
          A linear model says: start from a base value, then add a fixed amount for every unit of each input. Fitting it means choosing those amounts so
          the line passes as close as possible to the data, where "close" is measured by squaring every miss and adding them up.
        </p>
      ),
      example: (
        <>
          <p>An estate agent in Kathmandu has 24 flats with their floor area and sale price. She wants a quick rule for pricing the next one.</p>
          <p>
            Least squares gives about <strong>20 lakh plus 0.9 lakh per square metre</strong>. A 100 m² flat comes out near 110 lakh. The 0.9 is the
            useful part: each extra square metre adds roughly 90,000 rupees, at least within the sizes she's seen.
          </p>
        </>
      ),
      play: [{ Sim: LineSim, try: "Move the slope and starting price to make the red stalks as short as you can, then press Least squares and see how close you got." }],
      how: (
        <>
          <p>With one input the model is a line, and the error it minimises is the mean of the squared misses:</p>
          <Eq says="the hat means 'predicted'">
            ŷ = a + b·x, &nbsp; MSE = mean( (y − ŷ)² )
          </Eq>
          <p>
            Squaring does two jobs: it makes every miss positive, and it makes big misses count far more than small ones. Setting the derivatives of
            the MSE to zero gives the answer directly: the slope is how x and y vary together divided by how much x varies on its own, and the line
            passes through the point of averages.
          </p>
          <Eq says="cov is covariance, var is variance">
            b = cov(x, y) / var(x), &nbsp; a = ȳ − b·x̄
          </Eq>
          <p>
            With many inputs the same idea becomes matrix algebra, <M>w = (XᵀX)⁻¹Xᵀy</M>, which every statistics library solves for you.{" "}
            <strong>R²</strong> reports the share of the spread in y that the line accounts for: 1 is perfect, 0 is no better than always guessing the
            average.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "A line predicts price = 20 + 0.9 × area (in lakh, area in m²). What does it predict for a 150 m² flat?",
          answer: 155,
          tolerance: 0.5,
          why: "20 + 0.9 × 150 = 20 + 135 = 155 lakh.",
        },
        {
          kind: "choice",
          q: "Why does least squares square the errors instead of just adding them?",
          options: [
            { t: "So misses above and below don't cancel out, and big misses count more.", ok: true, why: "Right. Plain errors would cancel; squaring makes them all positive and punishes large ones hardest." },
            { t: "Squared numbers are quicker for a computer to add up than plain errors.", why: "Speed isn't the reason. Absolute errors are just as cheap; they give a different (median-like) line." },
            { t: "To make the line pass through every point.", why: "No line can pass through scattered points. Squaring decides which compromise is best." },
            { t: "So the fitted slope always comes out as a positive number.", why: "The error total becomes positive, but that's a side effect. The point is no cancelling, and weighting big misses." },
          ],
        },
        { kind: "task", q: "Get the average squared error within 15% of the best possible, by hand.", Sim: LineSim, check: (s) => s.mse <= s.best * 1.15, done: "Close to least squares. The formula just does this search exactly." },
      ],
      explain: {
        q: "A colleague says the weight on 'floor area' is 0.9. What does that mean?",
        options: [
          { t: "Each extra square metre adds about 0.9 lakh to the prediction, other inputs fixed.", verdict: "right", why: "That's the reading: a rate of change, holding the rest still, valid within the range of the data." },
          { t: "Floor area explains 90% of the variation in price across the flats.", verdict: "wrong", why: "That would be R². A weight is a rate per unit, and it changes if you measure in square feet instead." },
          { t: "Bigger flats cost more, and floor area is the strongest input.", verdict: "partly", why: "True, but it throws away the useful part: how much more per square metre." },
          { t: "Floor area causes 0.9 lakh of each flat's price, whatever else about the flat changes.", verdict: "wrong", why: "Regression measures association. Bigger flats may also be in better areas; the weight can't separate the two." },
        ],
      },
      readMore: [
        { title: "An Introduction to Statistical Learning, chapter 3", by: "James, Witten, Hastie and Tibshirani (free book)", url: "https://www.statlearning.com/" },
        { title: "Linear models", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/linear_model.html" },
        { title: "Linear regression", by: "Google Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course/linear-regression" },
      ],
    },

    {
      id: "gradient-descent",
      history: "Augustin-Louis Cauchy described the method of steepest descent in 1847, to solve equations from astronomy. Its random, bite-sized variant, stochastic gradient descent, comes from Herbert Robbins and Sutton Monro in 1951, and it now trains every large neural network, language models included.",
      gist: [
        "A model learns by measuring how wrong it is (the loss) and nudging its weights downhill.",
        "The slope says which way is down; the learning rate says how big a step to take.",
        "Too small a step crawls, too big a step overshoots; and a bumpy loss can trap you in a dip.",
      ],
      practice: {
        adjust: ["The learning rate, usually the single most important setting.", "The batch size: how many examples each step looks at.", "A schedule that shrinks the step as training goes on."],
        wrong: ["The loss shoots up or turns into 'NaN': the step is too big.", "The loss falls painfully slowly: the step is too small.", "The loss flattens early at a poor value: stuck in a dip or a flat stretch."],
        notice: ["Always plot the loss as training goes. It should fall fast, then level off.", "Training loss falling while validation loss rises means it's starting to memorise."],
        ask: ["Plot training and validation loss per epoch.", "Try the learning rate ten times smaller and ten times larger; which is best?"],
      },
      idea: (
        <p>
          Picture standing on a hillside in fog. You can't see the valley, but you can feel which way the ground slopes under your feet. Take a step
          downhill, feel again, step again. That's gradient descent: the "height" is how wrong the model is, and your position is the model's settings.
        </p>
      ),
      example: (
        <>
          <p>
            A model predicting delivery times starts with a random weight and is off by 40 minutes on average. The maths tells it that increasing the
            weight would lower the error, and by how much per unit.
          </p>
          <p>It moves the weight a little in that direction, re-measures, and repeats. After a few hundred small steps the error is down to six minutes.</p>
        </>
      ),
      play: [{ Sim: DescentSim, try: "Step through with the default rate. Then try 3 and 4.5 to see overshooting, and start at −4.5 with a small rate to get stuck in the shallow dip." }],
      how: (
        <>
          <p>The rule is one line: move each weight against its slope (its gradient), scaled by the learning rate η.</p>
          <Eq says="w is a weight, L the loss, ∂L/∂w its slope">
            w ← w − η · ∂L/∂w
          </Eq>
          <p>
            Far from the bottom the slope is steep, so steps are big; near the bottom it flattens, so steps shrink by themselves. If η is too large, a
            step jumps clean over the valley to a point even higher up, and the weights fly off. If it's too small, you'll get there next week.
          </p>
          <p>
            Real models have millions of weights, so the "hill" has millions of directions, and the slope is worked out for all of them at once by{" "}
            <strong>backpropagation</strong>. Computing the loss on all the data for each step is slow, so <strong>stochastic</strong> gradient descent
            uses a small random batch instead: noisier steps, but far more of them. Variants like momentum and Adam keep a running average of past
            slopes so they roll through flat stretches and small dips.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "A weight is 2.0, its slope is 0.5 and the learning rate is 0.1. What is the weight after one step?",
          answer: 1.95,
          tolerance: 0.001,
          why: "w − η·slope = 2.0 − 0.1 × 0.5 = 1.95.",
        },
        {
          kind: "choice",
          q: "Training loss suddenly jumps up and becomes 'NaN'. What's the first thing to try?",
          options: [
            { t: "Lower the learning rate.", ok: true, why: "Steps that are too big overshoot and blow up. A smaller rate is the usual fix." },
            { t: "Train for more epochs.", why: "More steps at a rate that's blowing up just blows up further." },
            { t: "Add more layers.", why: "A bigger model doesn't fix unstable steps, and can make them worse." },
            { t: "Raise the learning rate to get through it.", why: "That makes overshooting worse." },
          ],
        },
        { kind: "task", q: "Find a learning rate and start that reach the deep valley (within 0.03 of the lowest loss) within the 40 steps.", Sim: DescentSim, check: (s) => s.steps > 0 && s.loss < s.deepest + 0.03, done: "You found the deep valley. Notice how the start matters on a bumpy loss." },
      ],
      explain: {
        q: "How would you explain 'training a model' to someone new?",
        options: [
          { t: "It measures how wrong it is, nudges its numbers to be less wrong, and repeats.", verdict: "right", why: "That's gradient descent in a sentence, and it's what training means for almost every model." },
          { t: "It tries many random settings of its numbers and keeps whichever scored best.", verdict: "wrong", why: "Random search is hopeless with millions of weights. The slope tells it which way to go." },
          { t: "It memorises the examples it's shown, so it can look up the closest one later.", verdict: "partly", why: "It can, if trained too long (that's overfitting), but the aim is to learn settings that work on new examples." },
          { t: "An expert writes the rules, and the computer checks them against the examples.", verdict: "wrong", why: "That's traditional programming. In machine learning the rules (the weights) are learned from data." },
        ],
      },
      readMore: [
        { title: "Gradient descent, how neural networks learn", by: "3Blue1Brown (video)", url: "https://www.youtube.com/watch?v=IHZwWFHWa-w" },
        { title: "Why momentum really works", by: "Gabriel Goh, Distill", url: "https://distill.pub/2017/momentum/" },
        { title: "Gradient descent", by: "Google Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent" },
      ],
    },

    {
      id: "logistic",
      history: "The S-shaped logistic curve was introduced by Pierre-François Verhulst in the 1830s to model population growth. David Cox turned it into a regression method in 1958, and it is still the default first model for any yes/no question, from credit risk to clinical trials.",
      gist: [
        "Logistic regression computes a score like a line, then squashes it into a 0–1 probability.",
        "It's trained to make the probability high for real yeses and low for real noes (log loss).",
        "The yes/no decision comes from a cut-off you choose, separately from the model.",
      ],
      practice: {
        adjust: ["The cut-off, to trade false alarms against misses.", "A penalty on the weights when there are many inputs."],
        wrong: [
          "Reading the probability as certain: 0.7 means wrong three times in ten.",
          "Probabilities that are badly calibrated (a 0.9 that comes true only 60% of the time).",
          "A boundary that isn't a straight line in the inputs, which this model can't draw.",
        ],
        notice: ["Bin the predictions and compare each bin's average probability with how often it really happened.", "Check precision and recall at the cut-off you'll actually use."],
        ask: ["Show me a calibration plot.", "What cut-off gives us 90% recall, and how many false alarms does that cost?"],
      },
      idea: (
        <p>
          A straight line can predict any number, but a probability must stay between 0 and 1. Logistic regression keeps the line for the score, then
          bends it through an S-shaped curve: very negative scores become nearly 0, very positive ones nearly 1, and a score of 0 becomes exactly 50%.
        </p>
      ),
      example: (
        <>
          <p>A teacher has 40 students, how many hours each revised, and who passed. She wants to know who needs help.</p>
          <p>
            The fitted curve crosses 50% at about four and a half hours. A student who revised two hours gets about a 7% chance of passing, one who
            revised eight gets about 98%. Rather than "pass" or "fail", she gets a ranking of who's most at risk.
          </p>
        </>
      ),
      play: [{ Sim: LogisticSim, try: "Move the steepness and the 50/50 point to bring the log loss down, then press Best fit. Then slide the cut-off and watch how many it gets right." }],
      how: (
        <>
          <p>The score is a line, and the logistic (sigmoid) function turns it into a probability:</p>
          <Eq says="σ is the S-shaped curve; z can be any number">
            z = w·x + b, &nbsp; p = σ(z) = 1 / (1 + e<sup>−z</sup>)
          </Eq>
          <p>
            It's trained by <strong>log loss</strong>: for each example, the negative log of the probability it gave to what actually happened.
            Saying 0.9 for something that happened costs 0.1; saying 0.01 for it costs 4.6. Confident wrong answers are punished hardest.
          </p>
          <Eq says="y is 1 for yes, 0 for no">
            loss = −mean( y·log p + (1 − y)·log(1 − p) )
          </Eq>
          <p>
            There's no exact formula this time, so it's fitted by gradient descent. The weights read as changes in <strong>log-odds</strong>: a weight
            of 1.1 per hour multiplies the odds of passing by e<sup>1.1</sup> ≈ 3 for each extra hour.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "A model gives a score of z = 0. What probability does logistic regression output?",
          answer: 0.5,
          tolerance: 0.001,
          why: "σ(0) = 1 / (1 + e⁰) = 1 / 2 = 0.5.",
        },
        {
          kind: "choice",
          q: "Why not predict yes/no with an ordinary straight line?",
          options: [
            { t: "A line runs past 0 and 1, which no probability can.", ok: true, why: "Right. The logistic curve keeps the line's simplicity but squeezes its output into 0–1." },
            { t: "Least squares can't be run on columns of 0s and 1s at all.", why: "You can fit one, coding yes as 1 and no as 0; its answers just escape the 0–1 range." },
            { t: "Logistic regression is more accurate on every problem.", why: "It isn't always. It's the right shape for probabilities, which is the point." },
            { t: "Yes/no data always follows a curve, so a line underfits it.", why: "The S-curve isn't about curved data; it's about turning any score into a valid probability." },
          ],
        },
        { kind: "task", q: "Bring the log loss within 0.02 of the best possible.", Sim: LogisticSim, check: (s) => s.loss <= s.best + 0.02, done: "That's the fit gradient descent would find. The cut-off is a separate business decision." },
      ],
      explain: {
        q: "The model says a loan applicant has a 0.7 chance of repaying. What does that mean?",
        options: [
          { t: "Of applicants scored like this, about 7 in 10 repay, if it's calibrated.", verdict: "right", why: "A probability describes the group of similar cases, and it's only trustworthy if checked against what happened." },
          { t: "This applicant will repay, since 0.7 is above the 0.5 cut-off.", verdict: "wrong", why: "0.7 means 3 in 10 similar applicants don't. Whether to lend is a cut-off decision." },
          { t: "The model is right about 70% of the time on applicants who look like this one.", verdict: "wrong", why: "Accuracy is about the model overall; 0.7 is this one prediction." },
          { t: "They're more likely to repay than not, but it's far from certain.", verdict: "partly", why: "True, but 'a bit' undersells it: 0.7 is more than twice as likely as not." },
        ],
      },
      readMore: [
        { title: "Logistic regression", by: "Google Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course/logistic-regression" },
        { title: "An Introduction to Statistical Learning, chapter 4", by: "James, Witten, Hastie and Tibshirani (free book)", url: "https://www.statlearning.com/" },
        { title: "Probability calibration", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/calibration.html" },
      ],
    },

    {
      id: "regularisation",
      history: "Andrey Tikhonov proposed penalising large solutions in 1943, for unstable problems in physics; Arthur Hoerl and Robert Kennard brought it to statistics as ridge regression in 1970. Robert Tibshirani's lasso (1996), which can set weights exactly to zero, made it a way to choose features too.",
      gist: [
        "A flexible model can bend to fit the noise in its training data, and then fails on new data.",
        "Regularisation adds a penalty for big weights, so the model only bends where the data insists.",
        "The penalty's strength is tuned on held-out data: too little overfits, too much underfits.",
      ],
      practice: {
        adjust: ["The penalty strength (λ, 'alpha' or 'C', depending on the library).", "L2 (ridge, shrinks everything) or L1 (lasso, zeroes some weights out).", "In neural networks: weight decay, dropout and early stopping play the same role."],
        wrong: ["Penalising without scaling the inputs first, so columns in big units get punished unfairly.", "Choosing λ on the test set, which leaks it.", "Too strong a penalty: a flat model that misses real patterns."],
        notice: ["Training error much lower than validation error: add or raise the penalty.", "Both errors high and close together: lower it."],
        ask: ["Plot validation error against λ.", "Which features did the lasso drop?"],
      },
      idea: (
        <p>
          Give a model enough freedom and it will thread a curve through every training point, noise included. Regularisation charges the model for
          complexity: every large weight costs something, so it only uses one where the data clearly pays for it.
        </p>
      ),
      example: (
        <>
          <p>A team fits a degree-12 curve to 14 sensor readings. It passes almost exactly through all of them, swinging wildly in between.</p>
          <p>
            On fresh readings its error is several times worse than a simple straight line's. Adding a small ridge penalty keeps the curve smooth, and
            its error on new readings drops to the best of any setting they tried.
          </p>
        </>
      ),
      play: [{ Sim: RidgeSim, try: "Set the degree to 12 with no penalty and watch the error on new points. Then raise the penalty slowly: where is the error on new points lowest?" }],
      how: (
        <>
          <p>Ridge regression adds the sum of squared weights to the error it minimises, scaled by λ:</p>
          <Eq says="the first part is fit, the second is complexity">
            loss = Σ (y − ŷ)² + λ · Σ w<sub>j</sub>²
          </Eq>
          <p>
            λ = 0 is the plain fit; a huge λ forces every weight to near zero. In between, the model trades a little error on its training data for a lot
            less sensitivity to noise: more <strong>bias</strong>, much less <strong>variance</strong>.
          </p>
          <p>
            The <strong>lasso</strong> uses absolute values, Σ|w|, instead of squares. Its penalty has a sharp corner at zero, so weak features get
            exactly zero weight and drop out. Because the penalty compares weights directly, the inputs must be on comparable scales first (next
            lesson). In deep learning the same idea appears as weight decay, and dropout and early stopping are other ways to rein a model in.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "Training error is 2%, validation error is 19%. What should you do to the penalty?",
          options: [
            { t: "Raise it.", ok: true, why: "A big gap means it's fitting noise. A stronger penalty reins it in." },
            { t: "Lower it.", why: "That gives the model more freedom, widening the gap." },
            { t: "Leave it, and train longer.", why: "Training longer usually widens an overfitting gap." },
            { t: "Remove the validation set.", why: "Then you'd have no way of seeing the problem." },
          ],
        },
        {
          kind: "multi",
          q: "Which of these are forms of regularisation?",
          options: [
            { t: "Ridge (L2) penalty", ok: true, why: "Penalises squared weights." },
            { t: "Lasso (L1) penalty", ok: true, why: "Penalises absolute weights, and can zero some out." },
            { t: "Early stopping", ok: true, why: "Stopping before the model fits the noise limits its complexity." },
            { t: "Using a bigger learning rate", why: "That changes how fast it trains, not how complex it's allowed to be." },
          ],
        },
        { kind: "task", q: "Find a degree and penalty that bring the error on new points under 0.37.", Sim: RidgeSim, check: (s) => s.test < 0.37, done: "Either a modest degree or a high degree with a penalty works. That's the point: the penalty lets you keep flexibility safely." },
      ],
      explain: {
        q: "Why would you deliberately make a model fit its training data worse?",
        options: [
          { t: "A perfect fit also fits the noise; a slightly worse one predicts new data better.", verdict: "right", why: "The goal is new data. Giving up a little training fit buys a lot of stability." },
          { t: "To make it train faster, since a looser fit needs fewer steps to reach.", verdict: "wrong", why: "Speed isn't the reason; a penalty barely changes training time." },
          { t: "Because simpler models are always better, whatever the data looks like.", verdict: "partly", why: "Simpler often generalises better, but too simple misses real patterns. The penalty is tuned, not maxed." },
          { t: "It doesn't: regularisation improves training accuracy by steadying the weights as they learn.", verdict: "wrong", why: "It nearly always lowers training accuracy. Validation accuracy is what improves." },
        ],
      },
      readMore: [
        { title: "Regularization for simplicity", by: "Google Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course/overfitting/regularization" },
        { title: "Ridge regression and the lasso", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/linear_model.html#ridge-regression-and-classification" },
        { title: "An Introduction to Statistical Learning, chapter 6", by: "James, Witten, Hastie and Tibshirani (free book)", url: "https://www.statlearning.com/" },
      ],
    },

    {
      id: "features",
      history: "Statisticians have recoded variables for as long as there have been statistics, but 'feature engineering' became the heart of applied machine learning in the 2000s, when competition winners were usually whoever built the best inputs. Deep learning automated much of it for images and text; for tables of data it still matters most.",
      gist: [
        "Models see numbers, so every column must become numbers on sensible scales.",
        "Distance- and penalty-based models are fooled by units: scale the columns first.",
        "The best gains usually come from inputs that carry real meaning, built from what you know about the problem.",
      ],
      practice: {
        adjust: [
          "Scaling: standardise (mean 0, spread 1) for linear models, k-NN, SVMs and neural networks; trees don't need it.",
          "Categories: one column per value (one-hot), or the category's average outcome (target encoding, carefully).",
          "Missing values: fill them, and add a 'was missing' flag, because missing often means something.",
        ],
        wrong: [
          "Fitting the scaler on all the data, test set included, which leaks information.",
          "Numbering categories 1, 2, 3, which invents an order that isn't there.",
          "A feature built from information you won't have at prediction time.",
        ],
        notice: ["A model that's suddenly far better after a feature change: check it for leakage.", "Feature importances dominated by one huge-valued column in a distance-based model."],
        ask: ["Do all the transformations live inside one pipeline fitted on the training data only?", "Which features could we build from dates, places or counts that would mean something to an expert?"],
      },
      idea: (
        <p>
          A model only knows what's in its columns, and only as numbers. If one column is income in rupees and another is age in years, a model that
          measures distances will think a Rs 1,000 difference matters as much as a thousand years. Getting the inputs right is usually worth more than
          picking a cleverer model.
        </p>
      ),
      example: (
        <>
          <p>A shop recommends products by finding the customer most similar to you, by income and age.</p>
          <p>
            Unscaled, your "most similar" customer has the same income but is 67 when you're 29. Once both columns are standardised, the match is
            someone your own age earning slightly more, which is what the shop actually wanted.
          </p>
        </>
      ),
      play: [{ Sim: ScaleSim, try: "Look at who's most similar to you, then switch scaling on and look again." }],
      how: (
        <>
          <p>Standardising subtracts each column's mean and divides by its standard deviation, so every column is measured in "spreads":</p>
          <Eq says="μ is the column's mean, σ its standard deviation">
            z = (x − μ) / σ
          </Eq>
          <p>
            Models that compare distances (k-nearest neighbours, k-means, support vector machines) or penalise weights (ridge, lasso) need this. Trees
            don't: they only ever ask "is this column above a threshold?", which units can't change.
          </p>
          <p>
            Categories become <strong>one-hot</strong> columns: "city = Pokhara" turns into a 1 in a Pokhara column and 0 in the rest. Dates become
            day of week, month, holiday or not. Skewed amounts often work better as logs. And whatever you learn from the data (the means, the
            spreads, the category averages) must be learned from the training data alone and then applied to the test data, inside one pipeline.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "A column has mean 50 and standard deviation 10. What is the standardised value of 65?",
          answer: 1.5,
          tolerance: 0.01,
          why: "(65 − 50) / 10 = 1.5: one and a half spreads above average.",
        },
        {
          kind: "multi",
          q: "Which models need their inputs scaled to work well?",
          options: [
            { t: "k-nearest neighbours", ok: true, why: "It compares distances, which units distort." },
            { t: "Ridge regression", ok: true, why: "The penalty compares weights, which depend on units." },
            { t: "A random forest", why: "Trees split on thresholds; rescaling a column doesn't change any split." },
            { t: "k-means clustering", ok: true, why: "It groups by distance, so big-unit columns dominate." },
          ],
        },
        { kind: "task", q: "Make the most similar customer someone close to your own age.", Sim: ScaleSim, check: (s) => s.scaled && s.nearest === "Bikash", done: "Scaled, both columns get a fair say." },
      ],
      explain: {
        q: "Why scale features before using k-nearest neighbours?",
        options: [
          { t: "It measures distance, and a column in big units would drown out the rest.", verdict: "right", why: "Scaling puts every column on the same footing, so 'similar' means similar in all of them." },
          { t: "Because models can only read numbers between 0 and 1.", verdict: "wrong", why: "Models read any number. The problem is how distances weigh the columns." },
          { t: "To make it faster, since smaller numbers are quicker to compare.", verdict: "partly", why: "It can help gradient-based training converge, but for k-NN the reason is fairness between columns." },
          { t: "It isn't needed: the model learns how much each column matters.", verdict: "wrong", why: "k-NN has nothing to learn the units with. It just measures distance." },
        ],
      },
      readMore: [
        { title: "Preprocessing data", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/preprocessing.html" },
        { title: "Working with numerical data", by: "Google Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course/numerical-data" },
        { title: "Pipelines and composite estimators", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/compose.html" },
      ],
    },

    {
      id: "clustering",
      history: "Stuart Lloyd worked out the k-means algorithm at Bell Labs in 1957 to compress signals, though it wasn't published until 1982; James MacQueen named it in 1967. It is still the first thing most people reach for when they want to find groups in data without being told what they are.",
      gist: [
        "Clustering finds groups in data that has no labels, by putting similar rows together.",
        "k-means alternates two steps: join the nearest centre, then move each centre to the middle of its group.",
        "You choose how many groups, and the algorithm will happily invent groups that aren't really there.",
      ],
      practice: {
        adjust: ["The number of groups, k.", "Which columns go in, and their scaling (it's all distances)."],
        wrong: ["Groups that are long, curved or very different in size, which k-means can't see.", "Different results on each run, from a different random start.", "Reading meaning into groups that are an artefact of the chosen k."],
        notice: ["Run it several times from different starts and compare.", "Plot the spread inside groups against k: look for where adding groups stops helping much (the 'elbow')."],
        ask: ["Describe each group by its average customer: do they make sense to someone who knows the business?", "How stable are the groups if we drop 10% of the data?"],
      },
      idea: (
        <p>
          Sometimes there's no right answer to learn from, just data. Clustering looks for natural groups: rows that sit close together and far from
          the others. k-means does it with two simple moves, repeated until nothing changes.
        </p>
      ),
      example: (
        <>
          <p>A supermarket has two numbers for every shopper: visits a month and average basket. Nobody has labelled them.</p>
          <p>
            k-means with three groups finds frequent small-basket shoppers (nearby flats), occasional big-basket shoppers (the weekly shop), and a group
            in between. Marketing gets three segments to write to, found from the data rather than guessed.
          </p>
        </>
      ),
      play: [{ Sim: KMeansSim, try: "Press 'One round' a few times and watch the centres settle. Then try 2, 4 and 5 groups: does it always find something?" }],
      how: (
        <>
          <p>Start with k centres placed anywhere, then repeat:</p>
          <ol>
            <li>
              <strong>Assign</strong>: each point joins its nearest centre.
            </li>
            <li>
              <strong>Update</strong>: each centre moves to the average of its points.
            </li>
          </ol>
          <p>Each round can only lower the total squared distance from points to their centres, so it always settles:</p>
          <Eq says="c(i) is the centre point i belongs to">
            inertia = Σ ‖x<sub>i</sub> − μ<sub>c(i)</sub>‖²
          </Eq>
          <p>
            It settles to <em>a</em> good answer, not necessarily the best, so libraries run it from several starts and keep the best (k-means++
            chooses spread-out starts). k-means assumes round groups of similar size; for odd shapes there's DBSCAN (density) or Gaussian mixture
            models (soft, elliptical groups). And k is your call: the inertia always falls as k grows, so look for the elbow, or check how well
            separated the groups are with the silhouette score.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "What does the 'update' step of k-means do?",
          options: [
            { t: "Moves each centre to the average of its points.", ok: true, why: "Right; then points are reassigned to the nearest new centre." },
            { t: "Adds a new group if a point is far from all centres.", why: "k-means keeps k fixed. Methods like DBSCAN let the number of groups emerge." },
            { t: "Names each group after its most typical point.", why: "The algorithm has no idea what the groups mean. Naming them is your job." },
            { t: "Drops points that sit far from every centre as outliers.", why: "Every point always belongs to some group in k-means." },
          ],
        },
        {
          kind: "choice",
          q: "You run k-means with k = 8 on data that has no real groups at all. What happens?",
          options: [
            { t: "It still returns 8 groups.", ok: true, why: "It always splits the data into k groups, real or not. That's why you check whether they mean anything." },
            { t: "It merges everything into one group, since there's no structure.", why: "k is fixed by you; it will return k." },
            { t: "It stops with a warning that the data has no clusters.", why: "There's nothing in the algorithm that checks whether groups are real." },
            { t: "It never settles, because no grouping is better than another.", why: "It always settles, because each round lowers the inertia." },
          ],
        },
        { kind: "task", q: "With 3 groups, run rounds until the spread inside groups is under 0.9 (try a new start if it gets stuck).", Sim: KMeansSim, check: (s) => s.k === 3 && s.inertia != null && s.inertia < 0.9, done: "Settled on the three real groups. The algorithm never saw a label, and a bad start can trap it, which is why libraries try several." },
      ],
      explain: {
        q: "How would you explain what clustering found to a manager?",
        options: [
          { t: "It grouped customers who behave alike; we still have to check the groups make sense.", verdict: "right", why: "That's honest: the groups are found, not given, and their meaning comes from people who know the business." },
          { t: "It discovered the true customer types that were hidden in our data.", verdict: "wrong", why: "It found the k groups you asked for, given the columns you gave it. 'True' is too strong." },
          { t: "It sorted customers into groups by how close they are.", verdict: "partly", why: "Right mechanics, but it leaves out that the number of groups and the columns are choices." },
          { t: "It predicted which of our existing marketing segments each of the customers belongs to.", verdict: "wrong", why: "There's nothing to predict without labels. It made the groups." },
        ],
      },
      readMore: [
        { title: "Clustering", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/clustering.html" },
        { title: "Clustering", by: "Google Machine Learning course", url: "https://developers.google.com/machine-learning/clustering" },
        { title: "Visualizing k-means clustering", by: "Naftali Harris (interactive)", url: "https://www.naftaliharris.com/blog/visualizing-k-means-clustering/" },
      ],
    },

    {
      id: "pca",
      history: "Karl Pearson described principal components in 1901 as 'lines and planes of closest fit'; Harold Hotelling developed them in 1933 to study test scores. Newer methods for drawing data, t-SNE (2008) and UMAP (2018), are the ones behind most of today's colourful embedding maps.",
      gist: [
        "Many columns often move together, so the data really lives in fewer directions.",
        "PCA finds the directions along which the data spreads most, and keeps only the top few.",
        "It's for compressing and plotting; the new columns are mixtures, harder to name than the originals.",
      ],
      practice: {
        adjust: ["How many components to keep, often enough for 90–95% of the variance.", "Scaling first, or the biggest-unit column becomes the first component."],
        wrong: ["Reading t-SNE or UMAP maps too literally: distances between clusters there mean little.", "Assuming the top components are the ones that predict your target; they're just the widest."],
        notice: ["Plot the share of variance each component explains (a scree plot).", "Look at each component's loadings to see which columns it mixes."],
        ask: ["How many components cover 95% of the variance?", "Colour the 2-D plot by the label: do the groups separate?"],
      },
      idea: (
        <p>
          Height and arm span go up together, so you could describe people with one number, "overall size", and lose little. PCA does this
          systematically: it finds the direction along which the data is most spread out, then the next one at right angles to it, and so on, so a
          few directions can stand in for many columns.
        </p>
      ),
      example: (
        <>
          <p>A hospital has 40 blood-test measurements per patient and wants to see the patients on a single chart.</p>
          <p>
            PCA finds that the first two components hold 70% of the spread. Plotted on those two, the patients form three clouds that clinicians can
            then investigate, a picture impossible to see in 40 columns.
          </p>
        </>
      ),
      play: [{ Sim: PcaSim, try: "Turn the line until the spread kept is as large as you can get it, then press 'Find the best direction'. Notice it's along the cloud, not across it." }],
      how: (
        <>
          <p>
            Centre each column, then look for the unit direction u along which the points' positions vary most. That direction is the top eigenvector
            of the covariance matrix, and its variance is the matching eigenvalue:
          </p>
          <Eq says="C is the covariance matrix of the centred data">
            C u = λ u
          </Eq>
          <p>
            The next component is the direction of most remaining spread at right angles to the first, and so on. Keeping the top k components and
            dropping the rest is the best possible k-dimensional summary in the least-squares sense; the share kept is the sum of the kept eigenvalues
            over the total.
          </p>
          <p>
            PCA can only find straight directions. <strong>t-SNE</strong> and <strong>UMAP</strong> bend: they keep each point's nearest neighbours
            close on the map, which reveals clusters beautifully but distorts distances between them, so they're for looking, not measuring.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "Three components have variances 6, 3 and 1. What share of the total variance do the first two keep? (Give a number between 0 and 1.)",
          answer: 0.9,
          tolerance: 0.005,
          why: "(6 + 3) / (6 + 3 + 1) = 9 / 10 = 0.9.",
        },
        {
          kind: "choice",
          q: "Why scale columns before PCA?",
          options: [
            { t: "Otherwise the column in the biggest units dominates.", ok: true, why: "PCA chases variance, and variance depends on units." },
            { t: "PCA's maths only works on values between 0 and 1.", why: "It accepts any numbers; scaling is about fairness between columns." },
            { t: "Scaling lets PCA find more components than there are columns.", why: "The number of components is the number of columns either way." },
            { t: "It isn't necessary; PCA ignores units.", why: "It doesn't. Measure height in millimetres and it'll dominate." },
          ],
        },
        { kind: "task", q: "Turn the line to keep within 2 percentage points of the best possible spread.", Sim: PcaSim, check: (s) => s.share >= s.best - 0.02, done: "That's the first principal component: the long axis of the cloud." },
      ],
      explain: {
        q: "What does 'the first principal component' mean?",
        options: [
          { t: "The direction along which the data is most spread out.", verdict: "right", why: "That's it: the single line that keeps the most variance when the data is projected onto it." },
          { t: "The original column that carries the most information about the rest.", verdict: "wrong", why: "It's a mixture of columns, not one of them." },
          { t: "A summary that combines the columns into one number per row.", verdict: "partly", why: "True, but it misses how the combination is chosen: to keep the most spread." },
          { t: "The direction through the data that best predicts the target.", verdict: "wrong", why: "PCA never looks at a target. That would be a supervised method, like regression." },
        ],
      },
      readMore: [
        { title: "Principal component analysis, explained visually", by: "Setosa (interactive)", url: "https://setosa.io/ev/principal-component-analysis/" },
        { title: "How to use t-SNE effectively", by: "Wattenberg, Viégas and Johnson, Distill", url: "https://distill.pub/2016/misread-tsne/" },
        { title: "Decomposing signals in components", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/decomposition.html" },
      ],
    },

    {
      id: "anomalies",
      history: "Statisticians have argued about outliers since at least the 1850s, when Benjamin Peirce proposed a rule for rejecting suspect astronomical observations. Modern methods such as the isolation forest (2008) came from fraud and intrusion detection, where the bad cases are rare, varied and constantly changing.",
      gist: [
        "Anomaly detection learns what normal looks like and flags whatever doesn't fit it.",
        "It's used when trouble is too rare or too varied to learn from labelled examples.",
        "Unusual isn't the same as bad: every alarm still needs a human or a rule to judge it.",
      ],
      practice: {
        adjust: ["The threshold: how unusual is unusual enough to flag.", "Which features describe 'normal' (amount, time, place, how it compares with this customer's own history)."],
        wrong: ["Honest but unusual cases flood the alarm queue.", "Bad cases designed to look ordinary slip through.", "'Normal' drifts (festival season), and yesterday's model flags everything."],
        notice: ["Track how many alarms a day, and what share turn out to be real.", "Review a sample of the most unusual cases by hand every week."],
        ask: ["How many alerts a day can the team actually review?", "Of last month's confirmed frauds, how many would this have flagged?"],
      },
      idea: (
        <p>
          When the thing you want to catch is rare and keeps changing shape, you can't collect enough examples to learn it. Instead, learn what's
          normal, which you have plenty of, and raise a flag for anything far from it.
        </p>
      ),
      example: (
        <>
          <p>A wallet app sees thousands of payments a day, almost all between Rs 1,000 and Rs 3,000. It has only a handful of confirmed frauds.</p>
          <p>
            Flagging anything more than three standard deviations from the usual amount catches the big stolen-card payments. It also flags one honest
            customer buying a fridge, and misses a small Rs 300 test charge that a fraudster used first. That's why real systems combine many signals.
          </p>
        </>
      ),
      play: [{ Sim: OutlierSim, try: "Lower the threshold until all four frauds are caught. How many false alarms does that cost?" }],
      how: (
        <>
          <p>The simplest detector measures how many standard deviations a value is from the mean:</p>
          <Eq says="flag when |z| is above a chosen threshold">
            z = (x − mean) / standard deviation
          </Eq>
          <p>
            That works for one roughly bell-shaped column. For many columns, the <strong>isolation forest</strong> grows random trees that split the data
            at random; odd points get isolated in very few splits, so a short average path means "anomaly". Other approaches measure how far a point
            is from its nearest neighbours, or how badly a model trained only on normal data (an autoencoder) can reconstruct it.
          </p>
          <p>
            Whatever the method, there's a threshold, and the same trade-off as any classifier: lower it to catch more, at the cost of more false
            alarms. Set it from the capacity of the people who review the alerts.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "Payments average Rs 2,000 with a standard deviation of Rs 400. What is the z-score of a Rs 3,400 payment?",
          answer: 3.5,
          tolerance: 0.01,
          why: "(3,400 − 2,000) / 400 = 3.5.",
        },
        {
          kind: "choice",
          q: "Why use anomaly detection instead of a normal classifier for fraud?",
          options: [
            { t: "Fraud is rare and changing, but normal payments are plentiful.", ok: true, why: "Learning normal sidesteps the shortage of fraud examples." },
            { t: "Anomaly detectors are more accurate on any imbalanced data.", why: "With plenty of labelled fraud, a classifier often wins. It's about what data you have." },
            { t: "Classifiers can't take money amounts as inputs without binning.", why: "They handle any numbers. The issue is the lack of labelled positives." },
            { t: "It needs no threshold, so there's nothing to tune.", why: "It does, and choosing it is the main decision." },
          ],
        },
        { kind: "task", q: "Catch all 4 frauds with as few false alarms as you can (2 or fewer).", Sim: OutlierSim, check: (s) => s.caught === 4 && s.flagged - s.caught <= 2, done: "Notice the Rs 300 fraud needs a low threshold. In practice, a second signal (a new device, a new city) would catch it." },
      ],
      explain: {
        q: "A detector flags a payment as an anomaly. What does that tell you?",
        options: [
          { t: "It's unlike most payments seen so far; whether it's a problem is still open.", verdict: "right", why: "Unusual is a reason to look, not a verdict." },
          { t: "It's fraud, since normal payments don't get flagged.", verdict: "wrong", why: "Plenty of honest payments are unusual. Big one-off purchases trip it all the time." },
          { t: "It's far from the average payment in size.", verdict: "partly", why: "That's the mechanics, but the useful point is what to do next: review it." },
          { t: "The model is broken, because it should only flag fraud.", verdict: "wrong", why: "Flagging is its job. Too many flags means the threshold or features need work." },
        ],
      },
      readMore: [
        { title: "Novelty and outlier detection", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/outlier_detection.html" },
        { title: "Isolation forest", by: "Liu, Ting and Zhou (2008)", url: "https://ieeexplore.ieee.org/document/4781136" },
      ],
    },
  ],
};
