// The word list used for validation, plus a precomputed anagram index used by the
// bot and (later) the practice-mode hint tool.

import { normalizeWord, lettersToCounts, sortedKey } from "./letters";

export interface VocabEntry {
  word: string;
  counts: number[];
}

export class Dictionary {
  private readonly valid: Set<string>;
  private anagramIndex: Map<string, string[]> | null = null;

  constructor(words: Iterable<string>) {
    this.valid = new Set<string>();
    for (const raw of words) {
      const w = normalizeWord(raw);
      if (w.length > 0) this.valid.add(w);
    }
  }

  get size(): number {
    return this.valid.size;
  }

  isValid(word: string): boolean {
    return this.valid.has(normalizeWord(word));
  }

  /**
   * Build (once) and return a map from sorted-letter key to the list of words
   * that use exactly those letters. Lazily built because it is only needed for
   * word discovery, not for plain validation.
   */
  getAnagramIndex(): Map<string, string[]> {
    if (this.anagramIndex) return this.anagramIndex;
    const index = new Map<string, string[]>();
    for (const word of this.valid) {
      const key = sortedKey(word);
      const bucket = index.get(key);
      if (bucket) bucket.push(word);
      else index.set(key, [word]);
    }
    this.anagramIndex = index;
    return index;
  }
}

/**
 * Build the bot's playable vocabulary: the intersection of a common-word list
 * with the validation dictionary, each entry carrying its letter counts so the
 * bot can test formability quickly.
 */
export function buildVocabulary(
  commonWords: Iterable<string>,
  dictionary: Dictionary,
): VocabEntry[] {
  const seen = new Set<string>();
  const entries: VocabEntry[] = [];
  for (const raw of commonWords) {
    const w = normalizeWord(raw);
    if (w.length < 2 || seen.has(w)) continue;
    if (!dictionary.isValid(w)) continue;
    seen.add(w);
    entries.push({ word: w, counts: lettersToCounts(w) });
  }
  return entries;
}
