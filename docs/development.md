# Development

How the code fits together, the tests, performance, and deploying. Back to the [README](../README.md).

## Commands

Needs Node 22 or newer.

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

## Deploying

Pushing to `main` builds and deploys to GitHub Pages via GitHub Actions
(`.github/workflows/deploy.yml`). It also runs once a day so new repos and
stars show up, and can be run by hand.

Each run: install → refresh the repo snapshot (falling back to the committed
one) → lint → test → build → deploy.

**One-time setup:** Settings → Pages → Build and deployment → Source:
**GitHub Actions**.
