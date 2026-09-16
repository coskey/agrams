// Letter and multiset helpers. Words are handled in uppercase A-Z throughout the
// engine. A "counts" value is a 26-length array indexed by letter (A = 0).

export const ALPHABET_SIZE = 26;
const CODE_A = 65;

/** Uppercase a string and drop everything that is not an A-Z letter. */
export function normalizeWord(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, "");
}

/** Index 0-25 for an uppercase letter, or -1 if out of range. */
export function letterIndex(letter: string): number {
  const i = letter.charCodeAt(0) - CODE_A;
  return i >= 0 && i < ALPHABET_SIZE ? i : -1;
}

/** Build a 26-length letter-count array from a normalized word. */
export function lettersToCounts(word: string): number[] {
  const counts = new Array<number>(ALPHABET_SIZE).fill(0);
  for (let i = 0; i < word.length; i++) {
    const idx = word.charCodeAt(i) - CODE_A;
    if (idx >= 0 && idx < ALPHABET_SIZE) counts[idx]++;
  }
  return counts;
}

/** True when `whole` contains at least as many of every letter as `part`. */
export function countsContain(whole: number[], part: number[]): boolean {
  for (let i = 0; i < ALPHABET_SIZE; i++) {
    if (whole[i] < part[i]) return false;
  }
  return true;
}

/** True when two count arrays are identical. */
export function countsEqual(a: number[], b: number[]): boolean {
  for (let i = 0; i < ALPHABET_SIZE; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** a - b, per letter. Assumes countsContain(a, b). */
export function subtractCounts(a: number[], b: number[]): number[] {
  const out = new Array<number>(ALPHABET_SIZE).fill(0);
  for (let i = 0; i < ALPHABET_SIZE; i++) out[i] = a[i] - b[i];
  return out;
}

/** Total number of letters represented by a counts array. */
export function countsTotal(a: number[]): number {
  let sum = 0;
  for (let i = 0; i < ALPHABET_SIZE; i++) sum += a[i];
  return sum;
}

/** Canonical anagram key: the word's letters sorted. */
export function sortedKey(word: string): string {
  return word.split("").sort().join("");
}
