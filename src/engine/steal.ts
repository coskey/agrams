// Structural part of the steal rule: the new word must use every letter of the
// stolen word plus at least one more. The "different root" requirement lives in
// morphology.ts (see Morphology.sameRoot).

import { lettersToCounts, countsContain, countsTotal } from "./letters";

export interface StealCheck {
  legal: boolean;
  reason?: "NOT_LONGER" | "NOT_SUPERSET";
}

/**
 * Check the structural steal rule between two normalized uppercase words:
 * the new word contains all of the source's letters and is strictly longer.
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
  if (countsTotal(nextCounts) <= countsTotal(sourceCounts)) {
    return { legal: false, reason: "NOT_LONGER" };
  }
  return { legal: true };
}
