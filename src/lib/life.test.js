import { describe, expect, it } from "vitest";
import { cellKey, cellX, cellY, censusOf, glowMap, linePoints, plantCells, randomCluster, seedUniverse, stepUniverse, universeEnd, universeOf, watchUniverse } from "./life";

const cells = (u) => [...u.keys()].map((k) => [cellX(k), cellY(k)]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const run = (u, n) => {
  for (let i = 0; i < n; i++) u = stepUniverse(u);
  return u;
};
const BLOCK = [[2, 2], [3, 2], [2, 3], [3, 3]];
const BLINKER = [[3, 3], [4, 3], [5, 3]];
const GLIDER = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];

describe("Conway's rules on an infinite plane", () => {
  it("round-trips cell keys, negative coordinates included", () => {
    for (const [x, y] of [[0, 0], [5, 9], [-7, 3], [12, -40], [-1000, -1000]]) {
      expect([cellX(cellKey(x, y)), cellY(cellKey(x, y))]).toEqual([x, y]);
    }
  });

  it("keeps a block still and flips a blinker", () => {
    expect(cells(stepUniverse(universeOf(BLOCK)))).toEqual(cells(universeOf(BLOCK)));
    const tall = stepUniverse(universeOf(BLINKER));
    expect(cells(tall)).toEqual([[4, 2], [4, 3], [4, 4]]);
    expect(cells(stepUniverse(tall))).toEqual(cells(universeOf(BLINKER)));
  });

  it("kills the lonely and the overcrowded", () => {
    expect(stepUniverse(universeOf([[5, 5]])).size).toBe(0);
    const plus = universeOf([[4, 3], [3, 4], [4, 4], [5, 4], [4, 5]]);
    expect(stepUniverse(plus).has(cellKey(4, 4))).toBe(false);
  });

  it("lets a glider fly on forever without wrapping round", () => {
    const far = run(universeOf(GLIDER), 4 * 500);
    expect(cells(far)).toEqual(cells(universeOf(GLIDER.map(([x, y]) => [x + 500, y + 500]))));
  });

  it("grows the R-pentomino to its known end state: 116 cells at generation 1103", () => {
    expect(run(universeOf([[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]]), 1103).size).toBe(116);
  });

  it("ages survivors and starts newborns at 1", () => {
    const u = run(universeOf(BLINKER), 3);
    expect(u.get(cellKey(4, 3))).toBe(4); // the middle has lived throughout
    expect(u.get(cellKey(4, 2))).toBe(1); // reborn
    const old = new Map([...universeOf(BLOCK).keys()].map((k) => [k, 255]));
    expect(stepUniverse(old).get(cellKey(2, 2))).toBe(255);
  });
});

describe("starting a universe", () => {
  it("places the requested units inside the view", () => {
    const u = seedUniverse(20, 10, 30);
    expect(u.size).toBe(30);
    for (const [x, y] of cells(u)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(20);
      expect(y).toBeLessThan(10);
    }
  });

  it("can't ask for more units than fit", () => {
    expect(seedUniverse(3, 3, 100).size).toBe(9);
  });

  it("is different each time", () => {
    expect(cells(seedUniverse(50, 50, 40))).not.toEqual(cells(seedUniverse(50, 50, 40)));
  });
});

describe("ending a universe", () => {
  const limits = { minUnits: 10, calmLimit: 12 };

  it("counts who's in view and who has left", () => {
    const c = censusOf(universeOf([[0, 0], [9, 9], [10, 0], [-1, 5]]), 10, 10);
    expect(c).toMatchObject({ inView: 2, outside: 2 });
  });

  it("ends with too few units, or with most out of bounds", () => {
    expect(universeEnd({ inView: 9, outside: 0 }, 0, limits)).toBe("too few");
    expect(universeEnd({ inView: 20, outside: 21 }, 0, limits)).toBe("out of bounds");
    expect(universeEnd({ inView: 20, outside: 20 }, 0, limits)).toBeNull();
  });

  const calmAfter = (start, generations, cols = 60, rows = 60) => {
    let u = universeOf(start);
    let w = undefined;
    for (let i = 0; i < generations; i++) {
      u = stepUniverse(u);
      w = watchUniverse(w, censusOf(u, cols, rows).signature);
    }
    return w.calm;
  };

  it("notices when only still lifes and oscillators are left", () => {
    expect(calmAfter(BLOCK, 20)).toBeGreaterThanOrEqual(12);
    expect(calmAfter([...BLOCK, ...BLINKER.map(([x, y]) => [x + 20, y + 20])], 20)).toBeGreaterThanOrEqual(12);
    expect(universeEnd({ inView: 40, outside: 0 }, 12, limits)).toBe("settled");
  });

  it("stays patient with anything still moving", () => {
    const start = GLIDER.map(([x, y]) => [x + 5, y + 5]);
    expect(calmAfter(start, 100, 200, 200)).toBeLessThan(12);
  });

  it("ignores gliders once they've left: the view has still settled", () => {
    expect(calmAfter([...BLOCK.map(([x, y]) => [x + 2, y + 40]), ...GLIDER.map(([x, y]) => [x + 40, y + 40])], 150)).toBeGreaterThanOrEqual(12);
  });
});

