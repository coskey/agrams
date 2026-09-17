import { describe, it, expect } from "vitest";
import { Dictionary } from "./dictionary";
import { buildMorphology } from "./morphology";
import { lettersToCounts } from "./letters";
import { analyzeHelp } from "./help";

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
    const help = analyzeHelp("CARE", NO_POOL, dict, morph);
    expect(help.currentAnagrams).toEqual(["ACRE", "RACE"]);
  });

  it("finds +1 steals and excludes same-root words", () => {
    const help = analyzeHelp("CARE", NO_POOL, dict, morph);
    const words = help.plus1.map((s) => s.word).sort();
    expect(words).toEqual(["CARET", "CATER", "CRATE", "RACER", "REACT", "TRACE"]);
    expect(words).not.toContain("CARES"); // same root as CARE
  });

  it("marks formableNow and glows green when a steal fits the pool", () => {
    const help = analyzeHelp("CARE", lettersToCounts("R"), dict, morph);
    expect(help.glow).toBe("green");
    const racer = help.plus1.find((s) => s.word === "RACER");
    expect(racer?.formableNow).toBe(true);
    expect(racer?.extra).toBe("R");
  });

  it("glows yellow when a steal is one letter away from the pool", () => {
    const help = analyzeHelp("CARE", NO_POOL, dict, morph);
    expect(help.glow).toBe("yellow");
  });

  it("no glow and empty lists for an isolated word", () => {
    const help = analyzeHelp("QOPH", NO_POOL, dict, morph);
    expect(help.glow).toBeNull();
    expect(help.currentAnagrams).toEqual([]);
    expect(help.plus1).toEqual([]);
    expect(help.plus2).toEqual([]);
    expect(help.plus3).toEqual([]);
  });

  it("caps each list and reports how many more were found", () => {
    const help = analyzeHelp("CARE", NO_POOL, dict, morph, { cap: 2 });
    expect(help.plus1).toHaveLength(2);
    expect(help.more.plus1).toBe(4); // 6 legal +1 steals, 2 shown
  });
});
