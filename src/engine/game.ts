// The functional game core: state creation and the pure transitions that drive a
// game (flip, claim, steal, challenge, timer, end). Every transition returns a
// new GameState and appends to the event log; nothing mutates the input state.

import type { Dictionary } from "./dictionary";
import {
  lettersToCounts,
  countsContain,
  subtractCounts,
  normalizeWord,
} from "./letters";
import { checkStealStructure } from "./steal";
import { buildBag, makeRng } from "./bag";
import type {
  GameState,
  GameSettings,
  Player,
  Tile,
  ClaimedWord,
  Move,
  AttemptResult,
  GameEvent,
} from "./types";

export const DEFAULT_SETTINGS: GameSettings = {
  minWordLength: 4,
  flipMode: "manual",
  autoFlipIntervalMs: 6000,
  endgameSeconds: 60,
  stealBonusSeconds: 15,
};

/** Points for a word of the given length. At least 1 so short words still count
 *  when the minimum length is lowered below 4 in settings. */
export function wordScore(length: number): number {
  return Math.max(1, length - 3);
}

export interface CreateGameOptions {
  players: Player[];
  settings?: Partial<GameSettings>;
  /** Provide a pre-built bag (e.g. for tests). Overrides seed. */
  bag?: Tile[];
  /** Seed for the shuffle when no bag is supplied. */
  seed?: number;
}

export function createGame(options: CreateGameOptions): GameState {
  const settings: GameSettings = { ...DEFAULT_SETTINGS, ...options.settings };
  let nextTileId = 0;
  let bag: Tile[];
  if (options.bag) {
    bag = options.bag.slice();
    nextTileId = bag.reduce((m, t) => Math.max(m, t.id + 1), 0);
  } else {
    const rng = makeRng(options.seed ?? Math.floor(Math.random() * 2 ** 31));
    const built = buildBag(0, rng);
    bag = built.tiles;
    nextTileId = built.nextId;
  }

  const startEvent: GameEvent = {
    seq: 0,
    type: "gameStart",
    settings,
    players: options.players,
  };

  return {
    players: options.players,
    settings,
    phase: "playing",
    bag,
    pool: [],
    words: [],
    endgame: { active: false, remainingMs: null },
    events: [startEvent],
    nextTileId,
    nextWordId: 0,
    nextSeq: 1,
  };
}

/** Total score for one player (sum of their words' point values). */
export function playerScore(state: GameState, playerId: string): number {
  let total = 0;
  for (const w of state.words) {
    if (w.ownerId === playerId) total += wordScore(w.text.length);
  }
  return total;
}

/** Scores for everyone, keyed by player id. */
export function allScores(state: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of state.players) out[p.id] = playerScore(state, p.id);
  return out;
}

/** Reveal the next tile from the bag into the pool. No-op if the bag is empty or
 *  the game is over. Starts the endgame countdown when the last tile is drawn. */
export function flipNextTile(state: GameState): GameState {
  if (state.phase !== "playing" || state.bag.length === 0) return state;

  const bag = state.bag.slice();
  const tile = bag.pop()!;
  const pool = [...state.pool, tile];
  let seq = state.nextSeq;
  const events = state.events.slice();
  events.push({ seq: seq++, type: "flip", tile });

  let endgame = state.endgame;
  if (bag.length === 0) {
    endgame = { active: true, remainingMs: state.settings.endgameSeconds * 1000 };
    events.push({ seq: seq++, type: "endgameStart" });
  }

  return { ...state, bag, pool, endgame, events, nextSeq: seq };
}

// --- Tile assembly helpers -------------------------------------------------

/** Build word tiles from the pool alone (a fresh claim). Returns the ordered
 *  tiles and the pool tiles consumed, or null if not formable. */
function assembleFromPool(
  pool: Tile[],
  word: string,
): { tiles: Tile[]; usedPool: Tile[] } | null {
  const used = new Array<boolean>(pool.length).fill(false);
  const tiles: Tile[] = [];
  const usedPool: Tile[] = [];
  for (const letter of word) {
    let found = -1;
    for (let i = 0; i < pool.length; i++) {
      if (!used[i] && pool[i].letter === letter) {
        found = i;
        break;
      }
    }
    if (found === -1) return null;
    used[found] = true;
    tiles.push(pool[found]);
    usedPool.push(pool[found]);
  }
  return { tiles, usedPool };
}

/** Build word tiles for a steal: reuse ALL of the source word's tiles, plus pool
 *  tiles for the extra letters. Source tiles are preferred so they are all used.
 */
