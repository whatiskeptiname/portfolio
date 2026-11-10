# Susan Ghimire · portfolio

My personal site: <https://susang.com.np>

- **Home:** what I do and the work behind it, with a short simulation of each project
  and a live Game of Life in the background.
- **Learn:** short, hands-on lessons on how machine learning systems work, each with
  simulations to play with and questions to check yourself. Eight chapters, from
  fitting a line to recommender systems. <https://susang.com.np/#/learn>
- **The planet:** a small 3D world near a black hole, built from my CV and GitHub. Drive
  it in a car or fly it with a drone, by hand or on an autopilot that shows what it
  sees. <https://susang.com.np/#/planet>

## Quick start

Needs Node 22 or newer.

```sh
npm install
npm run dev     # http://localhost:5173/
npm test        # unit tests
npm run lint
npm run build   # production build in dist/
```

Every push to `main` is checked (lint, tests, build) and deployed to GitHub Pages.

## Docs

| | |
|---|---|
| [The home page and its content](docs/site.md) | The sections, the case-study simulations, and where to edit the text |
| [The lessons](docs/lessons.md) | How a lesson is built, and how to add a chapter or lesson |
| [The 3D planet](docs/planet.md) | Controls, the car and drone, the autopilot, traffic, sound and settings |
| [Development](docs/development.md) | How the code fits together, tests, performance and deploying |
| [Privacy and visitor statistics](docs/privacy.md) | What's counted, what never is, and what the site sends anywhere |

## Built with

React 19 and Vite; three.js with @react-three/fiber for the planet; Vitest and ESLint;
GitHub Pages. Visits are counted without cookies by GoatCounter.
