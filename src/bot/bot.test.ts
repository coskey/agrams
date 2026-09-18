import { describe, it, expect } from "vitest";
import { createGame, flipNextTile, attemptWord, type Rules } from "../engine/game";
import { Dictionary, buildVocabulary } from "../engine/dictionary";
import { emptyMorphology } from "../engine/morphology";
import { makeRng } from "../engine/bag";
import { findBotCandidates, findDeepStealCandidates, chooseBotMove, botLevel } from "./bot";
import type { Player, Tile } from "../engine/types";

const DICT = new Dictionary(["CARE", "RACER", "RACE", "ACRE", "CATER", "TRACE"]);
const RULES: Rules = { dictionary: DICT, morphology: emptyMorphology(DICT) };
const VOCAB = buildVocabulary(["CARE", "RACER", "RACE", "CATER", "TRACE"], DICT);

const PLAYERS: Player[] = [
  { id: "you", name: "You", isBot: false },
  { id: "bot", name: "Bot", isBot: true },
];

function poolGame(letters: string) {
  const bag: Tile[] = letters
    .split("")
    .map((letter, i) => ({ id: i, letter }))
    .reverse();
  let s = createGame({ players: PLAYERS, bag });
  for (let i = 0; i < letters.length; i++) s = flipNextTile(s);
  return s;
}

const level3 = botLevel(3);

describe("bot", () => {
  it("finds a claim it can make from the pool", () => {
    const s = poolGame("CARE");
    const candidates = findBotCandidates(s, RULES, VOCAB, "bot", 8);
    expect(candidates.some((c) => c.move.kind === "claim" && c.move.text === "CARE")).toBe(true);
  });

  it("finds a legal steal of an existing word", () => {
    let s = poolGame("CARER");
    const claim = attemptWord(s, RULES, "you", "CARE");
    if (!claim.ok) throw new Error("setup claim failed");
    s = claim.state;
    const candidates = findBotCandidates(s, RULES, VOCAB, "bot", 8);
    expect(candidates.some((c) => c.move.kind === "steal" && c.move.text === "RACER")).toBe(true);
  });

  it("respects the max word length", () => {
    const s = poolGame("CARE");
    expect(findBotCandidates(s, RULES, VOCAB, "bot", 3)).toHaveLength(0);
  });

  it("chooses a move deterministically with a seeded rng", () => {
    const s = poolGame("CARE");
    const move = chooseBotMove(s, RULES, VOCAB, "bot", {
      maxWordLength: level3.maxWordLength,
      missProbability: 0,
      topK: 3,
      rng: makeRng(42),
    });
    expect(move?.playerId).toBe("bot");
  });

  it("can be made to hold back", () => {
    const s = poolGame("CARE");
    const move = chooseBotMove(s, RULES, VOCAB, "bot", {
      maxWordLength: 8,
      missProbability: 1,
      topK: 3,
      rng: makeRng(42),
    });
    expect(move).toBeNull();
  });

  it("has six difficulty levels, hardest strongest", () => {
    expect(botLevel(1).missProbability).toBeGreaterThan(botLevel(5).missProbability);
    expect(botLevel(5).maxWordLength).toBeGreaterThan(botLevel(1).maxWordLength);
    // Level 6 ("unreal"): faster reactions than L5 and the deep steal search on.
    expect(botLevel(6).reactionHiMs).toBeLessThan(botLevel(5).reactionHiMs);
    expect(botLevel(6).deepStealAdd).toBeGreaterThan(0);
    expect(botLevel(7)).toEqual(botLevel(6)); // clamps to max
  });

  it("deep steal search finds a full-dictionary steal the common vocab misses", () => {
    // Common vocab lacks RACER; the deep search still finds CARE -> RACER.
    const vocabNoRacer = buildVocabulary(["CARE", "RACE", "CATER", "TRACE"], DICT);
    let s = poolGame("CARER");
    const claim = attemptWord(s, RULES, "you", "CARE");
    if (!claim.ok) throw new Error("setup claim failed");
    s = claim.state;

    const shallow = findBotCandidates(s, RULES, vocabNoRacer, "bot", 99);
    expect(shallow.some((c) => c.move.kind === "steal" && c.move.text === "RACER")).toBe(false);

    const deep = findDeepStealCandidates(s, RULES, "bot", 3);
    expect(deep.some((c) => c.move.kind === "steal" && c.move.text === "RACER")).toBe(true);

    const move = chooseBotMove(s, RULES, vocabNoRacer, "bot", {
      maxWordLength: 99,
      missProbability: 0,
      topK: 1,
      deepStealAdd: 3,
      rng: makeRng(1),
    });
    expect(move).toEqual({ kind: "steal", playerId: "bot", text: "RACER", sourceWordId: s.words[0].id });
  });
});
