import { useCallback, useEffect, useRef, useState } from "react";
import {
  createGame,
  flipNextTile,
  attemptWord,
  challengeWord,
  tickEndgame,
  endGame,
  type GameState,
  type GameSettings,
  type Player,
} from "../engine";
import type { Dictionary, VocabEntry } from "../engine/dictionary";
import { chooseBotMove, MEDIUM_BOT } from "../bot/bot";
import { makeRng } from "../engine/bag";

export interface Feedback {
  text: string;
  kind: "error" | "ok";
}

export const YOU_ID = "you";
export const BOT_ID = "bot";

const BOT_THINK_MS = 1300; // how often the bot considers a move
const ENDGAME_TICK_MS = 250;

function defaultPlayers(): Player[] {
  return [
    { id: YOU_ID, name: "You", isBot: false },
    { id: BOT_ID, name: "Bot", isBot: true },
  ];
}

export interface UseGame {
  game: GameState;
  feedback: Feedback | null;
  pending: string;
  selectedTileIds: Set<number>;
  challengeId: number | null;
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
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, setPendingState] = useState("");
  const [selectedTileIds, setSelectedTileIds] = useState<Set<number>>(new Set());
  const [sourceIds, setSourceIds] = useState<Set<number>>(new Set());
  const [challengeId, setChallengeId] = useState<number | null>(null);

  // Refs so timers always see current values without re-subscribing.
  const gameRef = useRef(game);
  gameRef.current = game;
  const botRng = useRef(makeRng(Math.floor(Math.random() * 2 ** 31)));

  const setPending = useCallback((text: string) => {
    // Manual typing invalidates the tap selection mapping.
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
  }, [pending, sourceIds, dictionary, clearPending]);

  const flip = useCallback(() => {
    setGame((g) => flipNextTile(g));
  }, []);

  const startChallenge = useCallback((wordId: number) => {
    setChallengeId(wordId);
  }, []);
  const cancelChallenge = useCallback(() => setChallengeId(null), []);
  const resolveChallenge = useCallback(
    (upheld: boolean) => {
      setChallengeId((id) => {
        if (id !== null) setGame((g) => challengeWord(g, id, upheld));
        return null;
      });
    },
    [],
  );

  const endNow = useCallback(() => {
    setGame((g) => endGame(g));
  }, []);

  const newGame = useCallback(
    (settings: GameSettings) => {
      setGame(createGame({ players: defaultPlayers(), settings }));
      setFeedback(null);
      clearPending();
      setChallengeId(null);
      botRng.current = makeRng(Math.floor(Math.random() * 2 ** 31));
    },
    [clearPending],
  );

  // Bot loop.
  useEffect(() => {
    const timer = setInterval(() => {
      const g = gameRef.current;
      if (g.phase !== "playing") return;
      const move = chooseBotMove(g, dictionary, vocab, BOT_ID, {
        ...MEDIUM_BOT,
        rng: botRng.current,
      });
      if (!move) return;
      const result =
        move.kind === "claim"
          ? attemptWord(g, dictionary, BOT_ID, move.text)
          : attemptWord(g, dictionary, BOT_ID, move.text, {
              preferSourceWordId: move.sourceWordId,
            });
      if (result.ok) setGame(result.state);
    }, BOT_THINK_MS);
    return () => clearInterval(timer);
  }, [dictionary, vocab]);

  // Auto-flip loop (only active in auto mode).
  useEffect(() => {
    if (game.settings.flipMode !== "auto") return;
    const timer = setInterval(() => {
      const g = gameRef.current;
      if (g.phase === "playing" && g.bag.length > 0) {
        setGame((cur) => flipNextTile(cur));
      }
    }, game.settings.autoFlipIntervalMs);
    return () => clearInterval(timer);
  }, [game.settings.flipMode, game.settings.autoFlipIntervalMs]);

  // Endgame countdown.
  useEffect(() => {
    const timer = setInterval(() => {
      const g = gameRef.current;
      if (g.phase === "playing" && g.endgame.active) {
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
    setPending,
    tapTile,
    clearPending,
    submit,
    flip,
    startChallenge,
    resolveChallenge,
    cancelChallenge,
    endNow,
    newGame,
  };
}
