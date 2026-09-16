import { TopBar } from "../components/TopBar";

interface Props {
  onPlay: () => void;
  onHowToPlay: () => void;
  themeMode: string;
  onToggleTheme: () => void;
}

// Simple decorative 3x3 logo grid (filled/empty like a mini crossword).
const LOGO_FILL = [false, true, false, true, false, true, false, true, false];

export function Home({ onPlay, onHowToPlay, themeMode, onToggleTheme }: Props) {
  return (
    <div className="app">
      <TopBar themeMode={themeMode} onToggleTheme={onToggleTheme} />
      <div className="home">
        <div className="logo" aria-hidden="true">
          {LOGO_FILL.map((f, i) => (
            <span key={i} className={f ? "fill" : ""} />
          ))}
        </div>
        <h1>Agrams</h1>
        <p className="tag">
          The classic word game Anagrams. Flip letters, build words, and steal
          them right back.
        </p>
        <div className="home-actions">
          <button className="btn" onClick={onPlay}>
            Play vs. Computer
          </button>
          <button className="btn secondary" onClick={onHowToPlay}>
            How to play
          </button>
        </div>
      </div>
    </div>
  );
}
