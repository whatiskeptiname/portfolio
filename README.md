# Portfolio

Personal site for Susan Ghimire — a fast landing page split into two
"hemispheres" (résumé above, open source below), plus an optional **3D planet**
near a black hole: the résumé is the northern hemisphere, GitHub the southern
one, and you can orbit it, drive it in a car or fly it with a drone.

Live: https://whatiskeptiname.github.io/portfolio/

## Develop

```sh
npm install
npm run dev          # http://localhost:5173/portfolio/
npm test             # unit tests for layout + project curation
npm run lint
npm run build        # outputs dist/
```

## Editing content

- **Intro, links, email, résumé PDF** → `src/content/profile.js`. Empty fields are hidden.
- **Roles, case studies, skills, education etc.** → `src/content/resume.js`.
- **Which projects appear** → `projectConfig` in the same file: pick featured repos,
  hide repos, or override a repo's title/description/demo link/image (put images in `public/`).
- **Repository data** → `src/data/repos.json`, a snapshot of the GitHub API.
  Refresh it with `npm run fetch-repos` (set `GITHUB_TOKEN` to avoid rate limits).
  CI refreshes it on every deploy and once a day.

## How it fits together

| Path | What |
| --- | --- |
| `src/App.jsx` | Landing page; `#/city` lazily loads the 3D explorer (three.js is never downloaded otherwise). |
| `src/components/site/` | Landing-page sections. |
| `src/lib/projects.js` | Filters, overrides, sorts and groups repos. Pure + tested. |
| `src/lib/career.js` | Résumé dates, timeline chart maths, and the planet's Work / Learning / Community districts. Pure + tested. |
| `src/lib/layout.js` | Deterministic planet layout on a wrapping plane: hemisphere rings of districts, the equator highway, winding spurs and lanes, a river falling from the southern mountains to a small island-dotted northern sea, arched bridges, billboards, trees, collisions. `junctions.js` (roundabout and highway flares), `signs.js` and `lamps.js` place street furniture; `routing.js` plans "Go to" trips over the road network. Pure + tested. |
| `src/lib/globe.js` | Projects that plane onto the sphere (equirectangular). Pure + tested. |
| `src/city/` | react-three-fiber scene: `World` (planet, roads, bridges, river), `Poles` (northern sea, southern mountains), `Lamps`, `Space` (Milky Way sky, black hole), `Vehicles` (car/drone, chase camera), HUD, globe minimap. |
| `scripts/fetch-repos.mjs` | Build-time GitHub snapshot. |

### Planet controls

Open it at `#/city`, or straight into a vehicle with `#/city?vehicle=car` / `#/city?vehicle=drone` (add `&view=eye` for the third-person orbit camera).

