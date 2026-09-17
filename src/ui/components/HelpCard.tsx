import type { WordHelp, HelpSuggestion } from "../../engine";

interface Props {
  word: string;
  help: WordHelp;
}

function SuggestionList({ items, more }: { items: HelpSuggestion[]; more: number }) {
  if (items.length === 0) return <span className="help-none">none</span>;
  return (
    <span className="help-words">
      {items.map((s) => (
        <span key={s.word} className={`help-word ${s.formableNow ? "now" : ""}`}>
          {s.word}
          <sup className="help-extra">+{s.extra}</sup>
        </span>
      ))}
      {more > 0 && <span className="help-more">+{more} more</span>}
    </span>
  );
}

/** The Help Mode content: anagrams and +1/+2/+3 potential steals for a word. */
export function HelpCard({ word, help }: Props) {
  const showAnagrams = help.currentAnagrams.length > 0;
  const showPlus3 = !showAnagrams; // +3 only when there are no same-letter anagrams
  const empty =
    !showAnagrams &&
    help.plus1.length === 0 &&
    help.plus2.length === 0 &&
    help.plus3.length === 0;

  return (
    <div className="help-card">
      <div className="help-title">{word}</div>
      {empty ? (
        <div className="help-section">
          <span className="help-none">No anagrams or steals.</span>
        </div>
      ) : (
        <>
          {showAnagrams && (
            <div className="help-section">
              <div className="help-label">Anagrams</div>
              <span className="help-words">
                {help.currentAnagrams.map((w) => (
                  <span key={w} className="help-word">
                    {w}
                  </span>
                ))}
              </span>
            </div>
          )}
          <div className="help-section">
            <div className="help-label">+1 letter</div>
            <SuggestionList items={help.plus1} more={help.more.plus1} />
          </div>
          <div className="help-section">
            <div className="help-label">+2 letters</div>
            <SuggestionList items={help.plus2} more={help.more.plus2} />
          </div>
          {showPlus3 && (
            <div className="help-section">
              <div className="help-label">+3 letters</div>
              <SuggestionList items={help.plus3} more={help.more.plus3} />
            </div>
          )}
        </>
      )}
      <div className="help-hint">
        <span className="help-swatch now" /> in the pool now
      </div>
    </div>
  );
}
