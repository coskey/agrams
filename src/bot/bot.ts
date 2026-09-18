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
  /** When set, also search the FULL dictionary for steals (adding up to this
   *  many pool letters) via the anagram index — the "unreal" level's edge. */
  deepStealAdd?: number;
  rng: () => number;
}

/** A difficulty level (1 easiest .. 6 hardest). Reaction bounds are consumed by
 *  the UI timing layer; the rest tune move quality and frequency. */
export interface BotLevel {
  maxWordLength: number;
  missProbability: number;
  topK: number;
  reactionLoMs: number;
  reactionHiMs: number;
  /** Extra pool letters the full-dictionary steal search may add (0 = off). */
  deepStealAdd?: number;
}

export const BOT_LEVELS: Record<number, BotLevel> = {
  1: { maxWordLength: 5, missProbability: 0.7, topK: 6, reactionLoMs: 9000, reactionHiMs: 13000 },
  2: { maxWordLength: 6, missProbability: 0.55, topK: 5, reactionLoMs: 7000, reactionHiMs: 10000 },
  3: { maxWordLength: 8, missProbability: 0.4, topK: 3, reactionLoMs: 5000, reactionHiMs: 8000 },
  4: { maxWordLength: 10, missProbability: 0.2, topK: 2, reactionLoMs: 3500, reactionHiMs: 6000 },
  5: { maxWordLength: 99, missProbability: 0.0, topK: 1, reactionLoMs: 2000, reactionHiMs: 4000 },
  // Unreal: L5's decision quality, faster hands, and a full-dictionary steal
  // search (adds up to 4 pool letters to any board word).
  6: { maxWordLength: 99, missProbability: 0.0, topK: 1, reactionLoMs: 1000, reactionHiMs: 2500, deepStealAdd: 3 },
};

export const DEFAULT_BOT_LEVEL = 3;
export const MAX_BOT_LEVEL = 6;

export function botLevel(level: number): BotLevel {
  const clamped = Math.min(MAX_BOT_LEVEL, Math.max(1, Math.round(level)));
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

function keyFromCounts(counts: number[]): string {
  let s = "";
  for (let i = 0; i < 26; i++) {
    if (counts[i] > 0) s += String.fromCharCode(65 + i).repeat(counts[i]);
  }
  return s;
}

/** Enumerate non-empty letter multisets drawn from the pool, up to `maxK` tiles,
 *  yielding a shared counts array (read it before requesting the next). */
function* poolAdditions(pc: number[], maxK: number): Generator<number[]> {
  const extra = new Array<number>(26).fill(0);
  function* rec(start: number, remaining: number): Generator<number[]> {
    for (let i = start; i < 26; i++) {
      if (pc[i] === 0) continue;
      const maxTake = Math.min(pc[i], remaining);
      for (let take = 1; take <= maxTake; take++) {
        extra[i] = take;
        yield extra;
        if (remaining - take > 0) yield* rec(i + 1, remaining - take);
      }
      extra[i] = 0;
    }
  }
  yield* rec(0, maxK);
}

/** Steals over the WHOLE dictionary (not just the common vocab): for each board
 *  word, add up to `maxAdded` pool letters and look the result up in the anagram
 *  index. Bounded by pool sub-multisets, so it stays fast. */
export function findDeepStealCandidates(
  state: GameState,
  rules: Rules,
  botId: string,
  maxAdded: number,
): Candidate[] {
  const minLen = state.settings.minWordLength;
  const pc = poolCounts(state);
  const banned = new Set(state.bannedWords);
  const index = rules.dictionary.getAnagramIndex();
  const out: Candidate[] = [];
  const combined = new Array<number>(26).fill(0);

  // The enumeration grows with pool size, so cap the added letters on big pools
  // to keep each search fast.
  const poolSize = state.pool.length;
  const k = poolSize > 24 ? Math.min(maxAdded, 2) : poolSize > 18 ? Math.min(maxAdded, 3) : maxAdded;

  for (const w of state.words) {
    const wc = lettersToCounts(w.text);
    const sourceScore = wordScore(w.text.length, minLen);
    const denied = w.ownerId === botId ? -sourceScore : sourceScore;
    for (const extra of poolAdditions(pc, k)) {
      for (let i = 0; i < 26; i++) combined[i] = wc[i] + extra[i];
      const hits = index.get(keyFromCounts(combined));
      if (!hits) continue;
      for (const t of hits) {
        if (t.length <= w.text.length) continue;
        if (banned.has(t)) continue;
        if (rules.morphology.sameRoot(w.text, t)) continue;
        out.push({
          move: { kind: "steal", playerId: botId, text: t, sourceWordId: w.id },
          value: wordScore(t.length, minLen) + denied,
        });
      }
    }
  }
  return out;
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

  // The "unreal" level also mines the whole dictionary for steals.
  if (config.deepStealAdd && config.deepStealAdd > 0) {
    const seen = new Set(
      candidates.map((c) =>
        c.move.kind === "steal" ? `${c.move.text}|${c.move.sourceWordId}` : "",
      ),
    );
    for (const c of findDeepStealCandidates(state, rules, botId, config.deepStealAdd)) {
      const move = c.move;
      if (move.kind !== "steal") continue;
      const key = `${move.text}|${move.sourceWordId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(c);
    }
  }

  if (candidates.length === 0) return null;

  // Sometimes hold back so the human can grab a word first.
  if (config.rng() < config.missProbability) return null;

  candidates.sort((a, b) => b.value - a.value);
  const pool = candidates.slice(0, Math.max(1, config.topK));
  const pick = pool[Math.floor(config.rng() * pool.length)];
  return pick.move;
}
