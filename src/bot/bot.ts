// The computer opponent. It searches its restricted (common-word) vocabulary for
// legal claims and steals, scores them, and picks one according to a difficulty
// profile. Timing (the reaction delay) is handled by the UI layer, not here.

import type {
  GameState,
  Move,
  ClaimedWord,
} from "../engine/types";
import type { VocabEntry } from "../engine/dictionary";
import {
  lettersToCounts,
  countsContain,
  subtractCounts,
} from "../engine/letters";
import { wordScore, type Rules } from "../engine/game";

export interface BotConfig {
  /** New words longer than this are ignored (keeps the bot human-beatable). */
  maxWordLength: number;
  /** Chance the bot skips acting on a given think, giving the human a chance. */
  missProbability: number;
  /** Choose randomly among the top-K moves by value rather than always the best.*/
  topK: number;
  rng: () => number;
}

/** A difficulty level (1 easiest .. 5 hardest). Reaction bounds are consumed by
 *  the UI timing layer; the rest tune move quality and frequency. */
export interface BotLevel {
  maxWordLength: number;
  missProbability: number;
  topK: number;
  reactionLoMs: number;
  reactionHiMs: number;
}

export const BOT_LEVELS: Record<number, BotLevel> = {
  1: { maxWordLength: 5, missProbability: 0.7, topK: 6, reactionLoMs: 9000, reactionHiMs: 13000 },
  2: { maxWordLength: 6, missProbability: 0.55, topK: 5, reactionLoMs: 7000, reactionHiMs: 10000 },
  3: { maxWordLength: 8, missProbability: 0.4, topK: 3, reactionLoMs: 5000, reactionHiMs: 8000 },
  4: { maxWordLength: 10, missProbability: 0.2, topK: 2, reactionLoMs: 3500, reactionHiMs: 6000 },
  5: { maxWordLength: 99, missProbability: 0.0, topK: 1, reactionLoMs: 2000, reactionHiMs: 4000 },
};

export const DEFAULT_BOT_LEVEL = 3;

export function botLevel(level: number): BotLevel {
  const clamped = Math.min(5, Math.max(1, Math.round(level)));
  return BOT_LEVELS[clamped] ?? BOT_LEVELS[DEFAULT_BOT_LEVEL];
}

interface Candidate {
  move: Move;
  value: number;
}

function poolCounts(state: GameState): number[] {
  const counts = new Array<number>(26).fill(0);
  for (const t of state.pool) {
    const idx = t.letter.charCodeAt(0) - 65;
    if (idx >= 0 && idx < 26) counts[idx]++;
  }
  return counts;
}

/** All legal claims and steals the bot's vocabulary can make right now. Exposed
 *  for testing and reuse; the bot itself layers difficulty on top. */
export function findBotCandidates(
  state: GameState,
  rules: Rules,
  vocab: VocabEntry[],
  botId: string,
  maxWordLength: number,
): Candidate[] {
  const minLen = state.settings.minWordLength;
  const pc = poolCounts(state);
  const banned = new Set(state.bannedWords);
  const candidates: Candidate[] = [];

  const wordCountsCache = new Map<number, number[]>();
  const countsFor = (w: ClaimedWord): number[] => {
    let c = wordCountsCache.get(w.id);
    if (!c) {
      c = lettersToCounts(w.text);
      wordCountsCache.set(w.id, c);
    }
    return c;
  };

  for (const entry of vocab) {
    const len = entry.word.length;
    if (len < minLen || len > maxWordLength) continue;
    if (banned.has(entry.word)) continue; // challenged out earlier

    // Claim straight from the pool.
    if (countsContain(pc, entry.counts)) {
      candidates.push({
        move: { kind: "claim", playerId: botId, text: entry.word },
        value: wordScore(len, minLen),
      });
    }

    // Steal an existing word.
    for (const w of state.words) {
      if (len <= w.text.length) continue;
      const wc = countsFor(w);
      if (!countsContain(entry.counts, wc)) continue; // must use all of source
      if (rules.morphology.sameRoot(w.text, entry.word)) continue; // different root
      const extra = subtractCounts(entry.counts, wc);
      if (!countsContain(pc, extra)) continue; // extras must be in the pool
      const gain = wordScore(len, minLen);
      const sourceScore = wordScore(w.text.length, minLen);
      const denied = w.ownerId === botId ? -sourceScore : sourceScore;
      candidates.push({
        move: { kind: "steal", playerId: botId, text: entry.word, sourceWordId: w.id },
        value: gain + denied,
      });
    }
  }
  return candidates;
}

/**
 * Choose a move for the bot, or null to do nothing this think. Deterministic
 * given the RNG, so it can be tested with a seeded RNG.
 */
export function chooseBotMove(
  state: GameState,
  rules: Rules,
  vocab: VocabEntry[],
  botId: string,
  config: BotConfig,
): Move | null {
  if (state.phase !== "playing") return null;

  const candidates = findBotCandidates(state, rules, vocab, botId, config.maxWordLength);
  if (candidates.length === 0) return null;

  // Sometimes hold back so the human can grab a word first.
  if (config.rng() < config.missProbability) return null;

  candidates.sort((a, b) => b.value - a.value);
  const pool = candidates.slice(0, Math.max(1, config.topK));
  const pick = pool[Math.floor(config.rng() * pool.length)];
  return pick.move;
}
