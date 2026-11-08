// Chapter: time series and forecasting.
import React from "react";
import { Eq, M, Table } from "../kit";
import { ACFSim, BacktestSim, ComponentsSim, FanSim, ForecastSim, HierarchySim, MetricsSim, MLForecastSim, StationaritySim } from "../sims/time";

export default {
  history: "Most of the forecasting toolkit was built in the 1950s to 70s for inventory, economics and engineering. Forecasting competitions since 1982 have kept everyone honest, and since 2018 machine learning has joined the winners.",
  lessons: [
    {
      id: "components",
      title: "Don't shuffle the calendar",
      lead: "What a time series is, and the four parts most of them are made of.",
      history: "Governments needed to know whether unemployment had really risen or it was just January, so statisticians built seasonal adjustment. The US Census Bureau's X-11 method (1965) did it for official statistics for decades, and STL, published in 1990 by Robert Cleveland and colleagues, is the flexible version most people use today.",
      gist: [
        "A time series is data where order matters: today depends on yesterday.",
        "Most series are a trend, a season, longer cycles and noise added together.",
        "Pulling them apart (decomposition) is the first thing to look at.",
      ],
      practice: {
        adjust: [
          "The time step (daily, weekly, monthly) you aggregate to.",
          "How missing periods are filled, using only the past.",
        ],
        wrong: [
          "Shuffling rows, or splitting train and test at random.",
          "Filling gaps with values computed from the future.",
        ],
        notice: [
          "A decomposition plot shows which part dominates.",
          "Sudden breaks (a new pricing policy, a pandemic) that no past pattern explains.",
        ],
        ask: [
          "Show me the series split into trend, season and what's left.",
          "Were there events that changed the pattern?",
        ],
      },
      idea: (
        <p>
          In most datasets you can shuffle the rows and nothing changes. In a time series the order is the whole point: today depends on
          yesterday. Most series are a few simple patterns stacked on top of each other: a slow trend, a season that repeats, longer swings, and
          noise. Pull them apart and each one is easy to understand.
        </p>
      ),
      example: (
        <p>
          An ice-cream shop's monthly sales. They've grown a little every year as the shop got known (trend). Every summer they peak and every
          winter they dip (season). In a recession year, the whole curve sags for a while (cycle). And any given month is a bit up or down for no
          reason anyone can name (noise). Forecasting means projecting the first three forward and being honest about the fourth.
        </p>
      ),
      play: [
        {
          Sim: ComponentsSim,
          try: "Turn every part off except one, then add them back one at a time. Notice how quickly noise and a business cycle make the season hard to see by eye.",
        },
      ],
      how: (
        <>
          <Table
            head={["Part", "What it is", "Example"]}
            rows={[
              ["Trend", "the long-run direction", "a growing customer base"],
              ["Seasonality", "a pattern with a fixed period, tied to the calendar", "summer peaks, Monday dips, the 6 pm rush"],
              ["Cycle", "rises and falls with no fixed period", "business cycles lasting several years"],
              ["Noise", "what's left: random variation", "a rainy weekend"],
            ]}
          />
          <p>The parts can combine in two ways:</p>
          <Eq says="additive: the season adds the same amount every year">y = trend + season + noise</Eq>
          <Eq says="multiplicative: the season is a percentage, so it grows with the trend">y = trend × season × noise</Eq>
          <p>
            Taking the log turns a multiplicative series into an additive one, which is why logs show up so often in forecasting. Decomposition
            methods such as <strong>STL</strong> (seasonal-trend decomposition using LOESS) split a real series into these parts so you can look at
            each one.
          </p>
          <p>
            Two more distinctions you'll meet: <strong>univariate</strong> series have one variable over time, <strong>multivariate</strong>{" "}
            series have several that influence each other (sales and price, say). And the practical first steps with any series are the same: give
            it a proper date index, resample it to the frequency you care about (daily to monthly, summing or averaging), and decide how to fill
            gaps, usually by carrying the last value forward or interpolating, never by borrowing from the future.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "A shop's sales rise every December, and the December peak gets bigger each year as the shop grows. Which description fits best?",
          options: [
            { t: "A trend with multiplicative seasonality", ok: true, why: "Right. The season scales with the level, so it's a percentage effect. A log would make it additive." },
            { t: "A trend with additive seasonality", why: "Additive seasonality would add the same amount every December, not a growing one." },
            { t: "A business cycle", why: "Cycles have no fixed period. A December peak is tied to the calendar." },
            { t: "Pure noise", why: "A peak every December is a pattern, not noise." },
          ],
        },
        {
          kind: "task",
          q: "Build a series where the season accounts for more than 70% of the wiggle.",
          Sim: ComponentsSim,
          check: (s) => s.seasonShare > 0.7,
          done: "A strongly seasonal series like this is exactly where 'same month last year' becomes a strong forecast. You'll see that in a later lesson.",
        },
        {
          kind: "multi",
          q: "Which of these are fine ways to fill a missing month in a sales series you'll forecast from? Pick all that apply.",
          options: [
            { t: "Carry the previous month's value forward", ok: true, why: "Uses only the past, so it's safe." },
            { t: "Interpolate between the months either side, for a gap inside your training data", ok: true, why: "Fine inside history. Just never interpolate using data after the point you forecast from." },
            { t: "Fill with the average of the whole series, including the test period", why: "That leaks the future into the past." },
            { t: "Fill with the same month from the previous year", ok: true, why: "A sensible seasonal fill that uses only the past." },
          ],
        },
      ],
      explain: {
        q: "Why can't you treat a time series like any other table of data?",
        options: [
          {
            t: "Because each value depends on the ones before it, the order carries information. Shuffling destroys it, and any test must only use the past to predict the future.",
            verdict: "right",
            why: "Both consequences in one: order is information, and evaluation must respect it.",
          },
          {
            t: "Because time series always have a trend.",
            verdict: "wrong",
            why: "Many don't. Stationary series have no trend at all, and they're still time series.",
          },
          {
            t: "Because you need special software for dates.",
            verdict: "wrong",
            why: "Dates are just an index. The difference is statistical, not technical.",
          },
          {
            t: "Because the rows aren't independent.",
            verdict: "partly",
            why: "That's the technical core, but the practical consequence (never let the future into training) is what bites people.",
          },
        ],
      },
      readMore: [
        { title: "Forecasting: Principles and Practice, time series patterns", by: "Hyndman and Athanasopoulos (free book)", url: "https://otexts.com/fpp3/tspatterns.html" },
        { title: "STL decomposition", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/stl.html" },
        { title: "Time series analysis", by: "statsmodels documentation", url: "https://www.statsmodels.org/stable/tsa.html" },
      ],
    },

    {
      id: "stationarity",
      title: "Making a series sit still",
      lead: "Stationarity, logs and differencing.",
      history: "George Box and Gwilym Jenkins' 1970 book made 'difference the series until it's stationary' the standard first step in forecasting. David Dickey and Wayne Fuller gave us a test for it in 1979, and the KPSS test, which asks the opposite question, followed in 1992.",
      gist: [
        "Many models assume a series behaves the same way all the time.",
        "Logs steady a growing spread; differences remove trends and seasons.",
        "You forecast the steady version, then undo the steps.",
      ],
      practice: {
        adjust: [
          "Whether to take the log, and how many regular and seasonal differences.",
          "Which tests to rely on: ADF and KPSS together.",
        ],
        wrong: [
          "Differencing a series that was already steady, which adds noise.",
          "Modelling raw prices, which wander like a random walk.",
        ],
        notice: [
          "Rolling mean and spread that stay flat after transforming.",
          "Leftover errors with no trend or season remaining.",
        ],
        ask: [
          "What transformations were applied before modelling?",
          "What do the ADF and KPSS tests say after transforming?",
        ],
      },
      idea: (
        <p>
          Many forecasting models assume the series behaves the same way throughout: same average, same spread, same rhythm. That's called
          stationary. Real series rarely are, but you can usually make them so: take the log to steady the spread, and look at changes instead of
          levels to remove the drift. Forecast the steady version, then undo the steps.
        </p>
      ),
      example: (
        <p>
          A share price wanders: last year's average says almost nothing about next year's. But the monthly <em>return</em>, the percentage
          change, hovers around a small number year after year. That's why financial models work with returns, the log of today's price minus the
          log of yesterday's, rather than prices.
        </p>
      ),
      play: [
        {
          Sim: StationaritySim,
          try: "Start with the share price: try the log, then the change from last month. Then switch to monthly sales, which grows and has a season; it needs more than one step. The temperature anomaly is already stationary.",
        },
      ],
      how: (
        <>
          <p>A series is (weakly) stationary when its mean and variance are constant, and the correlation between two points depends only on how far apart they are, not when.</p>
          <Table
            head={["Problem", "Fix", "In pandas"]}
            rows={[
              ["Spread grows with the level", "take the log (or a Box–Cox transform)", "np.log(y)"],
              ["Level drifts (a trend or random walk)", "difference: y_t − y_{t−1}", "y.diff()"],
              ["Seasonal pattern", "seasonal difference: y_t − y_{t−12}", "y.diff(12)"],
            ]}
          />
          <p>Two standard tests, which ask opposite questions:</p>
          <ul>
            <li>
              <strong>ADF</strong> (augmented Dickey–Fuller): the starting assumption is "this series wanders like a random walk". A small p-value
              (below 0.05) lets you reject that, so the series looks stationary.
            </li>
            <li>
              <strong>KPSS</strong>: the starting assumption is "this series is stationary". A small p-value says it isn't.
            </li>
          </ul>
          <p>
            Running both helps: if ADF says stationary and KPSS agrees, you're in good shape. The simulation uses a simpler rough check (does the
            mean or spread change between halves, does it remember last month almost perfectly, does it repeat yearly), which is the intuition these
            tests formalise.
          </p>
          <p>
            Don't over-difference. Differencing a series that's already stationary adds noise and creates a fake negative correlation between
            neighbouring values. The number of differences needed becomes the <M>d</M> in ARIMA.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Make the monthly sales series stationary.",
          Sim: StationaritySim,
          check: (s) => s.kind === "sales" && s.stationary,
          done: "It took the log (to steady the growing season), a change from the same month last year (to remove the season), and a change from last month (to remove what was left of the drift).",
        },
        {
          kind: "choice",
          q: "An ADF test on a share price gives a p-value of 0.62. What does that suggest?",
          options: [
            { t: "You can't reject a random walk: the series is probably not stationary, so difference it.", ok: true, why: "Right. ADF's starting assumption is non-stationary, and 0.62 is nowhere near small enough to reject it." },
            { t: "The series is stationary.", why: "That would need a small p-value from ADF. A large one means no evidence of stationarity." },
            { t: "There's a 62% chance the series is stationary.", why: "A p-value isn't the probability that a hypothesis is true." },
            { t: "The series has a season.", why: "ADF doesn't test for seasonality." },
          ],
        },
        {
          kind: "choice",
          q: "Why take the log before differencing monthly sales whose summer peaks get bigger every year?",
          options: [
            { t: "The log turns growing, percentage-style swings into constant ones, so the spread stops growing.", ok: true, why: "Exactly. After the log, a 20% summer bump is the same size every year." },
            { t: "The log removes the trend.", why: "The log keeps the trend (as a straight line); differencing removes it." },
            { t: "Models can't handle large numbers.", why: "Size isn't the problem. Changing spread is." },
            { t: "It makes the series positive.", why: "Sales are already positive; the log needs them to be." },
          ],
        },
      ],
      explain: {
        q: "How would you explain stationarity to a teammate who's new to forecasting?",
        options: [
          {
            t: "A stationary series behaves the same way at every point in time: same average, same spread, same rhythm. Models learned on one stretch of it then apply to the next, which is why we transform series until they look like that.",
            verdict: "right",
            why: "It defines it and says why anyone cares.",
          },
          {
            t: "A stationary series is one that doesn't change.",
            verdict: "wrong",
            why: "Stationary series move all the time. It's their statistical behaviour that stays the same.",
          },
          {
            t: "A series with no trend.",
            verdict: "partly",
            why: "No trend is necessary but not enough. A season or a changing spread also breaks stationarity.",
          },
          {
            t: "A series where every value is independent of the others.",
            verdict: "wrong",
            why: "That's white noise, one special stationary series. Most stationary series have memory.",
          },
        ],
      },
      readMore: [
        { title: "Stationarity and differencing", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/stationarity.html" },
        { title: "Stationarity and detrending (ADF/KPSS)", by: "statsmodels examples", url: "https://www.statsmodels.org/stable/examples/notebooks/generated/stationarity_detrending_adf_kpss.html" },
      ],
    },

    {
      id: "memory",
      title: "Echoes of last month",
      lead: "Autocorrelation, partial autocorrelation, and reading AR and MA patterns.",
      history: "In 1927 Udny Yule modelled the number of sunspots each year as a weighted echo of the previous years, the first autoregressive model. The same year Eugen Slutsky showed that averaging random shocks produces wave-like patterns, the idea behind moving-average models.",
      gist: [
        "Autocorrelation shows how much a value resembles its own past values.",
        "Slowly fading memory suggests an AR model; a single sharp echo suggests MA.",
        "The same plot of the leftover errors tells you whether a model missed something.",
      ],
      practice: {
        adjust: [
          "How many past steps (lags) to consider.",
          "The seasonal period to check: 7 for daily data with a weekly cycle, 12 for monthly.",
        ],
        wrong: [
          "Reading every small bar as meaningful.",
          "Skipping the check of the leftover errors after fitting.",
        ],
        notice: [
          "Spikes at seasonal lags in the leftover errors mean a missing seasonal term.",
          "A Ljung–Box test that fails means pattern is left over.",
        ],
        ask: [
          "Show me the ACF and PACF of the residuals.",
          "Is anything left at the seasonal lag?",
        ],
      },
      idea: (
        <p>
          The autocorrelation function (ACF) asks: how alike is this month to the month before? To the one before that? Plotting the answers shows a
          series' memory. The partial version (PACF) asks the same question but strips out what's already explained by the months in between, so
          you see only direct links. Together they hint at which model to use.
        </p>
      ),
      example: (
        <p>
          A warm room cools slowly: if it's warm at 3 pm it's probably still warm at 4 pm, and somewhat warm at 5 pm, because each hour inherits
          from the last. That's an AR pattern, slow fading memory. Now a shop that runs one-day promotions: a promotion today lifts tomorrow's
          sales a little (people come back), but by the day after it's forgotten. That's an MA pattern: a shock with a short, sharp echo.
        </p>
      ),
      play: [
        {
          Sim: ACFSim,
          try: "With θ at 0, raise φ: the ACF fades slowly while the PACF has a single spike. Now set φ to 0 and raise θ: the ACF has a single spike while the PACF fades. Try negative values too.",
        },
      ],
      how: (
        <>
          <Eq says="AR(p): today is a weighted sum of the last p values, plus a new shock">
            y<sub>t</sub> = φ<sub>1</sub> y<sub>t−1</sub> + … + φ<sub>p</sub> y<sub>t−p</sub> + ε<sub>t</sub>
          </Eq>
          <Eq says="MA(q): today is a new shock plus echoes of the last q shocks">
            y<sub>t</sub> = ε<sub>t</sub> + θ<sub>1</sub> ε<sub>t−1</sub> + … + θ<sub>q</sub> ε<sub>t−q</sub>
          </Eq>
          <Table
            head={["Pattern", "ACF", "PACF"]}
            rows={[
              ["AR(p)", "fades away gradually", "cuts off after lag p"],
              ["MA(q)", "cuts off after lag q", "fades away gradually"],
              ["ARMA(p, q)", "fades", "fades"],
              ["Seasonal", "spikes at 12, 24, …", "spike at 12"],
            ]}
          />
          <p>
            Bars inside the band ±1.96/√n are what you'd expect from pure noise, so only bars poking out count. Real data is messier than the
            simulation, and ARMA patterns are hard to read by eye, which is why automated order selection exists (next lessons).
          </p>
          <p>
            The same plot is also your best check after fitting a model: the leftover errors (residuals) should have no bars outside the band. If
            they do, there's pattern left to model. The Ljung–Box test does that check formally.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "choice",
          q: "A stationary series has an ACF that fades slowly and a PACF with significant spikes at lags 1 and 2 only. What's a sensible first model?",
          options: [
            { t: "AR(2)", ok: true, why: "Right. PACF cutting off after lag 2 is the AR(2) signature." },
            { t: "MA(2)", why: "MA(2) would show the cut-off in the ACF, not the PACF." },
            { t: "AR(20)", why: "No need: the PACF says only two lags have direct effects." },
            { t: "White noise", why: "White noise has no bars outside the band at all." },
          ],
        },
        {
          kind: "task",
          q: "Make a pure MA(1)-style series: φ at zero and a strong θ, so the ACF has one clear spike at lag 1 and nothing after.",
          Sim: ACFSim,
          check: (s) => Math.abs(s.phi) < 0.05 && Math.abs(s.theta) >= 0.5,
          done: "One spike in the ACF, a fading PACF: the mirror image of the AR pattern.",
        },
        {
          kind: "choice",
          q: "After fitting a model, the residuals' ACF has a large spike at lag 12. What does it tell you?",
          options: [
            { t: "There's yearly seasonality the model hasn't captured.", ok: true, why: "Right. Add a seasonal term, as in SARIMA." },
            { t: "The model is perfect.", why: "Perfect residuals have no spikes at all." },
            { t: "The data has 12 missing values.", why: "The ACF says nothing about missing values." },
            { t: "You should difference the residuals.", why: "You fix the model, not the residuals." },
          ],
        },
      ],
      explain: {
        q: "Which is the best plain description of the PACF?",
        options: [
          {
            t: "It shows how directly each past value is linked to today, after removing the influence of the values in between.",
            verdict: "right",
            why: "That's the 'partial' part, said simply.",
          },
          {
            t: "It's the ACF of half the series.",
            verdict: "wrong",
            why: "Partial refers to removing intermediate effects, not to using part of the data.",
          },
          {
            t: "It shows the correlation between today and k months ago.",
            verdict: "partly",
            why: "That's the plain ACF. The PACF removes the indirect route through the months in between.",
          },
          {
            t: "It measures seasonality.",
            verdict: "wrong",
            why: "It can reveal seasonality as a spike at the seasonal lag, but that's not what it is.",
          },
        ],
      },
      readMore: [
        { title: "Autocorrelation", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/acf.html" },
        { title: "Non-seasonal ARIMA models", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/non-seasonal-arima.html" },
      ],
    },

    {
      id: "classical",
      title: "Beat 'same as last year' first",
      lead: "Naive, seasonal naive, moving averages and exponential smoothing.",
      history: "Exponential smoothing came from practical jobs in the 1950s: Robert Brown used it for US Navy inventory and tracking, Charles Holt added a trend in 1957, and Peter Winters added seasons in 1960. From 1982 Spyros Makridakis ran forecasting competitions that kept finding these simple methods hard to beat.",
      gist: [
        "Simple forecasts such as \"same as last year\" are often hard to beat.",
        "Exponential smoothing weights recent data more; Holt–Winters adds trend and season.",
        "Every fancy model should be compared with these baselines.",
      ],
      practice: {
        adjust: [
          "Which baseline to compare against: naive or seasonal naive.",
          "The smoothing weights, usually fitted automatically.",
        ],
        wrong: [
          "Reporting a complex model's accuracy with no baseline beside it.",
          "Using a method without a season on clearly seasonal data.",
        ],
        notice: [
          "MASE below 1 means you beat the naive forecast.",
          "A flat forecast for data that's clearly seasonal.",
        ],
        ask: [
          "How does it compare with \"same as last year\"?",
          "Which smoothing settings were fitted, and do they make sense?",
        ],
      },
      idea: (
        <p>
          Before any clever model, try the dumb ones: "same as last month", "same as this month last year", "the average of recent months".
          They're often surprisingly good, and any fancy model has to beat them to earn its place. Exponential smoothing is the polished version:
          an average that trusts recent months more than old ones.
        </p>
      ),
      example: (
        <p>
          A bakery forecasts tomorrow's croissant orders. "Same as today" works on ordinary days but fails every Monday. "Same as last Monday"
          handles the weekly rhythm. Weighting the last few Mondays, with the most recent counting most, smooths out one-off oddities. That last
          idea, plus a trend term and a season term, is Holt–Winters.
        </p>
      ),
      play: [
        {
          Sim: ForecastSim,
          try: "Compare the last value with same month last year: the season matters. Then try exponential smoothing at different α, and finally Holt–Winters, which models level, trend and season together.",
        },
      ],
      how: (
        <>
          <Table
            head={["Method", "Forecast", "Good for"]}
            rows={[
              ["Naive", "the last value", "random walks, like prices"],
              ["Seasonal naive", "the value one season ago", "strong, stable seasons"],
              ["Moving average", "the mean of the last k values", "noisy, flat series"],
              ["Simple exponential smoothing", "a weighted average, weights shrinking by (1 − α) per step back", "flat series with a level that shifts"],
              ["Holt", "level plus trend", "trending series"],
              ["Holt–Winters", "level plus trend plus season", "trending, seasonal series"],
            ]}
          />
          <Eq says="the new level is a blend of the latest value and the old level">
            ℓ<sub>t</sub> = α y<sub>t</sub> + (1 − α) ℓ<sub>t−1</sub>
          </Eq>
          <p>
            α near 1 means "trust only the latest value" (that's the naive forecast); α near 0 means "barely move". Holt adds a trend updated the
            same way (with β), and Holt–Winters adds one seasonal value per month (with γ). In practice the smoothing weights are fitted by
            minimising the one-step-ahead errors on the training data.
          </p>
          <p>
            A single-step forecast predicts the next point; a multi-step forecast predicts many. For multi-step you either forecast recursively
            (feed each prediction back in as if it were data) or train a separate model per horizon (direct). Recursive errors compound; direct
            models need more training.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Find a method and setting that beats 'same month last year' by at least 40%.",
          Sim: ForecastSim,
          check: (s) => s.mae < 0.6 * s.snaive,
          done: "Only a method that models trend and season together gets there. Seasonal naive repeats last year, so it misses a year of growth.",
        },
        {
          kind: "choice",
          q: "Simple exponential smoothing with α = 1 gives the same forecast as which method?",
          options: [
            { t: "The naive forecast: the last value", ok: true, why: "Right. All the weight goes on the newest value." },
            { t: "The average of the whole history", why: "That's closer to α near 0." },
            { t: "Seasonal naive", why: "Simple smoothing has no season at all." },
            { t: "Holt–Winters", why: "Holt–Winters adds trend and season terms that simple smoothing doesn't have." },
          ],
        },
        {
          kind: "number",
          q: "With α = 0.5, the old level is 100 and this month's sales are 120. What's the new level?",
          answer: 110,
          tolerance: 0.01,
          why: "0.5 × 120 + 0.5 × 100 = 110.",
        },
      ],
      explain: {
        q: "Why should every forecasting project start with a naive baseline?",
        options: [
          {
            t: "Because simple methods are often hard to beat, and without a baseline you can't tell whether a complex model is adding anything. If it can't beat 'same as last year', it isn't worth shipping.",
            verdict: "right",
            why: "That's the reason: a baseline turns 'good' into a number you can check.",
          },
          {
            t: "Because naive methods are always the most accurate.",
            verdict: "wrong",
            why: "They often aren't. The point is to measure the improvement, not to stop there.",
          },
          {
            t: "To have something to show while the real model trains.",
            verdict: "wrong",
            why: "Useful, but not the reason. The baseline is part of the evaluation.",
          },
          {
            t: "Because they need no data.",
            verdict: "partly",
            why: "They need very little, which makes them cheap. The bigger reason is that they set the bar.",
          },
        ],
      },
      readMore: [
        { title: "Some simple forecasting methods", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/simple-methods.html" },
        { title: "Exponential smoothing", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/expsmooth.html" },
      ],
    },

    {
      id: "arima",
      title: "ARIMA and friends",
      lead: "AR, MA, ARIMA and SARIMA, automatic selection, and Prophet.",
      history: "Box and Jenkins published their method in 1970, and for decades fitting an ARIMA meant an expert reading ACF plots. Rob Hyndman and Yeasmin Khandakar's automatic ARIMA (2008) made it one function call, and Facebook released Prophet in 2017 so analysts without that expertise could forecast business data.",
      gist: [
        "ARIMA models what's left after steadying the series, using its own past and past surprises.",
        "Forecasts for steady series drift back to the average; for wandering series the uncertainty keeps growing.",
        "Tools such as AutoARIMA and Prophet choose much of the model for you.",
      ],
      practice: {
        adjust: [
          "The orders (p, d, q) and seasonal orders, usually chosen automatically.",
          "For Prophet: holidays, changepoints and how flexible the trend is.",
        ],
        wrong: [
          "Trusting prediction intervals when the leftover errors aren't random.",
          "Letting automatic selection run without checking the result makes sense.",
        ],
        notice: [
          "Intervals that widen further ahead, as they should.",
          "Leftover errors with no autocorrelation and a steady spread.",
        ],
        ask: [
          "Which orders were selected, and do the residuals pass the checks?",
          "How wide are the intervals 1, 6 and 12 steps ahead?",
        ],
      },
      idea: (
        <p>
          ARIMA combines the last two lessons' ideas: difference the series until it's stationary (the I), then model what's left with its own
          past values (AR) and past surprises (MA). The forecast leans towards the average for a stationary series, or keeps drifting for one that
          wanders, and its uncertainty grows the further ahead you look.
        </p>
      ),
      example: (
        <p>
          Daily temperature anomalies, how much warmer or colder than normal a day is, are stationary: a warm spell fades back to normal within a
          week or two. So a forecast three weeks out is "about normal", with a range that stops widening. A share price is a random walk: there's no
          normal to fall back to, so the range keeps widening the further out you go.
        </p>
      ),
      play: [
        {
          Sim: FanSim,
          try: "Compare AR(1) with the random walk. For AR(1), raise φ towards 1 and watch the forecast take longer to return to the average and the range take longer to stop growing. At φ = 1 it would be a random walk.",
        },
      ],
      how: (
        <>
          <p>
            <M>ARIMA(p, d, q)</M>: <M>p</M> autoregressive terms, <M>d</M> differences, <M>q</M> moving-average terms. Some special cases: ARIMA(0,1,0)
            is the random walk (the naive forecast), and ARIMA(0,1,1) is simple exponential smoothing in disguise.
          </p>
          <p>
            <strong>SARIMA</strong> adds a seasonal copy of the same structure, written <M>(p,d,q)(P,D,Q)_m</M>, where m is the season length (12
          for monthly data) and D is the number of seasonal differences.
          </p>
          <Eq says="the AR(1) forecast's spread h steps ahead: it levels off when |φ| < 1">
            sd<sub>h</sub> = σ √((1 − φ<sup>2h</sup>) / (1 − φ²)), &nbsp; random walk: sd<sub>h</sub> = σ √h
          </Eq>
          <p>Choosing orders by hand from ACF and PACF plots is slow, so tools do it:</p>
          <ul>
            <li>
              <strong>AutoARIMA</strong> (pmdarima, statsforecast) tests for d, then searches over p and q and keeps the model with the lowest AIC,
              a score that rewards fit and penalises extra terms.
            </li>
            <li>
              <strong>Prophet</strong> fits a piecewise trend plus Fourier-series seasons plus holiday effects. It's robust to missing data and easy
              to explain to non-specialists, though not always the most accurate.
            </li>
            <li>
              <strong>TBATS</strong> handles several seasons at once, like daily and weekly patterns in hourly data.
            </li>
            <li>
              <strong>STL + a simple model</strong>: decompose, forecast the seasonally adjusted series with ARIMA or exponential smoothing, then add
              the season back.
            </li>
          </ul>
          <p>
            After fitting, check the residuals: no autocorrelation (Ljung–Box), roughly normal (a Q–Q plot), constant spread. If they fail, the
            prediction intervals can't be trusted.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Find a model whose 95% range 40 steps ahead is no more than 5% wider than its range 12 steps ahead.",
          Sim: FanSim,
          check: (s) => s.ratio < 1.05,
          done: "Only a stationary model (AR with φ comfortably below 1) stops getting less certain. Random walks keep widening forever.",
        },
        {
          kind: "choice",
          q: "Which ARIMA model is the naive 'same as last value' forecast?",
          options: [
            { t: "ARIMA(0, 1, 0)", ok: true, why: "Right. One difference and nothing else: the change is pure noise, so the best guess is no change." },
            { t: "ARIMA(1, 0, 0)", why: "That's AR(1), which pulls back towards the mean." },
            { t: "ARIMA(0, 0, 1)", why: "That's MA(1) on the raw series." },
            { t: "ARIMA(0, 0, 0)", why: "That's white noise around a constant: the forecast is the mean." },
          ],
        },
        {
          kind: "multi",
          q: "Monthly data with a trend and a yearly season. Which models could reasonably handle it? Pick all that apply.",
          options: [
            { t: "SARIMA(1,1,1)(0,1,1)₁₂", ok: true, why: "A seasonal difference and a regular difference take care of both." },
            { t: "Holt–Winters", ok: true, why: "Level, trend and season: designed for exactly this." },
            { t: "Prophet with yearly seasonality", ok: true, why: "Trend plus a Fourier season fits the description." },
            { t: "ARIMA(1,0,0) on the raw series", why: "No differencing and no seasonal terms: it can't follow a trend or a season." },
          ],
        },
      ],
      explain: {
        q: "Explain the 'I' in ARIMA to a friend.",
        options: [
          {
            t: "It stands for integrated: you model the changes instead of the values, then add the predicted changes back up to get a forecast of the values.",
            verdict: "right",
            why: "That's exactly what the d differences and the undoing at the end do.",
          },
          {
            t: "It means the model is interpretable.",
            verdict: "wrong",
            why: "Clever guess, but no.",
          },
          {
            t: "It's the number of times the series is differenced.",
            verdict: "partly",
            why: "That's the d parameter that controls it. The friend would still want to know why the forecast comes back in the original units.",
          },
          {
            t: "It means the errors are independent.",
            verdict: "wrong",
            why: "Independent errors are an assumption of the model, not what the I stands for.",
          },
        ],
      },
      readMore: [
        { title: "ARIMA models", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/arima.html" },
        { title: "Seasonal ARIMA models", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/seasonal-arima.html" },
        { title: "Prophet", by: "Prophet documentation", url: "https://facebook.github.io/prophet/" },
      ],
    },

    {
      id: "ml-forecasting",
      title: "Trees can't predict a record",
      lead: "Lag features, why trees can't extrapolate, and where deep learning fits.",
      history: "For years the forecasting competitions were won by statistical methods. That changed in 2018, when the M4 competition was won by Slawek Smyl's hybrid of exponential smoothing and a neural network, and in 2020 the M5 competition, on Walmart sales, was dominated by LightGBM models built on lag features.",
      gist: [
        "Turn a series into a table of past values and any regression model can forecast.",
        "Tree models can't predict beyond the values they've seen, so they flatline on growing series.",
        "Predicting changes, or removing the trend first, fixes that.",
      ],
      practice: {
        adjust: [
          "Which lags, rolling statistics and calendar features to create.",
          "Whether to forecast step by step, or with one model per horizon.",
        ],
        wrong: [
          "Features that use information from the period being predicted.",
          "Using trees on the raw levels of a growing series.",
        ],
        notice: [
          "Forecasts that stall at the historical maximum.",
          "Great backtest scores that collapse in production, a sign of leakage.",
        ],
        ask: [
          "Could every feature actually be computed at the moment we forecast?",
          "Does the model predict levels or changes?",
        ],
      },
      idea: (
        <p>
          Any regression model can forecast if you turn the series into a table: each row is a moment in time, the target is the value, and the
          features are things like "last month's value" and "the value 12 months ago". But tree models can only predict values they've seen. Ask
          them about a future higher than anything in the past and they stall at the ceiling.
        </p>
      ),
      example: (
        <p>
          A gradient-boosted model forecasts a growing app's daily sign-ups. It's excellent on last year's data. Then the app keeps growing, and
          the forecast flattens out at last year's record, every single day, forever. Nothing is broken: a tree's leaves hold averages of training
          values, so it can't say "more than ever". The fix is to predict the change rather than the level.
        </p>
      ),
      play: [
        {
          Sim: MLForecastSim,
          try: "Look at the tree on the values: its forecast can't climb past the dashed line. Switch to the tree on yearly changes, then to linear regression, and compare how far each gets.",
        },
      ],
      how: (
        <>
          <Table
            head={["Feature", "Example", "Why"]}
            rows={[
              ["Lags", "y_{t−1}, y_{t−7}, y_{t−12}", "recent and seasonal memory"],
              ["Rolling statistics", "mean and spread of the last 4 weeks", "the recent level and volatility"],
              ["Calendar", "month, day of week, holiday flag", "seasons and special days"],
              ["Exogenous variables", "price, weather, promotions", "outside drivers (you'll need their future values too)"],
            ]}
          />
          <p>
            Every feature must be computable at forecast time. A rolling mean that includes today, when you're predicting today, is leakage.
          </p>
          <p>Getting around the extrapolation problem with trees:</p>
          <ul>
            <li>predict differences or growth rates instead of levels (what the simulation does);</li>
            <li>detrend first, with a linear model or decomposition, and let the trees model what's left;</li>
            <li>use a hybrid: a classical model for trend and season, plus a tree model on its residuals.</li>
          </ul>
          <p>Deep learning models learn the features themselves:</p>
          <Table
            head={["Model", "Idea"]}
            rows={[
              ["MLP", "a plain network on a window of past values"],
              ["RNN / LSTM", "reads the series step by step, keeping a memory state"],
              ["Temporal CNN", "convolutions over time, often dilated to see far back"],
              ["Transformers (Temporal Fusion Transformer, PatchTST)", "attention over many past steps and many related series"],
            ]}
          />
          <p>
            They shine with many related series (thousands of products) and rich covariates. On a single short series, classical methods often win,
            which is one reason forecasting competitions are frequently won by ensembles of simple and complex models.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Find a model that forecasts above the highest value it saw in training.",
          Sim: MLForecastSim,
          check: (s) => s.aboveCeiling,
          done: "Predicting changes, or using a model with a slope, lets the forecast keep climbing. The plain tree on values never can.",
        },
        {
          kind: "choice",
          q: "Why can't a regression tree predict a value higher than any in its training data?",
          options: [
            { t: "Each leaf predicts the average of training targets that landed in it, so every prediction is an average of seen values.", ok: true, why: "Exactly. Averages can't exceed the maximum." },
            { t: "Trees are capped at depth 10.", why: "Depth doesn't matter; even infinitely deep trees average seen values." },
            { t: "Trees ignore lag features.", why: "They use them fine; the problem is in what the leaves can output." },
            { t: "It can, if the learning rate is high enough.", why: "A single tree has no learning rate. Boosted trees add up many trees, but still within the range of training residuals." },
          ],
        },
        {
          kind: "multi",
          q: "You're predicting tomorrow's sales. Which features are safe to use? Pick all that apply.",
          options: [
            { t: "Sales 7 days ago", ok: true, why: "Known at forecast time." },
            { t: "The 28-day rolling average ending yesterday", ok: true, why: "Ends before the day you predict." },
            { t: "Tomorrow's day of the week", ok: true, why: "Calendar features are known in advance." },
            { t: "The 28-day rolling average ending tomorrow", why: "It includes the value you're trying to predict." },
          ],
        },
      ],
      explain: {
        q: "A teammate's boosted-tree forecast flatlines at last year's peak. How do you explain it?",
        options: [
          {
            t: "Trees predict by averaging training values, so they can't go above the highest one they've seen. Train them on changes or detrended data and add the trend back.",
            verdict: "right",
            why: "The cause and the fix, in two sentences.",
          },
          {
            t: "The model is overfitting.",
            verdict: "wrong",
            why: "It may also overfit, but flatlining is about extrapolation, not variance.",
          },
          {
            t: "It needs more trees.",
            verdict: "wrong",
            why: "More trees still average seen values. The limit is structural.",
          },
          {
            t: "Tree models can't extrapolate.",
            verdict: "partly",
            why: "True, but it doesn't say why, or what to do about it.",
          },
        ],
      },
      readMore: [
        { title: "Forecasting with machine learning", by: "skforecast documentation", url: "https://skforecast.org/latest/index.html" },
        { title: "Lagged predictors", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/lagged-predictors.html" },
        { title: "Temporal Fusion Transformers", by: "Lim et al. (paper)", url: "https://arxiv.org/abs/1912.09363" },
      ],
    },

    {
      id: "evaluation",
      title: "No time travel allowed",
      lead: "Walk-forward validation and choosing an error metric.",
      history: "Forecasters learned the hard way that models tested on the past they were built from look far better than they perform. Rolling-origin testing became standard advice by 2000, and in 2006 Rob Hyndman and Anne Koehler proposed MASE because percentage errors blew up on series with zeros, like spare-part demand.",
      gist: [
        "Test forecasts the way reality will: train on the past, predict the future.",
        "Walk-forward validation repeats that at several cut-off dates.",
        "Choose the error metric on purpose; percentages break near zero.",
      ],
      practice: {
        adjust: [
          "The cut-off dates, the forecast horizon and the gap between folds.",
          "The metric: MAE or RMSE for one series, MASE or WMAPE across many.",
        ],
        wrong: [
          "Shuffled cross-validation, which lets the model see the future.",
          "Using MAPE when some actual values are close to zero.",
        ],
        notice: [
          "Error that grows with the horizon, as it should.",
          "Errors much worse for particular products or periods.",
        ],
        ask: [
          "Was this tested with walk-forward validation?",
          "What's the error by horizon and by product group?",
        ],
      },
      idea: (
        <p>
          The only fair test of a forecast is the one reality gives it: train on the past, predict the future, compare. Ordinary cross-validation
          shuffles rows, so it trains on the future to predict the past. Walk-forward validation keeps time in order. And the metric you pick can
          change which model looks best, so pick it on purpose.
        </p>
      ),
      example: (
        <p>
          A model scores beautifully in shuffled cross-validation: it had seen March and May when predicting April, so filling in the gap was easy.
          Deployed, it has to predict a month nobody has seen yet, and it does much worse. The test was measuring interpolation; the job was
          extrapolation.
        </p>
      ),
      play: [
        {
          Sim: BacktestSim,
          try: "Turn shuffling on and count the red outlines: training months that come after a test month. Then turn it off and see walk-forward folds grow forward through time.",
        },
        {
          Sim: MetricsSim,
          try: "The forecast is off by the same few units every month. Lower the quietest month's sales towards zero and watch which metrics notice.",
        },
      ],
      how: (
        <>
          <p>
            <strong>Walk-forward</strong> (or time-series cross-validation): train on months 1–36, test on 37–39; then train on 1–39, test on 40–42;
            and so on. Each fold mimics a real forecast. scikit-learn's <M>TimeSeriesSplit</M> does this. Leave a gap between train and test if your
            features use lags that would otherwise reach into the test period.
          </p>
          <Table
            head={["Metric", "What it measures", "Watch out for"]}
            rows={[
              ["MAE", "average size of the miss, in the data's units", "can't compare across series of different sizes"],
              ["RMSE", "like MAE but punishes big misses more", "one disaster dominates"],
              ["MAPE", "average miss as a percentage of the actual", "explodes when actuals are near zero; favours under-forecasting"],
              ["sMAPE", "a percentage using the average of actual and forecast", "still unstable near zero, less so"],
              ["WMAPE", "total miss divided by total actual", "dominated by the big series"],
              ["MASE", "MAE divided by the naive forecast's MAE in training", "below 1 means you beat naive; works across series"],
            ]}
          />
          <p>
            Look beyond one number: plot actual against forecast over time, plot the error over time (does it drift?), look at error by forecast
            horizon (it should grow), by product group, and by size of the actual value. The Diebold–Mariano test checks whether one model's
            errors are significantly smaller than another's.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Without touching the forecast errors, push MAPE above 25%.",
          Sim: MetricsSim,
          check: (s) => s.mape > 25,
          done: "One quiet month blew up the percentage, while MAE barely moved. That's why MAPE is risky for series that touch zero.",
        },
        {
          kind: "choice",
          q: "A model's MASE on the test set is 0.8. What does that mean?",
          options: [
            { t: "Its average error is 20% smaller than the naive forecast's average error in training.", ok: true, why: "Right. MASE below 1 beats the naive benchmark." },
            { t: "It's right 80% of the time.", why: "MASE isn't a hit rate." },
            { t: "Its errors are 0.8 units on average.", why: "That's MAE. MASE has no units." },
            { t: "It's 80% worse than naive.", why: "That would be a MASE of 1.8." },
          ],
        },
        {
          kind: "choice",
          q: "Why is ordinary shuffled k-fold cross-validation wrong for time series?",
          options: [
            { t: "Training folds include data from after the test period, so the model effectively sees the future.", ok: true, why: "Right. Walk-forward folds keep training strictly before testing." },
            { t: "It uses too few folds.", why: "The number of folds isn't the issue; their order is." },
            { t: "Time series are too short for it.", why: "Length isn't the problem." },
            { t: "It can't compute MAPE.", why: "Any metric works; the leak is the problem." },
          ],
        },
      ],
      explain: {
        q: "Which explanation of walk-forward validation would you give?",
        options: [
          {
            t: "You pretend to stand at several moments in the past. Each time you train only on what was known then, forecast the next stretch, and score it. Averaging those scores tells you how the model would really have done.",
            verdict: "right",
            why: "It makes clear why it's honest: every test is a genuine forecast.",
          },
          {
            t: "You split the data randomly into training and test sets several times.",
            verdict: "wrong",
            why: "Random splits are exactly what walk-forward avoids.",
          },
          {
            t: "You train on the first 80% and test on the last 20%.",
            verdict: "partly",
            why: "That's one fold of it. Walk-forward repeats it at several cut-off points, so one lucky period can't decide the result.",
          },
          {
            t: "You test the model on new data after deploying it.",
            verdict: "wrong",
            why: "That's monitoring. Walk-forward happens before deployment, on history.",
          },
        ],
      },
      readMore: [
        { title: "Time series cross-validation", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/tscv.html" },
        { title: "Evaluating point forecast accuracy", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/accuracy.html" },
        { title: "TimeSeriesSplit", by: "scikit-learn", url: "https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html" },
      ],
    },

    {
      id: "hierarchies",
      title: "Forecasts that add up",
      lead: "Hierarchical forecasting: bottom-up, top-down and reconciliation.",
      history: "Companies have always needed store, region and national plans that agree. For decades the choice was bottom-up or top-down. In 2011 Rob Hyndman and colleagues showed how to reconcile forecasts from every level at once, and the MinT method (2019) improved on it.",
      gist: [
        "Forecasts for stores, regions and the total should add up.",
        "Separate forecasts rarely do; reconciliation adjusts them until they do.",
        "Using information from every level usually improves accuracy too.",
      ],
      practice: {
        adjust: [
          "The method: bottom-up, top-down, or reconciliation (OLS or MinT).",
          "Which levels to forecast directly.",
        ],
        wrong: [
          "Top-down splits that use out-of-date shares.",
          "Bottom-up forecasts that are too noisy at the lowest level.",
        ],
        notice: [
          "Any mismatch between levels shows up at once in finance reports.",
          "Compare accuracy at each level, not just the total.",
        ],
        ask: [
          "Do the forecasts add up across the hierarchy?",
          "How accurate is each level before and after reconciliation?",
        ],
      },
      idea: (
        <p>
          A business forecasts sales for every store, every region and the whole company. Forecast each separately and the stores won't add up to
          the region, which won't add up to the total. Finance notices immediately. Reconciliation adjusts all the forecasts so they add up, and
          done well, it makes them more accurate too.
        </p>
      ),
      example: (
        <p>
          The store managers' forecasts add up to 290, the regional team says 288, and head office says 318. Who's right? Bottom-up trusts the
          stores; top-down trusts head office and splits its number by usual shares. Least-squares reconciliation listens to everyone and finds the
          set of numbers that adds up and stays as close as possible to all seven forecasts.
        </p>
      ),
      play: [
        {
          Sim: HierarchySim,
          try: "Start with separate forecasts and check whether the numbers add up. Then try each method and compare the average miss.",
        },
      ],
      how: (
        <>
          <Table
            head={["Method", "How", "Strength", "Weakness"]}
            rows={[
              ["Bottom-up", "forecast the lowest level, add up", "keeps detail", "lowest-level series are noisy"],
              ["Top-down", "forecast the total, split by historical shares", "the total is smooth and easy", "loses differences between stores"],
              ["Middle-out", "forecast a middle level, add up above it and split below it", "a compromise", "needs a good middle level"],
              ["Optimal reconciliation (OLS, MinT)", "forecast every level, then adjust all of them to add up", "uses every forecast; often the most accurate", "more computation"],
            ]}
          />
          <p>
            Write the hierarchy as a summing matrix <M>S</M> that turns bottom-level values into every level. Least-squares reconciliation projects
            the base forecasts onto the set of numbers that add up:
          </p>
          <Eq says="ŷ: all base forecasts stacked; the result adds up by construction">ỹ = S (SᵀS)⁻¹ Sᵀ ŷ</Eq>
          <p>
            MinT (minimum trace) weights the projection by how reliable each level's forecast has been, which usually helps further. Python's
            <M>hierarchicalforecast</M> library implements all of these.
          </p>
        </>
      ),
      quiz: [
        {
          kind: "task",
          q: "Find a method whose numbers add up and whose average miss is below 6.",
          Sim: HierarchySim,
          check: (s) => s.coherent && s.err < 6,
          done: "Reconciliation used all seven forecasts, so the errors at different levels partly cancelled.",
        },
        {
          kind: "choice",
          q: "Why might top-down forecasting miss a store whose sales are growing fast?",
          options: [
            { t: "It splits the total by historical shares, so the store's growing share isn't reflected.", ok: true, why: "Right. Old proportions hide changing ones." },
            { t: "It ignores the total.", why: "It starts from the total." },
            { t: "It adds up the stores.", why: "That's bottom-up." },
            { t: "It can't produce store-level numbers.", why: "It does; that's the splitting step." },
          ],
        },
        {
          kind: "number",
          q: "Bottom-up: four stores are forecast at 110, 90, 60 and 40. What is the forecast for the total?",
          answer: 300,
          tolerance: 0,
          why: "Bottom-up just adds them: 110 + 90 + 60 + 40 = 300.",
        },
      ],
      explain: {
        q: "How would you explain reconciliation to a finance manager?",
        options: [
          {
            t: "We forecast every level separately, then nudge all the numbers as little as possible so stores add up to regions and regions to the total. Using every level's view usually makes the result more accurate too.",
            verdict: "right",
            why: "It answers their real concern (the numbers add up) and the bonus (better accuracy).",
          },
          {
            t: "We forecast the stores and add them up.",
            verdict: "partly",
            why: "That's bottom-up, one way to get numbers that add up, but it ignores the other levels' forecasts.",
          },
          {
            t: "We average the forecasts from all levels.",
            verdict: "wrong",
            why: "Averaging numbers at different levels doesn't make sense: a store and the total aren't comparable.",
          },
          {
            t: "We force the total to match last year's.",
            verdict: "wrong",
            why: "That's not reconciliation; it would throw away the forecast.",
          },
        ],
      },
      readMore: [
        { title: "Forecasting hierarchical and grouped time series", by: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/hierarchical.html" },
        { title: "HierarchicalForecast", by: "Nixtla (Python library)", url: "https://nixtlaverse.nixtla.io/hierarchicalforecast/index.html" },
      ],
    },
  ],
};
