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
} from "./game";
import { Dictionary } from "./dictionary";
import { checkStealStructure } from "./steal";
import {
  normalizeWord,
  countsContain,
  lettersToCounts,
  sortedKey,
} from "./letters";
import type { Player, Tile } from "./types";

const DICT = new Dictionary([
  "CARE", "RACER", "CAT", "CATS", "SCAT", "ART", "PART", "TEA", "EAT", "ATE",
  "RACE", "ACRE", "CARET", "CATER", "TRACE", "MILE", "SMILE", "SLIME", "LIMES",
]);

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

describe("strict steal rule", () => {
  it("rejects plain plural extension CAT -> CATS", () => {
    expect(checkStealStructure("CAT", "CATS").legal).toBe(false);
  });
  it("rejects prefix extension ART -> PART", () => {
    expect(checkStealStructure("ART", "PART").reason).toBe("SAME_ROOT");
  });
  it("rejects CAT -> SCAT (source survives as substring)", () => {
    expect(checkStealStructure("CAT", "SCAT").legal).toBe(false);
  });
  it("rejects same-length anagram (not longer)", () => {
    expect(checkStealStructure("CARE", "ACRE").reason).toBe("NOT_LONGER");
  });
  it("accepts a genuine rearrangement CARE -> RACER", () => {
    expect(checkStealStructure("CARE", "RACER").legal).toBe(true);
  });
});

describe("scoring", () => {
  it("is length minus 3, at least 1", () => {
    expect(wordScore(4)).toBe(1);
    expect(wordScore(5)).toBe(2);
    expect(wordScore(6)).toBe(3);
    expect(wordScore(2)).toBe(1);
  });
});

describe("game flow", () => {
  function freshGame() {
    // Explicit tiles so flip order is deterministic: pop() takes the last item.
    const orderedForPop: Tile[] = [
      { id: 4, letter: "R" }, // flipped 5th
      { id: 3, letter: "E" }, // flipped 4th
      { id: 2, letter: "R" }, // flipped 3rd
      { id: 1, letter: "A" }, // flipped 2nd
      { id: 0, letter: "C" }, // flipped 1st
    ];
    return createGame({ players: PLAYERS, bag: orderedForPop, seed: 1 });
  }

  it("flips tiles into the pool", () => {
    let s = freshGame();
    s = flipNextTile(s);
    expect(s.pool.map((t) => t.letter)).toEqual(["C"]);
    s = flipNextTile(s);
    s = flipNextTile(s);
    s = flipNextTile(s);
    expect(s.pool.map((t) => t.letter).join("")).toBe("CARE");
    expect(s.endgame.active).toBe(false);
  });

  it("claims a word from the pool", () => {
    let s = freshGame();
    for (let i = 0; i < 4; i++) s = flipNextTile(s);
    const r = attemptWord(s, DICT, "you", "care");
    expect(r.ok).toBe(true);
    if (r.ok) {
      s = r.state;
      expect(s.words).toHaveLength(1);
      expect(s.words[0].ownerId).toBe("you");
      expect(s.pool).toHaveLength(0);
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
    const claim = attemptWord(s, DICT, "you", "CARE");
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    s = claim.state; // pool now just "R"

    const steal = attemptWord(s, DICT, "bot", "RACER");
    expect(steal.ok).toBe(true);
    if (!steal.ok) return;
    s = steal.state;

    expect(s.words).toHaveLength(1);
    expect(s.words[0].text).toBe("RACER");
    expect(s.words[0].ownerId).toBe("bot");
    expect(playerScore(s, "you")).toBe(0);
    expect(playerScore(s, "bot")).toBe(2);
    expect(s.pool).toHaveLength(0);
    // Steal bonus is capped at the max, which the timer already sits at.
    expect(s.endgame.remainingMs).toBe(60000);
  });

  it("rejects words that are too short or not in the list", () => {
    let s = freshGame();
    for (let i = 0; i < 4; i++) s = flipNextTile(s);
    const short = attemptWord(s, DICT, "you", "car");
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.reason).toBe("TOO_SHORT");

    const notWord = attemptWord(s, DICT, "you", "raec");
    expect(notWord.ok).toBe(false);
    if (!notWord.ok) expect(notWord.reason).toBe("NOT_A_WORD");
  });

  it("returns tiles to the pool when a word is challenged out", () => {
    let s = freshGame();
    for (let i = 0; i < 4; i++) s = flipNextTile(s);
    const r = attemptWord(s, DICT, "you", "CARE");
    if (!r.ok) throw new Error("claim failed");
    s = r.state;
    s = challengeWord(s, s.words[0].id, false);
    expect(s.words).toHaveLength(0);
    expect(s.pool.map((t) => t.letter).sort().join("")).toBe("ACER");
  });

  it("ends the game when the endgame timer runs out", () => {
    let s = freshGame();
    for (let i = 0; i < 5; i++) s = flipNextTile(s);
    s = tickEndgame(s, 60000);
    expect(s.phase).toBe("ended");
    const ended = s.events.some((e) => e.type === "gameEnd");
    expect(ended).toBe(true);
    // No moves allowed after the game ends.
    const r = attemptWord(s, DICT, "you", "CARE");
    expect(r.ok).toBe(false);
  });

  it("End game button ends immediately", () => {
    let s = freshGame();
    s = flipNextTile(s);
    s = endGame(s);
    expect(s.phase).toBe("ended");
  });

  it("logs an ordered event stream for replay", () => {
    let s = freshGame();
    for (let i = 0; i < 4; i++) s = flipNextTile(s);
    const r = attemptWord(s, DICT, "you", "CARE");
    if (r.ok) s = r.state;
    const types = s.events.map((e) => e.type);
    expect(types[0]).toBe("gameStart");
    expect(types).toContain("flip");
    expect(types).toContain("claim");
    // Sequence numbers are strictly increasing.
    for (let i = 1; i < s.events.length; i++) {
      expect(s.events[i].seq).toBeGreaterThan(s.events[i - 1].seq);
    }
  });
});

describe("steal diagnostics and legality", () => {
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
    const claim = attemptWord(s, DICT, "you", "MILE");
    if (!claim.ok) throw new Error("setup claim failed");
    return claim.state; // pool: S ; word: MILE
  }

  it("explains that a prefix-only extension is not a rearrangement", () => {
    const s = milesGame();
    const r = attemptWord(s, DICT, "bot", "SMILE"); // MILE + S, but MILE ⊂ SMILE
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("NOT_A_STEAL");
      expect(r.message.toLowerCase()).toContain("rearrange");
    }
  });

  it("allows a genuine rearrangement steal (MILE -> SLIME)", () => {
    const s = milesGame();
    const r = attemptWord(s, DICT, "bot", "SLIME");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.move.kind).toBe("steal");
  });

  it("moveIsLegal agrees with attemptWord", () => {
    const s = milesGame();
    const src = s.words[0].id;
    expect(moveIsLegal(s, DICT, { kind: "steal", playerId: "bot", text: "SLIME", sourceWordId: src })).toBe(true);
    expect(moveIsLegal(s, DICT, { kind: "steal", playerId: "bot", text: "SMILE", sourceWordId: src })).toBe(false);
  });
});