- **Look around:** drag to spin the planet, scroll / pinch to zoom; click a building for details; click the world map to swing there.
- **One vehicle, two forms:** switching converts it in place — the car lifts off as a drone, the drone lands as a car.
- **Car:** <kbd>W A S D</kbd> or arrows (on-screen pedals on touch devices); pull up to a building and press <kbd>E</kbd>.
- **PID control** (`src/lib/pid.js`): the autopilot's throttle, brake and steering go through PID controllers (anti-windup, derivative on measurement) — analog, not on/off — for the car and the traffic; the drone's flight controller runs speed→pitch, slip→roll and climb-rate→thrust loops.
- **Drone battery** (`src/lib/battery.js`): a 4S LiPo — the voltage sags instantly with throttle and the pack drains continuously with the current drawn, losing power when nearly flat. On autopilot it lands, swaps the pack and carries on; flying by hand it prompts you to land and press <kbd>B</kbd>. The drone sees through its camera: a vision cone ahead (80°, out to its view distance) plus a small 2.5 m bubble of close-up awareness right round it — both drawn as faint translucent shells in the driver view (the cone grows with "Sees up to"; the bubble stays small), and all it decides from.
- **Time of day** (⚙ → World): *Cycle* runs the planet's 4-minute day; *Day* and *Night* hold it at noon or midnight wherever you are, easing the black hole across when you switch.
- **Car keys:** <kbd>W</kbd> drive, <kbd>S</kbd> brake (and, once stopped, reverse), <kbd>Space</kbd> handbrake — it locks the rear wheels, so steer while it's on and the back slides out — <kbd>A</kbd>/<kbd>D</kbd> steer. The inputs readout shows brake, reverse and handbrake separately.
- **Drone:** a racing FPV quad with a realistic flight model (`src/lib/quad.js`): thrust along the frame, tilted to move — throttle, yaw, pitch and roll. Fly it by hand in ⚙ → Drone controls: *Arcade* (W/S speed, A/D turn, Space/Shift or −/+ for the height it holds) or *Realistic* (mode 2, like a real radio: W/S throttle that stays put, A/D yaw, ↑/↓ pitch, ←/→ roll). On autopilot it always flies the realistic model through a flight controller — speed, coordinated banked turns and altitude hold become the four sticks, shown live in the inputs panel.
- **Cameras:** drag while driving to look around (the chase cam swings back behind you); <kbd>T</kbd> toggles *Eye view*, a free third-person orbit around the vehicle (scroll to zoom).
- **Terrain:** the planet isn't a perfect sphere (`src/lib/terrain.js`). Long, gentle swells run everywhere — the highway, roads and river rise and dip with them — easing out to level ground in towns; smaller rolling hills cover open country only, so roads never get sharp bumps.
- **Poles:** the north pole (facing the black hole) is a small sea with palm islands and a lighthouse; the south pole is ringed by low mountains. Only the drone gets past either — fly above the peaks to cross the south pole.
- **Day and night:** the planet turns in front of the black hole (its only sun) on a time-lapse of your system clock — one planet day every 4 real minutes (`src/lib/clock.js`). City lights, plazas, beacons and headlights follow the day/night line; the HUD shows local planet time.
- **Towns** have roundabouts where their roads meet, and every side road flares into the equator highway with curved kerbs. The **river** pours off a cliff in the southern mountains as a waterfall and flows north straight into the sea; roads cross it on raised, arched bridges. **Street lamps** line every road and light up on the night side.
- **FPV** (toolbar, or <kbd>T</kbd> to cycle Chase → FPV → Eye view): in the car, the driver's seat (right-hand drive) — a high seat over a low dashboard with a live instrument cluster, a steering wheel that turns, slim pillars and a working rear-view mirror, a field of view that widens with speed, and drag to look all round; in the drone, the nose camera, tilted up like a racing quad's and banking with the frame, with an FPV goggles OSD (horizon, speed, altitude, battery, timer, REC) over an analog-video look.
- **Autopilot settings** (🧭 in the toolbar): route, cruise speed, view distance, what's drawn — and every rule it follows as its own switch: traffic lights, junction boxes, other cars, roundabouts, trees/buildings/water, overtaking, bends, speed limits, getting unstuck. Switch one off and it ignores that element entirely. A live readout (<kbd>O</kbd>) shows the controls going to the vehicle — throttle, brake, steering, climb — and whether they're the autopilot's or yours.
- **Driver's eye view** (<kbd>I</kbd>, or ⚙): the autopilot — and every other car — decides only from what it can see (`src/lib/perception.js`): all round, out to a view distance you set in ⚙, but only in direct line of sight (buildings and, further off, other cars hide what's behind them). A panel shows what it's doing and why, live — *Waiting · Red light · 20 m*, *Following · car ahead*, *Can't overtake: oncoming traffic* — and the cause is marked in the world (a bracket on the car, a beam at the light, a ring at the bend or roundabout), with sight lines to everything in view. The path drawn ahead (<kbd>G</kbd>) is its real-time plan: the stretch it's about to drive, in its lane, coloured by the speed it intends, ending in a red wall where it means to stop. Overtaking checks the next lane both ways, the bends and junctions ahead, and that it can see far enough to pass safely.
- **Never into the river, never stuck on trees:** routes never set off across water or straight into trees, and off-road the car drives back to the highway by road (`planToHighway`). Off the road it steers round trees, buildings, billboards and the river (`src/lib/avoid.js`) — shifting sideways just enough to clear them, or stopping with the reason if there's no way round — and if it does touch something it slides along it rather than jamming.
- **What it sees** is drawn exactly, at the driver's eye level from 1 m off the car's body: a faint tint (that leaves the scene's shadows alone) out along sight lines cast all round to its view distance (10 m – 500 m, set in ⚙), each stopped by the first building, tree, billboard or car — or where the ground rises to eye level over a crest; the land beyond what it can see is shaded dark; and a box round every car, traffic light (in its colour), tree, building and billboard it notices, the one it's reacting to pulsing. Decisions use the same line of sight, hills included.
- **Lane recognition** (`src/lib/lanes.js`): it knows which lane it's in — its side of the road (traffic keeps left: centre line to kerb) or the roundabout ring — and marks the lane's two edges ahead as faint lines (green; amber when it's out in the other lane overtaking). The panel says *Equator highway · in lane*, *in the other lane*, or *Off-road*.
- **Scale:** 1 unit = 1 m everywhere (a car is 4.3 m; the km/h agree) — signs, trip distances, the panel and the drone's altitude.
- **Traffic keeps left**, as in Nepal: the autopilot drives in the left lane and signs stand on the left.
- **Traffic** (`src/lib/traffic.js`, `src/lib/trafficSim.js`): other cars drive their own trips round the planet by the same rules as your autopilot. Cars are rectangles; each sweeps its own body along the path it's about to drive and slows or stops before touching anyone — the car ahead, a car crossing, one coming head-on — and a hard safety net means no car ever moves into another. They **overtake** slow cars when the other lane is clear, the road is straight and no junction is coming (aborting if something appears), give way to anyone already on a **roundabout** (one car on the ring at a time), never enter a **junction box** that isn't clear, and stop with the **front bumper** behind the line (holding the brake) at red **traffic lights** — which are **actuated**: each approach detects its queue, empty approaches are skipped, a green is extended while cars keep coming (up to a cap) and ends early when its queue clears, the all-red holds until the junction is actually empty, and with no traffic they rest on the highway. Stand-offs resolve by whoever has waited longest, and the car that's in the way backs off to let the other through; a car wedged for long backs up or changes plan. The drone's autopilot climbs over whatever is in its path. Your autopilot obeys all of it. Off / Light (12 cars) / Busy (24) in ⚙. Each car thinks ten times a second — a driver's reaction time — with physics every frame, which keeps busy traffic cheap.
- **Surfaces:** the car tops out at 150 km/h on the equator highway, 90 on roads, 70 on district paving and 45 on grass (less grip, gravel crunch, judder); the gauge shows the limit for where you are.
- **Street signs** (`src/lib/signs.js`): green exit signs before every turn-off, speed limits, blue equator route shields every 45°, brown lane guides with distances.
- **Autopilot:** the vehicle starts on the equator highway and cruises east by itself (the drone glides above it); any drive key takes over, <kbd>P</kbd> hands back, and it re-engages after 45 s idle. Its route (the equator only, or touring every district in a random order by all the roads) and cruise speed (20–150 km/h) are set in ⚙. **Go to** drives you there on autopilot — by road in the car and the drone (which flies the same route at its set altitude); <kbd>P</kbd> cancels the trip. Steering or accelerating in auto mode only overrides it while you hold the keys; let go and it re-plans from where you are. If it gets pinned against something it backs off and tries again, and the minimap draws the route ahead. Press <kbd>G</kbd> (or ⚙) to watch it plan: the search spreads over the road network as a wave of glowing junctions, then the chosen route sweeps in, coloured by the speed it means to do — red where it brakes, through amber, to cyan at full cruise — with a marker on the point it's steering for.
- **Sound** (all synthesized, `src/city/audio.js`): car engine with gears and tyre squeal, four-motor drone whine and air rush, an ambient pad that shifts chord between day and night, black-hole rumble when you face it, wind with altitude, river murmur, district chimes, interface clicks, and the transformation. Volume and channels in ⚙.
- **♫ Planet Radio:** Nepali, Hindi and English stations streamed from official YouTube uploads (artist / label channels) through YouTube's embedded player — nothing is downloaded or hosted here, and the player only loads after you press play (from youtube-nocookie.com). Shuffle, seek, music volume, a *My mix* station for any YouTube link you paste, and videos that refuse embedding are skipped. While playing, a mini player with the video sits bottom-left (YouTube's terms ask for a visible player); *Hide video* switches to music only. <kbd>M</kbd> play/pause, <kbd>N</kbd> next. Song list: `src/content/music.js`.
- **Tools:** 📍 Go to any district, <kbd>X</kbd> unstuck, 📷 / <kbd>K</kbd> screenshot, ⛶ fullscreen, speed/altitude gauge; last vehicle and camera are remembered.
- **⚙ Settings → graphics:** Low / Medium / High presets plus individual switches (resolution, frame-rate cap, anti-aliasing, shadows, sky, stars, black hole detail, atmosphere, trees, night windows, rooftop signs, billboards, street signs, street lamps, labels, river & sea animation). Switching something off unloads it and frees its GPU memory; live FPS, draw calls, triangles and texture counts are shown. Saved per browser (`src/lib/graphics.js`).
- <kbd>C</kbd> look around / drive · <kbd>V</kbd> car / drone · <kbd>T</kbd> chase / eye view · <kbd>H</kbd> help · <kbd>Esc</kbd> close / exit.

## Deploy

Pushing to `main` builds and deploys via GitHub Actions (`.github/workflows/deploy.yml`).
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
