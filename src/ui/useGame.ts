import { useCallback, useEffect, useRef, useState } from "react";
import {
  createGame,
  flipNextTile,
  attemptWord,
  challengeWord,
  tickEndgame,
  endGame,
  moveIsLegal,
  type GameState,
  type GameSettings,
  type Player,
  type Move,
} from "../engine";
import type { Dictionary, VocabEntry } from "../engine/dictionary";
import { chooseBotMove, MEDIUM_BOT } from "../bot/bot";
import { makeRng } from "../engine/bag";

export interface Feedback {
  id: number;
  text: string;
  kind: "error" | "ok";
}

export const YOU_ID = "you";
export const BOT_ID = "bot";

const LOOP_MS = 250; // how often timers/bot are evaluated
const ENDGAME_TICK_MS = 250;
const FEEDBACK_MS = 2500;

function defaultPlayers(): Player[] {
  return [
    { id: YOU_ID, name: "You", isBot: false },
    { id: BOT_ID, name: "Bot", isBot: true },
  ];
}

/**
 * How long the bot waits before committing a found move. Medium difficulty gives
 * a human-usable buffer: 5-8s in auto-flip mode, 8-10s in manual mode, scaled by
 * how many letters the move adds.
 */
function botReactionDelayMs(
  state: GameState,
  move: Move,
  rng: () => number,
): number {
  const source =
    move.kind === "steal"
      ? state.words.find((w) => w.id === move.sourceWordId)
      : undefined;
  const added =
    move.kind === "claim"
      ? move.text.length
      : move.text.length - (source?.text.length ?? 0);
  const manual = state.settings.flipMode === "manual";
  const lo = manual ? 8000 : 5000;
  const hi = manual ? 10000 : 8000;
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
  // actions
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
  dictionary: Dictionary,
  vocab: VocabEntry[],
  initialSettings: GameSettings,
): UseGame {
  const [game, setGame] = useState<GameState>(() =>
    createGame({ players: defaultPlayers(), settings: initialSettings }),
  );
  const [feedback, setFeedbackState] = useState<Feedback | null>(null);
  const [pending, setPendingState] = useState("");
  const [selectedTileIds, setSelectedTileIds] = useState<Set<number>>(new Set());
  const [sourceIds, setSourceIds] = useState<Set<number>>(new Set());
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [autoFlipRemainingMs, setAutoFlipRemainingMs] = useState<number | null>(
    null,
  );

  const gameRef = useRef(game);
  gameRef.current = game;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const botRng = useRef(makeRng(Math.floor(Math.random() * 2 ** 31)));
  const pendingBot = useRef<PendingBotMove | null>(null);
  const nextFlipAt = useRef(0);
  const feedbackId = useRef(0);

  const setFeedback = useCallback((f: Omit<Feedback, "id"> | null) => {
    if (!f) {
      setFeedbackState(null);
      return;
    }
    feedbackId.current += 1;
    setFeedbackState({ ...f, id: feedbackId.current });
  }, []);

  // Fade feedback away after a short while.
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
    const preferSourceWordId =
      sourceIds.size === 1 ? [...sourceIds][0] : undefined;
    const result = attemptWord(gameRef.current, dictionary, YOU_ID, text, {
      preferSourceWordId,
    });
    if (result.ok) {
      setGame(result.state);
      const verb = result.move.kind === "steal" ? "Stole" : "Claimed";
      setFeedback({ text: `${verb} ${result.move.text}`, kind: "ok" });
      clearPending();
    } else {
      setFeedback({ text: result.message, kind: "error" });
    }
  }, [pending, sourceIds, dictionary, clearPending, setFeedback]);

  const flip = useCallback(() => {
    if (pausedRef.current) return;
    setGame((g) => flipNextTile(g));
  }, []);

  const startChallenge = useCallback((wordId: number) => {
    setChallengeId(wordId);
  }, []);
  const cancelChallenge = useCallback(() => setChallengeId(null), []);
  const resolveChallenge = useCallback((upheld: boolean) => {
    setChallengeId((id) => {
      if (id !== null) setGame((g) => challengeWord(g, id, upheld));
      return null;
    });
  }, []);

  const endNow = useCallback(() => {
    setPaused(false);
    setGame((g) => endGame(g));
  }, []);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    // Avoid a burst of catch-up actions after resuming.
    pendingBot.current = null;
    nextFlipAt.current = Date.now() + gameRef.current.settings.autoFlipIntervalMs;
    setPaused(false);
  }, []);

  const newGame = useCallback(
    (settings: GameSettings) => {
      setGame(createGame({ players: defaultPlayers(), settings }));
      setFeedback(null);
      clearPending();
      setChallengeId(null);
      setPaused(false);
      pendingBot.current = null;
      nextFlipAt.current = 0;
      setAutoFlipRemainingMs(null);
      botRng.current = makeRng(Math.floor(Math.random() * 2 ** 31));
    },
    [clearPending, setFeedback],
  );

  // Bot loop: plan a move, wait a human-usable delay, then commit it.
  useEffect(() => {
    const timer = setInterval(() => {
      const g = gameRef.current;
      if (pausedRef.current || g.phase !== "playing") {
        pendingBot.current = null;
        return;
      }
      let plan = pendingBot.current;
      if (plan && !moveIsLegal(g, dictionary, plan.move)) plan = null;
      if (!plan) {
        const move = chooseBotMove(g, dictionary, vocab, BOT_ID, {
          ...MEDIUM_BOT,
          rng: botRng.current,
        });
        if (move) {
          plan = { move, at: Date.now() + botReactionDelayMs(g, move, botRng.current) };
        }
      }
      if (plan && Date.now() >= plan.at) {
        const move = plan.move;
        const result =
          move.kind === "claim"
            ? attemptWord(g, dictionary, BOT_ID, move.text)
            : attemptWord(g, dictionary, BOT_ID, move.text, {
                preferSourceWordId: move.sourceWordId,
              });
        if (result.ok) setGame(result.state);
        plan = null;
      }
      pendingBot.current = plan;
    }, LOOP_MS);
    return () => clearInterval(timer);
  }, [dictionary, vocab]);

  // Auto-flip loop with a visible countdown to the next tile.
  useEffect(() => {
    const timer = setInterval(() => {
      const g = gameRef.current;
      if (
        pausedRef.current ||
        g.phase !== "playing" ||
        g.settings.flipMode !== "auto"
      ) {
        setAutoFlipRemainingMs(null);
        return;
      }
      if (g.bag.length === 0) {
        setAutoFlipRemainingMs(null);
        return;
      }
      const now = Date.now();
      if (nextFlipAt.current === 0) {
        nextFlipAt.current = now + g.settings.autoFlipIntervalMs;
      }
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
