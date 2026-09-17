import { useCallback, useEffect, useRef, useState } from "react";
import {
  createGame,
  flipNextTile,
  attemptWord,
  analyzeWord,
  challengeWord,
  tickEndgame,
  endGame,
  moveIsLegal,
  type GameState,
  type GameSettings,
  type Player,
  type Move,
  type Rules,
} from "../engine";
import type { VocabEntry } from "../engine/dictionary";
import { chooseBotMove, botLevel } from "../bot/bot";
import { makeRng } from "../engine/bag";

export interface Feedback {
  id: number;
  text: string;
  kind: "error" | "ok";
}

/** The word event most recently produced, used to prefill the feedback form. */
export interface LastWordEvent {
  original: string;
  created: string;
  outcome: "steal" | "claim" | "rejected";
}

/** One letter while composing a word. A typed letter has no tile; a tapped letter
 *  carries its tile id and (if from an existing word) that word's id, so a steal
 *  source and the used tiles can be inferred. */
interface Slot {
  letter: string;
  tileId?: number;
  wordId?: number;
}

export const YOU_ID = "you";
export const BOT_ID = "bot";

const LOOP_MS = 250;
const ENDGAME_TICK_MS = 250;
const FEEDBACK_MS = 2500;
export const MOVE_ANIM_MS = 1500;

function playersFor(mode: GameSettings["mode"]): Player[] {
  const you: Player = { id: YOU_ID, name: "You", isBot: false };
  if (mode === "practice") return [you];
  return [you, { id: BOT_ID, name: "Bot", isBot: true }];
}

const START_COUNTDOWN_MS = 3000;

/** Create the opening game state. The pool always begins empty: in auto mode the
 *  opening tiles are dealt after the start countdown, and in manual mode the first
 *  Flip press deals them (see the "Flip first four" button). */
function makeStart(settings: GameSettings): GameState {
  return createGame({ players: playersFor(settings.mode), settings });
}

/** How long the bot waits before committing a found move: bounds come from the
 *  difficulty level, scaled by how many letters the move adds, plus extra time
 *  in manual-flip mode where the human is pacing the game. */
function botReactionDelayMs(
  state: GameState,
  move: Move,
  rng: () => number,
): number {
  const level = botLevel(state.settings.difficultyLevel);
  const source =
    move.kind === "steal"
      ? state.words.find((w) => w.id === move.sourceWordId)
      : undefined;
  const added =
    move.kind === "claim"
      ? move.text.length
      : move.text.length - (source?.text.length ?? 0);
  const manualBonus = state.settings.flipMode === "manual" ? 3000 : 0;
  const lo = level.reactionLoMs + manualBonus;
  const hi = level.reactionHiMs + manualBonus;
  const norm = Math.min(1, Math.max(0, (added - 1) / 5));
  const base = lo + norm * (hi - lo);
  const jitter = (rng() * 2 - 1) * 500;
  return Math.max(lo, Math.min(hi + 500, base + jitter));
}

interface PendingBotMove {
  move: Move;
  at: number;
}

export interface UseGame {
  game: GameState;
  feedback: Feedback | null;
  pending: string;
  selectedTileIds: Set<number>;
  challengeId: number | null;
  paused: boolean;
  autoFlipRemainingMs: number | null;
  startCountdownSec: number | null;
  firstFourArmed: boolean;
  lastWordEvent: LastWordEvent | null;
  setPending: (text: string) => void;
  tapTile: (tileId: number, letter: string, fromWordId?: number) => void;
  appendLetter: (letter: string) => void;
  clearPending: () => void;
  backspace: () => void;
  submit: () => void;
  flip: () => void;
  startChallenge: (wordId: number) => void;
  resolveChallenge: (upheld: boolean) => void;
  cancelChallenge: () => void;
  endNow: () => void;
  pause: () => void;
  resume: () => void;
  newGame: (settings: GameSettings) => void;
}

