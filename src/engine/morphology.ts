// Root detection for the strict steal rule.
//
// A steal is illegal when the new word shares a ROOT with the word it steals
// (an inflection or derivation of the same base), and legal when the roots
// differ even if one word contains the other. Examples:
//   CAT -> CATS      same root (inflection)      -> illegal
//   CARE -> CAREFUL  same root (derivation)      -> illegal
//   NEWER -> RENEWS  same root NEW (new / renew) -> illegal
//   MILE -> SMILE    different roots             -> legal
//   AXIS -> TAXIS    different roots (axis/taxi) -> legal
//
// Inflections come from a bundled dataset (accurate, no false positives on
// coincidences like CORNER/CORN). Derivations are handled by stripping a
// curated set of affixes, only when the remainder is itself a real word.

import { normalizeWord } from "./letters";
import type { Dictionary } from "./dictionary";

// Curated derivational affixes, longest-first so the longest match wins.
export const DERIV_SUFFIXES = [
  "NESS", "MENT", "SHIP", "HOOD", "WARD", "LESS", "ABLE", "IBLE",
  "FUL", "IZE", "ISE", "IFY",
];
export const DERIV_PREFIXES = [
  "UNDER", "OVER", "DIS", "MIS", "NON", "PRE", "RE", "UN",
];
const MIN_ROOT = 3;
const MAX_STEPS = 12;

export class Morphology {
  private inflection: Map<string, string>;
  private dictionary: Dictionary;
  private rootCache = new Map<string, string>();

  constructor(inflection: Map<string, string>, dictionary: Dictionary) {
    this.inflection = inflection;
    this.dictionary = dictionary;
  }

  /** Reduce a word to its morphological root by peeling inflections (from the
   *  dataset) and curated derivational affixes (only down to real words). */
  rootOf(word: string): string {
    const key = normalizeWord(word);
    const cached = this.rootCache.get(key);
    if (cached) return cached;

    let w = key;
    for (let step = 0; step < MAX_STEPS; step++) {
      const lemma = this.inflection.get(w);
      if (lemma && lemma !== w) {
        w = lemma;
        continue;
      }
      let changed = false;
      for (const suf of DERIV_SUFFIXES) {
        if (w.length - suf.length >= MIN_ROOT && w.endsWith(suf)) {
          const base = w.slice(0, w.length - suf.length);
          if (this.dictionary.isValid(base)) {
            w = base;
            changed = true;
            break;
          }
        }
      }
      if (changed) continue;
      for (const pre of DERIV_PREFIXES) {
        if (w.length - pre.length >= MIN_ROOT && w.startsWith(pre)) {
          const rem = w.slice(pre.length);
          if (this.dictionary.isValid(rem)) {
            w = rem;
            changed = true;
            break;
          }
        }
      }
      if (!changed) break;
    }

    this.rootCache.set(key, w);
    return w;
  }

  /** True when two words share a root (so a steal between them is illegal). */
  sameRoot(a: string, b: string): boolean {
    const na = normalizeWord(a);
    const nb = normalizeWord(b);
    if (na === nb) return true;
    if (this.rootOf(na) === this.rootOf(nb)) return true;

    // Direct affixation the root reduction can miss when the shorter word is
    // below the minimum root length (e.g. DO -> REDO).
    const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
    if (long.length > short.length) {
      if (long.endsWith(short)) {
        const pre = long.slice(0, long.length - short.length);
        if (DERIV_PREFIXES.includes(pre)) return true;
      }
      if (long.startsWith(short)) {
        const suf = long.slice(short.length);
        if (DERIV_SUFFIXES.includes(suf)) return true;
      }
    }
    return false;
  }
}

/** Build a Morphology from lines of "form<TAB>lemma". */
export function buildMorphology(
  lines: Iterable<string>,
  dictionary: Dictionary,
): Morphology {
  const map = new Map<string, string>();
  for (const line of lines) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const form = normalizeWord(line.slice(0, tab));
    const lemma = normalizeWord(line.slice(tab + 1));
    if (form && lemma && form !== lemma) map.set(form, lemma);
  }
  return new Morphology(map, dictionary);
}

/** An empty morphology (no inflections, no reductions): every word is its own
 *  root, so only exact-match words share a root. Handy for tests. */
export function emptyMorphology(dictionary: Dictionary): Morphology {
  return new Morphology(new Map(), dictionary);
}
