import { TopBar } from "../components/TopBar";
import { Wordmark } from "../components/Wordmark";

interface Props {
  onPlay: () => void;
  onPractice: () => void;
  onHowToPlay: () => void;
  themeMode: string;
  onToggleTheme: () => void;
}

export function Home({ onPlay, onPractice, onHowToPlay, themeMode, onToggleTheme }: Props) {
  return (
    <div className="app">
      <TopBar themeMode={themeMode} onToggleTheme={onToggleTheme} />
      <div className="home">
        <Wordmark className="hero" />
        <div className="home-actions">
          <button className="btn" onClick={onPlay}>
            Play vs. Computer
          </button>
          <button className="btn secondary" onClick={onPractice}>
            Solo practice
          </button>
          <button className="btn secondary" onClick={onHowToPlay}>
            How to play
          </button>
        </div>
      </div>
    </div>
  );
}