export function useGame(
  rules: Rules,
  vocab: VocabEntry[],
  initialSettings: GameSettings,
): UseGame {
  const [game, setGame] = useState<GameState>(() => makeStart(initialSettings));
  const [startCountdownSec, setStartCountdownSec] = useState<number | null>(() =>
    initialSettings.flipMode === "auto" ? START_COUNTDOWN_MS / 1000 : null,
  );
  const [feedback, setFeedbackState] = useState<Feedback | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const pending = slots.map((s) => s.letter).join("");
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [autoFlipRemainingMs, setAutoFlipRemainingMs] = useState<number | null>(null);
  const [lastWordEvent, setLastWordEvent] = useState<LastWordEvent | null>(null);
  const [firstFourArmed, setFirstFourArmed] = useState<boolean>(
    () => initialSettings.flipMode === "manual" && initialSettings.startWithFourTiles,
  );

  const gameRef = useRef(game);
  gameRef.current = game;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const firstFourRef = useRef(firstFourArmed);
  firstFourRef.current = firstFourArmed;

  const botRng = useRef(makeRng(Math.floor(Math.random() * 2 ** 31)));
  const pendingBot = useRef<PendingBotMove | null>(null);
  const nextFlipAt = useRef(0);
  const animatingUntil = useRef(0);
  const feedbackId = useRef(0);
  const countdownDeadline = useRef(
    initialSettings.flipMode === "auto" ? Date.now() + START_COUNTDOWN_MS : 0,
  );

  const setFeedback = useCallback((f: Omit<Feedback, "id"> | null) => {
    if (!f) {
      setFeedbackState(null);
      return;
    }
    feedbackId.current += 1;
    setFeedbackState({ ...f, id: feedbackId.current });
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const id = feedback.id;
    const t = setTimeout(() => {
      setFeedbackState((cur) => (cur && cur.id === id ? null : cur));
    }, FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [feedback]);

  // Tiles currently used by the composed word (for dimming them).
  const selectedTileIds = new Set(
    slots.filter((s) => s.tileId !== undefined).map((s) => s.tileId as number),
  );

  const setPending = useCallback((text: string) => {
    // Replacing the whole text (mobile input) makes every letter a typed slot.
    const clean = text.toUpperCase().replace(/[^A-Z]/g, "");
    setSlots(clean.split("").map((letter) => ({ letter })));
  }, []);

  const clearPending = useCallback(() => setSlots([]), []);

  const tapTile = useCallback(
    (tileId: number, letter: string, fromWordId?: number) => {
      // Tapping a tile adds its letter; tapping it again removes that letter
      // from the word being built (a toggle).
      setSlots((prev) => {
        const idx = prev.findIndex((s) => s.tileId === tileId);
        if (idx !== -1) return prev.filter((_, i) => i !== idx);
        return [...prev, { letter: letter.toUpperCase(), tileId, wordId: fromWordId }];
      });
    },
    [],
  );

  const appendLetter = useCallback((letter: string) => {
    const up = letter.toUpperCase();
    if (!/^[A-Z]$/.test(up)) return;
    setSlots((prev) => [...prev, { letter: up }]);
  }, []);

  const backspace = useCallback(() => setSlots((prev) => prev.slice(0, -1)), []);

  const submit = useCallback(() => {
    const text = slots.map((s) => s.letter).join("").trim();
    if (text.length === 0) return;
    const g = gameRef.current;
    const srcs = new Set(
      slots.filter((s) => s.wordId !== undefined).map((s) => s.wordId as number),
    );
    const preferSourceWordId = srcs.size === 1 ? [...srcs][0] : undefined;
    const result = attemptWord(g, rules, YOU_ID, text, { preferSourceWordId });
    if (result.ok) {
      setGame(result.state);
      animatingUntil.current = Date.now() + MOVE_ANIM_MS;
      const m = result.move;
      if (m.kind === "steal") {
        const src = g.words.find((w) => w.id === m.sourceWordId);
        const old = src?.text ?? "";
        setLastWordEvent({ original: old, created: m.text, outcome: "steal" });
        const verb = src?.ownerId === YOU_ID ? "Made" : "Stole";
        setFeedback({ text: `${verb} "${m.text}" from "${old}"`, kind: "ok" });
      } else {
        setLastWordEvent({ original: "", created: m.text, outcome: "claim" });
        setFeedback({ text: `Claimed "${m.text}"`, kind: "ok" });
      }
    } else {
      // Prefill feedback with a same-root source, if the rejection was one.
      const analysis = analyzeWord(g, rules, text);
      let original = "";
      for (const w of g.words) {
        if (rules.morphology.sameRoot(w.text, analysis.normalized)) {
          original = w.text;
          break;
        }
      }
      setLastWordEvent({ original, created: analysis.normalized, outcome: "rejected" });
      setFeedback({ text: result.message, kind: "error" });
    }
    // Clear the entry box after every attempt.
    clearPending();
  }, [slots, rules, clearPending, setFeedback]);

  const flip = useCallback(() => {
    if (pausedRef.current) return;
    const n = firstFourRef.current ? 4 : 1;
    if (firstFourRef.current) {
      firstFourRef.current = false;
      setFirstFourArmed(false);
    }
    setGame((gm) => {
      let ng = gm;
      for (let i = 0; i < n && ng.phase === "playing" && ng.bag.length > 0; i++) {
        ng = flipNextTile(ng);
      }
      return ng;
    });
  }, []);

  const startChallenge = useCallback((wordId: number) => setChallengeId(wordId), []);
  const cancelChallenge = useCallback(() => setChallengeId(null), []);
  const resolveChallenge = useCallback((upheld: boolean) => {
    setChallengeId((id) => {
      if (id !== null) setGame((gm) => challengeWord(gm, id, upheld));
      return null;
    });
  }, []);

  const endNow = useCallback(() => {
    setPaused(false);
    setGame((gm) => endGame(gm));
  }, []);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    pendingBot.current = null;
    nextFlipAt.current = Date.now() + gameRef.current.settings.autoFlipIntervalMs;
    setPaused(false);
  }, []);

  const newGame = useCallback(
    (settings: GameSettings) => {
      setGame(makeStart(settings));
      setFeedback(null);
      clearPending();
      setChallengeId(null);
      setPaused(false);
      setLastWordEvent(null);
      pendingBot.current = null;
      nextFlipAt.current = 0;
      animatingUntil.current = 0;
      const auto = settings.flipMode === "auto";
      countdownDeadline.current = auto ? Date.now() + START_COUNTDOWN_MS : 0;
      setStartCountdownSec(auto ? START_COUNTDOWN_MS / 1000 : null);
      setFirstFourArmed(settings.flipMode === "manual" && settings.startWithFourTiles);
      setAutoFlipRemainingMs(null);
      botRng.current = makeRng(Math.floor(Math.random() * 2 ** 31));
    },
    [clearPending, setFeedback],
  );

  // Bot loop (skipped entirely in practice mode).
  useEffect(() => {
    const timer = setInterval(() => {
      const g = gameRef.current;
      if (pausedRef.current || g.phase !== "playing") {
        pendingBot.current = null;
        return;
      }
      if (!g.players.some((p) => p.isBot)) return;
      const level = botLevel(g.settings.difficultyLevel);
      let plan = pendingBot.current;
      if (plan && !moveIsLegal(g, rules, plan.move)) plan = null;
      if (!plan) {
        const move = chooseBotMove(g, rules, vocab, BOT_ID, {
          maxWordLength: level.maxWordLength,
          missProbability: level.missProbability,
          topK: level.topK,
          rng: botRng.current,
        });
        if (move) plan = { move, at: Date.now() + botReactionDelayMs(g, move, botRng.current) };
      }
      if (plan && Date.now() >= plan.at) {
        const move = plan.move;
        const result =
          move.kind === "claim"
            ? attemptWord(g, rules, BOT_ID, move.text)
            : attemptWord(g, rules, BOT_ID, move.text, { preferSourceWordId: move.sourceWordId });
        if (result.ok) {
          setGame(result.state);
          animatingUntil.current = Date.now() + MOVE_ANIM_MS;
        }
        plan = null;
      }
      pendingBot.current = plan;
    }, LOOP_MS);
    return () => clearInterval(timer);
  }, [rules, vocab]);

  // Auto-flip loop with a visible countdown; paused during move animations.
  useEffect(() => {
    const timer = setInterval(() => {
      const g = gameRef.current;
      if (pausedRef.current || g.phase !== "playing" || g.settings.flipMode !== "auto") {
        setAutoFlipRemainingMs(null);
        return;
      }
      const now = Date.now();
      // Start-of-game countdown, then deal the opening tiles.
      if (countdownDeadline.current > now) {
        setStartCountdownSec(Math.ceil((countdownDeadline.current - now) / 1000));
        setAutoFlipRemainingMs(null);
        return;
      }
      if (countdownDeadline.current !== 0) {
        countdownDeadline.current = 0;
        setStartCountdownSec(null);
        setGame((cur) => {
          let ng = cur;
          const n = cur.settings.startWithFourTiles ? 4 : 1;
          for (let i = 0; i < n && ng.bag.length > 0; i++) ng = flipNextTile(ng);
          return ng;
        });
        nextFlipAt.current = now + g.settings.autoFlipIntervalMs;
        setAutoFlipRemainingMs(g.settings.autoFlipIntervalMs);
        return;
      }
      if (g.bag.length === 0) {
        setAutoFlipRemainingMs(null);
        return;
      }
      if (now < animatingUntil.current) {
        // Hold the draw while tiles are animating into a word.
        nextFlipAt.current = animatingUntil.current + g.settings.autoFlipIntervalMs;
        setAutoFlipRemainingMs(nextFlipAt.current - now);
        return;
      }
      if (nextFlipAt.current === 0) nextFlipAt.current = now + g.settings.autoFlipIntervalMs;
      const remaining = nextFlipAt.current - now;
      if (remaining <= 0) {
        setGame((cur) => flipNextTile(cur));
        nextFlipAt.current = now + g.settings.autoFlipIntervalMs;
        setAutoFlipRemainingMs(g.settings.autoFlipIntervalMs);
      } else {
        setAutoFlipRemainingMs(remaining);
      }
    }, LOOP_MS);
    return () => clearInterval(timer);
  }, []);

  // Endgame countdown.
  useEffect(() => {
    const timer = setInterval(() => {
      const g = gameRef.current;
      if (!pausedRef.current && g.phase === "playing" && g.endgame.active) {
        setGame((cur) => tickEndgame(cur, ENDGAME_TICK_MS));
      }
    }, ENDGAME_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // If another player consumes a tile you've tapped for your pending word (a pool
  // tile they claimed/stole, or a word you were stealing that they took first),
  // the selection is stale — clear the entry and deselect the tiles.
  useEffect(() => {
    const tileSlots = slots.filter((s) => s.tileId !== undefined);
    if (tileSlots.length === 0) return;
    const wordIds = new Set(
      slots.filter((s) => s.wordId !== undefined).map((s) => s.wordId as number),
    );
    const available = new Set<number>();
    for (const t of game.pool) available.add(t.id);
    for (const w of game.words) {
      if (wordIds.has(w.id)) for (const t of w.tiles) available.add(t.id);
    }
    const stale = tileSlots.some((s) => !available.has(s.tileId as number));
    if (stale) {
      clearPending();
      setFeedback({ text: "Those letters were taken — entry cleared.", kind: "error" });
    }
  }, [game, slots, clearPending, setFeedback]);

  return {
    game,
    feedback,
    pending,
    selectedTileIds,
    challengeId,
    paused,
    autoFlipRemainingMs,
    startCountdownSec,
    firstFourArmed,
    lastWordEvent,
    setPending,
    tapTile,
    appendLetter,
    clearPending,
    backspace,
    submit,
    flip,
    startChallenge,
    resolveChallenge,
    cancelChallenge,
    endNow,
    pause,
    resume,
    newGame,
  };
}
