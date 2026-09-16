// The tile bag: the Bananagrams distribution (144 tiles, no blanks) plus a small
// seeded RNG so games can be reproduced (useful for tests and replay).

import type { Tile } from "./types";

/** Bananagrams letter counts. Totals 144 tiles. */
export const BANANAGRAMS_DISTRIBUTION: Record<string, number> = {
  A: 13, B: 3, C: 3, D: 6, E: 18, F: 3, G: 4, H: 3, I: 12, J: 2, K: 2, L: 5,
  M: 3, N: 8, O: 11, P: 3, Q: 2, R: 9, S: 6, T: 9, U: 6, V: 3, W: 3, X: 2,
  Y: 3, Z: 2,
};

/** Deterministic PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle in place using the provided RNG. */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build a shuffled bag of tiles. Draw order is from the END of the array (pop),
 * so the array is a face-down stack.
 */
export function buildBag(
  startId: number,
  rng: () => number,
  distribution: Record<string, number> = BANANAGRAMS_DISTRIBUTION,
): { tiles: Tile[]; nextId: number } {
  const tiles: Tile[] = [];
  let id = startId;
  for (const [letter, count] of Object.entries(distribution)) {
    for (let i = 0; i < count; i++) {
      tiles.push({ id: id++, letter });
    }
  }
  shuffle(tiles, rng);
  return { tiles, nextId: id };
}
