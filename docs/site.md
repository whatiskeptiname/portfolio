# The home page and its content

What's on the home page, how each part works, and where its content lives. Back to the [README](../README.md).

## Editing content

| What | Where |
| --- | --- |
| Name, role, intro, links, email, résumé PDF | `src/content/profile.js` — empty fields are hidden |
| Work roles, case studies, skills, education, community | `src/content/resume.js` |
| Which GitHub projects appear, and how | `projectConfig` in `src/content/resume.js`: featured repos, hidden repos, and per-repo overrides (title, description, demo link, image — images go in `public/`) |
| GitHub repository data | `src/data/repos.json`, a snapshot of the public GitHub API. Refresh with `npm run fetch-repos` (set `GITHUB_TOKEN` to avoid rate limits). CI refreshes it on every deploy and once a day. |
| Planet Radio playlists | `src/content/music.js` |
| Lessons and chapters | `src/learn/catalog.js` and `src/learn/chapters/` (see [The lessons](lessons.md)) |
| Résumé PDF | `public/Susan_Ghimire_CV.pdf` |

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