function assembleSteal(
  sourceTiles: Tile[],
  pool: Tile[],
  word: string,
): { tiles: Tile[]; usedPool: Tile[] } | null {
  const usedSource = new Array<boolean>(sourceTiles.length).fill(false);
  const usedPoolFlags = new Array<boolean>(pool.length).fill(false);
  const tiles: Tile[] = [];
  const usedPool: Tile[] = [];
  for (const letter of word) {
    let placed = false;
    for (let i = 0; i < sourceTiles.length; i++) {
      if (!usedSource[i] && sourceTiles[i].letter === letter) {
        usedSource[i] = true;
        tiles.push(sourceTiles[i]);
        placed = true;
        break;
      }
    }
    if (placed) continue;
    for (let i = 0; i < pool.length; i++) {
      if (!usedPoolFlags[i] && pool[i].letter === letter) {
        usedPoolFlags[i] = true;
        tiles.push(pool[i]);
        usedPool.push(pool[i]);
        placed = true;
        break;
      }
    }
    if (!placed) return null;
  }
  // Every source tile must have been reused for a legal steal.
  if (usedSource.some((u) => !u)) return null;
  return { tiles, usedPool };
}

function removeTiles(pool: Tile[], remove: Tile[]): Tile[] {
  const ids = new Set(remove.map((t) => t.id));
  return pool.filter((t) => !ids.has(t.id));
}

// --- Applying moves --------------------------------------------------------

function applyClaim(state: GameState, playerId: string, word: string): GameState {
  const built = assembleFromPool(state.pool, word);
  if (!built) return state;
  const wordId = state.nextWordId;
  const newWord: ClaimedWord = {
    id: wordId,
    ownerId: playerId,
    text: word,
    tiles: built.tiles,
  };
  let seq = state.nextSeq;
  const events = state.events.slice();
  events.push({ seq: seq++, type: "claim", playerId, wordId, text: word });
  return {
    ...state,
    pool: removeTiles(state.pool, built.usedPool),
    words: [...state.words, newWord],
    nextWordId: wordId + 1,
    nextSeq: seq,
    events,
  };
}

function applySteal(
  state: GameState,
  playerId: string,
  word: string,
  sourceWordId: number,
): GameState {
  const source = state.words.find((w) => w.id === sourceWordId);
  if (!source) return state;
  const built = assembleSteal(source.tiles, state.pool, word);
  if (!built) return state;

  const wordId = state.nextWordId;
  const newWord: ClaimedWord = {
    id: wordId,
    ownerId: playerId,
    text: word,
    tiles: built.tiles,
  };

  let seq = state.nextSeq;
  const events = state.events.slice();
  events.push({
    seq: seq++,
    type: "steal",
    playerId,
    wordId,
    text: word,
    sourceWordId: source.id,
    sourceText: source.text,
    sourceOwnerId: source.ownerId,
  });

  // Steals extend the endgame countdown, capped at the configured maximum.
  let endgame = state.endgame;
  if (endgame.active && endgame.remainingMs !== null) {
    const capMs = state.settings.endgameSeconds * 1000;
    const bonus = state.settings.stealBonusSeconds * 1000;
    endgame = {
      active: true,
      remainingMs: Math.min(capMs, endgame.remainingMs + bonus),
    };
  }

  return {
    ...state,
    pool: removeTiles(state.pool, built.usedPool),
    words: [...state.words.filter((w) => w.id !== source.id), newWord],
    endgame,
    nextWordId: wordId + 1,
    nextSeq: seq,
    events,
  };
}

/** Apply an explicit move (used by the tapping UI, which names the source word).
 *  Assumes the move has been validated via analyzeWord. */
export function applyMove(
  state: GameState,
  dictionary: Dictionary,
  move: Move,
): AttemptResult {
  if (move.kind === "claim") {
    return attemptWord(state, dictionary, move.playerId, move.text, {
      preferSourceWordId: undefined,
    });
  }
  return attemptWord(state, dictionary, move.playerId, move.text, {
    preferSourceWordId: move.sourceWordId,
  });
}

export interface AnalyzeResult {
  normalized: string;
  tooShort: boolean;
  dictionaryValid: boolean;
  /** True if the word can be claimed from the pool alone. */
  canClaim: boolean;
  /** Source word ids this word could legally steal (strict rule + pool letters).*/
  steals: number[];
}

/** Inspect a candidate word without changing state. Used for hints and to drive
 *  the attempt logic. */
export function analyzeWord(
  state: GameState,
  dictionary: Dictionary,
  text: string,
): AnalyzeResult {
  const normalized = normalizeWord(text);
  const tooShort = normalized.length < state.settings.minWordLength;
  const dictionaryValid = normalized.length > 0 && dictionary.isValid(normalized);

  const wordCounts = lettersToCounts(normalized);
  const poolCounts = poolLetterCounts(state.pool);
  const canClaim =
    normalized.length > 0 && countsContain(poolCounts, wordCounts);

  const steals: number[] = [];
  if (normalized.length > 0) {
    for (const w of state.words) {
      if (!checkStealStructure(w.text, normalized).legal) continue;
      const extra = subtractCounts(wordCounts, lettersToCounts(w.text));
      if (countsContain(poolCounts, extra)) steals.push(w.id);
    }
  }
  return { normalized, tooShort, dictionaryValid, canClaim, steals };
}

