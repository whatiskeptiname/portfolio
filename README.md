# Portfolio — Susan Ghimire

Personal site for Susan Ghimire, ML engineer. It has three parts:

1. **A fast landing page** that says what you'd be hiring and proves it from the CV.
2. **A 3D planet** near a black hole, an easter egg behind the tiny sphere in the
   header, loaded only when someone opens it. The
   résumé is the northern hemisphere and GitHub the southern one. You can orbit
   it, drive it in a car or fly it with a drone — by hand or on a self-driving
   autopilot that shows what it sees and why it does what it does.
3. **Interactive lessons** on machine learning, opened from the Learn section and
   loaded only when someone goes in.

**Live:** <https://susang.com.np/> · **Planet:** <https://susang.com.np/#/planet>

---

## Contents

- [Quick start](#quick-start)
- [Editing content](#editing-content)
- [The landing page](#the-landing-page)
- [The lessons](#the-lessons)
- [The 3D planet](#the-3d-planet)
  - [Opening it](#opening-it)
  - [Controls](#controls)
  - [The world](#the-world)
  - [The car](#the-car)
  - [The drone](#the-drone)
  - [Cameras](#cameras)
  - [Autopilot](#autopilot)
  - [Seeing what the autopilot sees](#seeing-what-the-autopilot-sees)
  - [Traffic and traffic lights](#traffic-and-traffic-lights)
  - [Sound and Planet Radio](#sound-and-planet-radio)
  - [Settings](#settings)
- [How the code fits together](#how-the-code-fits-together)
- [Tests](#tests)
- [Performance notes](#performance-notes)
- [Deploying](#deploying)
- [Tech stack](#tech-stack)

---

## Quick start

Requires Node 22 or newer.

```sh
npm install
npm run dev           # http://localhost:5173/
npm test              # unit tests (vitest)
npm run lint          # eslint
npm run build         # production build in dist/
npm run preview       # serve the production build
npm run fetch-repos   # refresh src/data/repos.json from the GitHub API
```

The site is served from the root of the custom domain (`base: '/'` in
`vite.config.js`; the domain itself is in `public/CNAME`).

---

## Editing content

| What | Where |
| --- | --- |
| Name, role, intro, links, email, résumé PDF | `src/content/profile.js` — empty fields are hidden |
| Work roles, case studies, skills, education, community | `src/content/resume.js` |
| Which GitHub projects appear, and how | `projectConfig` in `src/content/resume.js`: featured repos, hidden repos, and per-repo overrides (title, description, demo link, image — images go in `public/`) |
| GitHub repository data | `src/data/repos.json`, a snapshot of the public GitHub API. Refresh with `npm run fetch-repos` (set `GITHUB_TOKEN` to avoid rate limits). CI refreshes it on every deploy and once a day. |
| Planet Radio playlists | `src/content/music.js` |
| Lessons and chapters | `src/learn/catalog.js` and `src/learn/chapters/` (see [The lessons](#the-lessons)) |
| Résumé PDF | `public/Susan_Ghimire_CV.pdf` |

---

## The landing page

`src/App.jsx` renders the page; the sections live in
`src/components/site/Sections.jsx`.

The page is there to get hired: it says what you'd be hiring and proves it from the
CV. Light or dark follows the visitor's system setting until they slide the sun/moon
switch in the header; the choice is remembered and
applied before the page first paints (an inline script in `index.html` sets
`data-theme` on `<html>`).

- **Hero:** the claim, with its key word in a detection box; the summary and how to
  get in touch; a race of the same frames before and after optimization, at the real
  7× ratio (`InferenceRace` in `src/components/site/Figures.jsx`); the headline results.
- **Why hire me:** one short row: each strength as a small picture and a line (`strengths`
  in `src/content/resume.js`, pictures in `Figures.jsx`). The results stay in Work. The
  pictures only move while on screen, and settle at once for anyone who prefers less motion.
- **Work:** one tile per project, the first and last double-width. Each opens with a real
  frame from its simulation, in the current theme (`public/sims/`), which opens the
  simulation (below), then its headline number and first point, with *Show N more*.
- **Experience:** the timeline, then roles, education and community as ruled rows.
- **Toolbox:** the tools in the order the work happens, from labelling to operating a
  model in production (`buildPath` in `src/content/resume.js`).
- **Projects:** GitHub languages, the featured repositories on one sheet, then the
  rest in a list (six shown, filter by language, *Show all*).
- **Contact and footer.** The 3D planet is an easter egg: the tiny turning sphere beside
  the theme switch is the only way in from the page, and `#/planet` links straight to it.
  Clicking it opens the planet's sky out of the sphere (`portal.js`). The planet is always
  dark, whichever theme the site is in.

Headings use Fraunces, the same face as the planet's signs, and the text uses
Schibsted Grotesk. Icons are one drawn set (`src/components/Icon.jsx`).

Behind it all, quietly, runs **Conway's Game of Life** (`LifeBackground.jsx`, rules
in `src/lib/life.js`): small squares in the accent colour, one generation every 1.4
seconds. Cells fade in when born, strengthen as they age so stable structures stand
out, and leave a faint trace for one generation when they die. Each
universe starts with units scattered at random (16% of the view) and evolves by the
exact rules on an infinite plane, with nothing added and no wrap-around.

The layer moves with a little parallax (`src/lib/parallax.js`). The board is a bit
taller than the screen, and scrolling from the top of the page to the bottom slides
it through an extra tenth of the screen's height, no more. It follows the scroll on a
spring, so it trails slightly and settles with one soft bounce. Keep pulling at the
top or bottom of the page (wheel or touch) and it stretches like rubber, up to 6% of
the screen, then springs back when you let go. With reduced motion it stays still.

You can draw on it: **click and drag on the empty background** to paint new cells.
The simulation holds while the button is down and the layer brightens so you can
see them. A plain click, or a tap on a touch screen, plants a random connected
cluster of 1 to 5 cells instead.

A universe ends when too few units are left in view (under 0.5%), when more have
drifted out of bounds than remain, or when only still lifes and oscillators are
left and nothing new has appeared for 12 generations. A diagonal wave then fades it
out and fades the next one in. It rests while the tab is hidden or a simulation is
open, and holds one still generation with reduced motion.

Each page has one name, used by its header link, heading, URL and browser tab: Why
hire me (`#why-hire-me`), Work (`#work`), Experience, Toolbox, Projects, Learn, Contact and 3D planet (`#/planet`), all
defined in `src/lib/sections.js`. The older `#/city` and `#open-source` links still
work. The URL and tab title follow you as you scroll. On screens under 880px the
links fold into a menu, and the bar's left side shows the page you're on.

The header highlights the section you're reading as you scroll (your name lights up
at the top of the page).

- **Hero:** intro (photo, name, tagline, *See my work*, résumé), a
  night-sky tile that opens the 3D planet, what I'm doing now, three
  headline numbers, about (*More about me* for the rest), GitHub languages
  and contact.
- **Case studies:** one tile per project, the first and last double-width so
  every row is full; each shows its headline number and first point, with
  *Show N more* for the rest, and a **See how it works** button (below).
- **Experience:** the timeline, a tile per role, then education and
  community.
- **Toolbox:** a tile per skill category.
- **Side projects:** the featured repositories, then the rest in one list
  tile (six shown, filter by language, *Show all*).
- **Contact and footer.**

The 3D explorer is lazy-loaded from `#/planet`, so three.js is never downloaded
unless you open the planet.

### Case-study simulations

Every professional project has an interactive simulation of how it works,
built from the CV. Each one is a short animation (about 12–15 s) that loops
continuously, with its main processes laid out on a timeline you can click or
drag to scrub (Space pauses, ← → jump between processes, Esc closes). The
caption follows the playhead and quotes the CV line it illustrates, and each
has one thing to change yourself. Surgery, inference and the greenhouse robot
are **3D scenes** you can drag to look round (the camera moves in for detail,
like the drill being tracked, until you take it: then it stays where you put
it, and the simulation plays on regardless); the data-heavy ones (forecast, schema, tables,
CatDox) stay 2D, where charts and documents read best. The data is synthetic;
the headline numbers are the CV's.

| Project | Stages | Try |
| --- | --- | --- |
| AI-Assisted Surgery | a total knee replacement in 3D: capture rig → GroundingDINO finds the bone saw → SAM mask → tracking → Gaussian splats | camera count: coverage holds down to 6, so 30 → 6–9 |
| AI Inference Acceleration | prune → sparsify → quantize (7×, 80.26%) → distil (82.88%, half the params) → ZipVoice to Triton (2.84×) | switch each technique on or off |
| Demand Forecasting | baseline → price change → MoM / YTD / baseline delta → plain-language Q&A | price change ±20% |
| Database Schema Mapping | name → type → meaning → mapped (70%) → YAML config | the config weights (tuning reaches 90%) |
| Autonomous Greenhouse Robot | map the aisles → detect flowers in 3D → pollinate → lower the vines | robot speed |
| Table Detection | generate and augment data → label → Cascade TabNet → TabStructNet → cells | augmentations |
| CatDox | skewed scan → SIFT alignment → ResNet → DiT layout → OCR → ByT5 fixes → key-value JSON | document type |

The player and scenes live in `src/components/sims/` (stage text and timings
in `stages.js`, the shared 3D stage in `Scene3D.jsx`) and load only when one
is opened; their models (coverage,
optimisation trade-offs, the price ripple, schema matching) are in
`src/lib/sims.js`, unit-tested to land on the CV's numbers.

---

## The lessons

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

---

## The 3D planet

### Opening it

- `#/planet` — orbit the planet.
- `#/planet?vehicle=car` or `#/planet?vehicle=drone` — start straight in a vehicle.
- Add `&view=chase`, `&view=fpv` or `&view=eye` to pick the camera.

The last vehicle, camera and all settings are remembered in your browser.

### Controls

#### Everywhere

| Key | Action |
| --- | --- |
| <kbd>C</kbd> | Look around ↔ drive |
| <kbd>V</kbd> | Transform: car ↔ drone |
| <kbd>T</kbd> | Cycle cameras: Chase → FPV → Eye view |
| <kbd>P</kbd> | Autopilot on/off (also cancels a "Go to" trip) |
| <kbd>G</kbd> | Show route planning and the plan ahead |
| <kbd>I</kbd> | Show what the driver sees and decides |
| <kbd>O</kbd> | Show the controls being sent to the vehicle |
| <kbd>X</kbd> | Unstuck (back onto the nearest road) |
| <kbd>E</kbd> | Visit the building you've pulled up to |
| <kbd>K</kbd> | Screenshot |
| <kbd>M</kbd> / <kbd>N</kbd> | Radio play/pause / next song |
| <kbd>H</kbd> or <kbd>?</kbd> | Help |
| <kbd>Esc</kbd> | Close a panel / leave the planet |

#### Car

| Key | Action |
| --- | --- |
| <kbd>W</kbd> / <kbd>↑</kbd> | Accelerate |
| <kbd>S</kbd> / <kbd>↓</kbd> | Brake; once stopped, reverse |
| <kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd> | Steer |
| <kbd>Space</kbd> | Handbrake (with <kbd>W</kbd>: drift) |
| <kbd>L</kbd> | Cruise control: lock the speed you're doing (again to release) |

#### Drone — Arcade mode

| Key | Action |
| --- | --- |
| <kbd>W</kbd> / <kbd>S</kbd> | Forward / back |
| <kbd>A</kbd> / <kbd>D</kbd> | Turn |
| <kbd>Space</kbd> <kbd>R</kbd> / <kbd>Shift</kbd> <kbd>F</kbd> | Raise / lower the height it holds |
| <kbd>+</kbd> / <kbd>−</kbd> | Height it holds, in 2 m steps (0 lands) |
| <kbd>B</kbd> | Swap the battery (on the ground) |

#### Drone — Realistic mode (mode 2, like a real radio)

| Key | Action |
| --- | --- |
| <kbd>W</kbd> / <kbd>S</kbd> | Throttle up / down — it stays where you leave it |
| <kbd>A</kbd> / <kbd>D</kbd> | Yaw left / right |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Pitch forward / back |
| <kbd>←</kbd> / <kbd>→</kbd> | Roll left / right |
| <kbd>B</kbd> | Swap the battery (on the ground) |

**Mouse and touch:** drag to orbit the planet or look around while driving,
scroll or pinch to zoom, click a building to open it, click the minimap to
swing there.

**Phones and tablets** get their own layout: a one-row toolbar with the camera
views and tools behind **⋯**, the speedometer and minimap in the top corners so the
road stays clear, and see-through steering and pedal buttons under the thumbs,
with a **Drift** button (the handbrake) above the pedals in the car. The
picture renders at about the same pixel count as a laptop at the same setting, so
it isn't blocky on a small screen.

**Toolbar:** Portfolio (back), Look around / Car / Drone, Chase / FPV / Eye
view, Go to, music, screenshot, fullscreen, sound, autopilot
settings, settings (sliders icon), ? help.

**On arrival:** you land on the planet view, with the car cruising the
equator on autopilot, the day–night cycle running, the Low graphics preset
and sound muted. The autopilot's route planning and the inputs readout are on
from the start (what it sees and decides is one key away, <kbd>I</kbd>), and the
keys for your vehicle show when you start driving or flying, fading once you've
been at the wheel a few seconds. On a device that
reports at least 8 processor threads, the first visit suggests switching to the
High preset; it asks once, ever. One small hint bar at the bottom offers <kbd>C</kbd> *to drive*
(*Tap to drive* on touch) and *Sound off · turn on*; each chip leaves once
used. The full guide is behind **?** /
<kbd>H</kbd>: it opens with every control for your vehicle and the
shortcuts, and scrolls on small screens.

### The world

All built by a deterministic layout (`src/lib/layout.js`): the same input
always gives the same planet. Distances are real: **1 unit = 1 m** (a car is
4.3 m long and the km/h agree).

- **Two hemispheres.** Résumé districts (Work, Learning, Community) in the
  north on wheat-gold ground; one district per programming language in the
  south on green. Each project or role is a building; click it for details.
- **Roads.** The equator highway runs all the way round: a dual
  carriageway, two lanes each way (4.25 m each), with a double yellow line
  down the middle and a dashed line between the lanes. A winding side road
  links each district to it, and country lanes link neighbouring districts;
  side roads are one lane each way, 10 m across. Each district has a
  roundabout at its centre. Side roads meet roundabouts and the highway with
  flared, curved kerbs (`src/lib/junctions.js`). **Traffic keeps left**, as
  in Nepal. On the highway, lanes go by speed: at cruising speed you drive in
  the right-hand (fast) lane, slower traffic in the left-hand (service) lane;
  the stop lines at the lights span both.
- **Surfaces and speed limits:** 150 km/h on the highway, 90 on roads, 70 on
  district paving, 45 on grass (with less grip, gravel and judder).
- **Street furniture:** street lamps along every road that light up at night
  (`src/lib/lamps.js`); green exit signs, speed limits, blue equator route
  shields every 45° and brown lane guides with distances (`src/lib/signs.js`);
  skill billboards; trees.
- **Water.** A river pours off a cliff in the southern mountains as a
  waterfall, winds north across the equator and runs straight into a small sea
  over the north pole, with palm islands and a lighthouse. Roads cross it on
  raised, arched bridges, level from kerb to kerb and long enough to clear the
  water in every lane, with solid parapets you can scrape along but not drive
  through (the drone can fly over them). Cars can't drive into water.
- **Poles.** The north pole, which faces the black hole, is sea. The south
  pole is ringed by low snow-capped mountains; only a drone flying above the
  peaks gets over them.
- **Terrain** (`src/lib/terrain.js`). Long, gentle swells everywhere, so the
  highway, roads and river rise and dip, easing to level ground in towns;
  smaller rolling hills in open country only. Vehicles ride and tilt with it.
- **The black hole is the sun.** The planet turns in front of it on a
  time-lapse of your system clock: one planet day every 12 real minutes
  (`src/lib/clock.js`). City windows, plazas, beacons, lamps and headlights
  follow the day/night line, and the HUD shows local planet time. You can also
  hold it at Day, noon with the black hole high overhead, or at Night
  under the Milky Way (see [Settings](#settings)).
- **Space.** A baked Milky Way, seen from the night side only, with stars, an atmosphere glow, thin wispy
  cloud at 40 to 50 m (`Clouds.jsx`, with its own switch in the settings), and
  the black hole with its accretion disc, 2,500 planet radii away: far enough to
  stay put in the sky as you move, drawn as part of the sky so the camera's range
  stays short.
- **Size.** The planet is twice the size it needs to fit everything
  (`WORLD_SCALE` in `src/lib/layout.js`), for more open country between districts.
- **Minimap.** A small globe showing the hemispheres, roads, river, sea,
  mountains, islands, districts, other cars and your planned route (coloured
  by speed).

### The car

- **Driving:** gears, tyre squeal, and steering that scales with speed and
  flips in reverse.
- **Brake, then reverse:** <kbd>S</kbd> brakes while you're rolling forward
  and reverses only once stopped.
- **Speed and drag:** the tyres and the air hold the car back harder the
  faster it goes, so it gathers speed quickly from a standstill and more
  slowly near the top. Driving it yourself on the highway it'll do **300
  km/h** flat out (the signs still say 150, and the autopilot keeps to them);
  on other roads and off-road their limits cap it.
- **Cruise control:** <kbd>L</kbd> locks the speed you're doing and holds it
  while you steer (if the autopilot was driving, you take over). The
  accelerator still speeds you up past it, and you come back to it when you
  let go; the brake or handbrake cancels it (`src/lib/pedals.js`).
- **Handbrake and drifting:** <kbd>Space</kbd> locks the rear wheels: they
  brake, and lose their sideways grip, so steer and the tail steps out. It's
  a front-wheel-drive car, so with the accelerator down too the front keeps
  pulling against the locked rear and you hold the slide — a handbrake drift,
  steered with the throttle and counter-steer (once the tail is loose it keeps
  rotating until you catch it). Let go and the rear grips again over about
  half a second, straightening up. The tyres squeal with the slide angle, and
  the body leans out of it (`src/lib/carPhysics.js`). Off the asphalt it's
  harder: on paving and grass the tyres dig in, so the tail swings out less
  and the slide eats speed faster — you can still drift, just not as far.
- **Drift effects and score:** a slide leaves soft grey smoke billowing off
  the rear tyres (it swells, rises and thins away over about three seconds)
  and dark skid marks on the road that fade after nine seconds, with a
  rough skid sound under the squeal (`src/city/DriftFx.jsx`). While you
  drift, a score at the top of the screen counts up with the slide angle and
  your speed; straighten up for a moment and it's banked (*Drift! +1,240*),
  flick from one side to the other and it carries on, crash mid-slide and it's
  lost. Your best this visit is shown beside it (`src/lib/drift.js`).
- **Road feel:** a fine buzz at speed and real judder on grass; the highway
  rides 20% smoother than other roads.
- **Indicators:** steering by hand, they come on once the car has actually
  turned about 20° with the wheel held over — the same at any speed — never
  for taps or small corrections.
- **Holding the brake:** stopped at a light on autopilot, it holds the brake
  instead of rolling in neutral — the gauge shows **H**.
- **Collisions:** the car is a rectangle against other cars and two circles
  (nose and tail) against buildings, trees and billboards. What happens
  depends on the angle: a glancing touch scrapes along, keeping most of the
  speed and turning the car parallel to the wall; a steeper hit loses more and
  swings it round further; head on, it stops dead and rebounds a little. The
  speed lost into the wall sets how loud the thud is, how hard the camera
  jolts and how much the car shudders. Knocked or spun into a tree or a wall,
  the car is never stuck: any move that gets it less far in is allowed, so it
  can always back or slide out; only moves deeper in are blocked.
- **Cars share momentum:** hit another car (or have one hit you) and what
  counts is how fast the two were closing — both speeds together, so a head-on
  is far harder than a nudge at a light. The closing speed is shared out by
  mass with a little bounce: the car that was hit is shoved on, the one that
  hit it slows, and a blow off either car's centre line spins it. Whatever
  doesn't fit the way a car points becomes a sideways shove its tyres scrub
  away. The same goes for every car on the planet — traffic shunting traffic
  too — and for the drone flying into one (it's light, so it barely moves the
  car). Shoved cars stop at buildings, trees and the river.
- **Cockpit (FPV):** right-hand drive, framed like a real cabin: a clear
  windscreen with a black border and parked wipers, A-pillars, roof lining with
  sun visors, side windows with their frames and B-pillars, a deep dashboard, a
  live instrument cluster (speed, gear, limit, autopilot lamp), a head-up
  display and a steering wheel that turns. The rear-view mirror and both door
  mirrors are live: one wide camera looks back and each mirror shows its slice.

### The drone

A racing FPV quadcopter.

- **One vehicle, two forms.** Press <kbd>V</kbd> and the car rebuilds itself
  into the drone, which lifts off; transform back and it lands as the car.
- **Two ways to fly by hand** (Settings → Drone controls):
  - **Arcade:** speed, turn, and a height it holds for you.
  - **Realistic** (`src/lib/quad.js`): a real quadcopter model. Thrust acts
    along the frame, so you tilt to move — pitch forward to fly forward, roll
    to slide sideways, yaw to turn — with drag and gravity. Throttle, yaw,
    pitch and roll work like a real radio.
- **On autopilot it always flies the realistic model**, through a flight
  controller: speed, coordinated banked turns and altitude hold become the
  four sticks. It climbs over buildings, trees, billboards and the mountains in
  its path, and follows the same road routes as the car at its set altitude.
- **Battery** (`src/lib/battery.js`): a 4S LiPo. Voltage sags the instant the
  throttle goes up, and the pack drains continuously with the current drawn,
  losing power when nearly flat. On autopilot it lands, swaps the pack and
  carries on. Flying by hand it prompts you to land and press <kbd>B</kbd>. A
  meter shows volts, amps and charge.
- **FPV view:** the nose camera, tilted up like a racing quad's and banking
  with the frame, with a goggles-style OSD (horizon, speed, altitude, battery
  voltage, flight timer, REC) over an analog-video look.

### Cameras

| Camera | What it does |
| --- | --- |
| **Chase** | Behind the vehicle, pulling in if a building is in the way. Drag to glance around; it swings back after a moment. |
| **FPV** | First person: the driver's seat in the car, the nose camera on the drone. The field of view widens with speed. Drag to look all round; it re-centres after 4 s. |
| **Eye view** | A free third-person orbit round the vehicle, starting high above and a little ahead of it so you see the road coming. Drag to circle, scroll to zoom. |

During a transformation the camera swings to a three-quarter view.

### Autopilot

On by default: the vehicle starts on the equator highway and drives itself.

- **Routes** (autopilot settings → Route):
  - **Equator** — cruises east round the highway.
  - **All roads** — tours every district in a random order through the side
    roads, lanes and roundabouts.
- **Go to:** drives you to any district by road, then hands the wheel
  back. <kbd>P</kbd> cancels the trip.
- **Taking over:** steering or accelerating overrides it only while you hold
  the keys. Let go and, like a real car, the wheel comes back to centre and
  the car carries straight on at the speed you were doing for half a second;
  then the autopilot takes the wheel back and re-plans from where you are.
  After 45 s with no input it re-engages by itself.
- **Route planning** (`src/lib/routing.js`): Dijkstra over the road network,
  with routes laid down the middle of the left-hand lane and every corner
  smoothed into a curve. Roundabouts are driven round clockwise. A route never
  sets off across water or straight into trees.
- **Driving the route:** pure-pursuit steering, with the look-ahead growing
  with speed. It slows in time for bends, slower roads, traffic and the end of
  the trip.
- **PID control** (`src/lib/pid.js`): throttle, brake and steering go through
  PID controllers (anti-windup, derivative on measurement), so the inputs are
  smooth and analog, not on/off. The drone's flight controller uses PID loops
  for speed → pitch, sideslip → roll and climb rate → throttle.
- **Off the road:** it steers round trees, buildings, billboards and the river
  (`src/lib/avoid.js`), or stops and says why if there's no way round. Off-road
  while cruising, it drives back to the highway by road. If it gets pinned, it
  backs off gently and tries another line, re-planning if that keeps failing.
- **Overtaking:** on the highway it moves into the second lane going its
  way; on a side road, into the oncoming lane. It pulls out past a slow
  (moving, not queueing) car only once it can actually see 15 m of that lane
  ahead (line of sight, so a
  building, tree, car or hill in the way means waiting) with nothing coming
  in it: no oncoming car, nothing in the next lane ahead or catching up
  behind, and no junction or roundabout within 20 m of where the pass ends. The pass isn't a fixed manoeuvre: every step it
  re-plans against the nearest oncoming car it can see. If it will finish and
  be back in its lane in time, it speeds up and commits, tucking in tighter
  and faster the closer that car is. If not, it eases off, drops back behind
  and pulls in, and carries on if the road clears. The decision panel shows
  the live margin, e.g. *Overtaking · oncoming 80 m, 2.1 s spare*.

#### Autopilot settings

- Route (Equator / All roads), cruise speed (20–150 km/h, 80 to start), and how far it
  sees (10–500 m, 50 m to start).
- What to show: route planning (G), what it sees and decides (I), and the
  controls it's sending (O).
- **Every rule it follows as its own switch:** traffic lights, junction boxes,
  other cars, roundabouts, trees/buildings/water, overtaking, bends, speed
  limits, getting unstuck. Switch one off and it ignores that element
  entirely. "Obey everything again" resets them.

### Seeing what the autopilot sees

- **Perception** (`src/lib/perception.js`): every decision — by your autopilot
  and by every other car — comes only from what it can see. It looks all round
  to its view distance, from eye height, in direct line of sight only:
  buildings, trees, billboards, other cars and the rise of the ground hide what
  is behind them. Anything right next to it is always noticed. The drone sees
  through its camera instead: a cone ahead plus a small close-up bubble.
- **Driver view (<kbd>I</kbd>):**
  - **Car:** the area it can see, outlined at eye level. Blind spots behind
    obstacles and the land beyond its range are shaded dark.
  - **Drone:** a faint translucent cone ahead (its length follows "Sees up
    to") and a small bubble round it.
  - **Boxes** round everything it notices — cars, traffic lights (in their
    current colour), trees, buildings, billboards. The thing it's reacting to
    pulses in the decision's colour.
  - **Lane recognition** (`src/lib/lanes.js`): its lane's two edges ahead as
    thin glowing strips on the road, bright by the car and fading ahead
    (green; amber when it's in the other lane).
- **Driver panel:** what it's doing and why, live — e.g. *Waiting · Red light
  · 20 m*, *Following · car ahead*, *Can't overtake: oncoming traffic* — plus
  its lane and a count of everything it sees. Colours: red stopping, amber
  slowing, cyan going.
- **Plan ahead (<kbd>G</kbd>):** the stretch it's about to drive, starting
  under the car, coloured by the speed it intends (red braking → amber → cyan
  cruising), ending in a red wall where it means to stop. When a route is
  planned, the search spreads over the road network as a wave of glowing
  junctions.
- **Inputs readout (<kbd>O</kbd>):** the controls going to the vehicle, gold
  when they're yours and cyan when the autopilot's. For the car: throttle,
  brake, reverse, handbrake, cruise and steering. For the drone: a
  radio-control transmitter's two sticks (Mode 2), throttle and yaw on the
  left, pitch and roll on the right.

### Traffic and traffic lights

Other cars (`src/lib/traffic.js`, `src/lib/trafficSim.js`, drawn by
`src/city/Traffic.jsx`) make their own trips by the same rules as your
autopilot:

- They keep left, slow for bends, and keep a safe gap. Each car sweeps its own
  outline along its path and stops before touching anyone — the car ahead, a
  crossing car, an oncoming one. A hard safety net means no car ever moves
  into another.
- They overtake slower cars when it's safe, give way to cars already on a
  roundabout (one car on the ring at a time), and never enter a junction box
  that isn't clear.
- **Lanes by speed, by the rules of the road** (the same for them as for your
  autopilot): on the highway each driver goes faster than in town by the same
  factor (one who does 35 km/h on a side road does about 55; a hurrier at 65
  does over 100), so there's a real spread of speeds.
  - A car at its cruising speed, when that's highway pace (60 km/h or more),
    drives in the **right-hand (fast) lane**; a slow driver, or one well
    below its cruise, keeps to the **left-hand (service) lane**, which is
    also where cars move before turning off.
  - In the fast lane a car moves over to let a faster one by. In the service
    lane a car stuck behind a slower one overtakes on the right and comes
    back, passing a line of slow cars in one go rather than weaving.
  - **Nobody passes on the left**: a car in the service lane stays behind a
    slower one in the fast lane.
  - Lane changes are signalled, checked in the mirror first, never made in a
    queue or near a junction (except to turn off there), and a car settles
    for a few seconds before changing again (`src/lib/traffic.js`).
- At red lights they stop with the front bumper behind the line, holding the
  brake.
- Stand-offs are resolved fairly: whoever has waited longest goes, and the car
  in the way backs off to let the other through.
- Each car makes decisions ten times a second, like a driver's reaction time;
  physics runs every frame.
- **Amount** (Settings → Traffic): Off, Light (12 cars) or Busy (24). Other cars are
  solid to your car.

**The highway has priority.** Traffic lights stand only at a real
**crossroads**, where side roads come in from both sides of the highway (close
junctions share one set). Where a side road just joins from one side, there
are no lights: a double broken **give-way line** and an upside-down triangle
sign, and cars coming off the side road wait there for a safe gap (about 4½
seconds of clear highway, a little less once they've waited a while) — the
highway traffic never stops for them.

The lights are **vehicle-actuated**: each approach detects its queue, empty
approaches are skipped, a green is extended while cars keep arriving (up to a
cap) and ends early once its queue clears, the all-red holds until the
junction is actually empty, and with no traffic they rest on the highway.
The highway gets the long greens: once green it stays green at least 10
seconds before a side road gets its turn.

### Sound and Planet Radio

- **Sound** (all synthesized, `src/city/audio.js`): the car's engine built
  like a real one — a train of exhaust pulses at the firing rate (twice a
  revolution for a four-cylinder), a half-rate rumble, a growl that hardens
  under load and intake hiss — climbing through the gears; tyre roar that
  grows with speed, squeal in hard turns and slides, gravel off-road; the
  drone's motors and air rush, an ambient pad that changes
  chord between day and night, a rumble when you face the black hole, wind
  with altitude, the river, district chimes, interface clicks and the
  transformation. A knock is a thud; a real hit is a **crash** — a heavy
  thump, crunching metal and the clang of panels ringing, with breaking glass
  on the hardest — louder the harder you hit and quieter from further off.
  Every visit starts muted; turn it on with 🔊 or the hint chip. Volume and
  channels are in Settings.
- **Traffic you can hear:** the three nearest cars each have their own engine
  and tyre swish, louder as they near, heard from the side they're on, and
  higher-pitched as they come and lower as they go (the Doppler effect).
- **Sound follows the camera:** your vehicle is as loud as it is from where
  the camera is — fully inside or behind it, fading as the camera pulls away,
  and silent once you're looking at the planet from space
  (`src/lib/carSound.js`).
- **♫ Planet Radio** (`src/city/radio.js`): Nepali, Hindi and English stations
  streamed from official YouTube uploads through YouTube's embedded player
  (youtube-nocookie.com). Nothing is downloaded or hosted here, and the player
  loads only when you press play. Shuffle, seek, music volume, a *My mix*
  station for any YouTube link you paste, and skipping of videos that refuse
  embedding. While playing, a mini player shows the video bottom-left; *Hide
  video* switches to music only.

### Settings

#### Settings (sliders icon)

- **Audio:** overall volume; **Music** and **Cars & engines** each with
  their own level and mute button, so either can be off while the other
  plays; ambience and interface sounds.
- **World:** time of day — *Cycle* (the 12-minute day), *Day* or *Night*
  (held at noon with the black hole high overhead, or at midnight, wherever you are; the sun eases across when you
  switch).
- **Drone controls:** Arcade or Realistic.
- **Graphics:** Low (default) / Medium / High presets, plus resolution, frame-rate cap,
  anti-aliasing, shadows, sky, stars, black-hole detail, and switches for the
  atmosphere, trees, night windows, rooftop signs, billboards, street signs,
  street lamps, labels and river/sea animation. Switching something off
  unloads it and frees its GPU memory (`src/lib/graphics.js`). Live FPS, draw
  calls, triangles and texture counts are shown.
- **Traffic:** Off / Light / Busy.

The autopilot settings are described under [Autopilot](#autopilot).

Everything is saved per browser in `localStorage` (keys starting with
`city-`).

---

## How the code fits together

```
src/
├── App.jsx                 landing page; #/planet lazy-loads the explorer
├── components/
│   ├── ProjectCard.jsx
│   ├── site/               landing-page sections and the planet illustration
│   └── sims/               case-study simulations (lazy-loaded)
├── content/                profile, résumé, radio playlists (edit these)
├── data/                   repos.json snapshot + derived groups for the planet
├── lib/                    pure, unit-tested logic (no three.js)
└── city/                   the react-three-fiber scene and HUD
```

### `src/lib/` — pure logic, all unit-tested

| File | What |
| --- | --- |
| `projects.js` | Filters, overrides, sorts and groups repos |
| `career.js` | Résumé dates, timeline maths, the résumé districts |
| `sims.js` | Models behind the case-study simulations |
| `life.js` | Conway's Game of Life, for the page background |
| `parallax.js` | The background's spring and rubber-band motion |
| `layout.js` | The planet: districts, roads, river, sea, mountains, bridges, buildings, billboards, trees, collisions |
| `globe.js` | Maps the flat layout onto the sphere |
| `terrain.js` | Swells and hills |
| `junctions.js` | Roundabout and highway junction flares |
| `signs.js`, `lamps.js` | Street signs and street lamps |
| `clock.js` | Planet time, the sun's position, time-of-day modes |
| `graphics.js` | Graphics presets and saved settings |
| `autopilot.js` | Inputs, speed limits, equator cruise, autopilot rules, getting unstuck |
| `routing.js` | Road graph, route planning, path smoothing, route following, speed plans |
| `pid.js` | PID controllers |
| `perception.js` | Line of sight, what each driver can see, vision areas |
| `decision.js` | What the autopilot is doing and why; its real-time plan |
| `lanes.js` | Lane recognition |
| `avoid.js` | Obstacle avoidance; the drone's clearance ahead |
| `traffic.js` | Traffic lights (actuated), traffic rules, overtaking |
| `trafficSim.js` | The other cars |
| `quad.js` | Quadcopter physics and flight controller |
| `battery.js` | The drone's battery |
| `music.js` | Radio helpers |

### `src/city/` — the scene

| File | What |
| --- | --- |
| `CityExplorer.jsx` | The explorer: state, keys, settings, scene assembly |
| `World.jsx` | Planet, roads, bridges, river, districts, trees, billboards |
| `Poles.jsx` | The northern sea and islands, the southern mountains, the waterfall |
| `Buildings.jsx` | Every building in a few draw calls, with rooftop signs and night windows |
| `Lamps.jsx`, `StreetSigns.jsx` | Street lamps and signs |
| `Space.jsx` | Sky and black hole |
| `Vehicles.jsx` | The car and drone: models, physics, the autopilot loop, cameras |
| `Transform.jsx` | The car ↔ drone transformation |
| `Cockpit.jsx` | The car's interior for first person |
| `Traffic.jsx` | Other cars and traffic lights |
| `RouteViz.jsx` | Route planning and the plan ahead |
| `DriverView.jsx` | What the driver sees: vision area/cone, boxes, lanes |
| `Hud.jsx` | Toolbar, gauge, panels, driver panel, inputs, battery, FPV overlay |
| `Minimap.jsx` | The globe minimap |
| `audio.js`, `radio.js`, `RadioPanel.jsx` | Sound and Planet Radio |
| `globe3d.js`, `gpu.js` | three.js helpers (placing things on the sphere, GPU cleanup, night glow) |
| `city.css` | HUD styles |

**`scripts/fetch-repos.mjs`** — takes the build-time GitHub snapshot.

---

## Tests

```sh
npm test
```

**217 unit tests** cover everything in `src/lib`, including:

- **Layout:** layout determinism, roads, junctions, bridges, the river,
  sea and mountains, terrain.
- **Routing:** route planning and following — a car simulated on its own
  physics reaches every district at 30 and 150 km/h, stays on the road and
  never circles. Routes are also checked to never cross water.
- **Traffic:** two-minute simulations of 18–24 cars with zero collisions,
  zero red lights run, overtakes happening, and nobody stuck for long. Also
  actuated lights, overtaking decisions, and line-of-sight perception.
- **Drone:** the quadcopter physics and flight controller, the PID
  controller, and the battery.

CI runs lint and tests before every deploy.

---

## Performance notes

- three.js and the planet load only when you open `#/planet`.
- Buildings, roads, lamps and signs are merged into a handful of draw calls;
  windows, trees and cars are instanced.
- Lights never change in number during play (adding or removing a light
  makes three.js recompile every material). The transformation's shaders are
  warmed up at load.
- Traffic cars decide ten times a second rather than every frame; your
  autopilot's perception refreshes ten times a second.
- Graphics switches unload what they turn off and free its GPU memory.

---

## Deploying

Pushing to `main` builds and deploys to GitHub Pages via GitHub Actions
(`.github/workflows/deploy.yml`). It also runs once a day so new repos and
stars show up, and can be run by hand.

Each run: install → refresh the repo snapshot (falling back to the committed
one) → lint → test → build → deploy.

**One-time setup:** Settings → Pages → Build and deployment → Source:
**GitHub Actions**.

---

## Tech stack

- **Site:** React 19 and Vite.
- **3D:** three.js, @react-three/fiber and @react-three/drei.
- **Tests and lint:** Vitest, ESLint.
- **Hosting:** GitHub Pages via GitHub Actions.
