// Loads the bundled word data and builds the rules (validation dictionary +
// root detection) plus the bot's common-word vocabulary. Runs once at startup.

import { Dictionary, buildVocabulary, type VocabEntry } from "../engine/dictionary";
import { buildMorphology } from "../engine/morphology";
import type { Rules } from "../engine/game";

export interface GameData {
  rules: Rules;
  vocab: VocabEntry[];
}

function splitWords(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line.length > 0);
}

export async function loadGameData(): Promise<GameData> {
  const base = import.meta.env.BASE_URL;
  const get = async (path: string) => {
    const r = await fetch(`${base}${path}`);
    if (!r.ok) throw new Error(`Failed to load ${path} (${r.status})`);
    return r.text();
  };

  const [enableText, commonText, inflText] = await Promise.all([
    get("words/enable.txt"),
    get("words/common.txt"),
    get("words/inflections.txt"),
  ]);

  const dictionary = new Dictionary(splitWords(enableText));
  const morphology = buildMorphology(splitWords(inflText), dictionary);
  const vocab = buildVocabulary(splitWords(commonText), dictionary);
  return { rules: { dictionary, morphology }, vocab };
}
