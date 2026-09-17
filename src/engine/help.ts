// Help Mode suggestion engine (solo practice only). For a word on the board it
// finds, using the anagram index, the other words you could make with the same
// letters (anagrams) or by adding 1, 2 or 3 more letters (potential steals). It
// also decides a "glow" that signals, at a glance, how stealable the word is
// given the current pool. Pure and framework-free like the rest of the engine.

import type { Dictionary } from "./dictionary";
import type { Morphology } from "./morphology";
import { lettersToCounts, ALPHABET_SIZE } from "./letters";

const CODE_A = 65;

/** Letters considered "common" for the yellow glow rule. */
const COMMON_LETTERS = new Set(["A", "E", "I", "O", "U", "S", "T", "D", "N", "G"]);

export type Glow = "green" | "yellow" | null;

export interface HelpSuggestion {
  /** The target word (a legal steal of the source word). */
  word: string;
  /** The extra letters added to the source word, uppercase and sorted. */
  extra: string;
  /** True when those extra letters are all currently in the pool. */
  formableNow: boolean;
}

export interface WordHelp {
  /** Other valid words with exactly the same letters (different spellings). */
  currentAnagrams: string[];
  /** Legal steals adding 1 / 2 / 3 letters (already root-filtered). */
  plus1: HelpSuggestion[];
  plus2: HelpSuggestion[];
  plus3: HelpSuggestion[];
  /** Whether each +N list was truncated, and by how many. */
  more: { plus1: number; plus2: number; plus3: number };
  /**
   * green  = a legal steal is possible right now with pool letters,
   * yellow = a legal steal needs just 1 more letter, or 2 more common letters,
   * null   = neither.
   */
  glow: Glow;
}

/** Build the sorted-letter key for a counts array (canonical anagram key). */
function keyFromCounts(counts: number[]): string {
  let s = "";
  for (let i = 0; i < ALPHABET_SIZE; i++) {
    if (counts[i] > 0) s += String.fromCharCode(CODE_A + i).repeat(counts[i]);
  }
  return s;
}

/** Enumerate every non-decreasing length-k tuple of letter indices (0-25):
 *  the multisets of k letters (combinations with repetition). */
function* letterMultisets(k: number): Generator<number[]> {
  const idx = new Array<number>(k).fill(0);
  while (true) {
    yield idx;
    let i = k - 1;
    while (i >= 0 && idx[i] === ALPHABET_SIZE - 1) i--;
    if (i < 0) return;
    const v = idx[i] + 1;
    for (let j = i; j < k; j++) idx[j] = v;
  }
}

export interface AnalyzeHelpOptions {
  /** Words to rank first within each list (e.g. the bot's common vocabulary). */
  commonSet?: Set<string>;
  /** Max entries kept per +N list after ranking. Default 24. */
  cap?: number;
}

/**
 * Analyze one board word: its anagrams, its +1/+2/+3 legal steals, and its glow.
 * `poolCounts` is a 26-length letter-count array for the current pool.
 */
export function analyzeHelp(
  word: string,
  poolCounts: number[],
  dictionary: Dictionary,
  morphology: Morphology,
  options?: AnalyzeHelpOptions,
): WordHelp {
  const cap = options?.cap ?? 24;
  const commonSet = options?.commonSet;
  const index = dictionary.getAnagramIndex();
  const wc = lettersToCounts(word);

  const currentAnagrams = (index.get(keyFromCounts(wc)) ?? [])
    .filter((w) => w !== word)
    .sort();

  const sections: HelpSuggestion[][] = [[], [], []];
  let green = false;
  let yellow = false;

  const extraCounts = new Array<number>(ALPHABET_SIZE).fill(0);
  const combined = new Array<number>(ALPHABET_SIZE).fill(0);

  for (let k = 1; k <= 3; k++) {
    for (const combo of letterMultisets(k)) {
      extraCounts.fill(0);
      for (const i of combo) extraCounts[i]++;
      for (let i = 0; i < ALPHABET_SIZE; i++) combined[i] = wc[i] + extraCounts[i];
      const hits = index.get(keyFromCounts(combined));
      if (!hits) continue;

      // How many of the extra letters the pool can't cover, and are they common?
      let deficitTotal = 0;
      let deficitAllCommon = true;
      for (let i = 0; i < ALPHABET_SIZE; i++) {
        const d = extraCounts[i] - poolCounts[i];
        if (d > 0) {
          deficitTotal += d;
          if (!COMMON_LETTERS.has(String.fromCharCode(CODE_A + i))) deficitAllCommon = false;
        }
      }
      const formableNow = deficitTotal === 0;
      const extra = keyFromCounts(extraCounts);

      let anyLegal = false;
      for (const t of hits) {
        if (t === word) continue;
        if (morphology.sameRoot(word, t)) continue; // roots must differ to steal
        anyLegal = true;
        sections[k - 1].push({ word: t, extra, formableNow });
      }
      if (anyLegal) {
        if (formableNow) green = true;
        else if (deficitTotal === 1 || (deficitTotal === 2 && deficitAllCommon)) yellow = true;
      }
    }
  }

  const rank = (a: HelpSuggestion, b: HelpSuggestion): number => {
    if (a.formableNow !== b.formableNow) return a.formableNow ? -1 : 1;
    if (commonSet) {
      const ca = commonSet.has(a.word);
      const cb = commonSet.has(b.word);
      if (ca !== cb) return ca ? -1 : 1;
    }
    if (a.word.length !== b.word.length) return a.word.length - b.word.length;
    return a.word < b.word ? -1 : a.word > b.word ? 1 : 0;
  };

  const finalize = (arr: HelpSuggestion[]): { list: HelpSuggestion[]; more: number } => {
    arr.sort(rank);
    return { list: arr.slice(0, cap), more: Math.max(0, arr.length - cap) };
  };

  const p1 = finalize(sections[0]);
  const p2 = finalize(sections[1]);
  const p3 = finalize(sections[2]);

  return {
    currentAnagrams,
    plus1: p1.list,
    plus2: p2.list,
    plus3: p3.list,
    more: { plus1: p1.more, plus2: p2.more, plus3: p3.more },
    glow: green ? "green" : yellow ? "yellow" : null,
  };
}