describe("the glow map", () => {
  const C = 10;
  const R = 8;
  const at = (map, x, y) => map[y * C + x];

  it("strengthens live cells with age, and leaves the rest dark", () => {
    const newborn = glowMap(universeOf(BLOCK), C, R);
    expect(at(newborn, 2, 2)).toBeCloseTo(0.6);
    expect(at(newborn, 8, 7)).toBe(0);
    const old = new Map([...universeOf(BLOCK).keys()].map((k) => [k, 50]));
    expect(at(glowMap(old, C, R), 2, 2)).toBeCloseTo(1);
  });

  it("leaves dead cells a faint trace for one generation, then nothing", () => {
    let map = glowMap(universeOf(BLOCK), C, R);
    const empty = new Map();
    map = glowMap(empty, C, R, map);
    expect(at(map, 2, 2)).toBeCloseTo(0.072);
    map = glowMap(empty, C, R, map);
    expect(at(map, 2, 2)).toBe(0);
  });

  it("relights a fading cell that's reborn", () => {
    const faded = glowMap(new Map(), C, R, glowMap(universeOf(BLOCK), C, R));
    expect(at(glowMap(universeOf(BLOCK), C, R, faded), 2, 2)).toBeCloseTo(0.6);
  });

  it("skips cells outside the view, without wrapping round", () => {
    const map = glowMap(universeOf([[-1, 0], [C, 3], [0, R]]), C, R);
    expect(map.reduce((a, b) => a + b)).toBe(0);
  });

  it("writes into a reused buffer", () => {
    const out = new Float32Array(C * R).fill(1);
    expect(glowMap(universeOf(BLOCK), C, R, null, out)).toBe(out);
    expect(at(out, 8, 7)).toBe(0);
  });
});

describe("drawing by hand", () => {
  const touching = ([a, b], [c, d]) => Math.max(Math.abs(a - c), Math.abs(b - d)) === 1;

  it("draws lines with no gaps, in any direction", () => {
    for (const [x0, y0, x1, y1] of [[0, 0, 7, 3], [7, 3, 0, 0], [2, 9, 2, 1], [-3, -3, 4, 4], [5, 5, 5, 5], [0, 0, 1, 9]]) {
      const line = linePoints(x0, y0, x1, y1);
      expect(line[0]).toEqual([x0, y0]);
      expect(line.at(-1)).toEqual([x1, y1]);
      for (let i = 1; i < line.length; i++) expect(touching(line[i - 1], line[i])).toBe(true);
    }
  });

  it("shows planted cells at full strength, and leaves living ones alone", () => {
    const u = universeOf([[1, 1]]);
    plantCells(u, [[1, 1], [5, 5]]);
    expect(u.get(cellKey(1, 1))).toBe(1);
    expect(glowMap(u, 10, 10)[5 * 10 + 5]).toBeCloseTo(1);
  });

  it("makes click clusters of every size from 1 to 5, connected and including the click", () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const sizes = new Set();
    const shapes = new Set();
    for (let i = 0; i < 500; i++) {
      const cluster = randomCluster(5, 5, random);
      sizes.add(cluster.length);
      shapes.add(cells(universeOf(cluster)).join(";"));
      expect(cluster[0]).toEqual([5, 5]);
      expect(new Set(cluster.map(([x, y]) => cellKey(x, y))).size).toBe(cluster.length);
      for (let k = 1; k < cluster.length; k++) expect(cluster.slice(0, k).some((c) => touching(c, cluster[k]))).toBe(true);
    }
    expect([...sizes].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(shapes.size).toBeGreaterThan(50);
  });

  it("copes with a random source stuck at its extremes", () => {
    expect(randomCluster(0, 0, () => 0)).toHaveLength(1);
    expect(randomCluster(0, 0, () => 0.999)).toHaveLength(5);
  });
});
