import { Tile } from "./Tile";

interface Props {
  word: string;
  ownerName: string;
  inDictionary: boolean;
  onResolve: (upheld: boolean) => void;
  onCancel: () => void;
}

/**
 * Manual challenge / override. In Phase 1 (vs. the bot) the human decides whether
 * a word stands. We show whether the word is in the bundled list as a hint, but
 * the human's call is final, which is the point of the override.
 */
export function ChallengeModal({
  word,
  ownerName,
  inDictionary,
  onResolve,
  onCancel,
}: Props) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Challenge">
      <div className="modal">
        <h2>Challenge</h2>
        <p className="modal-sub">Is {ownerName}&rsquo;s word valid?</p>

        <div className="challenge-word">
          {word.split("").map((ch, i) => (
            <Tile key={i} letter={ch} />
          ))}
        </div>

        <p className="modal-sub" style={{ textAlign: "center" }}>
          {inDictionary
            ? `“${word}” is in the word list.`
            : `“${word}” is not in the word list.`}
        </p>

        <div className="modal-actions">
          <button className="btn success" onClick={() => onResolve(true)}>
            Valid
          </button>
          <button className="btn danger" onClick={() => onResolve(false)}>
            Invalid
          </button>
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
