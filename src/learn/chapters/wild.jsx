// Chapter: machine learning after the notebook — serving, versions, drift,
// A/B tests, retraining, fairness, and recommender systems.
import React from "react";
import { Eq } from "../kit";
import { AbSim, DriftSim, FairSim, RecSim, RetrainSim, ServeSim, VersionSim } from "../sims/wild";

export default {
  history: "For most of machine learning's history the work ended with a good score on a test set. As models moved into products in the 2010s, Google's 2015 paper on the 'hidden technical debt' of ML systems made the point that the model is a small part of the system; MLOps grew up to handle the rest.",
  lessons: [
    {
      id: "serving",
      title: "From notebook to service",
      lead: "Serving a model: latency, throughput and batching.",
      history: "Early production models were rewritten by engineers into the company's main code. Dedicated model servers arrived in the late 2010s, Google's TensorFlow Serving in 2016 and NVIDIA's Triton in 2018, built around the trade-off between answering each request fast and answering many at once.",
      gist: [
        "In production a model is a service: requests come in, predictions go out, under a time budget.",
        "Batching requests together uses the hardware better but makes each one wait for the batch.",
        "The right batch size depends on traffic: what's ideal at rush hour is slow at night.",
      ],
      practice: {
        adjust: ["Batch size and how long to wait for a batch to fill.", "The hardware, and how many copies of the model run.", "A smaller or quantised model (see the vision chapter) when latency is tight."],
        wrong: ["Load near capacity: the queue grows and waits explode.", "Latency measured as an average, hiding the slow 1% of requests.", "The model in production differing from the one tested (different preprocessing)."],
        notice: ["Track the 95th and 99th percentile latency, not just the mean.", "Watch utilisation: above about 70–80%, queues start to grow fast."],
        ask: ["What's our latency budget, at the 99th percentile?", "What happens to latency at twice today's peak traffic?"],
      },
      idea: (
        <p>
          A model in a notebook answers when you run a cell. In a product it's a service answering thousands of requests a minute, each within a time
          budget. Graphics cards are fastest working on many inputs at once, so servers group requests into batches; but a request that has to wait
          for its batch to fill is a request that waits.
        </p>
      ),
      example: (
        <>
          <p>A photo app checks every upload with a vision model and must answer within 200 ms.</p>
          <p>
            One-at-a-time serving copes at night but falls over at 7 pm, when the queue grows faster than it drains. Batches of 8 handle more than
            three times the traffic. At 3 am, though, waiting for 8 uploads to arrive takes too long, so the server sends whatever it has after 20 ms.
          </p>
        </>
      ),
      play: [{ Sim: ServeSim, try: "At 60 requests a second, find the batch size with the shortest wait. Then raise the traffic to 150 and find it again." }],
      how: (
        <>
          <p>Each batch has a fixed start-up cost plus a cost per request, so bigger batches serve more requests a second:</p>
          <Eq says="t₀ is the fixed cost per batch, t₁ the cost per request, b the batch size">
            capacity = b / (t₀ + t₁·b)
          </Eq>
          <p>
            But each request also waits for its batch to fill, and for the batches ahead of it. As the load (traffic divided by capacity) approaches 1,
            queueing time grows without limit, roughly in proportion to load / (1 − load). That's why servers run with headroom.
          </p>
          <p>
            Real servers use <strong>dynamic batching</strong>: collect requests up to a maximum batch size or a maximum wait, whichever comes first.
            Latency is reported as percentiles (p50, p95, p99), because users notice the slow tail, not the average.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "A batch costs 20 ms to start plus 4 ms per request. How many requests a second can batches of 5 handle?",
          answer: 125,
          tolerance: 1,
          why: "A batch of 5 takes 20 + 4 × 5 = 40 ms, so 1000 / 40 = 25 batches a second, × 5 = 125 requests.",
        },
        {
          kind: "choice",
          q: "Why report the 99th-percentile latency rather than the average?",
          options: [
            { t: "Users notice the slowest requests; averages hide them.", ok: true, why: "A good average can hide 1 request in 100 taking seconds." },
            { t: "Because averages are harder to compute.", why: "They're easier. The point is what they hide." },
            { t: "The 99th percentile is always lower.", why: "It's always at least as high as the median." },
            { t: "It's what service agreements legally require.", why: "It's simply what reflects user experience." },
          ],
        },
        { kind: "task", q: "At 150 requests a second, find a batch size that keeps the wait under 200 ms.", Sim: ServeSim, check: (s) => s.traffic >= 150 && s.latency != null && s.latency < 200, done: "Under heavy traffic, batching is what keeps the queue from running away." },
      ],
      explain: {
        q: "Why not always use the biggest batch the hardware can take?",
        options: [
          { t: "Requests wait for the batch to fill, which is slow when traffic is light.", verdict: "right", why: "Throughput and latency pull against each other; the best batch depends on traffic." },
          { t: "Big batches give less accurate predictions, since each one gets less attention.", verdict: "wrong", why: "Accuracy doesn't depend on how requests are grouped." },
          { t: "Because big batches use more memory than the server can always spare.", verdict: "partly", why: "They do, but within what the hardware can take, waiting time is the main reason." },
          { t: "You should: bigger batches are always faster per request.", verdict: "wrong", why: "Faster in total, slower for each request when traffic is light." },
        ],
      },
      readMore: [
        { title: "Rules of machine learning", by: "Martin Zinkevich, Google", url: "https://developers.google.com/machine-learning/guides/rules-of-ml" },
        { title: "Dynamic batching", by: "NVIDIA Triton documentation", url: "https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html" },
        { title: "Designing Machine Learning Systems", by: "Chip Huyen (book)", url: "https://huyenchip.com/books/" },
      ],
    },

    {
      id: "versioning",
      title: "Which model was that?",
      lead: "Versioning data, code and models so results can be repeated.",
      history: "Software engineers have versioned code since the 1970s. Machine learning added two more things that change a result, the data and the randomness, and tools to track them appeared in the late 2010s: DVC for data (2017) and MLflow for experiments and models (2018).",
      gist: [
        "A model is the product of its data, its code, its settings and its random seed.",
        "Change any of them unrecorded, and you can't rebuild the model or explain why it changed.",
        "Record all four for every model you ship, so any prediction can be traced back.",
      ],
      practice: {
        adjust: ["Record the data version, code commit, settings and seed with every trained model.", "Register models with a stage (staging, production) and an owner."],
        wrong: ["'It got better' with no record of what changed.", "A production model nobody can rebuild.", "The training data overwritten in place."],
        notice: ["Try rebuilding last month's model from its records: do you get the same numbers?", "Every model in production should link to its training run."],
        ask: ["Which data version and commit is the model in production built from?", "Can we roll back to the previous model in five minutes?"],
      },
      idea: (
        <p>
          Retrain the same model twice and you may get two different models: the data was refreshed overnight, someone tweaked a feature, the random
          start was different. Each change is small, but together they mean nobody can say why this week's model behaves differently from last
          week's. The fix is boring and essential: record exactly what went into every model.
        </p>
      ),
      example: (
        <>
          <p>A fraud model's catch rate drops after a routine retrain. The team can't tell whether it was new data, a code change or bad luck.</p>
          <p>
            After they start pinning data snapshots, commits and seeds, the next drop is traced in an hour: a supplier changed a date format, and a
            feature quietly became empty.
          </p>
        </>
      ),
      play: [{ Sim: VersionSim, try: "Train a few times with nothing pinned, then pin one thing at a time. When do repeated runs agree exactly?" }],
      how: (
        <>
          <p>Think of a trained model as a function of everything that went into it:</p>
          <Eq says="change any input and the output can change">model = train(data, code, settings, seed)</Eq>
          <p>
            Reproducibility means recording all four. <strong>Code</strong>: the commit hash. <strong>Data</strong>: an immutable snapshot or a content
            hash (tools like DVC or lakeFS). <strong>Settings</strong>: logged with the run (MLflow, Weights & Biases). <strong>Seed</strong>: fixed and
            logged, though some GPU operations still vary slightly between runs.
          </p>
          <p>
            A <strong>model registry</strong> stores each trained model with those records and its test results, and marks which version is in
            production, so you can compare, promote and roll back.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "multi",
          q: "Which must be recorded to rebuild a model exactly?",
          options: [
            { t: "The data version", ok: true, why: "Different data, different model." },
            { t: "The code commit", ok: true, why: "Features and training code change results." },
            { t: "The random seed", ok: true, why: "Initialisation and shuffling depend on it." },
            { t: "The name of the person who trained it", why: "Useful to know, but it doesn't change the model." },
          ],
        },
        {
          kind: "choice",
          q: "A model in production starts misbehaving. What does a model registry let you do first?",
          options: [
            { t: "Roll back, and see exactly what changed.", ok: true, why: "Stop the damage, then investigate with the records." },
            { t: "Retrain it from scratch on the latest data.", why: "Without knowing what changed, you may reproduce the problem." },
            { t: "Delete the model so it stops serving.", why: "Then nothing is serving predictions." },
            { t: "Nothing; registries are just storage.", why: "Their point is promotion, comparison and rollback." },
          ],
        },
        { kind: "task", q: "Get three runs in a row that agree exactly.", Sim: VersionSim, check: (s) => s.pinned && s.same, done: "Only with all three pinned is the model reproducible." },
      ],
      explain: {
        q: "Why version data, not just code?",
        options: [
          { t: "The same code on different data gives a different model.", verdict: "right", why: "In ML, data is as much a part of the 'program' as the code." },
          { t: "Because data is bigger than code, so it's the riskier thing to lose.", verdict: "wrong", why: "Size isn't the reason; its effect on the model is." },
          { t: "For backups, in case the data store fails.", verdict: "partly", why: "That's a benefit, but the main point is being able to rebuild and compare models." },
          { t: "It isn't needed if the code is versioned, since code produces the data.", verdict: "wrong", why: "Code alone can't rebuild a model trained on last month's data." },
        ],
      },
      readMore: [
        { title: "MLflow model registry", by: "MLflow documentation", url: "https://mlflow.org/docs/latest/model-registry.html" },
        { title: "Get started with DVC", by: "DVC documentation", url: "https://dvc.org/doc/start" },
        { title: "Hidden technical debt in machine learning systems", by: "Sculley et al. (2015)", url: "https://papers.nips.cc/paper/5656-hidden-technical-debt-in-machine-learning-systems" },
      ],
    },

    {
      id: "drift",
      title: "The world moves on",
      lead: "Data drift: when live data stops looking like training data.",
      history: "Statisticians called it 'dataset shift' and studied it from the 1990s; spam filters met it first in practice, as spammers adapted. The COVID-19 pandemic in 2020 broke models everywhere at once, from demand forecasts to fraud detection, and made drift monitoring standard.",
      gist: [
        "A model learns the world as it was in its training data; the world keeps changing.",
        "When live inputs drift away from training inputs, accuracy usually falls, often silently.",
        "You can watch the inputs' distributions long before the true answers arrive.",
      ],
      practice: {
        adjust: ["Which features to monitor, and how often.", "Alarm thresholds (PSI above 0.1 or 0.25 are common starting points)."],
        wrong: [
          "No monitoring: the first sign of drift is an angry customer.",
          "Alarms on every tiny wiggle, so everyone ignores them.",
          "Concept drift: the inputs look the same but what they mean has changed, which input monitoring can't see.",
        ],
        notice: ["Compare this week's distribution of each important feature with the training data.", "Check the predictions' distribution too: a sudden jump in 'yes' is a clue."],
        ask: ["Which features drifted most this month?", "When the true labels arrive, how far has accuracy actually fallen?"],
      },
      idea: (
        <p>
          A model is a snapshot of the past. If customers get younger, prices rise, or a new phone changes how photos look, the model meets inputs
          unlike anything it learned from, and its accuracy drops without any error message. Drift monitoring compares what the model sees now with
          what it was trained on.
        </p>
      ),
      example: (
        <>
          <p>A lender's credit model was trained on applicants aged mostly 30–50. A new app partnership brings in thousands of applicants in their early twenties.</p>
          <p>
            Repayment results won't arrive for months, but the age distribution shifts within a week. The drift alarm fires, and the team reviews
            the new applicants by hand before trusting the model on them.
          </p>
        </>
      ),
      play: [{ Sim: DriftSim, try: "Move the customers' ages and watch the drift score. Where does it cross 0.1, and 0.25?" }],
      how: (
        <>
          <p>A common drift score is the <strong>population stability index</strong>, comparing the share of data in each bin, training (p) against live (q):</p>
          <Eq says="summed over bins; 0 means identical">
            PSI = Σ (q<sub>i</sub> − p<sub>i</sub>) · ln(q<sub>i</sub> / p<sub>i</sub>)
          </Eq>
          <p>
            Rules of thumb: under 0.1 stable, 0.1–0.25 worth a look, above 0.25 a real shift. Other tests (Kolmogorov–Smirnov, Wasserstein distance)
            do the same job. They need no labels, which matters because true outcomes often arrive weeks late.
          </p>
          <p>
            There are kinds of drift: <strong>covariate drift</strong>, where the inputs change (the example); <strong>label drift</strong>, where the
            share of each outcome changes; and <strong>concept drift</strong>, where the same inputs now lead to different outcomes. Only the last
            needs labels to detect, and all of them usually end in retraining.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "A PSI of 0.32 on an important feature means:",
          options: [
            { t: "A real shift worth investigating", ok: true, why: "Above 0.25 is the usual 'significant shift' threshold." },
            { t: "The model is 32% less accurate", why: "PSI measures how the inputs changed, not accuracy." },
            { t: "Nothing much, since it's well below 1", why: "PSI values are usually small; 0.32 is large." },
            { t: "The model must be retired at once", why: "It needs investigating, maybe retraining, not deleting." },
          ],
        },
        {
          kind: "choice",
          q: "Why monitor input drift if you could just measure accuracy?",
          options: [
            { t: "Outcomes arrive late; inputs arrive at once.", ok: true, why: "Input drift is an early warning." },
            { t: "Accuracy can't be measured in production.", why: "It can, once the labels arrive. Drift monitoring is faster." },
            { t: "Drift and accuracy are the same thing.", why: "Inputs can drift without hurting accuracy, and accuracy can fall without input drift (concept drift)." },
            { t: "Drift is much cheaper to compute than accuracy.", why: "Perhaps, but timing is the main reason." },
          ],
        },
        { kind: "task", q: "Find a shift that pushes the drift score past 0.25.", Sim: DriftSim, check: (s) => s.psi > 0.25, done: "That would page someone. Notice it happened before a single label arrived." },
      ],
      explain: {
        q: "What is data drift?",
        options: [
          { t: "Live data growing unlike the training data, so accuracy can quietly fall.", verdict: "right", why: "Clear about the cause and the silent effect." },
          { t: "The model slowly forgetting what it learned as time passes.", verdict: "wrong", why: "The model doesn't change; the world it's applied to does." },
          { t: "Changes in the data over time, in any column.", verdict: "partly", why: "True, but the point is the mismatch with training data and its effect on accuracy." },
          { t: "A bug somewhere in the data pipeline that quietly corrupts some of the model's inputs.", verdict: "partly", why: "Pipeline bugs can look like drift, and monitoring catches both, but drift is usually the real world changing." },
        ],
      },
      readMore: [
        { title: "Data distribution shifts and monitoring", by: "Chip Huyen", url: "https://huyenchip.com/2022/02/07/data-distribution-shifts-and-monitoring.html" },
        { title: "Dataset Shift in Machine Learning", by: "Quiñonero-Candela et al. (MIT Press, 2009)", url: "https://mitpress.mit.edu/9780262545877/dataset-shift-in-machine-learning/" },
      ],
    },

    {
      id: "ab-testing",
      title: "Let the users decide",
      lead: "A/B testing a new model against the old one.",
      history: "Randomised experiments go back to Ronald Fisher's crop trials at Rothamsted in the 1920s. Online companies scaled them up in the 2000s; Microsoft, Google and Amazon now run thousands of experiments a year, and a better offline score only counts once it wins one.",
      gist: [
        "A better test-set score doesn't prove a model helps users; an experiment does.",
        "Split users randomly between old and new, and compare what they do.",
        "Small improvements need many users before the difference stands out from chance.",
      ],
      practice: {
        adjust: ["The metric that decides it, chosen before the test starts.", "How many users and how long, worked out in advance.", "The share of traffic the new model gets."],
        wrong: [
          "Peeking every day and stopping when it looks good, which inflates false wins.",
          "Too few users: a real improvement looks like noise.",
          "Comparing different weeks instead of the same time, so a holiday decides the winner.",
        ],
        notice: ["Check the split really is 50/50 and random.", "Look at guardrail metrics (complaints, latency) as well as the main one."],
        ask: ["How many users do we need to detect a one-point improvement?", "What will we do if the result is inconclusive?"],
      },
      idea: (
        <p>
          The new recommendation model scored better on last month's data. Does it actually get more people to buy? The only way to know is to run
          both at once on randomly split users and compare. Randomness makes the groups alike in every other way, so a difference in behaviour is down
          to the model.
        </p>
      ),
      example: (
        <>
          <p>A shop tests a new recommendation model: half its visitors see the old one, half the new.</p>
          <p>
            After a week, 10.0% of the old group bought something and 11.0% of the new group. With 1,000 visitors in each group, that one-point
            difference could easily be luck. With 10,000 each, it's clear. The team planned for 10,000 before starting, so they waited.
          </p>
        </>
      ),
      play: [{ Sim: AbSim, try: "With a true improvement of 1 point, run the test several times at 1,000 users, then at 10,000. How often does it spot the difference?" }],
      how: (
        <>
          <p>Compare the two conversion rates with a two-proportion z-test:</p>
          <Eq says="p̂ is the pooled rate, n the users per group">
            z = (p<sub>B</sub> − p<sub>A</sub>) / √( p̂(1 − p̂)(1/n<sub>A</sub> + 1/n<sub>B</sub>) )
          </Eq>
          <p>
            A p-value under 0.05 means a difference this big would be unusual if the models were really equal. The 95% interval for the difference is
            more useful still: it shows how big the effect plausibly is.
          </p>
          <p>
            <strong>Power</strong> is the chance a test spots an improvement that's really there. It grows with the number of users and the size of
            the effect, so work out the sample size before starting, and don't stop early because it looks good on a given day.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "The 95% interval for the improvement is −0.4 to +2.1 percentage points. What do you conclude?",
          options: [
            { t: "They can't be told apart yet.", ok: true, why: "It might help, or do nothing, or hurt a little." },
            { t: "The new model is better by 0.85 points.", why: "That's the middle of the interval, but zero is still plausible." },
            { t: "The new model is probably worse, since it can be negative.", why: "Most of the interval is above zero; it's inconclusive, not worse." },
            { t: "The test is broken: an interval can't cross zero.", why: "Inconclusive results are normal, especially with few users." },
          ],
        },
        {
          kind: "choice",
          q: "Why split users randomly rather than giving the new model to new customers?",
          options: [
            { t: "So the groups differ only in which model they got.", ok: true, why: "Any other split mixes up the model's effect with the groups' differences." },
            { t: "Random splits are easier to code and maintain.", why: "Maybe, but the reason is fairness of the comparison." },
            { t: "New customers buy too little to measure anything.", why: "They might buy differently, which is exactly the problem with that split." },
            { t: "It makes the test finish sooner, with fewer users.", why: "Randomisation doesn't change the length; it makes it valid." },
          ],
        },
        { kind: "task", q: "Set up a test that spots a 1-point improvement at least 80% of the time.", Sim: AbSim, check: (s) => s.lift === 1 && s.power >= 0.8, done: "That needs several thousand users per group. That's why the sample size is planned first." },
      ],
      explain: {
        q: "Why A/B test a model that already scored better on the test set?",
        options: [
          { t: "The test set is past data; only an experiment shows what users do now.", verdict: "right", why: "Offline scores and business outcomes often disagree." },
          { t: "Because the test set might have been wrong.", verdict: "partly", why: "Possible, but even a perfect test set can't show the effect on behaviour." },
          { t: "It's a formality before release that confirms the test-set score on a few more users.", verdict: "wrong", why: "Many offline wins turn out neutral or negative online." },
          { t: "To make it faster, by tuning it on live traffic.", verdict: "wrong", why: "An experiment measures effect, not speed." },
        ],
      },
      readMore: [
        { title: "How not to run an A/B test", by: "Evan Miller", url: "https://www.evanmiller.org/how-not-to-run-an-ab-test.html" },
        { title: "Sample size calculator", by: "Evan Miller", url: "https://www.evanmiller.org/ab-testing/sample-size.html" },
        { title: "Trustworthy Online Controlled Experiments", by: "Kohavi, Tang and Xu (book)", url: "https://experimentguide.com/" },
      ],
    },

    {
      id: "retraining",
      title: "When to retrain",
      lead: "Keeping a model fresh without wasting effort.",
      history: "Retraining was a manual project until the mid-2010s. Continuous training, pipelines that rebuild and test models automatically on new data, became a pillar of MLOps from around 2018, alongside continuous integration for code.",
      gist: [
        "Accuracy decays as the world drifts from the training data.",
        "Retraining on fresh data resets it, but each retrain costs compute and checking.",
        "Retrain on a schedule matched to how fast your world changes, or when monitoring says so.",
      ],
      practice: {
        adjust: ["A schedule (weekly, monthly) or a trigger (drift alarm, accuracy drop).", "How much recent data to train on.", "The checks a new model must pass before it replaces the old one."],
        wrong: ["Retraining automatically on bad data and shipping a worse model.", "Never retraining a model in a fast-changing world.", "Retraining so often that nobody can review the changes."],
        notice: ["Plot accuracy over time since the last retrain to see how fast it decays.", "Always compare the new model with the current one on the same recent test data."],
        ask: ["How much does accuracy drop per month without retraining?", "What automatic checks stop a bad retrain from shipping?"],
      },
      idea: (
        <p>
          A model starts stale the day it's deployed and gets staler. Retraining on recent data brings it back up, but every retrain costs compute,
          review time and a little risk. The question is how often, and the answer depends on how fast your world changes.
        </p>
      ),
      example: (
        <>
          <p>A grocery demand forecast loses about 0.15 accuracy points a day as prices and habits shift.</p>
          <p>
            Never retrained, it falls below the business's minimum within three months. Retrained monthly, it stays comfortably above. Retrained daily,
            it's barely better than monthly, at thirty times the cost and review effort.
          </p>
        </>
      ),
      play: [{ Sim: RetrainSim, try: "Find the longest gap between retrains that never dips below the minimum. Then speed up the change and find it again." }],
      how: (
        <>
          <p>If accuracy falls by d each day and you retrain every N days, the model is on average N/2 days stale, so roughly:</p>
          <Eq says="a₀ is accuracy just after retraining">
            average accuracy ≈ a₀ − d · N / 2
          </Eq>
          <p>
            Halving N halves the loss but doubles the retrains. Pick N where the remaining loss is small compared with the cost, or retrain when drift
            monitoring fires instead of on a timer.
          </p>
          <p>
            Every retrain should go through the same gate: train on fresh data, evaluate on a recent held-out period, compare with the current model,
            and promote only if it's at least as good. Automated, this is <strong>continuous training</strong>.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "Accuracy starts at 0.92 and falls 0.002 a day. Retraining every 30 days, what's the average accuracy? (two decimals)",
          answer: 0.89,
          tolerance: 0.006,
          why: "Average staleness is about 15 days: 0.92 − 0.002 × 15 = 0.89.",
        },
        {
          kind: "choice",
          q: "A retrain finishes overnight. What should happen before it serves users?",
          options: [
            { t: "Check it beats the current model on recent data.", ok: true, why: "A gate stops a bad retrain (bad data, a bug) from shipping." },
            { t: "Deploy it straight away; newer is better.", why: "Newer data can be broken data. Check first." },
            { t: "Wait a month in case the data changes again.", why: "That throws away the freshness you retrained for." },
            { t: "Ask a few users which answers they prefer.", why: "That's an A/B test, which can come after the offline check." },
          ],
        },
        { kind: "task", q: "Keep the lowest point above 85% with as few retrains as you can (no more than 4 in six months).", Sim: RetrainSim, check: (s) => s.retrains > 0 && s.retrains <= 4 && s.low > 0.85, done: "Matched to the pace of change, a handful of retrains keeps it healthy." },
      ],
      explain: {
        q: "How do you decide how often to retrain?",
        options: [
          { t: "Retrain often enough to stay above the minimum accuracy, and no more.", verdict: "right", why: "It's a trade-off between staleness and cost, set by data." },
          { t: "As often as possible, since fresher data is always better.", verdict: "wrong", why: "Past a point each retrain costs more than it gains, and adds risk." },
          { t: "Whenever any of the data changes, so the model never falls behind the world.", verdict: "partly", why: "Drift-triggered retraining is valid, but data always changes a little; it needs a threshold." },
          { t: "Once a year, when the business plans are reviewed.", verdict: "wrong", why: "A fixed number ignores how fast your world changes." },
        ],
      },
      readMore: [
        { title: "MLOps: continuous delivery and automation pipelines in machine learning", by: "Google Cloud", url: "https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning" },
        { title: "Rules of machine learning", by: "Martin Zinkevich, Google", url: "https://developers.google.com/machine-learning/guides/rules-of-ml" },
      ],
    },

    {
      id: "fairness",
      title: "Fair for whom?",
      lead: "Checking that a model's mistakes don't fall on one group.",
      history: "ProPublica's 2016 investigation of the COMPAS reoffending score found it wrongly flagged Black defendants as high-risk about twice as often as white defendants. Researchers then proved that several reasonable definitions of fairness can't all hold at once, which made fairness a choice to be argued, not a box to tick.",
      gist: [
        "A model can be accurate overall and still make far more mistakes for one group.",
        "One cut-off applied to everyone can treat groups unequally if the model scores them differently.",
        "Measure error rates per group, decide which kind of fairness matters for your use, and fix the data or the decision.",
      ],
      practice: {
        adjust: ["Which error rates to compare across groups (false negatives, false positives, approval rates).", "The data, to cover under-represented groups better.", "Decision thresholds, within what the law allows."],
        wrong: [
          "Only checking overall accuracy.",
          "Dropping the sensitive column and assuming that fixes it, when other columns (postcode, school) stand in for it.",
          "Picking a fairness metric after seeing which one looks best.",
        ],
        notice: ["Break every evaluation metric down by group.", "Look at who the model is least sure about; thin data often means a thin record."],
        ask: ["What's the false-negative rate for each group?", "Which groups are under-represented in the training data?"],
      },
      idea: (
        <p>
          A loan model can be right 85% of the time overall and still turn away twice as many good payers from one group. That happens when the model
          is less sure about people with thinner records, often the young, rural or new to banking, and one cut-off is applied to everyone. Overall
          accuracy hides it; per-group error rates show it.
        </p>
      ),
      example: (
        <>
          <p>A lender's model scores applicants from rural districts lower for the same repayment behaviour, because they have shorter credit histories.</p>
          <p>
            At one cut-off, 40% of rural good payers are refused against 12% in the city. The team adds better data (mobile-wallet repayment
            records), and while they collect it, reviews borderline rural applications by hand.
          </p>
        </>
      ),
      play: [{ Sim: FairSim, try: "Look at the refusal rates for good payers in each group. Then try separate cut-offs: can you close the gap, and what does it cost?" }],
      how: (
        <>
          <p>Compare error rates between groups, for example the false-negative rate (good payers refused):</p>
          <Eq says="computed separately for each group">FNR = good payers refused / all good payers</Eq>
          <p>Common definitions of fairness ask for different things to be equal across groups:</p>
          <ul>
            <li>
              <strong>Demographic parity</strong>: the same approval rate.
            </li>
            <li>
              <strong>Equal opportunity</strong>: the same rate of good payers approved (equal FNR).
            </li>
            <li>
              <strong>Calibration</strong>: a score means the same chance of repaying in every group.
            </li>
          </ul>
          <p>
            When groups differ in their underlying rates, these can't all hold at once, so you have to choose which matters for the decision at hand.
            Fixes include better data for the group the model is unsure about, adjusting thresholds where it's lawful, or human review near the cut-off.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "Of 200 good payers in a group, 30 are refused. What is that group's false-negative rate? (between 0 and 1)",
          answer: 0.15,
          tolerance: 0.005,
          why: "30 / 200 = 0.15.",
        },
        {
          kind: "choice",
          q: "Why doesn't removing the 'district' column make a model fair?",
          options: [
            { t: "Other columns carry the same information.", ok: true, why: "Proxies let the model rebuild what you removed." },
            { t: "Trained models still remember columns they were given once.", why: "Retrained without it, the model never sees district. What it does see are the columns that stand in for it." },
            { t: "It does make it fair, if district was the only problem.", why: "Usually not: the pattern survives through correlated columns." },
            { t: "Because fairness only depends on accuracy.", why: "Fairness is about how errors fall across groups, not overall accuracy." },
          ],
        },
        { kind: "task", q: "Bring the gap in good payers refused under 5 percentage points.", Sim: FairSim, check: (s) => s.gap < 0.05, done: "It took treating the groups differently, which may or may not be allowed or wanted. That's the real decision." },
      ],
      explain: {
        q: "A model is 85% accurate. Is it fair?",
        options: [
          { t: "Accuracy can't say; you need each group's error rates, and a choice of fairness.", verdict: "right", why: "Fairness is about who bears the errors, and it involves a choice." },
          { t: "Yes: 85% is good, so it treats people well overall.", verdict: "wrong", why: "The 15% of errors could fall mostly on one group." },
          { t: "Only if it doesn't use any sensitive columns, like gender, caste or religion, as its inputs.", verdict: "partly", why: "That's one check, but proxies mean it isn't enough." },
          { t: "Fairness can't be measured, so accuracy is the best guide.", verdict: "wrong", why: "It can, per group, once you choose a definition." },
        ],
      },
      readMore: [
        { title: "Fairness and Machine Learning", by: "Barocas, Hardt and Narayanan (free book)", url: "https://fairmlbook.org/" },
        { title: "Machine bias", by: "ProPublica (2016)", url: "https://www.propublica.org/article/machine-bias-risk-assessments-in-criminal-sentencing" },
        { title: "Fairness", by: "Google Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course/fairness" },
      ],
    },

    {
      id: "recommenders",
      title: "People who liked this also liked…",
      lead: "Recommender systems and the hidden tastes behind ratings.",
      history: "Amazon's 'customers who bought this also bought' launched in the late 1990s. The Netflix Prize (2006–2009) offered a million dollars to beat Netflix's own film recommender by 10%; the winners leaned on matrix factorisation, which finds hidden tastes in a grid of ratings.",
      gist: [
        "A recommender predicts how much someone would like things they haven't seen yet.",
        "Collaborative filtering learns from everyone's ratings: people who agreed before tend to agree again.",
        "Matrix factorisation describes each person and each item by a few hidden tastes, and multiplies them.",
      ],
      practice: {
        adjust: ["How many hidden tastes (factors) to learn.", "Mixing in item details (genre, price) for new items nobody has rated.", "What to optimise: clicks, purchases, or long-term satisfaction."],
        wrong: [
          "New users and new items with no history (the cold-start problem).",
          "Feedback loops: it recommends popular things, they get more popular, and the long tail vanishes.",
          "Optimising clicks and promoting clickbait.",
        ],
        notice: ["Evaluate on ratings held out in time (the future), not at random.", "Track how varied recommendations are, not just how accurate."],
        ask: ["What does a brand-new user see?", "What share of recommendations come from the 100 most popular items?"],
      },
      idea: (
        <p>
          Nobody has rated every film. But if you and a friend agreed about ten films, you'll probably agree about the eleventh. Collaborative
          filtering turns that into maths: it fills in the blanks in a big grid of who rated what, using everyone's ratings at once.
        </p>
      ),
      example: (
        <>
          <p>A streaming app has six viewers and six films, with a third of the ratings missing.</p>
          <p>
            Matrix factorisation finds two hidden tastes, which turn out to be roughly "likes action" and "likes romance". Anu loved two action films,
            so her unseen action film is predicted near 4 and her unseen romance near 2; the app recommends the action film.
          </p>
        </>
      ),
      play: [{ Sim: RecSim, try: "Tap each viewer's name and see what's recommended. Then try one hidden taste and three: which fits the known ratings best?" }],
      how: (
        <>
          <p>Give each user u a short vector of tastes p<sub>u</sub> and each item i a vector of qualities q<sub>i</sub>. A predicted rating is their match:</p>
          <Eq says="μ is the average rating; the dot product measures how well tastes and qualities line up">
            r̂<sub>ui</sub> = μ + p<sub>u</sub> · q<sub>i</sub>
          </Eq>
          <p>
            The vectors are learned by gradient descent on the known ratings, with a penalty to stop them overfitting (regularisation again). Nobody
            names the tastes; they emerge from the data, often lining up with genres or moods.
          </p>
          <p>
            Modern systems are larger versions of the same idea: two-tower neural networks embed users and items in the same space (the embedding
            lesson, again), retrieve candidates by closeness, then a second model ranks them. Cold start is handled by using item details and the new
            user's first few clicks.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "number",
          q: "The average rating is 3. A user's tastes are (1, 0) and a film's qualities are (1.5, 2). What rating is predicted?",
          answer: 4.5,
          tolerance: 0.01,
          why: "3 + (1 × 1.5 + 0 × 2) = 3 + 1.5 = 4.5.",
        },
        {
          kind: "choice",
          q: "Why do brand-new films get recommended poorly by collaborative filtering?",
          options: [
            { t: "Nobody has rated them yet.", ok: true, why: "Item details or a bit of exploration are needed until ratings arrive." },
            { t: "New films are worse on average, and it learns that.", why: "Quality has nothing to do with it." },
            { t: "The model is set to skip items under a month old.", why: "It simply has no data about them." },
            { t: "Their titles aren't in its vocabulary yet.", why: "Collaborative filtering doesn't read titles." },
          ],
        },
        { kind: "task", q: "Find what the model recommends to Deepa, who likes romance.", Sim: RecSim, check: (s) => s.who === 3 && s.pick.startsWith("Romance"), done: "It worked out her taste only from the pattern of ratings." },
      ],
      explain: {
        q: "How does 'people who liked this also liked…' work?",
        options: [
          { t: "It learns hidden tastes from everyone's ratings and matches yours to items.", verdict: "right", why: "Collaborative filtering in a sentence." },
          { t: "It recommends the most popular items among all the people like you.", verdict: "wrong", why: "That's a baseline. A recommender personalises." },
          { t: "It finds people similar to you and shows what they liked.", verdict: "partly", why: "That's neighbourhood-based filtering, a close cousin; factorisation does it through shared hidden tastes." },
          { t: "Someone tags each film by genre and mood, and it matches those tags to what you watched.", verdict: "wrong", why: "That's content-based filtering; collaborative filtering needs no tags." },
        ],
      },
      readMore: [
        { title: "Recommendation systems", by: "Google Machine Learning course", url: "https://developers.google.com/machine-learning/recommendation" },
        { title: "Matrix factorization techniques for recommender systems", by: "Koren, Bell and Volinsky (2009)", url: "https://ieeexplore.ieee.org/document/5197422" },
      ],
    },
  ],
};
