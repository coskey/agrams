import { describe, it, expect } from "vitest";
import { Dictionary } from "./dictionary";
import { buildMorphology, emptyMorphology } from "./morphology";
import { lettersToCounts } from "./letters";
import { analyzeHelp } from "./help";

// A supply with plenty of every letter, so tests that aren't about the
// remaining-tiles rule behave as if any extra letter is available.
const SUPPLY_ALL = new Array<number>(26).fill(9);

const WORDS = [
  "CARE", "ACRE", "RACE", // anagrams of CARE
  "RACER", // CARE + R
  "CARES", // CARE + S (same root as CARE)
  "CARET", "CATER", "CRATE", "REACT", "TRACE", // CARE + T anagrams
  "QOPH", // isolated: no anagrams or extensions here
];

const dict = new Dictionary(WORDS);
// Make CARES an inflection of CARE so the steal is blocked by the root rule.
const morph = buildMorphology(["CARES\tCARE"], dict);

const NO_POOL = lettersToCounts("");

describe("analyzeHelp", () => {
  it("lists current anagrams (same letters, excluding the word itself)", () => {
    const help = analyzeHelp("CARE", NO_POOL, SUPPLY_ALL, dict, morph);
    expect(help.currentAnagrams).toEqual(["ACRE", "RACE"]);
  });

  it("finds +1 steals and excludes same-root words", () => {
    const help = analyzeHelp("CARE", NO_POOL, SUPPLY_ALL, dict, morph);
    const words = help.plus1.map((s) => s.word).sort();
    expect(words).toEqual(["CARET", "CATER", "CRATE", "RACER", "REACT", "TRACE"]);
    expect(words).not.toContain("CARES"); // same root as CARE
  });

  it("marks formableNow and glows green when a steal fits the pool", () => {
    const help = analyzeHelp("CARE", lettersToCounts("R"), SUPPLY_ALL, dict, morph);
    expect(help.glow).toBe("green");
    const racer = help.plus1.find((s) => s.word === "RACER");
    expect(racer?.formableNow).toBe(true);
    expect(racer?.extra).toBe("R");
  });

  it("glows yellow when a steal is one letter away from the pool", () => {
    const help = analyzeHelp("CARE", NO_POOL, SUPPLY_ALL, dict, morph);
    expect(help.glow).toBe("yellow");
  });

  it("no glow and empty lists for an isolated word", () => {
    const help = analyzeHelp("QOPH", NO_POOL, SUPPLY_ALL, dict, morph);
    expect(help.glow).toBeNull();
    expect(help.currentAnagrams).toEqual([]);
    expect(help.plus1).toEqual([]);
    expect(help.plus2).toEqual([]);
    expect(help.plus3).toEqual([]);
  });

  it("caps each list and reports how many more were found", () => {
    const help = analyzeHelp("CARE", NO_POOL, SUPPLY_ALL, dict, morph, { cap: 2 });
    expect(help.plus1).toHaveLength(2);
    expect(help.more.plus1).toBe(4); // 6 legal +1 steals, 2 shown
  });
});

describe("analyzeHelp — remaining-tiles supply", () => {
  const d2 = new Dictionary(["CAR", "CARS", "CART", "CARE", "SCAR", "ARCS"]);
  const m2 = emptyMorphology(d2);

  it("drops steals whose extra letters aren't in the remaining supply", () => {
    // Only an S is left in play (no E, no T): +T (CART) and +E (CARE) are gone.
    const supply = lettersToCounts("S");
    const help = analyzeHelp("CAR", NO_POOL, supply, d2, m2);
    // +T (CART) is gone (no T). CARS is dropped too — it's the same root as CAR
    // (a plural), leaving the different-root anagrams ARCS and SCAR.
    expect(help.plus1.map((s) => s.word).sort()).toEqual(["ARCS", "SCAR"]);
    // Still glows yellow: the S needed is drawable and it's a common letter.
    expect(help.glow).toBe("yellow");
  });

  it("no suggestions or glow when the supply is exhausted", () => {
    const help = analyzeHelp("CAR", NO_POOL, lettersToCounts(""), d2, m2);
    expect(help.plus1).toEqual([]);
    expect(help.glow).toBeNull();
  });
});
