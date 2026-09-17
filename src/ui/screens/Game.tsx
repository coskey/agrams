import { useEffect, useMemo, useRef, useState } from "react";
import {
  playerScore,
  allScores,
  type GameSettings,
  type ClaimedWord,
  type Rules,
} from "../../engine";
import type { VocabEntry } from "../../engine/dictionary";
import { useGame, YOU_ID, BOT_ID, MOVE_ANIM_MS } from "../useGame";
import { TopBar } from "../components/TopBar";
import { Tile } from "../components/Tile";
import { SettingsModal } from "../components/SettingsModal";
import { ChallengeModal } from "../components/ChallengeModal";
import { WordFeedback } from "../components/WordFeedback";

interface Props {
  rules: Rules;
  vocab: VocabEntry[];
  settings: GameSettings;
  onExit: () => void;
  themeMode: string;
  onToggleTheme: () => void;
}

const DOT_COLORS: Record<string, string> = {
  [YOU_ID]: "var(--accent)",
  [BOT_ID]: "#c0392b",
};

const CHALLENGE_WINDOW_MS = 5000;

export function Game({ rules, vocab, settings, onExit, themeMode, onToggleTheme }: Props) {
  const g = useGame(rules, vocab, settings);
  const { game } = g;
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const scores = useMemo(() => allScores(game), [game]);
  const remainingSec =
    game.endgame.active && game.endgame.remainingMs !== null
      ? Math.ceil(game.endgame.remainingMs / 1000)
      : null;
  const nextTileSec =
    g.autoFlipRemainingMs !== null ? Math.ceil(g.autoFlipRemainingMs / 1000) : null;

  const challengeWordObj: ClaimedWord | null =
    g.challengeId !== null ? game.words.find((w) => w.id === g.challengeId) ?? null : null;

  const isSelected = (id: number) => g.selectedTileIds.has(id);
  const ended = game.phase === "ended";
  const isAuto = game.settings.flipMode === "auto";
  // Desktop (mouse/keyboard) can type without focusing the box; mobile uses the
  // on-screen input so its soft keyboard still works.
  const isDesktop = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches,
    [],
  );

  const [clock, setClock] = useState(() => Date.now());
  const seenRef = useRef<Map<number, number>>(new Map());
  useEffect(() => {
    const now = Date.now();
    for (const w of game.words) {
      if (!seenRef.current.has(w.id)) seenRef.current.set(w.id, now);
    }
  }, [game.words]);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const ageOf = (wordId: number) => clock - (seenRef.current.get(wordId) ?? clock);
  const challengeable = (wordId: number) => !ended && ageOf(wordId) < CHALLENGE_WINDOW_MS;
  const animating = (wordId: number) => ageOf(wordId) < MOVE_ANIM_MS;

  // Enter submits the pending word (typed or tapped) even when the input isn't
  // focused, e.g. after tapping tiles; Escape clears it. Ignored while a modal
  // is open or the game is over.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ended || g.paused || showSettings || showFeedback || g.challengeId !== null) return;
      if (e.key === "Enter") {
        if (g.pending.trim().length > 0) {
          e.preventDefault();
          g.submit();
        }
        return;
      }
      if (e.key === "Escape") {
        if (g.pending.length > 0) {
          e.preventDefault();
          g.clearPending();
        }
        return;
      }
      // Desktop only: type letters without focusing the box, and backspace.
      if (!isDesktop || e.metaKey || e.ctrlKey || e.altKey) return;
      // Manual flip: pressing "1" flips the next tile (like the Flip button).
      if (e.key === "1" && game.settings.flipMode === "manual" && game.bag.length > 0) {
        e.preventDefault();
        g.flip();
        return;
      }
      if (e.key === "Backspace") {
        if (g.pending.length > 0) {
          e.preventDefault();
          g.backspace();
        }
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        g.appendLetter(e.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    ended,
    showSettings,
    showFeedback,
    isDesktop,
    g.paused,
    g.challengeId,
    g.pending,
    g.submit,
    g.clearPending,
    g.backspace,
    g.appendLetter,
    g.flip,
    game.settings.flipMode,
    game.bag.length,
  ]);

  const openFeedback = () => {
    g.pause();
    setShowFeedback(true);
  };
  const closeFeedback = () => {
    setShowFeedback(false);
    g.resume();
  };

  return (
    <div className="app">
      <TopBar
        themeMode={themeMode}
        onToggleTheme={onToggleTheme}
        leftSlot={
          <span className="chip">
            {game.settings.mode === "practice" ? "Solo" : `Bot · L${game.settings.difficultyLevel}`}
          </span>
        }
      >
        {remainingSec !== null && (
          <span className="chip" aria-live="polite">
            ⏳ <span className="countdown">{remainingSec}s</span>
          </span>
        )}
        {!ended && (
          <button className="icon-btn" onClick={g.pause}>
            Pause
          </button>
        )}
        {!ended && (
          <button className="icon-btn" onClick={g.endNow}>
            End game
          </button>
        )}
        {ended && (
          <button className="icon-btn" onClick={() => setShowSettings(true)}>
            New game
          </button>
        )}
        <button className="icon-btn" onClick={onExit} aria-label="Back to home">
          Home
        </button>
      </TopBar>

      <div className="game">
        <div className="board">
          <div className="left-col">
            <div className="section-label">
              <span>Pool</span>
              <span>
                {game.bag.length} in bag
                {nextTileSec !== null && ` · next tile ${nextTileSec}s`}
              </span>
            </div>
            <div className="pool-panel">
              {game.pool.length === 0 ? (
                <div className="pool-empty">
                  {g.startCountdownSec !== null ? (
                    <span className="pool-countdown">Get ready… {g.startCountdownSec}</span>
                  ) : game.bag.length === 0 ? (
                    "The bag is empty."
                  ) : isAuto ? (
                    nextTileSec !== null ? `First tile in ${nextTileSec}s…` : ""
                  ) : (
                    "Flip a tile to begin."
                  )}
                </div>
              ) : (
                <div className="pool-tiles">
                  {game.pool.map((t) => (
                    <Tile
                      key={t.id}
                      letter={t.letter}
                      used={isSelected(t.id)}
                      onTap={() => g.tapTile(t.id, t.letter)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="players">
            {game.players.map((p) => {
              const words = game.words.filter((w) => w.ownerId === p.id);
              return (
                <div className="player-row" key={p.id}>
                  <div className="player-head">
                    <span className="player-dot" style={{ background: DOT_COLORS[p.id] ?? "var(--muted)" }} />
                    <span className="player-name">
                      {p.name}
                      {p.id === YOU_ID && <span className="you">(you)</span>}
                    </span>
                    <span className="player-score">{playerScore(game, p.id)}</span>
                  </div>
                  {words.length === 0 ? (
                    <div className="no-words">No words yet</div>
                  ) : (
                    <div className="player-words">
                      {words.map((w) => (
                        <div className={`word ${animating(w.id) ? "animating" : ""}`} key={w.id}>
                          <span className="word-run">
                            {w.tiles.map((t, i) => (
                              <span key={t.id} className="tile-slot" style={{ animationDelay: `${i * 60}ms` }}>
                                <Tile
                                  letter={t.letter}
                                  small
                                  used={isSelected(t.id)}
                                  onTap={() => g.tapTile(t.id, t.letter, w.id)}
                                />
                              </span>
                            ))}
                          </span>
                          {challengeable(w.id) && (
                            <button className="challenge-link" onClick={() => g.startChallenge(w.id)}>
                              challenge
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!ended && (
          <div className="inputbar">
            <div className="row">
              {game.settings.flipMode === "manual" && (
                <button
                  className="btn secondary flip-btn"
                  onClick={g.flip}
                  disabled={game.bag.length === 0}
                  title={isDesktop ? "Flip a tile (press 1)" : undefined}
                >
                  {g.firstFourArmed ? "Flip first four" : "Flip"}
                </button>
              )}
              <input
                ref={inputRef}
                value={g.pending}
                readOnly={isDesktop}
                placeholder={isDesktop ? "TYPE OR TAP" : "TAP OR TYPE"}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-label="Word entry"
                onChange={(e) => g.setPending(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              />
              {g.pending.length > 0 && (
                <>
                  <button
                    className="btn secondary clear-btn"
                    onClick={g.backspace}
                    aria-label="Backspace"
                    title="Backspace"
                  >
                    ◀
                  </button>
                  <button
                    className="btn secondary clear-btn"
                    onClick={g.clearPending}
                    aria-label="Clear the word"
                    title="Clear"
                  >
                    ✕
                  </button>
                </>
              )}
              <button className="btn accent send" onClick={g.submit}>
                Enter
              </button>
            </div>
            <div className="under-input">
              <div className={`feedback-line ${g.feedback?.kind ?? ""}`}>
                {g.feedback && (
                  <span key={g.feedback.id} className={`feedback-msg ${g.feedback.kind}`}>
                    {g.feedback.text}
                  </span>
                )}
              </div>
              <button className="link-btn" onClick={openFeedback}>
                Word feedback
              </button>
            </div>
          </div>
        )}
      </div>

      {challengeWordObj && (
        <ChallengeModal
          word={challengeWordObj.text}
          ownerName={game.players.find((p) => p.id === challengeWordObj.ownerId)?.name ?? "Player"}
          inDictionary={rules.dictionary.isValid(challengeWordObj.text)}
          onResolve={g.resolveChallenge}
          onCancel={g.cancelChallenge}
        />
      )}

      {showFeedback && (
        <WordFeedback last={g.lastWordEvent} onClose={closeFeedback} />
      )}

      {g.paused && !showFeedback && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Paused">
          <div className="modal pause-modal">
            <h2>Game paused</h2>
            <div className="modal-actions">
              <button className="btn" onClick={g.resume}>
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          initial={game.settings}
          confirmLabel="Start new game"
          onConfirm={(s) => {
            g.newGame(s);
            setShowSettings(false);
          }}
          onCancel={() => setShowSettings(false)}
        />
      )}

      {ended && (
        <Results
          scores={scores}
          names={Object.fromEntries(game.players.map((p) => [p.id, p.name]))}
          onPlayAgain={() => g.newGame(game.settings)}
          onExit={onExit}
        />
      )}
    </div>
  );
}

function Results({
  scores,
  names,
  onPlayAgain,
  onExit,
}: {
  scores: Record<string, number>;
  names: Record<string, string>;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const rows = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = rows.length > 0 ? rows[0][1] : 0;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Results">
      <div className="modal">
        <h2>Game over</h2>
        <div className="results-list">
          {rows.map(([id, score]) => (
            <div key={id} className={`results-row ${score === top ? "winner" : ""}`}>
              <span>{names[id] ?? id}</span>
              <span>
                {score} {score === 1 ? "point" : "points"}
              </span>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onExit}>
            Home
          </button>
          <button className="btn" onClick={onPlayAgain}>
            Play again
          </button>
        </div>
      </div>
    </div>
  );
}
