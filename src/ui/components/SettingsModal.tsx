import { useState } from "react";
import type { GameSettings } from "../../engine";

interface Props {
  initial: GameSettings;
  confirmLabel?: string;
  onConfirm: (settings: GameSettings) => void;
  onCancel: () => void;
}

const MIN_LEN_MIN = 2;
const MIN_LEN_MAX = 6;

export function SettingsModal({
  initial,
  confirmLabel = "Start game",
  onConfirm,
  onCancel,
}: Props) {
  const [s, setS] = useState<GameSettings>(initial);
  const heading = s.mode === "practice" ? "New solo game" : "New game vs computer";

  const setMinLen = (delta: number) =>
    setS((cur) => ({
      ...cur,
      minWordLength: Math.min(
        MIN_LEN_MAX,
        Math.max(MIN_LEN_MIN, cur.minWordLength + delta),
      ),
    }));

  const setEndgame = (delta: number) =>
    setS((cur) => ({
      ...cur,
      endgameSeconds: Math.min(180, Math.max(15, cur.endgameSeconds + delta)),
    }));

  // Steps by 1s down to 2s, then by 0.5s (2 -> 1.5 -> 1). Minimum 1s, max 15s.
  const stepFlip = (dir: -1 | 1) =>
    setS((cur) => {
      const ms = cur.autoFlipIntervalMs;
      const next = dir < 0 ? (ms > 2000 ? ms - 1000 : ms - 500) : ms < 2000 ? ms + 500 : ms + 1000;
      return { ...cur, autoFlipIntervalMs: Math.min(15000, Math.max(1000, next)) };
    });

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={heading}>
      <div className="modal setup-modal">
        <h2>{heading}</h2>

        {s.mode === "vs-computer" && (
          <div className="field">
            <label>Difficulty</label>
            <div className="bubbles" role="group" aria-label="Difficulty level">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`bubble ${s.difficultyLevel === n ? "active" : ""}`}
                  aria-pressed={s.difficultyLevel === n}
                  aria-label={`Level ${n}`}
                  onClick={() => setS((c) => ({ ...c, difficultyLevel: n }))}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="hint">
              {["", "Easy", "Decent", "Challenging", "Hard", "Insane"][s.difficultyLevel]}
            </span>
          </div>
        )}

        <div className="field">
          <label>Minimum word length</label>
          <div className="stepper">
            <button
              type="button"
              onClick={() => setMinLen(-1)}
              disabled={s.minWordLength <= MIN_LEN_MIN}
              aria-label="Decrease minimum length"
            >
              −
            </button>
            <span className="val">{s.minWordLength}</span>
            <button
              type="button"
              onClick={() => setMinLen(1)}
              disabled={s.minWordLength >= MIN_LEN_MAX}
              aria-label="Increase minimum length"
            >
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
              <button
                type="button"
                onClick={() => stepFlip(-1)}
                disabled={s.autoFlipIntervalMs <= 1000}
                aria-label="Decrease flip interval"
              >
                −
              </button>
              <span className="val">{s.autoFlipIntervalMs / 1000}s</span>
              <button
                type="button"
                onClick={() => stepFlip(1)}
                disabled={s.autoFlipIntervalMs >= 15000}
                aria-label="Increase flip interval"
              >
                +
              </button>
            </div>
          </div>
        )}

        <div className="field">
          <label>Endgame timer</label>
          <div className="stepper">
            <button
              type="button"
              onClick={() => setEndgame(-15)}
              disabled={s.endgameSeconds <= 15}
              aria-label="Decrease endgame timer"
            >
              −
            </button>
            <span className="val">{s.endgameSeconds}s</span>
            <button
              type="button"
              onClick={() => setEndgame(15)}
              disabled={s.endgameSeconds >= 180}
              aria-label="Increase endgame timer"
            >
              +
            </button>
          </div>
          <span className="hint">
            Starts when the last tile is flipped.
            <br />
            Each steal adds {s.stealBonusSeconds}s, capped at {s.endgameSeconds}s.
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
