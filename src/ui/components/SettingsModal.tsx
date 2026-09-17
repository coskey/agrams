import { useState } from "react";
import type { GameSettings } from "../../engine";

interface Props {
  initial: GameSettings;
  title?: string;
  confirmLabel?: string;
  onConfirm: (settings: GameSettings) => void;
  onCancel: () => void;
}

const MIN_LEN_MIN = 2;
const MIN_LEN_MAX = 6;

export function SettingsModal({
  initial,
  title = "Game settings",
  confirmLabel = "Start game",
  onConfirm,
  onCancel,
}: Props) {
  const [s, setS] = useState<GameSettings>(initial);

  const setMinLen = (delta: number) =>
    setS((cur) => ({
      ...cur,
      minWordLength: Math.min(
        MIN_LEN_MAX,
        Math.max(MIN_LEN_MIN, cur.minWordLength + delta),
      ),
    }));

  const setDifficulty = (delta: number) =>
    setS((cur) => ({
      ...cur,
      difficultyLevel: Math.min(5, Math.max(1, cur.difficultyLevel + delta)),
    }));

  const setEndgame = (delta: number) =>
    setS((cur) => ({
      ...cur,
      endgameSeconds: Math.min(180, Math.max(15, cur.endgameSeconds + delta)),
    }));

  const setFlipInterval = (deltaMs: number) =>
    setS((cur) => ({
      ...cur,
      autoFlipIntervalMs: Math.min(
        15000,
        Math.max(3000, cur.autoFlipIntervalMs + deltaMs),
      ),
    }));

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal setup-modal">
        <h2>{title}</h2>

        <div className="field">
          <div className="toggle-row">
            <label htmlFor="solo-toggle">Solo practice</label>
            <button
              id="solo-toggle"
              type="button"
              role="switch"
              aria-checked={s.mode === "practice"}
              className={`switch ${s.mode === "practice" ? "on" : ""}`}
              onClick={() =>
                setS((c) => ({
                  ...c,
                  mode: c.mode === "practice" ? "vs-computer" : "practice",
                }))
              }
            >
              <span className="knob" />
            </button>
          </div>
          <span className="hint">
            {s.mode === "practice"
              ? "Play solo, with no computer opponent."
              : "Play against the computer."}
          </span>
        </div>

        {s.mode === "vs-computer" && (
          <div className="field">
            <label>Difficulty</label>
            <div className="stepper">
              <button type="button" onClick={() => setDifficulty(-1)} aria-label="Decrease difficulty">
                −
              </button>
              <span className="val">{s.difficultyLevel}</span>
              <button type="button" onClick={() => setDifficulty(1)} aria-label="Increase difficulty">
                +
              </button>
            </div>
            <span className="hint">
              1 = easiest, 5 = hardest.{" "}
              {["", "Very easy", "Easy", "Medium", "Hard", "Very hard"][s.difficultyLevel]}
            </span>
          </div>
        )}

        <div className="field">
          <label>Minimum word length</label>
          <div className="stepper">
            <button type="button" onClick={() => setMinLen(-1)} aria-label="Decrease minimum length">
              −
            </button>
            <span className="val">{s.minWordLength}</span>
            <button type="button" onClick={() => setMinLen(1)} aria-label="Increase minimum length">
              +
            </button>
          </div>
        </div>

        <div className="field">
          <label>Tile flipping</label>
          <div className="seg" role="group" aria-label="Flip mode">
            <button
              type="button"
              className={s.flipMode === "manual" ? "active" : ""}
              onClick={() => setS((c) => ({ ...c, flipMode: "manual" }))}
            >
              Manual
            </button>
            <button
              type="button"
              className={s.flipMode === "auto" ? "active" : ""}
              onClick={() => setS((c) => ({ ...c, flipMode: "auto" }))}
            >
              Auto
            </button>
          </div>
          <span className="hint">
            {s.flipMode === "manual"
              ? "You reveal each tile with the Flip button."
              : "A new tile appears automatically on a timer."}
          </span>
        </div>

        {s.flipMode === "auto" && (
          <div className="field">
            <label>Seconds between tiles</label>
            <div className="stepper">
              <button type="button" onClick={() => setFlipInterval(-1000)} aria-label="Decrease flip interval">
                −
              </button>
              <span className="val">{Math.round(s.autoFlipIntervalMs / 1000)}s</span>
              <button type="button" onClick={() => setFlipInterval(1000)} aria-label="Increase flip interval">
                +
              </button>
            </div>
            <span className="hint">Between 3 and 15 seconds.</span>
          </div>
        )}

        <div className="field">
          <label>Endgame timer</label>
          <div className="stepper">
            <button type="button" onClick={() => setEndgame(-15)} aria-label="Decrease endgame timer">
              −
            </button>
            <span className="val">{s.endgameSeconds}s</span>
            <button type="button" onClick={() => setEndgame(15)} aria-label="Increase endgame timer">
              +
            </button>
          </div>
          <span className="hint">
            Starts when the last tile is flipped. Each steal adds{" "}
            {s.stealBonusSeconds}s, capped at {s.endgameSeconds}s.
          </span>
        </div>

        <div className="modal-actions">
          <button className="btn secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn" onClick={() => onConfirm(s)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
