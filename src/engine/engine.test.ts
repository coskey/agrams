import { describe, it, expect } from "vitest";
import {
  createGame,
  flipNextTile,
  attemptWord,
  challengeWord,
  tickEndgame,
  endGame,
  playerScore,
  wordScore,
  moveIsLegal,
  type Rules,
} from "./game";
import { Dictionary } from "./dictionary";
import { buildMorphology } from "./morphology";
import { checkStealStructure } from "./steal";
import { normalizeWord, countsContain, lettersToCounts, sortedKey } from "./letters";
import type { Player, Tile } from "./types";

const DICT = new Dictionary([
  "CARE", "RACER", "CAT", "CATS", "SCAT", "ART", "PART", "TEA", "EAT", "ATE",
  "RACE", "ACRE", "CARET", "CATER", "TRACE", "MILE", "MILES", "SMILE", "SLIME",
  "LIMES", "NEW", "NEWER", "RENEW", "RENEWS", "CAREFUL", "AXIS", "TAXI", "TAXIS",
  "DO", "REDO", "KIND", "KINDNESS",
  // Words from tester feedback (same-root steals that were wrongly allowed).
  "JEAN", "JEANS", "WHINE", "WHINER", "THWARTED", "THWARTEDLY", "CORONA",
  "CORONAL", "EMOTE", "EMOTIVE", "POSADA", "POUSADA", "FLAME", "FLAMER",
  "FLAIR", "FLAIRS", "PIZE", "PIZES", "JEE", "JEES",
  // For the general (non-curated) rule.
  "ACT", "ACTIVE", "TEACH", "TEACHER",
]);

const INFLECTIONS = [
  "cats\tcat",
  "miles\tmile",
  "newer\tnew",
  "renews\trenew",
  "renewed\trenew",
  "taxis\ttaxi",
  "cares\tcare",
];

const MORPH = buildMorphology(INFLECTIONS, DICT);
const RULES: Rules = { dictionary: DICT, morphology: MORPH };

const PLAYERS: Player[] = [
  { id: "you", name: "You", isBot: false },
  { id: "bot", name: "Bot", isBot: true },
];

describe("letters", () => {
  it("normalizes to uppercase A-Z", () => {
    expect(normalizeWord("Ca-re!")).toBe("CARE");
  });
  it("sorted key groups anagrams", () => {
    expect(sortedKey("TRACE")).toBe(sortedKey("CATER"));
  });
  it("countsContain works as multiset subset", () => {
    expect(countsContain(lettersToCounts("RACER"), lettersToCounts("CARE"))).toBe(true);
    expect(countsContain(lettersToCounts("CARE"), lettersToCounts("RACER"))).toBe(false);
  });
});

describe("steal structure", () => {
  it("requires the new word to be longer", () => {
    expect(checkStealStructure("CARE", "ACRE").reason).toBe("NOT_LONGER");
  });
  it("requires all of the source's letters", () => {
    expect(checkStealStructure("CAT", "TEAR").reason).toBe("NOT_SUPERSET");
  });
  it("accepts a longer superset", () => {
    expect(checkStealStructure("CARE", "RACER").legal).toBe(true);
  });
});

describe("root detection (Morphology.sameRoot)", () => {
  const cases: [string, string, boolean][] = [
    ["CAT", "CATS", true], // plural inflection
    ["MILE", "MILES", true], // plural inflection
    ["CARE", "CAREFUL", true], // derivation (-ful)
    ["KIND", "KINDNESS", true], // derivation (-ness)
    ["NEWER", "RENEWS", true], // shared root NEW (new / renew)
    ["DO", "REDO", true], // prefix re-
    ["MILE", "SMILE", false], // different roots
    ["AXIS", "TAXIS", false], // different roots (axis / taxi)
    ["ART", "PART", false], // different roots
    ["CARE", "RACER", false], // rearrangement, different root
    // Tester feedback: these must all be blocked.
    ["JEAN", "JEANS", true], // plural (+S)
    ["WHINE", "WHINER", true], // agent (+R)
    ["THWARTED", "THWARTEDLY", true], // adverb (+LY)
    ["CORONA", "CORONAL", true], // derivation (+AL)
    ["EMOTE", "EMOTIVE", true], // spelling-change derivation (curated)
    ["POSADA", "POUSADA", true], // variant spelling (curated)
    // The general rule catches these without a curated entry.
    ["ACT", "ACTIVE", true], // derivation (-ive)
    ["TEACH", "TEACHER", true], // agent (-er)
  ];
  for (const [a, b, expected] of cases) {
    it(`${a} vs ${b} -> sameRoot ${expected}`, () => {
      expect(MORPH.sameRoot(a, b)).toBe(expected);
    });
  }
});

describe("scoring", () => {
  it("is 1 at the minimum length, +1 per extra letter", () => {
    // Default 4-letter minimum.
    expect(wordScore(4, 4)).toBe(1);
    expect(wordScore(5, 4)).toBe(2);
    expect(wordScore(6, 4)).toBe(3);
    // 3-letter minimum.
    expect(wordScore(3, 3)).toBe(1);
    expect(wordScore(4, 3)).toBe(2);
    expect(wordScore(6, 3)).toBe(4);
  });
});

