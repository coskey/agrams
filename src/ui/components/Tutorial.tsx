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
        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "10px 0", flexWrap: "wrap" }}>
          {"CARE".split("").map((c, i) => (
            <Tile key={i} letter={c} small />
          ))}
          <span style={{ margin: "0 4px" }}>+</span>
          <Tile letter="R" small />
          <span style={{ margin: "0 4px" }}>&rarr;</span>
          {"RACER".split("").map((c, i) => (
            <Tile key={i} letter={c} small />
          ))}
        </div>
      </>
    ),
  },
  {
    title: "Keep the root different",
    body: (
      <>
        You can&rsquo;t just add letters to make another form of the same word.
        The new word has to come from a different root:
        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "10px 0", flexWrap: "wrap" }}>
          {"CARE".split("").map((c, i) => (
            <Tile key={i} letter={c} small />
          ))}
          <span style={{ margin: "0 4px" }}>+</span>
          <Tile letter="S" small />
          <span style={{ margin: "0 4px" }}>&rarr;</span>
          {"CARES".split("").map((c, i) => (
            <Tile key={i} letter={c} small />
          ))}
          <span style={{ margin: "0 0 0 4px", fontWeight: 700 }}>&#10007;</span>
        </div>
        CARES is just CARE again, so that steal isn&rsquo;t allowed.
      </>
    ),
  },
  {
    title: "Scoring",
    body: (
      <>
        A word scores 1 point at the minimum length, plus 1 for each extra letter.
        For example, with a 4-letter minimum, each word with 4 letters is one
        point. A 5 letter word is two points, a 6 letter word is 3 points, etc.
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
