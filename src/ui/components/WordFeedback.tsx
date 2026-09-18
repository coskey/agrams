import { useState } from "react";
import type { LastWordEvent } from "../useGame";
import { recordFeedback } from "../../data/feedback";

interface Props {
  last: LastWordEvent | null;
  onClose: () => void;
}

/**
 * Report whether a steal/word should be allowed, to tune the root rules. Prefills
 * from the last move: the game's decision (allowed vs rejected) seeds the
 * okay/not-okay toggle, and all fields are editable.
 */
export function WordFeedback({ last, onClose }: Props) {
  const [original, setOriginal] = useState(last?.original ?? "");
  const [created, setCreated] = useState(last?.created ?? "");
  // Default to "Not okay" — the form is usually opened to flag a bad steal.
  const [okay, setOkay] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const res = await recordFeedback({ original, created, okay, note, kind: "feedback" });
    setBusy(false);
    setStatus(res.message);
    if (res.ok) setTimeout(onClose, 900);
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Word feedback">
      <div className="modal">
        <h2>Word feedback</h2>
        <p className="modal-sub">
          Record whether this should count as a valid steal. Helps tune what
          counts as the same root.
        </p>

        <div className="field">
          <label htmlFor="fb-original">Original word</label>
          <input
            id="fb-original"
            className="text-input"
            value={original}
            placeholder="(none for a fresh word)"
            autoCapitalize="characters"
            onChange={(e) => setOriginal(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
          />
        </div>

        <div className="field">
          <label htmlFor="fb-new">New word</label>
          <input
            id="fb-new"
            className="text-input"
            value={created}
            autoCapitalize="characters"
            onChange={(e) => setCreated(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
          />
        </div>

        <div className="field">
          <label>Should this be allowed?</label>
          <div className="seg" role="group" aria-label="Okay or not okay">
            <button type="button" className={okay ? "active" : ""} onClick={() => setOkay(true)}>
              Okay
            </button>
            <button type="button" className={!okay ? "active" : ""} onClick={() => setOkay(false)}>
              Not okay
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="fb-note">Note (optional)</label>
          <input
            id="fb-note"
            className="text-input"
            value={note}
            placeholder="Why?"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {status && <p className="modal-sub">{status}</p>}

        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn" onClick={submit} disabled={busy || created.length === 0}>
            {busy ? "Saving…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
