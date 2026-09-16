// The strict "classic" steal rule.
//
// A steal from word A to word B is legal only if:
//   1. B is a valid dictionary word          (checked by the caller)
//   2. B uses every letter of A plus >= 1 more (multiset superset, strictly longer)
//   3. A does NOT appear as a contiguous substring of B (a real rearrangement)
//
// This module covers rules 2 and 3, which are purely structural. Rule 1 and the
// "the extra letters are actually available in the pool" check live in game.ts.

import { lettersToCounts, countsContain, countsTotal } from "./letters";

export interface StealCheck {
  legal: boolean;
  reason?: "NOT_LONGER" | "NOT_SUPERSET" | "SAME_ROOT";
}

/**
 * Check the structural steal rule between two already-normalized uppercase words.
 */
export function checkStealStructure(source: string, next: string): StealCheck {
  if (next.length <= source.length) {
    return { legal: false, reason: "NOT_LONGER" };
  }
  const sourceCounts = lettersToCounts(source);
  const nextCounts = lettersToCounts(next);
  if (!countsContain(nextCounts, sourceCounts)) {
    return { legal: false, reason: "NOT_SUPERSET" };
  }
  // Must add at least one letter (guaranteed by the length check above, but kept
  // explicit for clarity).
  if (countsTotal(nextCounts) <= countsTotal(sourceCounts)) {
    return { legal: false, reason: "NOT_LONGER" };
  }
  // Rule 3: reject plain extensions where the source survives as a contiguous
  // block (CAT->CATS, ART->PART, CAT->SCAT).
  if (next.includes(source)) {
    return { legal: false, reason: "SAME_ROOT" };
  }
  return { legal: true };
}

/** Convenience boolean form. */
export function isLegalStealStructure(source: string, next: string): boolean {
  return checkStealStructure(source, next).legal;
}
