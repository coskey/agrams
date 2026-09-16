import { describe, it, expect } from "vitest";
import { createGame, flipNextTile, attemptWord } from "../engine/game";
import { Dictionary, buildVocabulary } from "../engine/dictionary";
import { makeRng } from "../engine/bag";
import { findBotCandidates, chooseBotMove } from "./bot";
import type { Player, Tile } from "../engine/types";

const DICT = new Dictionary(["CARE", "RACER", "RACE", "ACRE", "CATER", "TRACE"]);
const VOCAB = buildVocabulary(["CARE", "RACER", "RACE", "CATER", "TRACE"], DICT);

const PLAYERS: Player[] = [
  { id: "you", name: "You", isBot: false },
  { id: "bot", name: "Bot", isBot: true },
];

function poolGame(letters: string) {
  // Build a bag whose flip order (pop from end) reveals `letters` left-to-right.
  const bag: Tile[] = letters
    .split("")
    .map((letter, i) => ({ id: i, letter }))
    .reverse();
  let s = createGame({ players: PLAYERS, bag });
  for (let i = 0; i < letters.length; i++) s = flipNextTile(s);
  return s;
}

describe("bot", () => {
  it("finds a claim it can make from the pool", () => {
    const s = poolGame("CARE");
    const candidates = findBotCandidates(s, VOCAB, "bot", 8);
    expect(candidates.some((c) => c.move.kind === "claim" && c.move.text === "CARE")).toBe(true);
  });

  it("finds a legal steal of an existing word", () => {
    let s = poolGame("CARER"); // pool: C A R E R
    const claim = attemptWord(s, DICT, "you", "CARE");
    if (!claim.ok) throw new Error("setup claim failed");
    s = claim.state; // pool: R
    const candidates = findBotCandidates(s, VOCAB, "bot", 8);
    const steal = candidates.find(
      (c) => c.move.kind === "steal" && c.move.text === "RACER",
    );
    expect(steal).toBeDefined();
  });

  it("respects the max word length setting", () => {
    const s = poolGame("CARE");
    const candidates = findBotCandidates(s, VOCAB, "bot", 3);
    expect(candidates).toHaveLength(0);
  });

  it("chooses a move deterministically with a seeded rng", () => {
    const s = poolGame("CARE");
    const move = chooseBotMove(s, DICT, VOCAB, "bot", {
      maxWordLength: 8,
      missProbability: 0, // never skip
      topK: 3,
      rng: makeRng(42),
    });
    expect(move).not.toBeNull();
    expect(move?.playerId).toBe("bot");
  });

  it("can be made to hold back", () => {
    const s = poolGame("CARE");
    const move = chooseBotMove(s, DICT, VOCAB, "bot", {
      maxWordLength: 8,
      missProbability: 1, // always skip
      topK: 3,
      rng: makeRng(42),
    });
    expect(move).toBeNull();
  });
});
