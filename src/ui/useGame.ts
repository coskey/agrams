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
  lastWordEvent: LastWordEvent | null;
  setPending: (text: string) => void;
  tapTile: (tileId: number, letter: string, fromWordId?: number) => void;
  clearPending: () => void;
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
  const [game, setGame] = useState<GameState>(() =>
    createGame({ players: playersFor(initialSettings.mode), settings: initialSettings }),
  );
  const [feedback, setFeedbackState] = useState<Feedback | null>(null);
  const [pending, setPendingState] = useState("");
  const [selectedTileIds, setSelectedTileIds] = useState<Set<number>>(new Set());
  const [sourceIds, setSourceIds] = useState<Set<number>>(new Set());
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [autoFlipRemainingMs, setAutoFlipRemainingMs] = useState<number | null>(null);
  const [lastWordEvent, setLastWordEvent] = useState<LastWordEvent | null>(null);

  const gameRef = useRef(game);
  gameRef.current = game;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const botRng = useRef(makeRng(Math.floor(Math.random() * 2 ** 31)));
  const pendingBot = useRef<PendingBotMove | null>(null);
  const nextFlipAt = useRef(0);
  const animatingUntil = useRef(0);
  const feedbackId = useRef(0);

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

  const setPending = useCallback((text: string) => {
    setPendingState(text);
    setSelectedTileIds(new Set());
    setSourceIds(new Set());
  }, []);

  const clearPending = useCallback(() => {
    setPendingState("");
    setSelectedTileIds(new Set());
    setSourceIds(new Set());
  }, []);

  const tapTile = useCallback(
    (tileId: number, letter: string, fromWordId?: number) => {
      setSelectedTileIds((prev) => {
        if (prev.has(tileId)) return prev;
        const next = new Set(prev);
        next.add(tileId);
        return next;
      });
      setPendingState((p) => p + letter.toUpperCase());
      if (fromWordId !== undefined) {
        setSourceIds((prev) => {
          const next = new Set(prev);
          next.add(fromWordId);
          return next;
        });
      }
    },
    [],
  );

  const submit = useCallback(() => {
    const text = pending.trim();
    if (text.length === 0) return;
    const g = gameRef.current;
    const preferSourceWordId = sourceIds.size === 1 ? [...sourceIds][0] : undefined;
    const result = attemptWord(g, rules, YOU_ID, text, { preferSourceWordId });
    if (result.ok) {
      setGame(result.state);
      animatingUntil.current = Date.now() + MOVE_ANIM_MS;
      const m = result.move;
      if (m.kind === "steal") {
        const src = g.words.find((w) => w.id === m.sourceWordId);
        setLastWordEvent({ original: src?.text ?? "", created: m.text, outcome: "steal" });
        setFeedback({ text: `Stole ${m.text}`, kind: "ok" });
      } else {
        setLastWordEvent({ original: "", created: m.text, outcome: "claim" });
        setFeedback({ text: `Claimed ${m.text}`, kind: "ok" });
      }
      clearPending();
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
  }, [pending, sourceIds, rules, clearPending, setFeedback]);

  const flip = useCallback(() => {
    if (pausedRef.current) return;
    setGame((gm) => flipNextTile(gm));
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
      setGame(createGame({ players: playersFor(settings.mode), settings }));
      setFeedback(null);
      clearPending();
      setChallengeId(null);
      setPaused(false);
      setLastWordEvent(null);
      pendingBot.current = null;
      nextFlipAt.current = 0;
      animatingUntil.current = 0;
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
      if (g.bag.length === 0) {
        setAutoFlipRemainingMs(null);
        return;
      }
      const now = Date.now();
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

  return {
    game,
    feedback,
    pending,
    selectedTileIds,
    challengeId,
    paused,
    autoFlipRemainingMs,
    lastWordEvent,
    setPending,
    tapTile,
    clearPending,
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
