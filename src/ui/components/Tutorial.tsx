import { useState, type ReactNode } from "react";
import { Tile } from "./Tile";

interface Props {
  onDone: () => void;
}

interface Step {
  title: string;
  body: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Welcome to Agrams",
    body: (
      <>
        Build words from the letters in the center pool, and steal your
        opponent&rsquo;s words by rearranging them into longer ones. You&rsquo;re
        playing against the computer.
      </>
    ),
  },
  {
    title: "Make words",
    body: (
      <>
        Type a word and press Enter, or tap letters to spell it. Words must be at
        least the minimum length (4 by default).
      </>
    ),
  },
  {
    title: "Steal by rearranging",
    body: (
      <>
        Take an existing word, add one or more pool letters, and rearrange it into
        a new word. A simple add-on doesn&rsquo;t count:
        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "10px 0" }}>
          {"CARE".split("").map((c, i) => (
            <Tile key={i} letter={c} small />
          ))}
          <span style={{ margin: "0 6px" }}>+ R →</span>
          {"RACER".split("").map((c, i) => (
            <Tile key={i} letter={c} small />
          ))}
        </div>
        CARE → CATS is fine; CARE → CARES is not (that&rsquo;s not a rearrangement).
      </>
    ),
  },
  {
    title: "Scoring",
    body: (
      <>
        A word scores its length minus three: 4 letters = 1 point, 5 = 2, 6 = 3,
        and so on. Steal a word and its points come with it.
      </>
    ),
  },
  {
    title: "Challenge & endgame",
    body: (
      <>
        Doubt one of the bot&rsquo;s words? Tap Challenge on it to rule it out.
        When the last tile is flipped a countdown begins; every steal adds time.
        Play the perfect word and good luck!
      </>
    ),
  },
];

export function Tutorial({ onDone }: Props) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const step = STEPS[i];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="modal">
        <div className="steps" style={{ color: "var(--muted)", fontSize: 13, marginBottom: 6 }}>
          Step {i + 1} of {STEPS.length}
        </div>
        <h2>{step.title}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.55 }}>{step.body}</p>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onDone}>
            Skip
          </button>
          {last ? (
            <button className="btn" onClick={onDone}>
              Play
            </button>
          ) : (
            <button className="btn" onClick={() => setI((n) => n + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
