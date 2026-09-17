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
        Build words from the letters in the center pool, and steal words already
        on the board by rearranging them into longer ones.
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
        a new, different word:
        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "10px 0" }}>
          {"CARE".split("").map((c, i) => (
            <Tile key={i} letter={c} small />
          ))}
          <span style={{ margin: "0 6px" }}>+ R →</span>
          {"RACER".split("").map((c, i) => (
            <Tile key={i} letter={c} small />
          ))}
        </div>
        Just adding letters to make another form of the same word (CARE &rarr;
        CARES) doesn&rsquo;t count.
      </>
    ),
  },
  {
    title: "Scoring",
    body: (
      <>
        A word scores 1 point at the minimum length, plus 1 for each extra letter.
        With the default 4-letter minimum that's 4 letters = 1 point, 5 = 2, 6 = 3.
        Steal a word and its points come with it.
      </>
    ),
  },
  {
    title: "Challenge & endgame",
    body: (
      <>
        Doubt a word on the board? Tap Challenge on it to rule it out. When the
        last tile is flipped a countdown begins; every steal adds time. Play the
        perfect word and good luck!
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
      <div className="modal tutorial-modal">
        <button className="modal-close" onClick={onDone} aria-label="Close">
          ✕
        </button>
        <h2>{step.title}</h2>
        <p className="tutorial-body">{step.body}</p>
        <div className="modal-actions">
          {i === 0 ? (
            <button className="btn secondary" onClick={onDone}>
              Skip
            </button>
          ) : (
            <button className="btn secondary" onClick={() => setI((n) => n - 1)}>
              Back
            </button>
          )}
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
