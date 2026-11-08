// Chapter: decision trees and the ensembles built from them.
import React from "react";
import { Eq, M, Table } from "../kit";
import { BoostSim, BootstrapSim, CrowdSim, DepthSim, LeakSim, SearchSim, ShapSim, SplitSim, ThresholdSim } from "../sims/trees";

export default {
  lessons: [
    {
      id: "splits",
      title: "Twenty questions with data",
      lead: "How a decision tree picks its questions.",
      idea: (
        <p>
          A decision tree plays twenty questions with your data. At every step it asks the single yes/no question that best sorts the rows into
          groups that agree with each other. Then it does the same inside each group, and again, until the groups are tidy enough to name.
        </p>
      ),
      example: (
        <>
          <p>
            A gym wants to know which members are about to cancel. It has two facts about each person: how many months they've been a member, and how
            many times they called support last month.
          </p>
          <p>
            A tree might start with "joined less than 18 months ago?". That one question already puts most of the cancellations on one side. Next,
            inside the new members, it might ask "called support more than 3 times?". Two questions in, the gym has a rule a manager can read out
            loud.
          </p>
        </>
      ),
      play: [
        {
          Sim: SplitSim,
          try: "Drag the line and watch the mix on each side. Look for the spot where the number for mix after the split is lowest, then switch to splitting on support calls and compare.",
        },
      ],
      how: (
        <>
          <p>
            "Agree with each other" needs a number. The usual one is <strong>Gini impurity</strong>: pick two members of a group at random, and it's
            the chance they have different labels. A group where everyone stayed scores 0. A 50/50 group scores 0.5.
          </p>
          <Eq says="p is the share of the group in each class">
            Gini = 1 − Σ p<sub>k</sub>²
          </Eq>
          <p>
            The other common choice is <strong>entropy</strong>, borrowed from information theory. It counts how many yes/no questions you'd need,
            on average, to name a member's label. A pure group needs none; a 50/50 group needs one.
          </p>
          <Eq says="measured in bits when the log is base 2">
            Entropy = − Σ p<sub>k</sub> log<sub>2</sub> p<sub>k</sub>
          </Eq>
          <p>
            For each candidate question, the tree works out the impurity of both sides, weights each by its size, and subtracts that from the impurity
            before the split. That drop is the <strong>information gain</strong>, and the question with the biggest gain wins. The tree is greedy: it
            never plans ahead, it just takes the best question right now.
          </p>
          <p>
            Every question looks at one feature against one threshold. That's why a tree's boundaries are always straight lines parallel to the axes,
            and why a diagonal boundary comes out as a staircase. For predicting numbers instead of labels (a regression tree), the same search runs
            but scores each side by how spread out its values are, and each leaf predicts its average.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "A group holds 30 members who stayed and 10 who cancelled. What is its Gini impurity?",
          answer: 0.375,
          tolerance: 0.005,
          why: "The shares are 0.75 and 0.25, so Gini = 1 − (0.75² + 0.25²) = 1 − (0.5625 + 0.0625) = 0.375.",
        },
        {
          kind: "choice",
          q: "Why do a decision tree's boundaries look like a staircase when the true boundary is a diagonal line?",
          options: [
            { t: "Each question tests one feature against one threshold, so every cut is parallel to an axis.", ok: true, why: "Right. A diagonal needs both features at once, so the tree approximates it with many small axis-aligned steps." },
            { t: "Trees work on a pixel grid, so they can't draw smooth lines.", why: "Trees don't use a grid. The thresholds can sit anywhere; the problem is that each one uses a single feature." },
            { t: "The Gini formula squares the shares, which bends the boundary.", why: "Gini only scores how mixed a group is. It has no say in the shape of the cut." },
            { t: "It's how the chart is drawn, not what the model does.", why: "The staircase is real. Ask the tree about a point on the diagonal and it answers according to the steps." },
          ],
        },
        {
          kind: "task",
          q: "Find a split whose mix after the split is within 0.01 of the best one possible. Try both features.",
          Sim: SplitSim,
          check: (s) => s.weighted <= s.best + 0.01,
          done: "That's the question a tree would ask first. Notice that you had to compare across both features to be sure.",
        },
      ],
      explain: {
        q: "A friend asks how a tree decides on its first question. Which answer would you give?",
        options: [
          {
            t: "It tries every possible yes/no question on every feature and keeps the one that leaves the two groups least mixed.",
            verdict: "right",
            why: "That's it. It's a brute-force search over features and thresholds, scored by impurity, done one step at a time.",
          },
          {
            t: "It picks the feature most correlated with the label and splits it down the middle.",
            verdict: "partly",
            why: "The feature it picks is often strongly related to the label, but the tree scores actual splits, and where the threshold goes matters as much as which feature.",
          },
          {
            t: "It searches for the order of questions that gives the smallest possible tree.",
            verdict: "wrong",
            why: "Finding the smallest tree is far too slow to do exactly. Trees are greedy: they take the best question now and never look ahead.",
          },
          {
            t: "It tries random questions and keeps whichever tree scores best.",
            verdict: "wrong",
            why: "A single tree's search is systematic, not random. Randomness comes in later, with random forests.",
          },
        ],
      },
      readMore: [
        { title: "Decision and classification trees, clearly explained", by: "StatQuest (video)", url: "https://www.youtube.com/watch?v=_L39rN6gz7Y" },
        { title: "Entropy for data science, clearly explained", by: "StatQuest (video)", url: "https://youtu.be/YtebGVx-Fxw" },
        { title: "Decision trees", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/tree.html" },
        { title: "An Introduction to Statistical Learning, chapter 8", by: "James, Witten, Hastie and Tibshirani (free book)", url: "https://www.statlearning.com/" },
      ],
    },

    {
      id: "overfitting",
      title: "When a tree memorises",
      lead: "Depth, overfitting, and the trade between bias and variance.",
      idea: (
        <p>
          Let a tree keep asking questions and it will eventually give every training row a leaf of its own. It's then perfect on data it has seen and
          shaky on anything new, like a student who memorised last year's answer sheet. Too few questions and it misses real patterns. The skill is
          stopping in between.
        </p>
      ),
      example: (
        <p>
          With unlimited depth, the gym's tree might learn "members who joined on a Tuesday in March and called support exactly three times will
          cancel", because one person did. That rule is true of the past and useless for the future. A tree that stops at four or five questions can't
          learn rules that specific, so it's forced to keep only the patterns that hold for many people.
        </p>
      ),
      play: [
        {
          Sim: DepthSim,
          try: "Slide the depth from 1 to 12. Watch the coloured regions get fussier as training accuracy climbs, while accuracy on new data peaks and then slips. Turn the noise off and see how the peak moves.",
        },
      ],
      how: (
        <>
          <p>
            Every model's error on new data comes from three places. <strong>Bias</strong> is being wrong in a consistent way because the model is
            too simple: a depth-1 tree can only draw one line. <strong>Variance</strong> is being jumpy: a deep tree changes a lot if you swap a few
            training rows. <strong>Noise</strong> is randomness in the data that no model can predict.
          </p>
          <Eq says="for squared error, averaged over many training sets">expected error = bias² + variance + noise</Eq>
          <p>
            Deep trees have low bias and high variance. You can see the variance directly: retrain on a slightly different sample and the top split
            can change, which changes everything below it.
          </p>
          <p>Ways to rein a tree in:</p>
          <ul>
            <li>
              <M>max_depth</M>: stop after a set number of questions.
            </li>
            <li>
              <M>min_samples_leaf</M>: every leaf must hold at least this many rows, so no rule rests on one person.
            </li>
            <li>
              Pruning (<M>ccp_alpha</M> in scikit-learn): grow the full tree, then cut back branches that don't earn their keep.
            </li>
          </ul>
          <p>
            The tell-tale sign of overfitting is a gap: high accuracy on the training data, much lower on data held back. Plotting both against depth
            gives you a curve like the one in the simulation.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "Your tree scores 100% on its training data and 71% on a held-out set. What's the most likely story?",
          options: [
            { t: "It has memorised the training data: high variance.", ok: true, why: "Yes. A big gap between training and held-out scores is the signature of overfitting." },
            { t: "It's too simple: high bias.", why: "A too-simple model does badly on both sets. Here it's perfect on one." },
            { t: "The held-out set must be broken.", why: "It might be, but a gap like this is exactly what a very deep tree produces on healthy data." },
            { t: "That's a good result; 100% shows it learned everything.", why: "Training accuracy says how well it remembers, not how well it predicts. The 71% is the number that matters." },
          ],
        },
        {
          kind: "task",
          q: "With the noisy data, set the depth to where accuracy on new data is highest.",
          Sim: DepthSim,
          check: (s) => s.noise && s.test >= s.bestTest - 0.004,
          done: "Notice the best depth sits well short of the deepest tree, even though training accuracy keeps rising past it.",
        },
        {
          kind: "multi",
          q: "Which of these make a single tree less likely to overfit? Pick all that apply.",
          options: [
            { t: "Limit its depth", ok: true, why: "Fewer questions means fewer chances to learn one-off rules." },
            { t: "Require at least 20 rows in every leaf", ok: true, why: "No rule can rest on a single row." },
            { t: "Prune weak branches after growing", ok: true, why: "Pruning removes splits that barely improve the fit." },
            { t: "Add more columns of random noise", why: "Extra noise gives the tree more ways to find accidental patterns." },
          ],
        },
      ],
      explain: {
        q: "How would you explain overfitting to someone who's never trained a model?",
        options: [
          {
            t: "The model learns the quirks of the examples it was shown instead of the general pattern, so it does well on those examples and badly on new ones.",
            verdict: "right",
            why: "Clear and correct. The key is the contrast between seen and unseen data.",
          },
          {
            t: "The model is too complicated, so it runs slowly.",
            verdict: "wrong",
            why: "Speed is a separate issue. Overfitting is about predictions on new data getting worse.",
          },
          {
            t: "The model has been trained for too long.",
            verdict: "partly",
            why: "That can cause it in models trained in rounds, like boosting or neural networks, but the underlying problem is fitting noise. A tree overfits by growing too deep, not by training long.",
          },
          {
            t: "The model gets a low score on its training data.",
            verdict: "wrong",
            why: "That's underfitting. An overfit model usually looks excellent on its training data.",
          },
        ],
      },
      readMore: [
        { title: "Decision trees and ensemble methods, Stanford CS229 lecture 9", by: "Stanford (video)", url: "https://youtu.be/wr9gUr-eWdA" },
        { title: "Tips on practical use of decision trees", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/tree.html#tips-on-practical-use" },
        { title: "Hands-On Machine Learning, chapter on decision trees", by: "Aurélien Géron (book)", url: "https://www.oreilly.com/library/view/hands-on-machine-learning/9781098125967/" },
      ],
    },

    {
      id: "metrics",
      title: "The accuracy trap",
      lead: "Precision, recall, F1 and ROC curves, and why accuracy lies when one answer is rare.",
      idea: (
        <p>
          If 6 in every 100 card payments are fraud, a model that says "honest" every single time is 94% accurate and catches nothing. Accuracy hides
          that. Better to ask two questions: of the payments I flagged, how many were really fraud? And of all the fraud, how much did I catch?
        </p>
      ),
      example: (
        <p>
          A bank's model gives every payment a fraud score between 0 and 1, and the bank picks a cut-off. Set it low and the fraud team drowns in false
          alarms, phoning customers who were only buying groceries. Set it high and fraud slips through. No cut-off is right in general. It depends on
          what a missed fraud costs compared with an annoyed customer.
        </p>
      ),
      play: [
        {
          Sim: ThresholdSim,
          try: "Start with fraud being rare and slide the cut-off down from 1. Watch accuracy barely move while recall climbs and precision falls. Then turn off 'rare' and see how different the same model looks.",
        },
      ],
      how: (
        <>
          <p>Every prediction lands in one of four boxes, the confusion matrix:</p>
          <Table
            head={["", "Really fraud", "Really honest"]}
            rows={[
              ["Flagged", "true positive (caught)", "false positive (false alarm)"],
              ["Not flagged", "false negative (missed)", "true negative (cleared)"],
            ]}
          />
          <Eq says="of what I flagged, how much was right">precision = TP / (TP + FP)</Eq>
          <Eq says="of what was really there, how much I found">recall = TP / (TP + FN)</Eq>
          <Eq says="the harmonic mean: high only when both are high">F1 = 2 · precision · recall / (precision + recall)</Eq>
          <p>
            The <strong>ROC curve</strong> plots recall (the true positive rate) against the false positive rate for every possible cut-off. The area
            under it, <strong>AUC</strong>, has a plain meaning: pick one real fraud and one honest payment at random, and AUC is the chance the
            model scores the fraud higher. 0.5 is a coin toss, 1.0 is perfect. Because it covers every cut-off, AUC rates the ranking, not a
            particular decision. When positives are very rare, a precision–recall curve is often more telling, because the false positive rate stays
            tiny even when false alarms swamp the real cases.
          </p>
          <p>Two habits that go with rare classes:</p>
          <ul>
            <li>
              Rebalance during training, not testing: class weights (<M>class_weight="balanced"</M>) or resampling the training rows only. The test
              set should look like the real world.
            </li>
            <li>
              Fill in missing values inside the training pipeline (a median, or a "was missing" flag), never with numbers computed from the whole
              dataset. More on that in "Testing honestly".
            </li>
          </ul>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "Out of 1,000 payments, 50 are fraud. The model flags 40 payments, and 30 of those are really fraud. What is its recall, as a percentage?",
          answer: 60,
          tolerance: 0.5,
          unit: "%",
          why: "Recall = caught / all fraud = 30 / 50 = 60%. (Precision is 30 / 40 = 75%.)",
        },
        {
          kind: "task",
          q: "With fraud rare, move the cut-off until the model catches at least 80% of the fraud. Then look at precision.",
          Sim: ThresholdSim,
          check: (s) => s.rare && s.recall >= 0.8,
          done: "Catching more fraud cost a lot of precision: most of what you're flagging now is honest. That's the trade every fraud team negotiates.",
        },
        {
          kind: "choice",
          q: "A model has an AUC of 0.5. What does that tell you?",
          options: [
            { t: "Its scores rank fraud above honest payments no better than chance.", ok: true, why: "Right. Half the time a random fraud outscores a random honest payment, which is a coin toss." },
            { t: "It's right half the time.", why: "AUC isn't accuracy. A model can be 94% accurate with an AUC of 0.5, as the 'always honest' model shows." },
            { t: "Its best cut-off is 0.5.", why: "AUC doesn't depend on any one cut-off; it sums over all of them." },
            { t: "It catches half the fraud.", why: "That's a recall of 0.5, at one cut-off. AUC summarises every cut-off." },
          ],
        },
      ],
      explain: {
        q: "Your manager asks why you didn't just report accuracy. What do you say?",
        options: [
          {
            t: "Because fraud is rare, a model that never flags anything already scores 94%. Precision and recall show how much fraud we catch and how many false alarms we raise, which is what we actually care about.",
            verdict: "right",
            why: "That's the whole argument, in terms a manager can act on.",
          },
          {
            t: "Accuracy is an outdated metric; modern teams use F1.",
            verdict: "wrong",
            why: "Accuracy is fine when classes are balanced and mistakes cost the same. The reason to look further is the imbalance, not fashion.",
          },
          {
            t: "Accuracy only works for regression problems.",
            verdict: "wrong",
            why: "Accuracy is a classification metric. Regression uses errors like RMSE.",
          },
          {
            t: "Our accuracy was low, so other metrics look better.",
            verdict: "wrong",
            why: "Picking metrics to flatter a model is how bad models get shipped. Here accuracy was misleadingly high.",
          },
        ],
      },
      readMore: [
        { title: "ROC and AUC, clearly explained", by: "StatQuest (video)", url: "https://youtu.be/4jRBRDbJemM" },
        { title: "Classification: accuracy, precision, recall", by: "Google Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course/classification" },
        { title: "Metrics and scoring", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/model_evaluation.html" },
      ],
    },

    {
      id: "forests",
      title: "Why a forest beats a tree",
      lead: "Bagging, random forests and the wisdom of a crowd.",
      idea: (
        <p>
          One tree is a nervous guesser. A forest is a crowd of nervous guessers who are wrong in <em>different</em> ways, so when they vote, their
          mistakes cancel out. The trick is keeping them different.
        </p>
      ),
      example: (
        <p>
          Will Maya cancel her phone plan next month? One tree looks at her contract and says yes. Another, trained on a different shuffle of past
          customers, looks at her bills and says no. A hundred trees vote, 71 say she'll stay, and that's the forest's answer. Ask the same hundred
          trees about someone else and a different set of them will be wrong.
        </p>
      ),
      play: [
        {
          Sim: CrowdSim,
          try: "Each tree here is right only 60% of the time. Add trees and watch the vote improve. Then raise how much they copy each other and watch the benefit drain away.",
        },
        {
          Sim: BootstrapSim,
          try: "Each tree in a forest trains on a bootstrap sample: rows drawn at random, with replacement. Draw a few and count how many rows get left out each time.",
        },
      ],
      how: (
        <>
          <p>
            <strong>Bagging</strong> (bootstrap aggregating) is the simple version: draw a bootstrap sample, grow a deep tree on it, repeat a few
            hundred times, then vote (classification) or average (regression). Each tree overfits in its own way, and averaging cancels much of
            that.
          </p>
          <p>
            But bootstrap samples overlap a lot, so the trees still tend to agree, especially if one feature is very strong: every tree splits on it
            first. A <strong>random forest</strong> adds one more twist. At every split, each tree may only choose from a random handful of features
            (often √p of the p features). Sometimes the strong feature isn't on the menu, so trees are forced to find other routes, and their
            mistakes become less alike.
          </p>
          <Eq says="the spread of an average of B models, each with spread σ² and correlation ρ">
            Var(average) = ρσ² + (1 − ρ) σ² / B
          </Eq>
          <p>
            More trees shrink the second term towards zero, but the first term stays. Only lower correlation reduces it, which is exactly what the
            feature subsampling buys.
          </p>
          <p>
            Each bootstrap sample leaves out about 37% of the rows. Those <strong>out-of-bag</strong> rows are a free test set for that tree, so a
            forest can estimate its own accuracy without a separate validation split.
          </p>
          <Table
            head={["", "Bagging", "Random forest"]}
            rows={[
              ["Rows per tree", "bootstrap sample", "bootstrap sample"],
              ["Features per split", "all of them", "a random subset"],
              ["How alike the trees are", "quite alike", "less alike"],
              ["Typical result", "better than one tree", "usually better again"],
            ]}
          />
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "What does a random forest add on top of plain bagging?",
          options: [
            { t: "Each split may only consider a random subset of the features.", ok: true, why: "Right. That makes the trees less alike, so their errors cancel better." },
            { t: "Each new tree focuses on the rows the previous trees got wrong.", why: "That's boosting, the next lesson." },
            { t: "Every tree is cut back to a single split.", why: "Forests usually grow deep trees. Averaging handles the variance." },
            { t: "Each tree trains on all the rows instead of a sample.", why: "Forests do sample the rows, the same as bagging." },
          ],
        },
        {
          kind: "task",
          q: "Set at least 51 trees, then raise how much they copy each other until the vote is right no more than 70% of the time.",
          Sim: CrowdSim,
          check: (s) => s.trees >= 51 && s.acc <= 0.7,
          done: "Fifty-one trees, and barely better than a handful. More trees can't help if they make the same mistakes together.",
        },
        {
          kind: "number",
          q: "Roughly what percentage of the original rows end up in a bootstrap sample of the same size (for a large dataset)?",
          answer: 63.2,
          tolerance: 1.5,
          unit: "%",
          why: "Each row is missed by one draw with chance 1 − 1/n, and by all n draws with chance (1 − 1/n)ⁿ ≈ 1/e ≈ 36.8%. So about 63.2% make it in.",
        },
      ],
      explain: {
        q: "Explain to a friend why a forest of so-so trees beats one carefully built tree.",
        options: [
          {
            t: "Each tree makes mistakes, but different trees make different mistakes. When they vote, the mistakes mostly cancel and the shared, real pattern wins.",
            verdict: "right",
            why: "That's the core idea, including the part people forget: the mistakes have to be different.",
          },
          {
            t: "More trees means more computing power, so the answer is more accurate.",
            verdict: "wrong",
            why: "Computing power isn't the point. A hundred identical trees are no better than one.",
          },
          {
            t: "The forest picks the best tree out of all of them.",
            verdict: "wrong",
            why: "A forest doesn't pick a winner; every tree gets a vote.",
          },
          {
            t: "Averaging many trees makes the model less likely to overfit.",
            verdict: "partly",
            why: "True, and it's the effect you see. But it leaves out why: averaging only reduces variance when the trees disagree in their errors.",
          },
        ],
      },
      readMore: [
        { title: "Random forests, part 1", by: "StatQuest (video)", url: "https://www.youtube.com/watch?v=J4Wdy0Wc_xQ" },
        { title: "Forests of randomized trees", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/ensemble.html#forest" },
        { title: "Random Forests", by: "Leo Breiman, 2001 (the original paper)", url: "https://link.springer.com/article/10.1023/A:1010933404324" },
      ],
    },

    {
      id: "boosting",
      title: "Boosting: learning from mistakes",
      lead: "Gradient boosting, and what XGBoost, LightGBM and CatBoost each add.",
      idea: (
        <p>
          A forest's trees work side by side. Boosting's trees work in a line. Each new tree looks only at what the team so far still gets wrong and
          tries to fix a small part of it. Add enough small fixes and you get a very accurate model.
        </p>
      ),
      example: (
        <p>
          Think of putting in golf. Your first putt gets you near the hole. You don't start over; you putt again from where the ball stopped, aiming
          at what's left. A good golfer putts gently so they don't overshoot. That gentleness is the learning rate: each tree only gets to fix a
          fraction of the remaining error.
        </p>
      ),
      play: [
        {
          Sim: BoostSim,
          try: "Press play and watch each tree nudge the curve towards the dots. Then compare learning rates: 1 fits fast but gets fussy, 0.05 is careful but needs many more trees.",
        },
      ],
      how: (
        <>
          <p>Gradient boosting builds the model one tree at a time:</p>
          <Eq says="the new model is the old one plus a small step in the direction of the new tree">
            F<sub>m</sub>(x) = F<sub>m−1</sub>(x) + η · h<sub>m</sub>(x)
          </Eq>
          <p>
            Each tree <M>h</M> is fitted to the negative gradient of the loss, which for squared error is just the residual: actual minus predicted.
            The learning rate <M>η</M> and the number of trees trade off: a smaller rate needs more trees but usually generalises better. Early
            stopping watches a validation set and stops adding trees once it stops improving.
          </p>
          <p>The three popular libraries share this core and differ in the details:</p>
          <Table
            head={["", "What it adds", "Reach for it when"]}
            rows={[
              ["XGBoost", "Uses second-order gradients; penalises leaf weights (λ) and the number of leaves (γ); grows trees level by level.", "You want a dependable, well-documented default."],
              ["LightGBM", "Buckets feature values into histograms and grows the leaf with the biggest gain first (leaf-wise), so it's very fast.", "The data is large and training time matters."],
              ["CatBoost", "Encodes categorical features with ordered statistics that avoid target leakage; uses symmetric trees.", "You have many categorical columns."],
            ]}
          />
          <p>
            Leaf-wise growth fits faster but can overfit small data, so LightGBM's <M>num_leaves</M> and <M>min_data_in_leaf</M> matter more than
            depth. In all three, the settings that matter most are usually the learning rate, the number of trees, tree size, and subsampling.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "In gradient boosting with squared error, what does each new tree try to predict?",
          options: [
            { t: "The residuals: how far off the current model is on each row.", ok: true, why: "Right. More generally it's the negative gradient of the loss, which for squared error is the residual." },
            { t: "The original target, from scratch.", why: "That would be bagging. Boosting trees only see what's left to fix." },
            { t: "Which of the earlier trees was most accurate.", why: "Trees don't predict anything about each other. They predict corrections." },
            { t: "A random subset of the features.", why: "Subsampling features is an option in boosting, but it isn't what each tree predicts." },
          ],
        },
        {
          kind: "task",
          q: "Get the error on new points below 0.26. You'll need the right learning rate and enough trees.",
          Sim: BoostSim,
          check: (s) => s.testErr < 0.26,
          done: "A moderate rate with plenty of trees wins. Rate 1 drives training error lower but never gets new-point error this low: it's fitting noise.",
        },
        {
          kind: "multi",
          q: "Which statements are true? Pick all that apply.",
          options: [
            { t: "LightGBM grows the leaf with the largest gain first.", ok: true, why: "That's leaf-wise growth, one reason it's fast." },
            { t: "CatBoost has a special way of handling categorical features.", ok: true, why: "Ordered target statistics, designed to avoid leakage." },
            { t: "XGBoost penalises large leaf weights.", ok: true, why: "The λ term in its objective does exactly that." },
            { t: "Boosting trains its trees independently, in parallel.", why: "Each tree depends on the ones before it, so the trees are built in sequence. (The work inside each tree can be parallel.)" },
          ],
        },
      ],
      explain: {
        q: "How would you explain the difference between a random forest and boosting?",
        options: [
          {
            t: "A forest grows many trees independently and lets them vote. Boosting grows trees one after another, each fixing what the previous ones got wrong.",
            verdict: "right",
            why: "That's the difference in one breath: in parallel versus in sequence, voting versus correcting.",
          },
          {
            t: "Boosting uses bigger trees than a random forest.",
            verdict: "wrong",
            why: "It's usually the opposite: boosting likes small trees, forests like deep ones.",
          },
          {
            t: "Forests reduce variance; boosting mainly reduces bias.",
            verdict: "partly",
            why: "A good summary of their effects, but it doesn't say how either works. Pair it with the parallel-versus-sequence picture.",
          },
          {
            t: "They're the same; boosting is just a faster forest.",
            verdict: "wrong",
            why: "They build trees in fundamentally different ways and fail in different ways.",
          },
        ],
      },
      readMore: [
        { title: "XGBoost part 1: regression", by: "StatQuest (video)", url: "https://youtu.be/OtD8wVaFm6E" },
        { title: "Introduction to boosted trees", by: "XGBoost documentation", url: "https://xgboost.readthedocs.io/en/stable/tutorials/model.html" },
        { title: "LightGBM features", by: "LightGBM documentation", url: "https://lightgbm.readthedocs.io/en/latest/Features.html" },
        { title: "CatBoost: unbiased boosting with categorical features", by: "Prokhorenkova et al. (paper)", url: "https://arxiv.org/abs/1706.09516" },
      ],
    },

    {
      id: "honest-testing",
      title: "Testing honestly",
      lead: "Cross-validation, searching for settings, pipelines that don't leak, and saving the result.",
      idea: (
        <p>
          A score is only worth something if the model never peeked at the rows it's scored on. Peeking sneaks in easily, through steps that look
          harmless. Cross-validation rotates which rows are held back, and a pipeline makes sure every preparation step happens inside that
          rotation.
        </p>
      ),
      example: (
        <p>
          A teacher hands out the exam questions as homework, then is delighted by the class average. Nobody cheated on purpose. Now the data science
          version: you pick the 10 columns most related to the label using all your data, then cross-validate. The held-out rows already helped
          choose the columns, so the score is inflated. On pure noise it can look like 80%.
        </p>
      ),
      play: [
        {
          Sim: LeakSim,
          try: "The data here is pure noise; no model can beat 50% for real. Look at the score with the leak on, then turn it off. Press new random data a few times with each setting.",
        },
        {
          Sim: SearchSim,
          try: "You have nine tries to find good settings. Only the learning rate matters here. Compare how many different learning rates the grid tries with random or guided search.",
        },
      ],
      how: (
        <>
          <p>
            <strong>K-fold cross-validation</strong> splits the data into k parts, trains on k − 1 and scores on the one left out, and rotates until
            every part has been the check. The average is steadier than a single split. Use stratified folds for classification so every fold has
            the same share of each class, and time-ordered folds for time series (see the forecasting chapter).
          </p>
          <p>
            If you use cross-validation to choose settings, that score is now a little optimistic too, because you picked the best of many. Keep a
            final test set you touch once, at the end.
          </p>
          <p>Three ways to search for settings:</p>
          <ul>
            <li>
              <strong>Grid search</strong> tries every combination from a list. Simple, but it wastes tries when some settings don't matter: nine
              tries give only three distinct values of each.
            </li>
            <li>
              <strong>Random search</strong> samples combinations at random. With the same budget, every try tests a new value of the setting that
              matters.
            </li>
            <li>
              <strong>Bayesian search</strong> (Optuna, scikit-optimize) builds a cheap model of score versus settings from the tries so far and
              picks the next try where it expects the most improvement. The guided option in the simulation shows the spirit of it.
            </li>
          </ul>
          <p>
            A scikit-learn <M>Pipeline</M> chains the preparation steps (filling gaps, scaling, encoding categories, selecting features) with the
            model, so cross-validation refits all of them on each fold's training rows. That's what closes the leak.
          </p>
          <p>
            Once you've chosen a model, save the whole fitted pipeline, not just the model, with <M>joblib.dump</M>. Name it with a version, and
            store alongside it the data version, the metrics, and the library versions, because a pickle may not load under a different scikit-learn
            version. For serving outside Python, ONNX is a portable alternative.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "You fill missing values with each column's mean, computed on the full dataset, and then run cross-validation. What's wrong?",
          options: [
            { t: "The held-out rows helped compute the means, so information leaked from the check rows into training.", ok: true, why: "Right. The fix is to put the filling step in a pipeline so each fold computes its own means." },
            { t: "Nothing; the mean is the same either way.", why: "It's close, but not the same, and with steps like feature selection the difference can be enormous." },
            { t: "You should use the median instead.", why: "The median is often a better choice, but computing it on all rows leaks in exactly the same way." },
            { t: "Cross-validation can't be used when there were missing values.", why: "It can, as long as the filling happens inside each fold." },
          ],
        },
        {
          kind: "task",
          q: "Find settings that score at least 85% using only nine tries. Pick any search method.",
          Sim: SearchSim,
          check: (s) => s.best >= 0.85,
          done: "Grid search can't reach it, because none of its three learning rates is close enough to the sweet spot.",
        },
        {
          kind: "choice",
          q: "When only one of two settings matters, why does random search usually beat grid search with the same number of tries?",
          options: [
            { t: "Every random try tests a new value of the setting that matters; the grid repeats the same few.", ok: true, why: "Exactly. Nine grid points give three values of each setting; nine random points give nine." },
            { t: "Random search uses a smarter model of the scores.", why: "That's Bayesian search. Random search has no model at all." },
            { t: "Random search runs faster per try.", why: "Each try costs the same. The difference is where the tries land." },
            { t: "Grid search can't handle more than one setting.", why: "It can; it just spends tries poorly." },
          ],
        },
      ],
      explain: {
        q: "Why do we put preprocessing inside a pipeline? Pick the explanation you'd give a teammate.",
        options: [
          {
            t: "So that during cross-validation every step, like filling gaps or choosing features, is learned only from the training rows of each fold, and the score stays honest.",
            verdict: "right",
            why: "That's the reason that matters. The tidiness is a bonus.",
          },
          {
            t: "It makes the code shorter.",
            verdict: "partly",
            why: "True, but it's a side benefit. The real reason is preventing leakage.",
          },
          {
            t: "Models can't read raw data without one.",
            verdict: "wrong",
            why: "You can preprocess by hand. The point is where the statistics are learned from.",
          },
          {
            t: "Pipelines make the model more accurate.",
            verdict: "wrong",
            why: "A pipeline can make the reported score lower, because it removes the leak. The model isn't better; the measurement is truer.",
          },
        ],
      },
      readMore: [
        { title: "Cross-validation: evaluating estimator performance", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/cross_validation.html" },
        { title: "Pipelines and composite estimators", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/compose.html" },
        { title: "Random search for hyper-parameter optimization", by: "Bergstra and Bengio (paper)", url: "https://www.jmlr.org/papers/v13/bergstra12a.html" },
        { title: "Optuna", by: "a library for Bayesian-style search", url: "https://optuna.org/" },
        { title: "Model persistence", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/model_persistence.html" },
      ],
    },

    {
      id: "explaining",
      title: "Why did it say that?",
      lead: "Feature importance and SHAP values.",
      idea: (
        <p>
          SHAP splits a prediction among the features, the way you'd split a restaurant bill fairly. Start from the average customer's risk. Each
          feature then gets credit, or blame, for how far it moved this customer's prediction up or down. The pieces always add up to the final
          answer.
        </p>
      ),
      example: (
        <p>
          The model says Priya has a 73% chance of cancelling, and the retention team asks why. SHAP answers: the average customer sits at 26%. Her
          month-to-month contract adds a lot, being only four months in adds more, three support calls add a bit, and not paying automatically adds a
          little. Now the team knows what to talk to her about.
        </p>
      ),
      play: [
        {
          Sim: ShapSim,
          try: "Change one detail at a time and watch which bar moves. Try making a long-standing customer on a two-year contract who still calls support a lot.",
        },
      ],
      how: (
        <>
          <p>
            Shapley values come from game theory, where they split a team's winnings fairly among its players. For a prediction, the "players" are
            the features. A feature's value is its average extra contribution over every possible order in which features could join.
          </p>
          <Eq says="the average prediction plus every feature's push gives this prediction">
            prediction = average + Σ SHAP<sub>i</sub>
          </Eq>
          <p>
            Computed naively that's exponential in the number of features, but TreeSHAP computes exact values for tree models quickly by walking the
            trees. In the simulation the model adds its pushes on the log-odds scale, so the bars are exact too.
          </p>
          <p>Ways to ask "which features matter overall":</p>
          <ul>
            <li>
              <strong>Impurity-based importance</strong> (the default <M>feature_importances_</M>): total impurity drop from splits on each
              feature. Fast, but biased towards features with many distinct values, like IDs.
            </li>
            <li>
              <strong>Permutation importance</strong>: shuffle one column on held-out data and see how much the score drops. Honest, but slow, and
              misleading when two features carry the same information.
            </li>
            <li>
              <strong>Mean |SHAP|</strong>: average the size of each feature's push across many rows. The SHAP summary plot shows this, and the
              direction too.
            </li>
          </ul>
          <p>
            One warning: SHAP explains the model, not the world. If the model learned that support calls predict cancelling, that doesn't mean
            stopping customers from calling would keep them.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "The average prediction is 20%. For one customer the SHAP values are +15, −5 and +8 percentage points. What does the model predict for them, in percent?",
          answer: 38,
          tolerance: 0.5,
          unit: "%",
          why: "SHAP values add up: 20 + 15 − 5 + 8 = 38%.",
        },
        {
          kind: "task",
          q: "Change this customer's details until they're less likely to cancel than the average customer.",
          Sim: ShapSim,
          check: (s) => s.risk < 0.26,
          done: "Look at which bars flipped direction. Those are the features that did the work.",
        },
        {
          kind: "choice",
          q: "Why can the default impurity-based feature importance mislead?",
          options: [
            { t: "It favours features with many distinct values, which offer more possible split points.", ok: true, why: "Right. A random ID column can look important just because it can be split so many ways." },
            { t: "It only works for linear models.", why: "It's specific to trees, actually." },
            { t: "It's calculated on the test set.", why: "It's calculated from the training splits, which is part of the problem." },
            { t: "It can't rank more than ten features.", why: "There's no such limit." },
          ],
        },
      ],
      explain: {
        q: "A colleague says: 'SHAP shows that support calls cause customers to leave.' How do you respond?",
        options: [
          {
            t: "SHAP shows how much the model leaned on support calls for this prediction. That's about the model's reasoning, not cause and effect in the world.",
            verdict: "right",
            why: "Exactly the distinction. Unhappy customers both call and leave; the calls may be a symptom.",
          },
          {
            t: "That's right, SHAP values measure causal effects.",
            verdict: "wrong",
            why: "SHAP measures contributions to a prediction. Causal claims need experiments or causal methods.",
          },
          {
            t: "SHAP can't be trusted at all for tree models.",
            verdict: "wrong",
            why: "TreeSHAP is exact for trees. The issue is interpreting it as cause, not its accuracy.",
          },
          {
            t: "It depends whether the SHAP value is positive.",
            verdict: "partly",
            why: "The sign tells you the direction of the push, but no sign turns a contribution into a cause.",
          },
        ],
      },
      readMore: [
        { title: "SHAP documentation", by: "the shap library", url: "https://shap.readthedocs.io/en/latest/" },
        { title: "Interpretable Machine Learning: SHAP", by: "Christoph Molnar (free book)", url: "https://christophm.github.io/interpretable-ml-book/shap.html" },
        { title: "A unified approach to interpreting model predictions", by: "Lundberg and Lee (the SHAP paper)", url: "https://arxiv.org/abs/1705.07874" },
      ],
    },
  ],
};