describe("game flow", () => {
  function freshGame() {
    const orderedForPop: Tile[] = [
      { id: 4, letter: "R" },
      { id: 3, letter: "E" },
      { id: 2, letter: "R" },
      { id: 1, letter: "A" },
      { id: 0, letter: "C" },
    ];
    return createGame({ players: PLAYERS, bag: orderedForPop, seed: 1 });
  }

  it("flips tiles into the pool", () => {
    let s = freshGame();
    s = flipNextTile(s);
    expect(s.pool.map((t) => t.letter)).toEqual(["C"]);
    for (let i = 0; i < 3; i++) s = flipNextTile(s);
    expect(s.pool.map((t) => t.letter).join("")).toBe("CARE");
    expect(s.endgame.active).toBe(false);
  });

  it("claims a word from the pool", () => {
    let s = freshGame();
    for (let i = 0; i < 4; i++) s = flipNextTile(s);
    const r = attemptWord(s, RULES, "you", "care");
    expect(r.ok).toBe(true);
    if (r.ok) {
      s = r.state;
      expect(s.words[0].ownerId).toBe("you");
      expect(playerScore(s, "you")).toBe(1);
    }
  });

  it("starts the endgame countdown when the last tile flips", () => {
    let s = freshGame();
    for (let i = 0; i < 5; i++) s = flipNextTile(s);
    expect(s.bag).toHaveLength(0);
    expect(s.endgame.active).toBe(true);
    expect(s.endgame.remainingMs).toBe(60000);
  });

  it("steals a word using a pool letter and transfers points", () => {
    let s = freshGame();
    for (let i = 0; i < 5; i++) s = flipNextTile(s); // pool: C A R E R
    const claim = attemptWord(s, RULES, "you", "CARE");
    if (!claim.ok) throw new Error("claim failed");
    s = claim.state; // pool: R
    const steal = attemptWord(s, RULES, "bot", "RACER");
    expect(steal.ok).toBe(true);
    if (!steal.ok) return;
    s = steal.state;
    expect(s.words[0].text).toBe("RACER");
    expect(s.words[0].ownerId).toBe("bot");
    expect(playerScore(s, "you")).toBe(0);
    expect(playerScore(s, "bot")).toBe(2);
  });

  it("rejects words that are too short or not in the list", () => {
    let s = freshGame();
    for (let i = 0; i < 4; i++) s = flipNextTile(s);
    const short = attemptWord(s, RULES, "you", "car");
    if (!short.ok) expect(short.reason).toBe("TOO_SHORT");
    const notWord = attemptWord(s, RULES, "you", "raec");
    if (!notWord.ok) expect(notWord.reason).toBe("NOT_A_WORD");
  });

  it("returns tiles to the pool when a word is challenged out", () => {
    let s = freshGame();
    for (let i = 0; i < 4; i++) s = flipNextTile(s);
    const r = attemptWord(s, RULES, "you", "CARE");
    if (!r.ok) throw new Error("claim failed");
    s = challengeWord(r.state, r.state.words[0].id, false);
    expect(s.words).toHaveLength(0);
    expect(s.pool.map((t) => t.letter).sort().join("")).toBe("ACER");
  });

  it("returns a stolen word to its owner on a successful challenge", () => {
    let s = freshGame();
    for (let i = 0; i < 5; i++) s = flipNextTile(s); // pool: C A R E R
    const claim = attemptWord(s, RULES, "you", "CARE");
    if (!claim.ok) throw new Error("claim failed");
    const steal = attemptWord(claim.state, RULES, "bot", "RACER");
    if (!steal.ok) throw new Error("steal failed");
    s = steal.state;
    const racer = s.words.find((w) => w.text === "RACER");
    expect(racer?.ownerId).toBe("bot");

    s = challengeWord(s, racer!.id, false);
    expect(s.words.some((w) => w.text === "RACER")).toBe(false);
    const care = s.words.find((w) => w.text === "CARE");
    expect(care?.ownerId).toBe("you"); // restored to the original owner
    expect(playerScore(s, "you")).toBe(1);
    expect(playerScore(s, "bot")).toBe(0);
    // Only the added letter (R) returns to the pool; CARE keeps its tiles.
    expect(s.pool.map((t) => t.letter).sort().join("")).toBe("R");
  });

  it("ends when the endgame timer runs out", () => {
    let s = freshGame();
    for (let i = 0; i < 5; i++) s = flipNextTile(s);
    s = tickEndgame(s, 60000);
    expect(s.phase).toBe("ended");
    expect(s.events.some((e) => e.type === "gameEnd")).toBe(true);
    expect(attemptWord(s, RULES, "you", "CARE").ok).toBe(false);
  });

  it("End game button ends immediately", () => {
    let s = endGame(flipNextTile(freshGame()));
    expect(s.phase).toBe("ended");
  });
});

describe("root rule in play", () => {
  // Bag pops M, I, L, E, S in order.
  function milesGame() {
    const bag: Tile[] = [
      { id: 4, letter: "S" },
      { id: 3, letter: "E" },
      { id: 2, letter: "L" },
      { id: 1, letter: "I" },
      { id: 0, letter: "M" },
    ];
    let s = createGame({ players: PLAYERS, bag });
    for (let i = 0; i < 5; i++) s = flipNextTile(s); // pool: M I L E S
    const claim = attemptWord(s, RULES, "you", "MILE");
    if (!claim.ok) throw new Error("setup claim failed");
    return claim.state; // pool: S ; word: MILE
  }

  it("blocks a same-root steal (MILE -> MILES)", () => {
    const s = milesGame();
    const r = attemptWord(s, RULES, "bot", "MILES");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("NOT_A_STEAL");
  });

  it("allows a different-root add-on (MILE -> SMILE)", () => {
    const s = milesGame();
    const r = attemptWord(s, RULES, "bot", "SMILE");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.move.kind).toBe("steal");
  });

  it("moveIsLegal agrees with attemptWord", () => {
    const s = milesGame();
    const id = s.words[0].id;
    expect(moveIsLegal(s, RULES, { kind: "steal", playerId: "bot", text: "SMILE", sourceWordId: id })).toBe(true);
    expect(moveIsLegal(s, RULES, { kind: "steal", playerId: "bot", text: "MILES", sourceWordId: id })).toBe(false);
  });
});
