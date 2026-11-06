// Conway's Game of Life on a true infinite plane: a live cell survives with 2
// or 3 live neighbours, a dead one is born with exactly 3, and nothing else
// ever touches the board. A universe is a Map of cell key -> age in
// generations. Whatever leaves the view keeps evolving out there; a universe
// ends when too little is left to watch (see universeEnd). Pure, so it can be
// tested; the drawing is in components/site/LifeBackground.jsx.

const SPAN = 2 ** 21;
const OFFSET = 2 ** 20;
const NEIGHBOURS = [-SPAN - 1, -SPAN, -SPAN + 1, -1, 1, SPAN - 1, SPAN, SPAN + 1];

export const cellKey = (x, y) => (x + OFFSET) * SPAN + (y + OFFSET);
export const cellX = (key) => Math.floor(key / SPAN) - OFFSET;
export const cellY = (key) => key % SPAN - OFFSET;

/** A universe from [x, y] cells, each newly alive. */
export function universeOf(cells) {
  return new Map(cells.map(([x, y]) => [cellKey(x, y), 1]));
}

/** `count` units at random places in the view, none on top of another. */
export function seedUniverse(cols, rows, count, random = Math.random) {
  const out = new Map();
  const wanted = Math.min(count, cols * rows);
  while (out.size < wanted) out.set(cellKey(Math.floor(random() * cols), Math.floor(random() * rows)), 1);
  return out;
}

/** The next generation: B3/S23, exactly. Survivors grow a generation older. */
export function stepUniverse(cells) {
  const counts = new Map();
  for (const key of cells.keys()) {
    for (const d of NEIGHBOURS) counts.set(key + d, (counts.get(key + d) ?? 0) + 1);
  }
  const next = new Map();
  for (const [key, n] of counts) {
    if (n === 3 || (n === 2 && cells.has(key))) next.set(key, Math.min(255, (cells.get(key) ?? 0) + 1));
  }
  return next;
}

/** How many cells are inside the cols × rows view, how many have left it, and a hash of those inside. */
export function censusOf(cells, cols, rows) {
  let inView = 0;
  let outside = 0;
  let signature = 0;
  for (const key of cells.keys()) {
    const x = cellX(key);
    const y = cellY(key);
    if (x < 0 || y < 0 || x >= cols || y >= rows) {
      outside++;
    } else {
      inView++;
      // Summed, so the order of the Map doesn't matter.
      signature = (signature + Math.imul(Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663), 2654435761)) | 0;
    }
  }
  return { inView, outside, signature };
}

const WATCH_PERIOD = 30; // spots any repeat up to this period: still lifes, blinkers, pulsars, pentadecathlons

/**
 * Follows the view across generations. `calm` counts the generations in a row
 * that repeated one of the last few, so it climbs once only still lifes and
 * oscillators are left, however many cells that is.
 */
export function watchUniverse(watch = { seen: [], calm: 0 }, signature) {
  const calm = watch.seen.includes(signature) ? watch.calm + 1 : 0;
  return { seen: [...watch.seen, signature].slice(-WATCH_PERIOD), calm };
}

/** Why this universe is over, or null if it isn't: too few left, drifted out of bounds, or settled. */
export function universeEnd({ inView, outside }, calm, { minUnits, calmLimit }) {
  if (inView < minUnits) return "too few";
  if (outside > inView) return "out of bounds";
  if (calm >= calmLimit) return "settled";
  return null;
}

const NEWBORN = 0.6; // how strong a cell starts out
const MATURE = 8; // generations until it's at full strength
const AFTERGLOW = 0.12; // how much of a dead cell's glow survives each generation
const GONE = 0.03; // below this it's out

/**
 * How strongly each cell in the view shows, 0..1, for drawing: live cells
 * strengthen with age, and dead ones fade over a few generations (`previous` is
 * the last call's result). Written into `out` when given.
 */
export function glowMap(cells, cols, rows, previous = null, out = new Float32Array(cols * rows)) {
  for (let i = 0; i < out.length; i++) {
    const left = previous ? previous[i] * AFTERGLOW : 0;
    out[i] = left < GONE ? 0 : left;
  }
  for (const [key, age] of cells) {
    const x = cellX(key);
    const y = cellY(key);
    if (x >= 0 && y >= 0 && x < cols && y < rows) out[y * cols + x] = NEWBORN + (1 - NEWBORN) * Math.min(1, (age - 1) / MATURE);
  }
  return out;
}

const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/** What a click plants at (x, y): a random connected cluster of 1 to `most` cells, always including (x, y). */
export function randomCluster(x, y, random = Math.random, most = 5) {
  const size = 1 + Math.min(most - 1, Math.floor(random() * most));
  const cluster = [[x, y]];
  const taken = new Set([cellKey(x, y)]);
  while (cluster.length < size) {
    const free = [];
    for (const [cx, cy] of cluster) {
      for (const [dx, dy] of AROUND) {
        if (!taken.has(cellKey(cx + dx, cy + dy))) free.push([cx + dx, cy + dy]);
      }
    }
    const next = free[Math.min(free.length - 1, Math.floor(random() * free.length))];
    if (taken.has(cellKey(next[0], next[1]))) continue;
    taken.add(cellKey(next[0], next[1]));
    cluster.push(next);
  }
  return cluster;
}

/** Every grid cell on the line between two points, ends included, with no gaps. */
export function linePoints(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    points.push([x, y]);
    if (x === x1 && y === y1) return points;
    const e = err * 2;
    if (e > -dy) {
      err -= dy;
      x += sx;
    }
    if (e < dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Adds cells placed by hand, at full strength so they show at once; cells already alive keep their age. */
export function plantCells(cells, points) {
  for (const [x, y] of points) {
    const key = cellKey(x, y);
    if (!cells.has(key)) cells.set(key, MATURE + 1);
  }
  return cells;
}
