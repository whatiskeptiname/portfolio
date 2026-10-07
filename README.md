# Portfolio — Susan Ghimire

Personal site for Susan Ghimire, ML engineer. It has two parts:

1. **A fast landing page**, split into two "hemispheres": the résumé above the
   equator, open-source work below it.
2. **A 3D planet** near a black hole, loaded only when you ask for it. The
   résumé is the northern hemisphere and GitHub the southern one. You can orbit
   it, drive it in a car or fly it with a drone — by hand or on a self-driving
   autopilot that shows what it sees and why it does what it does.

**Live:** <https://susang.com.np/> · **Planet:** <https://susang.com.np/#/city>

---

## Contents

- [Quick start](#quick-start)
- [Editing content](#editing-content)
- [The landing page](#the-landing-page)
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
| Résumé PDF | `public/Susan_Ghimire_CV.pdf` |

---

## The landing page

`src/App.jsx` renders the page; the sections live in
`src/components/site/Sections.jsx`.

- **Header and hero** — name, role and the main links, with a planet
  illustration (`PlanetArt.jsx`).
- **Northern hemisphere (résumé):** About; Experience (a timeline of roles);
  Case studies; Toolbox (skills); Background (education and more).
- **The equator** — the divider between the two halves.
- **Southern hemisphere (open source):** projects grouped by language with
  language bars, featured projects, and a full project index you can filter.
- **Contact and footer.**

The 3D explorer is lazy-loaded from `#/city`, so three.js is never downloaded
unless you open the planet.

---

## The 3D planet

### Opening it

- `#/city` — orbit the planet.
- `#/city?vehicle=car` or `#/city?vehicle=drone` — start straight in a vehicle.
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
| <kbd>Space</kbd> | Handbrake |

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
swing there. On touch devices on-screen pedals appear.

**Toolbar:** Portfolio (back), Look around / Car / Drone, Chase / FPV / Eye
view, 📍 Go to, ♫ radio, 📷 screenshot, ⛶ fullscreen, 🔊 sound, 🧭 autopilot
settings, ⚙ settings, ? help.

**First visit:** the planet opens quietly and light: sound muted, the Low
graphics preset, the autopilot cruising the equator, and the route, decision
and input overlays off. One small hint bar at the bottom offers
<kbd>C</kbd> *to drive* and *Sound off · turn on*; each chip leaves once
used. The full guide is behind **?** / <kbd>H</kbd>.

### The world

All built by a deterministic layout (`src/lib/layout.js`): the same input
always gives the same planet. Distances are real: **1 unit = 1 m** (a car is
4.3 m long and the km/h agree).

- **Two hemispheres.** Résumé districts (Work, Learning, Community) in the
  north on wheat-gold ground; one district per programming language in the
  south on green. Each project or role is a building; click it for details.
- **Roads.** The equator highway runs all the way round. A winding side road
  links each district to it, and country lanes link neighbouring districts.
  Each district has a roundabout at its centre. Side roads meet roundabouts
  and the highway with flared, curved kerbs (`src/lib/junctions.js`).
  **Traffic keeps left**, as in Nepal.
- **Surfaces and speed limits:** 150 km/h on the highway, 90 on roads, 70 on
  district paving, 45 on grass (with less grip, gravel and judder).
- **Street furniture:** street lamps along every road that light up at night
  (`src/lib/lamps.js`); green exit signs, speed limits, blue equator route
  shields every 45° and brown lane guides with distances (`src/lib/signs.js`);
  skill billboards; trees.
- **Water.** A river pours off a cliff in the southern mountains as a
  waterfall, winds north across the equator and runs straight into a small sea
  over the north pole, with palm islands and a lighthouse. Roads cross it on
  raised, arched bridges. Cars can't drive into water.
- **Poles.** The north pole, which faces the black hole, is sea. The south
  pole is ringed by low snow-capped mountains; only a drone flying above the
  peaks gets over them.
- **Terrain** (`src/lib/terrain.js`). Long, gentle swells everywhere, so the
  highway, roads and river rise and dip, easing to level ground in towns;
  smaller rolling hills in open country only. Vehicles ride and tilt with it.
- **The black hole is the sun.** The planet turns in front of it on a
  time-lapse of your system clock: one planet day every 4 real minutes
  (`src/lib/clock.js`). City windows, plazas, beacons, lamps and headlights
  follow the day/night line, and the HUD shows local planet time. You can also
  hold it at Day or Night (see [Settings](#settings)).
- **Space.** A baked Milky Way sky with stars, an atmosphere glow, and the
  black hole with its accretion disc.
- **Minimap.** A small globe showing the hemispheres, roads, river, sea,
  mountains, islands, districts, other cars and your planned route (coloured
  by speed).

### The car

- **Driving:** gears, tyre squeal, and steering that scales with speed and
  flips in reverse.
- **Brake, then reverse:** <kbd>S</kbd> brakes while you're rolling forward
  and reverses only once stopped.
- **Handbrake:** <kbd>Space</kbd> locks the rear wheels. It slows the car
  more gently than the foot brake; steer while it's on and the back slides
  out into a handbrake turn, scrubbing off speed until the tyres grip again.
- **Holding the brake:** stopped at a light on autopilot, it holds the brake
  instead of rolling in neutral — the gauge shows **H**.
- **Collisions:** the car is a rectangle against other cars and two circles
  (nose and tail) against buildings, trees and billboards. Brushing something
  makes it slide along it rather than stop dead.
- **Cockpit (FPV):** right-hand drive, a live instrument cluster (speed, gear,
  limit, autopilot lamp), a steering wheel that turns, slim pillars and a
  working rear-view mirror.

### The drone

A racing FPV quadcopter.

- **One vehicle, two forms.** Press <kbd>V</kbd> and the car rebuilds itself
  into the drone, which lifts off; transform back and it lands as the car.
- **Two ways to fly by hand** (⚙ → Drone controls):
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
| **Eye view** | A free third-person orbit round the vehicle. Drag to circle, scroll to zoom. |

During a transformation the camera swings to a three-quarter view.

### Autopilot

On by default: the vehicle starts on the equator highway and drives itself.

- **Routes** (🧭 → Route):
  - **Equator** — cruises east round the highway.
  - **All roads** — tours every district in a random order through the side
    roads, lanes and roundabouts.
- **Go to** (📍): drives you to any district by road, then hands the wheel
  back. <kbd>P</kbd> cancels the trip.
- **Taking over:** steering or accelerating overrides it only while you hold
  the keys. Let go and it re-plans from where you are. After 45 s with no
  input it re-engages by itself.
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
- **Overtaking:** it passes a slow car only when the next lane is clear both
  ways, the road stays straight for the whole pass, no junction or roundabout
  is coming, and it can see far enough ahead. If something appears, it aborts
  and drops back behind.

#### Autopilot settings (🧭)

- Route (Equator / All roads), cruise speed (20–150 km/h), and how far it
  sees (10–500 m).
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
    faint lines (green; amber when it's in the other lane).
- **Driver panel:** what it's doing and why, live — e.g. *Waiting · Red light
  · 20 m*, *Following · car ahead*, *Can't overtake: oncoming traffic* — plus
  its lane and a count of everything it sees. Colours: red stopping, amber
  slowing, cyan going.
- **Plan ahead (<kbd>G</kbd>):** the stretch it's about to drive, starting
  under the car, coloured by the speed it intends (red braking → amber → cyan
  cruising), ending in a red wall where it means to stop. When a route is
  planned, the search spreads over the road network as a wave of glowing
  junctions.
- **Inputs readout (<kbd>O</kbd>):** the controls going to the vehicle, and
  whether they're yours or the autopilot's. For the car: throttle, brake,
  reverse, handbrake, steering. For the drone: the four sticks.

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
- At red lights they stop with the front bumper behind the line, holding the
  brake.
- Stand-offs are resolved fairly: whoever has waited longest goes, and the car
  in the way backs off to let the other through.
- Each car makes decisions ten times a second, like a driver's reaction time;
  physics runs every frame.
- **Amount** (⚙ → Traffic): Off, Light (12 cars) or Busy (24). Other cars are
  solid to your car.

**Traffic lights** stand wherever a side road meets the highway; close
junctions share one crossroads. They're **vehicle-actuated**: each approach
detects its queue, empty approaches are skipped, a green is extended while
cars keep arriving (up to a cap) and ends early once its queue clears, the
all-red holds until the junction is actually empty, and with no traffic they
rest on the highway.

### Sound and Planet Radio

- **Sound** (all synthesized, `src/city/audio.js`): car engine with gears and
  tyre squeal, the drone's motors and air rush, an ambient pad that changes
  chord between day and night, a rumble when you face the black hole, wind
  with altitude, the river, district chimes, interface clicks and the
  transformation. Every visit starts muted; turn it on with 🔊 or the hint
  chip. Volume and channels are in ⚙.
- **♫ Planet Radio** (`src/city/radio.js`): Nepali, Hindi and English stations
  streamed from official YouTube uploads through YouTube's embedded player
  (youtube-nocookie.com). Nothing is downloaded or hosted here, and the player
  loads only when you press play. Shuffle, seek, music volume, a *My mix*
  station for any YouTube link you paste, and skipping of videos that refuse
  embedding. While playing, a mini player shows the video bottom-left; *Hide
  video* switches to music only.

### Settings

#### ⚙ Settings

- **Audio:** volume; engines, ambience and interface sounds.
- **World:** time of day — *Cycle* (the 4-minute day), *Day* or *Night*
  (held at noon or midnight wherever you are; the sun eases across when you
  switch).
- **Drone controls:** Arcade or Realistic.
- **Graphics:** Low (default) / Medium / High presets, plus resolution, frame-rate cap,
  anti-aliasing, shadows, sky, stars, black-hole detail, and switches for the
  atmosphere, trees, night windows, rooftop signs, billboards, street signs,
  street lamps, labels and river/sea animation. Switching something off
  unloads it and frees its GPU memory (`src/lib/graphics.js`). Live FPS, draw
  calls, triangles and texture counts are shown.
- **Traffic:** Off / Light / Busy.

The 🧭 autopilot settings are described under [Autopilot](#autopilot).

Everything is saved per browser in `localStorage` (keys starting with
`city-`).

---

## How the code fits together

```
src/
├── App.jsx                 landing page; #/city lazy-loads the explorer
├── components/
│   ├── ProjectCard.jsx
│   └── site/               landing-page sections and the planet illustration
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

**179 unit tests** cover everything in `src/lib`, including:

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

- three.js and the planet load only when you open `#/city`.
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
