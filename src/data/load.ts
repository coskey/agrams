// Loads the bundled word lists and builds the validation dictionary plus the
// bot's common-word vocabulary. Runs once at startup.

import { Dictionary, buildVocabulary, type VocabEntry } from "../engine/dictionary";

export interface GameData {
  dictionary: Dictionary;
  vocab: VocabEntry[];
}

function splitWords(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line.length > 0);
}

export async function loadGameData(): Promise<GameData> {
  const base = import.meta.env.BASE_URL;
  const [enableText, commonText] = await Promise.all([
    fetch(`${base}words/enable.txt`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load word list (${r.status})`);
      return r.text();
    }),
    fetch(`${base}words/common.txt`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load vocabulary (${r.status})`);
      return r.text();
    }),
  ]);

  const dictionary = new Dictionary(splitWords(enableText));
  const vocab = buildVocabulary(splitWords(commonText), dictionary);
  return { dictionary, vocab };
}
