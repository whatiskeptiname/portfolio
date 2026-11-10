// Chapter: probability, uncertainty and Bayesian inference.
import React from "react";
import { Eq, M, Table } from "../kit";
import { EstimatorSim, GaussianSim, GPSim, MCMCSim, NetworkSim, UncertaintySim, UpdateSim } from "../sims/bayes";

export default {
  lessons: [
    {
      id: "uncertainty",
      history: "Economist Frank Knight drew a similar line in 1921, between risk you can measure and uncertainty you can't. In machine learning the words aleatoric and epistemic were popularised by a 2017 paper by Alex Kendall and Yarin Gal on vision models, such as those in self-driving cars, that need to know when they're unsure.",
      gist: [
        "Some uncertainty comes from too little data, and more data shrinks it.",
        "Some comes from the world being random, and no amount of data removes it.",
        "Good systems report both, so you know whether to collect more data or plan for a range.",
      ],
      practice: {
        adjust: [
          "How much data you collect for the groups the model is unsure about.",
          "Whether the model gives a single number or a range (prediction intervals or quantiles).",
        ],
        wrong: [
          "Giving confident point predictions for groups the model has barely seen.",
          "Promising that more data will make a random outcome predictable.",
        ],
        notice: [
          "Intervals much wider for some groups point to thin data there.",
          "Check that 90% intervals contain the real value about 90% of the time.",
        ],
        ask: [
          "How wide are the prediction intervals, and for which groups are they widest?",
          "Would more data shrink this uncertainty, or is it noise in the outcome itself?",
        ],
      },
      idea: (
        <p>
          Some uncertainty is ignorance: you haven't seen enough yet, and more data will shrink it. Some is just how the world is: even with perfect
          knowledge, a coin flip stays a coin flip. Good models keep the two apart, because only the first one is worth collecting more data for.
        </p>
      ),
      example: (
        <p>
          You're scouting a basketball player. After watching 10 free throws you can't say much about how good they really are; maybe 50%, maybe
          85%. After 500 throws you know their rate to within a few points. But ask how many of their <em>next</em> 10 throws will go in, and even
          with all that knowledge the honest answer is "about 7, give or take one or two". That give-or-take never goes away.
        </p>
      ),
      play: [
        {
          Sim: UncertaintySim,
          try: "Slide the number of shots watched from 0 to 500. The left curve, your belief about the player, gets narrow. The bars on the right, the next 10 shots, barely change after the first hundred.",
        },
      ],
      how: (
        <>
          <p>
            <strong>Epistemic</strong> uncertainty (from the Greek for knowledge) is uncertainty about the model: its parameters, or which model is
            right at all. It shrinks as data arrives. In the simulation it's the width of the curve over the player's true rate.
          </p>
          <p>
            <strong>Aleatoric</strong> uncertainty (from the Latin for dice) is noise in the outcome itself. More data teaches you how big it is but
            doesn't shrink it. In the simulation it's the spread of the next-10 bars, which settles towards a binomial distribution and stays there.
          </p>
          <Eq says="total spread of a prediction = average noise + uncertainty about the model">
            Var(y) = E[Var(y | θ)] + Var(E[y | θ])
          </Eq>
          <p>
            Why it matters: when a model is unsure about a customer group it rarely sees, the fix is more data from that group. When it's unsure
            because the outcome is genuinely random, more data won't help, and the right response is to plan for the range of outcomes. Models
            that give a single number hide both. The rest of this chapter is about models that give you the whole distribution.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "A weather model is unsure about tomorrow's rain in a region where it has only two years of records. What kind of uncertainty is mostly at play?",
          options: [
            { t: "Epistemic: too little data about that region", ok: true, why: "Right. More years of records would shrink it." },
            { t: "Aleatoric: rain is random however much you record", why: "Weather does have irreducible randomness, but the problem described is the thin data, which more records would fix." },
            { t: "Neither: a trained model's output is fixed", why: "Every model is uncertain. The question is whether the uncertainty can be reduced." },
            { t: "Both equally, since one always comes with the other", why: "There's no rule that they're equal. Here the thin data dominates." },
          ],
        },
        {
          kind: "task",
          q: "Watch enough shots that your range for the player's true rate is narrower than 10 percentage points. Then look at the spread of the next 10 shots.",
          Sim: UncertaintySim,
          check: (s) => s.width < 0.1,
          done: "Your knowledge of the player is now sharp, yet the next 10 shots are still uncertain by about ±1.5 baskets. That part is aleatoric.",
        },
        {
          kind: "multi",
          q: "Which of these would reduce epistemic uncertainty? Pick all that apply.",
          options: [
            { t: "Collecting more data from under-represented groups", ok: true, why: "The model learns more about the cases it was unsure of." },
            { t: "Using a model family that better fits the true pattern", ok: true, why: "Uncertainty about which model is right is epistemic too." },
            { t: "Measuring the same noisy outcome more precisely in future", ok: true, why: "Better measurement removes noise you'd otherwise have to model: it moves uncertainty out of the data altogether." },
            { t: "Rolling the dice more carefully", why: "A fair die is aleatoric through and through. Care doesn't change the odds." },
          ],
        },
      ],
      explain: {
        q: "How would you explain the difference to a manager who wants 'certain' predictions?",
        options: [
          {
            t: "Some uncertainty shrinks with more data; some is real randomness, so we plan for a range.",
            verdict: "right",
            why: "Clear, honest and actionable: it says what to invest in and what to plan around.",
          },
          {
            t: "With enough data, all uncertainty goes away, so we just need to collect more.",
            verdict: "wrong",
            why: "Only the epistemic part does. Coin flips stay random however many you watch.",
          },
          {
            t: "Uncertainty means the model is bad, and a better one would be certain.",
            verdict: "wrong",
            why: "A model that admits uncertainty is being honest. A model that hides it is the dangerous one.",
          },
          {
            t: "Some uncertainty is about the model and some is noise in the data, and both matter equally.",
            verdict: "partly",
            why: "Correct, but a manager needs the consequence: which part money and data can fix.",
          },
        ],
      },
      readMore: [
        { title: "Bayes theorem, the geometry of changing beliefs", by: "3Blue1Brown (video)", url: "https://youtu.be/HZGCoVF3YvM" },
        { title: "Seeing Theory", by: "Brown University (interactive probability)", url: "https://seeing-theory.brown.edu/" },
        { title: "Think Bayes", by: "Allen Downey (free book)", url: "https://allendowney.github.io/ThinkBayes2/" },
      ],
    },

    {
      id: "estimation",
      history: "Thomas Bayes' essay on updating beliefs was published in 1763, two years after he died, by his friend Richard Price. Pierre-Simon Laplace worked out the same ideas independently and used them, among other things, to ask how sure we can be that the sun will rise tomorrow. Ronald Fisher championed maximum likelihood, which needs no prior, in the 1910s and 1920s.",
      gist: [
        "With little data, a raw rate like 4 out of 5 is unreliable.",
        "A prior is what you believed beforehand; blending it with the data gives a sensible estimate.",
        "The full posterior gives a range, which is what most decisions need.",
      ],
      practice: {
        adjust: [
          "The prior: what similar cases usually look like, and how much weight it gets.",
          "Which summary to report: the most likely value, the average, or an interval.",
        ],
        wrong: [
          "Ranking by raw rates, so tiny samples with a lucky streak come out on top.",
          "A prior so strong that real evidence can't move it.",
        ],
        notice: [
          "Top-ranked items with very few observations behind them.",
          "Estimates that barely change as data arrives, a sign the prior is too strong.",
        ],
        ask: [
          "How many observations sit behind each estimate?",
          "What prior did we use, and how much do the results change if we vary it?",
        ],
      },
      idea: (
        <p>
          You want a number, like a sign-up rate, from a little data. You can trust only the data (maximum likelihood). You can blend the data with
          what you already believed and take the single most likely value (MAP). Or you can keep the whole range of plausible values with their
          weights (the posterior). With lots of data all three agree. With a little data they don't, and that's when the choice matters.
        </p>
      ),
      example: (
        <p>
          You launch a new sign-up page. The first 5 visitors arrive and 4 sign up. Taken literally that's an 80% sign-up rate, which you'd never
          believe: similar pages convert at around 20%. MAP pulls the estimate towards what you knew, to about 38%. The posterior says something more
          useful still: "most likely around 40%, but anywhere from about 18% to 64% is plausible, so wait for more visitors before celebrating".
        </p>
      ),
      play: [
        {
          Sim: EstimatorSim,
          try: "Start with 4 sign-ups from 5 visitors and look at where MLE and MAP land. Then raise the number of visitors (keeping the share similar) and watch the prior lose its pull. Finally, make the prior very sure and see how much data it takes to overrule it.",
        },
      ],
      how: (
        <>
          <p>Everything rests on Bayes' rule:</p>
          <Eq says="posterior ∝ likelihood × prior">p(θ | data) = p(data | θ) · p(θ) / p(data)</Eq>
          <Table
            head={["", "What it gives you", "Formula for k of n with a Beta(a, b) prior"]}
            rows={[
              ["MLE", "the θ that makes the data most likely; ignores the prior", "k / n"],
              ["MAP", "the peak of the posterior; one number, prior included", "(a + k − 1) / (a + b + n − 2)"],
              ["Full Bayes", "the whole posterior; any summary you like", "Beta(a + k, b + n − k)"],
            ]}
          />
          <p>
            The prior Beta(a, b) behaves like <M>a + b</M> imaginary visitors you've already seen, <M>a</M> of whom signed up. That's why a "sure"
            prior takes a lot of real data to overrule, and why as n grows the real data swamps it.
          </p>
          <p>
            MAP with a prior is the same thing as regularisation. A Gaussian prior on regression weights gives ridge regression (L2); a Laplace
            prior gives the lasso (L1). Penalising large weights is just saying you believed beforehand that weights are small.
          </p>
          <p>
            Credible intervals from the posterior read the way people wish confidence intervals did: "there's a 94% chance the rate is in this
            range, given the data and the prior". The 94% is a convention borrowed from some Bayesian tools; it isn't special.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "With a Beta(2, 8) prior and 4 sign-ups out of 5 visitors, what is the MAP estimate, as a percentage?",
          answer: 38.46,
          tolerance: 0.6,
          unit: "%",
          why: "(a + k − 1) / (a + b + n − 2) = (2 + 4 − 1) / (2 + 8 + 5 − 2) = 5 / 13 ≈ 38.5%. Compare the MLE of 80%.",
        },
        {
          kind: "task",
          q: "Keep the prior very sure (worth at least 50 visitors), and find enough data that MAP and MLE are within 1 percentage point of each other.",
          Sim: EstimatorSim,
          check: (s) => s.strength >= 50 && s.n > 0 && Number.isFinite(s.map) && Math.abs(s.map - s.mle) < 0.01,
          done: "However strong the prior, enough data overrules it. That's the prior washing out.",
        },
        {
          kind: "choice",
          q: "L2 regularisation (ridge regression) is the same as MAP estimation with which prior on the weights?",
          options: [
            { t: "A Gaussian centred at zero", ok: true, why: "Right. Its log is a squared penalty, exactly the L2 term." },
            { t: "A Laplace distribution centred at zero", why: "That gives L1, the lasso." },
            { t: "A uniform prior", why: "A flat prior makes MAP the same as MLE: no penalty at all." },
            { t: "A Beta prior", why: "Beta priors are for rates between 0 and 1, not regression weights." },
          ],
        },
      ],
      explain: {
        q: "A colleague asks why you didn't just report 4 out of 5 as an 80% sign-up rate. What do you say?",
        options: [
          {
            t: "Five visitors is too few; with what similar pages do, it's about 38%, within 18–64%.",
            verdict: "right",
            why: "It names the problem (tiny n), the fix (the prior) and the useful output (a range that narrows).",
          },
          {
            t: "80% is the correct answer; using a prior is just adding bias.",
            verdict: "partly",
            why: "The prior does add bias, and that's the point: a little bias buys a lot less variance when data is scarce. 80% is the right MLE but a poor estimate.",
          },
          {
            t: "Bayesian methods always give a lower number, which is safer to report.",
            verdict: "wrong",
            why: "The posterior moves towards the prior, which can be higher or lower than the data.",
          },
          {
            t: "The posterior is the average of the prior and the data.",
            verdict: "partly",
            why: "Close in spirit, since it's a weighted blend, but the weights depend on how much data you have compared with how sure the prior is.",
          },
        ],
      },
      readMore: [
        { title: "Maximum likelihood, clearly explained", by: "StatQuest (video)", url: "https://youtu.be/Dn6b9fCIUpM" },
        { title: "Bayesian Methods for Hackers", by: "Cameron Davidson-Pilon (free book with code)", url: "https://github.com/CamDavidsonPilon/Probabilistic-Programming-and-Bayesian-Methods-for-Hackers" },
        { title: "Pattern Recognition and Machine Learning, chapter 2", by: "Christopher Bishop (free PDF)", url: "https://www.microsoft.com/en-us/research/uploads/prod/2006/01/Bishop-Pattern-Recognition-and-Machine-Learning-2006.pdf" },
      ],
    },

    {
      id: "updating",
      history: "At Bletchley Park during the Second World War, Alan Turing and Jack Good updated their beliefs about German Enigma settings one clue at a time, adding up the weight of evidence in units Turing called bans. The same arithmetic, applied one observation at a time, is what this lesson is about.",
      gist: [
        "Today's conclusion is tomorrow's starting point: you update as each piece of evidence arrives.",
        "People who start with different beliefs end up agreeing once there's enough shared evidence.",
        "For common cases the update is just adding up counts.",
      ],
      practice: {
        adjust: [
          "The starting belief, especially for new products or small groups.",
          "Whether older data should count less over time, if the world changes.",
        ],
        wrong: [
          "Starting from scratch each time and throwing away what was already learned.",
          "Treating all data as equally current when the world has moved on.",
        ],
        notice: [
          "Estimates jumping around early on is expected; they should settle.",
          "Two teams with different starting beliefs converging is a sign there's enough data.",
        ],
        ask: [
          "How much of the current estimate comes from the prior, and how much from the data?",
          "Should older observations be given less weight?",
        ],
      },
      idea: (
        <p>
          Today's posterior is tomorrow's prior. Each new observation nudges your belief, and you never need to go back to the start. Two people who
          begin far apart but see the same evidence end up agreeing. How fast depends on how stubborn they were to begin with.
        </p>
      ),
      example: (
        <p>
          A sceptic thinks a new treatment works about 10% of the time; an enthusiast thinks 75%. Neither is unreasonable before any trials. As
          results come in, both update. After a handful of trials they still disagree. After a few hundred, they're quoting nearly the same number,
          because the evidence has drowned out where they started.
        </p>
      ),
      play: [
        {
          Sim: UpdateSim,
          try: "Click 'it worked' and 'it didn't' a few times and watch both curves move. Then add 100 trials at a time until they overlap. Change the true rate and repeat.",
        },
      ],
      how: (
        <>
          <p>
            Some prior and likelihood pairs are <strong>conjugate</strong>: the posterior is the same kind of distribution as the prior, only with
            updated numbers. Updating is then just arithmetic, no integrals.
          </p>
          <Table
            head={["Data", "Prior", "Update after seeing data"]}
            rows={[
              ["Yes/no outcomes (k of n)", "Beta(a, b)", "Beta(a + k, b + n − k)"],
              ["Counts in categories", "Dirichlet(α₁…α_K)", "Dirichlet(α₁ + n₁, …, α_K + n_K)"],
              ["Numbers with known noise σ²", "Normal(μ₀, τ²)", "Normal, with precision 1/τ² + n/σ² and a precision-weighted mean"],
              ["Counts per interval", "Gamma(α, β)", "Gamma(α + Σx, β + n)"],
            ]}
          />
          <p>
            Because the update only needs the totals (k and n here), it doesn't matter whether the data arrives all at once or one row at a time:
            you end up in the same place. Those totals are called <strong>sufficient statistics</strong>.
          </p>
          <p>
            Conjugacy isn't luck. All the likelihoods in the table belong to the <strong>exponential family</strong>, which can be written in one
            shape:
          </p>
          <Eq says="η: natural parameters · T(x): sufficient statistics · A(η): log-partition, which makes it sum to one">
            p(x | η) = h(x) · exp(ηᵀ T(x) − A(η))
          </Eq>
          <p>
            Bernoulli, binomial, Poisson, Gaussian, gamma, beta and Dirichlet all fit this form. Any member has a conjugate prior, its sufficient
            statistics have a fixed size however much data you have, and derivatives of <M>A(η)</M> give its mean and variance. It's also why
            generalised linear models (logistic and Poisson regression) share one fitting recipe.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "You start with a Beta(2, 2) prior and see 7 successes and 3 failures. What is the posterior mean, as a percentage?",
          answer: 64.29,
          tolerance: 0.6,
          unit: "%",
          why: "The posterior is Beta(2 + 7, 2 + 3) = Beta(9, 5). Its mean is 9 / 14 ≈ 64.3%.",
        },
        {
          kind: "task",
          q: "Add evidence until the sceptic and the optimist are within 5 percentage points of each other.",
          Sim: UpdateSim,
          check: (s) => s.n > 0 && s.gap < 0.05,
          done: "Different starting points, same evidence, nearly the same conclusion. The prior matters early and fades later.",
        },
        {
          kind: "choice",
          q: "Why can conjugate updates be done one observation at a time, in any order?",
          options: [
            { t: "The posterior depends only on running totals, which add up the same in any order.", ok: true, why: "Exactly. k and n don't care about order." },
            { t: "Because the prior is ignored after the first update.", why: "The prior stays in the totals forever; it just becomes a smaller share." },
            { t: "Because each observation is weighted by when it arrived.", why: "Standard conjugate updating weights every observation equally." },
            { t: "It can't; the order changes the answer.", why: "For independent observations it doesn't." },
          ],
        },
      ],
      explain: {
        q: "Which is the best plain-language description of Bayesian updating?",
        options: [
          {
            t: "Shift your belief towards what explains the evidence best, then repeat with the next piece.",
            verdict: "right",
            why: "That's Bayes' rule in words, including the part that makes it sequential.",
          },
          {
            t: "You replace your old belief with whatever the latest data says.",
            verdict: "wrong",
            why: "That throws away everything you knew. Updating blends, it doesn't replace.",
          },
          {
            t: "You average all the data you've seen so far, and that average is your belief.",
            verdict: "partly",
            why: "With a flat prior the posterior mean is close to the data average, but updating also tracks how sure you are, not just a single number.",
          },
          {
            t: "You keep your prior belief unless the new data is statistically significant, then swap it.",
            verdict: "wrong",
            why: "That's the logic of a hypothesis test. Bayesian updating moves a little with every observation.",
          },
        ],
      },
      readMore: [
        { title: "Bayesian statistics: a beginner's introduction", by: "Ben Lambert (video series)", url: "https://www.youtube.com/watch?v=P_og8H-VkIY" },
        { title: "Machine Learning: A Probabilistic Perspective", by: "Kevin Murphy (book site)", url: "https://probml.github.io/pml-book/book0.html" },
        { title: "Think Bayes", by: "Allen Downey (free book)", url: "https://allendowney.github.io/ThinkBayes2/" },
      ],
    },

    {
      id: "gaussians",
      history: "Carl Friedrich Gauss used the bell curve in 1809 to handle errors in astronomical measurements. In 1886 Francis Galton measured the heights of parents and their grown children and noticed that children of very tall parents were tall, but less extreme. He called it regression towards mediocrity; we still call it regression to the mean.",
      gist: [
        "When two quantities move together, knowing one narrows down the other.",
        "How much it helps depends on how strong the link (the correlation) is.",
        "Even fairly strong links shrink uncertainty less than people expect.",
      ],
      practice: {
        adjust: [
          "Which related measurements to feed in alongside the one you care about.",
          "How correlations are estimated, especially from few data points.",
        ],
        wrong: [
          "Assuming a strong correlation makes the prediction nearly certain.",
          "Treating variables as independent when they clearly move together.",
        ],
        notice: [
          "Compare the spread of predictions with and without the related variable.",
          "Look at a scatter plot before trusting a correlation number.",
        ],
        ask: [
          "How much does knowing X reduce our uncertainty about Y?",
          "Is the relationship roughly a straight line, or is the correlation hiding something?",
        ],
      },
      idea: (
        <p>
          When two uncertain quantities are linked, learning one tells you something about the other. A multivariate Gaussian is the simplest way to
          describe that link, and it has a lovely property: whatever you learn, the updated belief about the rest is still a Gaussian, with a formula
          you can write down.
        </p>
      ),
      example: (
        <p>
          Before you know anything about a stranger, your guess for their adult height is the population average, give or take a lot. Now you learn
          their parent is tall. Your guess moves up, and gets tighter, but not all the way to the parent's height, because the link is real but
          loose. How far it moves and how much tighter it gets both depend on the correlation.
        </p>
      ),
      play: [
        {
          Sim: GaussianSim,
          try: "Drag across the chart to pick a parent's height. Watch the orange curve on the right shift and narrow compared with the grey one. Then change the correlation: at 0 the parent tells you nothing; near 1 it tells you almost everything.",
        },
      ],
      how: (
        <>
          <p>
            A multivariate Gaussian is described by a mean vector <M>μ</M> and a covariance matrix <M>Σ</M>. The diagonal holds each variable's
            variance; the off-diagonal entries say how they move together. Its contours are ellipses, stretched along directions of high
            correlation.
          </p>
          <p>Split the variables into a part you'll observe (b) and a part you want (a). Two operations do almost everything:</p>
          <Eq says="marginalising: to ignore b, just drop its rows and columns">p(a) = N(μ_a, Σ_aa)</Eq>
          <Eq says="conditioning: what you learn about a once b is known">
            μ_a|b = μ_a + Σ_ab Σ_bb⁻¹ (b − μ_b), &nbsp; Σ_a|b = Σ_aa − Σ_ab Σ_bb⁻¹ Σ_ba
          </Eq>
          <p>
            In the two-variable case with equal spreads, that's <M>mean = μ + ρ(x − μ)</M> and <M>sd = σ√(1 − ρ²)</M>. Notice that the new spread
            doesn't depend on what value you observed, only on the correlation. And the mean moves only part of the way: this is regression to the
            mean, first measured in exactly this example, on parents' and children's heights.
          </p>
          <p>
            These two formulas carry a lot of machine learning: Kalman filters, linear-Gaussian state space models, Bayesian linear regression and,
            in two lessons' time, Gaussian processes, which are this same conditioning with infinitely many variables.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "Two variables each have standard deviation 10 and correlation 0.6. Once you know one exactly, what is the standard deviation of the other?",
          answer: 8,
          tolerance: 0.05,
          why: "σ√(1 − ρ²) = 10 × √(1 − 0.36) = 10 × 0.8 = 8.",
        },
        {
          kind: "task",
          q: "Find how strong the link must be before knowing the parent halves your uncertainty about the child (± 4.5 cm or less).",
          Sim: GaussianSim,
          check: (s) => s.condSd <= 4.5,
          done: "It takes a correlation of about 0.87. Even quite strong links shrink uncertainty less than people expect.",
        },
        {
          kind: "choice",
          q: "A very tall parent's child is predicted to be tall, but less tall than the parent. Why?",
          options: [
            { t: "The correlation is below 1, so the prediction moves only part way from the average.", ok: true, why: "Right. The prediction moves ρ of the way, not all the way." },
            { t: "Children are shorter than their parents on average, so the model shrinks the height.", why: "Not true; and by the same logic, very short parents' children are predicted to be taller than them." },
            { t: "The Gaussian thins out at the tails, so it can't place a child that far out.", why: "It can; the tails just get thinner." },
            { t: "Because the variance shrinks when you condition.", why: "It does shrink, but that's about how sure you are, not where the centre goes." },
          ],
        },
      ],
      explain: {
        q: "How would you explain conditioning a Gaussian to a friend?",
        options: [
          {
            t: "Learning one of two linked things shifts your guess about the other and sharpens it.",
            verdict: "right",
            why: "It covers both effects: the shift and the narrowing.",
          },
          {
            t: "You set the known variable to its value and the other one equals it.",
            verdict: "wrong",
            why: "Only with perfect correlation. Usually the shift is partial.",
          },
          {
            t: "You throw away the variables you don't care about and keep the rest exactly as they were.",
            verdict: "wrong",
            why: "That's marginalising, the other operation. Conditioning uses what you observed.",
          },
          {
            t: "It makes the distribution narrower, so the prediction is more certain.",
            verdict: "partly",
            why: "True, but it leaves out that the centre moves too, which is usually the part you care about.",
          },
        ],
      },
      readMore: [
        { title: "Pattern Recognition and Machine Learning, section 2.3", by: "Christopher Bishop (free PDF)", url: "https://www.microsoft.com/en-us/research/uploads/prod/2006/01/Bishop-Pattern-Recognition-and-Machine-Learning-2006.pdf" },
        { title: "Seeing Theory: regression", by: "Brown University (interactive)", url: "https://seeing-theory.brown.edu/regression-analysis/index.html" },
      ],
    },

    {
      id: "networks",
      history: "Judea Pearl coined the term Bayesian network in 1985 and set out the theory in a 1988 book, to let computers reason with uncertain evidence. The work earned him the Turing Award in 2011. The wet grass and sprinkler is the textbook example used ever since.",
      gist: [
        "A Bayesian network is a diagram of what directly influences what.",
        "From it you can work out the probability of anything, given whatever you've observed.",
        "Evidence flows in surprising ways: confirming one cause can make another less likely.",
      ],
      practice: {
        adjust: [
          "The structure: which arrows exist, usually from experts and data together.",
          "The probability tables, estimated from data or set by experts.",
        ],
        wrong: [
          "Drawing arrows from correlations alone and calling them causes.",
          "Forgetting that observing a shared effect links its causes.",
        ],
        notice: [
          "Predictions that feel wrong to experts often reveal a missing arrow.",
          "Test a few \"what if we observe X\" questions against common sense.",
        ],
        ask: [
          "Draw the diagram of what influences what before we fit anything.",
          "What happens to this prediction if we learn about the other possible cause?",
        ],
      },
      idea: (
        <p>
          With many variables, writing down every joint probability is hopeless. But most things depend directly on only a few others. Draw those
          direct dependencies as arrows and you get a Bayesian network: a picture that is also a recipe for every probability you might ask about.
        </p>
      ),
      example: (
        <p>
          You see that the grass is wet. Did it rain? Maybe, so rain becomes more likely than usual. Then you notice the sprinkler was on. Suddenly
          rain seems unlikely again: the sprinkler already explains the wet grass. Nobody told you anything about rain directly. Learning about one
          cause made the other less likely. That's called explaining away.
        </p>
      ),
      play: [
        {
          Sim: NetworkSim,
          try: "Click 'The grass is wet' once (seen: yes) and note the chance of rain. Then click 'Sprinkler was on' and watch rain drop. Try 'sprinkler: no' instead and see rain jump.",
        },
      ],
      how: (
        <>
          <p>A Bayesian network says the joint distribution factors into one small table per node, given its parents:</p>
          <Eq says="one table per arrow-target instead of one giant table">p(x₁, …, x_n) = Π p(x_i | parents(x_i))</Eq>
          <p>
            For the three yes/no variables here that saves nothing (1 + 2 + 4 = 7 numbers, the same as the full table), but for 30 variables
            with at most 3 parents each it's at most 240 numbers instead of about a billion. To answer a question like "rain, given wet grass", you sum over every
            combination of the unknowns (what the simulation does), or use smarter algorithms such as variable elimination or belief propagation.
          </p>
          <p>Three patterns decide when information flows:</p>
          <Table
            head={["Shape", "Example", "Does knowing the middle block the flow?"]}
            rows={[
              ["Chain A → B → C", "cloudy → rain → wet", "Yes: once you know it rained, clouds tell you nothing more about wet grass."],
              ["Fork A ← B → C", "rain → wet grass, rain → wet road", "Yes: given rain, the grass and road are independent."],
              ["Collider A → B ← C", "rain → wet ← sprinkler", "No, the opposite: rain and sprinkler are independent until you observe wet grass."],
            ]}
          />
          <p>
            A <strong>Markov random field</strong> uses undirected links instead, for things that influence each other symmetrically, like
            neighbouring pixels in an image or friends in a social network. It's written as a product of "compatibility" scores over groups of
            linked variables, divided by a normalising constant. Conditional random fields, used for labelling sequences, are a famous case.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "In this network, rain and the sprinkler are independent of each other until you observe the wet grass. What is this structure called?",
          options: [
            { t: "A collider", ok: true, why: "Right. Two arrows meet at one node, and observing it links its causes." },
            { t: "A chain, from rain through the grass to the sprinkler", why: "A chain passes influence along a line, and observing the middle blocks it." },
            { t: "A fork, with the grass as the common cause", why: "A fork has one common cause pointing to two effects." },
            { t: "A Markov blanket around the grass", why: "That's the set of nodes that shields one node from the rest: parents, children and the children's other parents." },
          ],
        },
        {
          kind: "task",
          q: "Find evidence that makes rain less likely than it was before you knew anything, even though the grass is wet.",
          Sim: NetworkSim,
          check: (s) => s.evidence.wet === true && s.rain < 0.2,
          done: "That's explaining away: the sprinkler accounts for the wet grass, so rain is no longer needed to explain it.",
        },
        {
          kind: "number",
          q: "A network over 10 yes/no variables has each variable with at most 2 parents. At most how many numbers does it need (one per row of each table)?",
          answer: 40,
          tolerance: 0,
          why: "Each node needs one probability per combination of its parents: at most 2² = 4. Ten nodes × 4 = 40, compared with 2¹⁰ − 1 = 1,023 for the full table.",
        },
      ],
      explain: {
        q: "Which is the best way to explain 'explaining away'?",
        options: [
          {
            t: "If two causes could explain an effect, confirming one makes the other less likely.",
            verdict: "right",
            why: "That's it, in one sentence.",
          },
          {
            t: "When you observe an effect, all its causes become more likely.",
            verdict: "partly",
            why: "That's the first half: seeing wet grass does raise both rain and sprinkler. Explaining away is what happens after you then learn one of them.",
          },
          {
            t: "Independent causes stay independent whatever you observe.",
            verdict: "wrong",
            why: "Observing their common effect makes them dependent. That's the surprise.",
          },
          {
            t: "A Bayesian network can't represent two causes of one effect.",
            verdict: "wrong",
            why: "It can; that's exactly the collider in the simulation.",
          },
        ],
      },
      readMore: [
        { title: "Probabilistic graphical models, lecture series", by: "CMU 10-708 (video)", url: "https://youtu.be/TuGDMj43ehw" },
        { title: "pgmpy", by: "Python library for graphical models", url: "https://pgmpy.org/" },
        { title: "Pattern Recognition and Machine Learning, chapter 8", by: "Christopher Bishop (free PDF)", url: "https://www.microsoft.com/en-us/research/uploads/prod/2006/01/Bishop-Pattern-Recognition-and-Machine-Learning-2006.pdf" },
      ],
    },

    {
      id: "gaussian-processes",
      history: "In 1951 Danie Krige, a South African mining engineer, needed to estimate how much gold lay between boreholes. His method, later formalised by Georges Matheron and named kriging after him, is Gaussian process regression. Machine learning rediscovered it in the 1990s, notably through Christopher Williams and Carl Rasmussen.",
      gist: [
        "A Gaussian process fits a smooth curve through data and gives an error bar everywhere.",
        "The error bar is small near measurements and grows where there are none.",
        "How it behaves (smooth, wiggly, repeating) is set by the kernel you choose.",
      ],
      practice: {
        adjust: [
          "The kernel and its length scale: how far each point's influence reaches.",
          "The noise level, so it doesn't chase every wobble.",
        ],
        wrong: [
          "Running it on hundreds of thousands of points without an approximation; it gets very slow.",
          "Extrapolating far from the data and trusting the line while ignoring the widening band.",
        ],
        notice: [
          "The band should widen in gaps. If it doesn't, the length scale is too long.",
          "Check that the fitted kernel settings make sense in your units.",
        ],
        ask: [
          "Show me the prediction with its uncertainty band, including beyond the data.",
          "What length scale was fitted, and what does that mean in our units?",
        ],
      },
      idea: (
        <p>
          Instead of picking a formula and fitting its numbers, a Gaussian process starts with a belief about what kind of function you're looking
          for: smooth, wiggly, repeating. Every measurement pins the function down near that point. Far from your data it admits it doesn't know,
          and the error bars say so.
        </p>
      ),
      example: (
        <p>
          You're mapping air temperature along a mountain road with a handful of sensors. Between two nearby sensors, the temperature is probably
          somewhere in between, and you're fairly sure. Halfway across a long gap, you're much less sure. Past the last sensor, you have little more
          than a guess. A GP gives you exactly that picture, with a band that pinches at each sensor and swells in the gaps.
        </p>
      ),
      play: [
        {
          Sim: GPSim,
          try: "Click to add measurements and watch the band pinch around them. Shrink the reach and the function gets wigglier, with uncertainty swelling quickly between points. Switch to 'repeating' and add points in one cycle: the GP copies the pattern into the others.",
        },
      ],
      how: (
        <>
          <p>
            A GP says: any finite set of function values <M>f(x₁), …, f(x_n)</M> is jointly Gaussian, with covariance given by a{" "}
            <strong>kernel</strong> <M>k(x, x′)</M> that says how alike two inputs' outputs should be.
          </p>
          <Eq says="the RBF kernel: nearby inputs have similar outputs; ℓ is the length scale (the reach)">k(x, x′) = σ² exp(−(x − x′)² / 2ℓ²)</Eq>
          <p>Prediction is then the Gaussian conditioning from two lessons ago, with the kernel filling in the covariances:</p>
          <Eq says="K: kernel between training points, k*: between a test point and the training points, σ_n²: noise">
            mean = k*ᵀ (K + σ_n² I)⁻¹ y, &nbsp; variance = k(x*, x*) − k*ᵀ (K + σ_n² I)⁻¹ k*
          </Eq>
          <p>
            Kernels can be combined. A periodic kernel captures seasons; adding a slowly varying RBF captures a trend; multiplying them gives a
            season whose shape drifts. The classic demonstration is atmospheric CO₂, a rising trend with a yearly cycle.
          </p>
          <p>
            The catch is cost: inverting <M>K</M> takes time proportional to n³, which limits exact GPs to a few thousand points. Sparse and
            approximate GPs (inducing points, GPyTorch) push that much further. The kernel's settings are usually fitted by maximising the marginal
            likelihood, which automatically balances fit against complexity.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "You shrink the RBF kernel's length scale a lot. What happens to the predictions between two distant measurements?",
          options: [
            { t: "The mean falls back to the prior and the band widens.", ok: true, why: "Right. With a short reach, points far from data get almost no information." },
            { t: "The predictions get more confident everywhere, since the kernel is sharper.", why: "The opposite: confidence now drops off quickly away from each point." },
            { t: "The function becomes a straight line between points.", why: "That's closer to what a very long length scale does." },
            { t: "Nothing; the length scale only matters for noise.", why: "Noise has its own setting. The length scale controls smoothness and reach." },
          ],
        },
        {
          kind: "task",
          q: "Make the GP confident everywhere: get the widest uncertainty below ± 0.5.",
          Sim: GPSim,
          check: (s) => s.maxSd < 0.25,
          done: "You needed points spread across the whole range, or a long reach. A GP can only be sure where it has evidence, or where you've told it the function is smooth.",
        },
        {
          kind: "multi",
          q: "Which are true of exact Gaussian process regression? Pick all that apply.",
          options: [
            { t: "Its cost grows with the cube of the number of training points.", ok: true, why: "Inverting the n × n kernel matrix is O(n³)." },
            { t: "It gives an uncertainty for every prediction.", ok: true, why: "The predictive variance comes for free." },
            { t: "Its behaviour is controlled by the choice of kernel.", ok: true, why: "The kernel is the prior: it decides smoothness, periodicity and scale." },
            { t: "It needs a fixed formula, like a polynomial, chosen in advance.", why: "No. It's non-parametric: the kernel replaces the formula." },
          ],
        },
      ],
      explain: {
        q: "How would you describe a Gaussian process to someone who knows linear regression?",
        options: [
          {
            t: "Assume nearby inputs give similar outputs; you get a curve with error bars.",
            verdict: "right",
            why: "It captures the kernel idea, the flexibility and the honest uncertainty.",
          },
          {
            t: "It's ordinary linear regression with Gaussian noise added to every measurement.",
            verdict: "partly",
            why: "Bayesian linear regression is in fact a GP with a linear kernel, but GPs are far more flexible than that.",
          },
          {
            t: "It fits a very high-degree polynomial and then smooths it out.",
            verdict: "wrong",
            why: "There's no polynomial. The function is described by its covariance between points.",
          },
          {
            t: "It's a neural network with one hidden layer and Gaussian weights.",
            verdict: "wrong",
            why: "There is a connection (an infinitely wide network becomes a GP), but that's a deep result, not a description.",
          },
        ],
      },
      readMore: [
        { title: "A visual exploration of Gaussian processes", by: "Distill (interactive article)", url: "https://distill.pub/2019/visual-exploration-gaussian-processes/" },
        { title: "Gaussian Processes for Machine Learning", by: "Rasmussen and Williams (free book; chapter 2 is the core)", url: "https://gaussianprocess.org/gpml/" },
        { title: "Gaussian processes", by: "Richard Turner, Cambridge (video)", url: "https://youtu.be/92-98SYOdlY" },
        { title: "Gaussian process regression", by: "scikit-learn user guide", url: "https://scikit-learn.org/stable/modules/gaussian_process.html" },
      ],
    },

    {
      id: "mcmc",
      history: "In 1953 at Los Alamos, Nicholas Metropolis, Arianna and Marshall Rosenbluth, and Augusta and Edward Teller used one of the first computers to simulate atoms with a random walk. W. K. Hastings generalised it in 1970, and from around 1990 it transformed Bayesian statistics, because suddenly almost any model could be fitted.",
      gist: [
        "When the maths has no neat answer, you can still get one by sampling.",
        "MCMC wanders over the possible answers, spending time in each in proportion to how likely it is.",
        "Tools like PyMC and Stan do the sampling; your job is checking it worked.",
      ],
      practice: {
        adjust: [
          "Number of chains and samples, and the length of the warm-up.",
          "The model itself; rewriting it in a different but equivalent form often fixes sampling problems.",
        ],
        wrong: [
          "Using results from chains that never mixed or settled.",
          "Ignoring sampler warnings such as divergences.",
        ],
        notice: [
          "R-hat close to 1.00 and a healthy effective sample size.",
          "Trace plots that look like fuzzy caterpillars, not slow drifts.",
        ],
        ask: [
          "What are R-hat and the effective sample size for the main parameters?",
          "Did the sampler report any divergences or other warnings?",
        ],
      },
      idea: (
        <p>
          Most real posteriors have no neat formula. But you don't need the formula if you can collect samples from it. MCMC sends a walker around
          the space of possible answers, with one rule: it can always step uphill, and sometimes downhill. Over time, the walker spends time in each
          place in proportion to how probable it is. Its footprints become the distribution.
        </p>
      ),
      example: (
        <p>
          Imagine mapping a dark, hilly park by walking it blindfolded. At each step you test a spot nearby. Higher ground? Move there. Lower? Move
          only sometimes, more rarely the steeper the drop. Count where you spent your time and you've mapped the hills, without ever seeing the
          whole park at once.
        </p>
      ),
      play: [
        {
          Sim: MCMCSim,
          try: "Start with a step size of 0.3: the walker accepts nearly every step but never finds the second hill. Try 6: it finds both hills but wastes most proposals. Find a size in between where the bars match the dashed shape.",
        },
      ],
      how: (
        <>
          <p>The Metropolis–Hastings recipe, for a target density p(θ) you can compute up to a constant:</p>
          <ol>
            <li>From the current θ, propose θ′ (for example θ plus a little Gaussian noise).</li>
            <li>Accept with probability min(1, p(θ′) / p(θ)). (With a lopsided proposal, also multiply by the ratio of proposal densities.)</li>
            <li>If accepted, move to θ′; otherwise stay put and count θ again.</li>
          </ol>
          <p>
            Only the ratio matters, so the normalising constant <M>p(data)</M>, usually the impossible part, cancels out. That's the whole trick.
          </p>
          <p>Practical points:</p>
          <ul>
            <li>
              <strong>Step size</strong>: too small and the walker crawls and gets stuck; too big and almost every proposal is rejected. For simple
              random walks an acceptance rate around 25 to 50% is a common target.
            </li>
            <li>
              <strong>Burn-in</strong>: early samples still remember the starting point; throw them away.
            </li>
            <li>
              <strong>Diagnostics</strong>: run several chains from different starts. If they disagree (R̂ well above 1) or the effective sample size
              is small, don't trust the result.
            </li>
          </ul>
          <p>
            Modern samplers like <strong>Hamiltonian Monte Carlo</strong> and its self-tuning version <strong>NUTS</strong> use the gradient of the
            log density to glide along the hills instead of stumbling, which makes them far more efficient in many dimensions. They're the default
            in PyMC and Stan: you write the model, and the sampler does the rest.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "Why can Metropolis–Hastings sample from a posterior whose normalising constant you can't compute?",
          options: [
            { t: "It only uses ratios of the density, where the constant cancels.", ok: true, why: "Right. p(θ′)/p(θ) is the same whether or not you divide both by p(data)." },
            { t: "It estimates the constant first, then samples.", why: "It never needs the constant at all." },
            { t: "It uses the prior instead of the posterior.", why: "It targets the posterior; it just never normalises it." },
            { t: "It only works for conjugate models, where the constant is known.", why: "Conjugate models don't need MCMC. It's for everything else." },
          ],
        },
        {
          kind: "task",
          q: "Find a step size where, after at least 2,000 steps, the walker spends between 28% and 42% of its time on the right-hand hill (the truth is 35%).",
          Sim: MCMCSim,
          check: (s) => s.count >= 2000 && s.rightShare >= 0.28 && s.rightShare <= 0.42,
          done: "A step big enough to cross the valley but not so big that everything is rejected. Notice the acceptance rate where it worked.",
        },
        {
          kind: "choice",
          q: "Four chains started in different places give clearly different averages. What should you conclude?",
          options: [
            { t: "They haven't converged, so nothing can be trusted yet.", ok: true, why: "Right. This is what R̂ measures." },
            { t: "Average the four chains together; that fixes it.", why: "Averaging chains that disagree hides the problem; it doesn't solve it." },
            { t: "Keep the chain that reached the highest density, since it found the peak.", why: "That throws away the evidence that something is wrong." },
            { t: "The posterior has four peaks, and each chain found one.", why: "Possibly, but you can't tell until the chains mix between them." },
          ],
        },
      ],
      explain: {
        q: "A friend asks what MCMC actually does. Which answer would you give?",
        options: [
          {
            t: "A random walk that visits each value in proportion to its probability.",
            verdict: "right",
            why: "That's the key property, stated without jargon.",
          },
          {
            t: "It finds the most probable value of the parameters.",
            verdict: "wrong",
            why: "That's optimisation (MAP). MCMC explores the whole distribution, including the less likely parts.",
          },
          {
            t: "It draws independent random samples from the posterior.",
            verdict: "partly",
            why: "It draws samples from the posterior, but consecutive samples are correlated, which is why effective sample size matters.",
          },
          {
            t: "It computes the posterior exactly by trying every value.",
            verdict: "wrong",
            why: "That's grid enumeration, impossible in many dimensions. MCMC only visits where it matters.",
          },
        ],
      },
      readMore: [
        { title: "MCMC interactive gallery", by: "Chi Feng (try many samplers)", url: "https://chi-feng.github.io/mcmc-demo/" },
        { title: "Markov chain Monte Carlo", by: "ritvikmath (video)", url: "https://youtu.be/yApmR-c_hKU" },
        { title: "PyMC documentation", by: "probabilistic programming in Python", url: "https://www.pymc.io/welcome.html" },
        { title: "Bayesian Methods for Hackers, chapter 3", by: "Cameron Davidson-Pilon (free book)", url: "https://github.com/CamDavidsonPilon/Probabilistic-Programming-and-Bayesian-Methods-for-Hackers" },
      ],
    },
  ],
};
