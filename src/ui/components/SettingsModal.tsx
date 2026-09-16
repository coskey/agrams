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

  const setEndgame = (delta: number) =>
    setS((cur) => ({
      ...cur,
      endgameSeconds: Math.min(180, Math.max(15, cur.endgameSeconds + delta)),
    }));

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <h2>{title}</h2>

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
          <span className="hint">Between {MIN_LEN_MIN} and {MIN_LEN_MAX} letters.</span>
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
              : `A new tile appears every ${Math.round(s.autoFlipIntervalMs / 1000)}s.`}
          </span>
        </div>

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