function poolLetterCounts(pool: Tile[]): number[] {
  const counts = new Array<number>(26).fill(0);
  for (const t of pool) {
    const idx = t.letter.charCodeAt(0) - 65;
    if (idx >= 0 && idx < 26) counts[idx]++;
  }
  return counts;
}

/**
 * Attempt a word typed (or tapped) by a player. Auto-detects whether it is a
 * fresh claim or a steal. Prefers a pure claim; otherwise steals a source word.
 * `preferSourceWordId` forces a specific steal source (from the tapping UI).
 */
export function attemptWord(
  state: GameState,
  dictionary: Dictionary,
  playerId: string,
  text: string,
  opts?: { preferSourceWordId?: number },
): AttemptResult {
  if (state.phase !== "playing") {
    return { ok: false, reason: "GAME_OVER", message: "The game is over." };
  }
  const analysis = analyzeWord(state, dictionary, text);
  const { normalized } = analysis;

  if (analysis.tooShort) {
    return {
      ok: false,
      reason: "TOO_SHORT",
      message: `Words must be at least ${state.settings.minWordLength} letters.`,
    };
  }
  if (!analysis.dictionaryValid) {
    return {
      ok: false,
      reason: "NOT_A_WORD",
      message: `"${normalized}" is not in the word list.`,
    };
  }

  // Explicit steal source requested (tapping a specific word).
  if (opts?.preferSourceWordId !== undefined) {
    const id = opts.preferSourceWordId;
    if (!state.words.some((w) => w.id === id)) {
      return { ok: false, reason: "SOURCE_NOT_FOUND", message: "Word not found." };
    }
    if (!analysis.steals.includes(id)) {
      return {
        ok: false,
        reason: "NOT_A_STEAL",
        message: "That is not a legal steal of the selected word.",
      };
    }
    const next = applySteal(state, playerId, normalized, id);
    return { ok: true, state: next, move: { kind: "steal", playerId, text: normalized, sourceWordId: id } };
  }

  // Prefer a pure claim from the pool.
  if (analysis.canClaim) {
    const next = applyClaim(state, playerId, normalized);
    return { ok: true, state: next, move: { kind: "claim", playerId, text: normalized } };
  }

  // Otherwise pick the best steal: steal the longest source word (denies the
  // most points), tie-break by lowest id for determinism.
  if (analysis.steals.length > 0) {
    const sources = analysis.steals
      .map((id) => state.words.find((w) => w.id === id)!)
      .sort((a, b) => b.text.length - a.text.length || a.id - b.id);
    const source = sources[0];
    const next = applySteal(state, playerId, normalized, source.id);
    return { ok: true, state: next, move: { kind: "steal", playerId, text: normalized, sourceWordId: source.id } };
  }

  // Valid dictionary word but the letters are not available.
  return {
    ok: false,
    reason: "NOT_FORMABLE",
    message: "Those letters are not available to make that word.",
  };
}

/** Resolve a challenge against a claimed word. When ruled invalid the word's
 *  tiles go back to the pool and its points are lost (scores derive from words).
 */
export function challengeWord(
  state: GameState,
  wordId: number,
  upheld: boolean,
): GameState {
  const word = state.words.find((w) => w.id === wordId);
  if (!word) return state;

  let seq = state.nextSeq;
  const events = state.events.slice();
  events.push({ seq: seq++, type: "challenge", wordId, text: word.text, upheld });

  if (upheld) {
    return { ...state, events, nextSeq: seq };
  }
  return {
    ...state,
    words: state.words.filter((w) => w.id !== wordId),
    pool: [...state.pool, ...word.tiles],
    events,
    nextSeq: seq,
  };
}

/** Advance the endgame countdown. Ends the game when it reaches zero. */
export function tickEndgame(state: GameState, deltaMs: number): GameState {
  if (state.phase !== "playing") return state;
  if (!state.endgame.active || state.endgame.remainingMs === null) return state;
  const remaining = state.endgame.remainingMs - deltaMs;
  if (remaining > 0) {
    return { ...state, endgame: { active: true, remainingMs: remaining } };
  }
  return endGame({ ...state, endgame: { active: true, remainingMs: 0 } });
}

/** Force the game to end immediately (the "End game" button). */
export function endGame(state: GameState): GameState {
  if (state.phase === "ended") return state;
  let seq = state.nextSeq;
  const events = state.events.slice();
  events.push({ seq: seq++, type: "gameEnd", scores: allScores(state) });
  return { ...state, phase: "ended", events, nextSeq: seq };
}

/** True when there are no tiles left to draw. */
export function bagEmpty(state: GameState): boolean {
  return state.bag.length === 0;
}
