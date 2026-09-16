import { useEffect, useState } from "react";
import { loadGameData, type GameData } from "../data/load";
import { DEFAULT_SETTINGS, type GameSettings, type GameMode } from "../engine";
import { useTheme } from "./useTheme";
import { Home } from "./screens/Home";
import { Game } from "./screens/Game";
import { SettingsModal } from "./components/SettingsModal";
import { Tutorial } from "./components/Tutorial";

const TUTORIAL_KEY = "agrams:tutorialSeen";

function firstVisit(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) !== "1";
  } catch {
    return true;
  }
}

export function App() {
  const theme = useTheme();
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"home" | "game">("home");
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [startMode, setStartMode] = useState<GameMode | null>(null);
  const [showTutorial, setShowTutorial] = useState<boolean>(firstVisit);
  const [startNonce, setStartNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadGameData()
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const markTutorialSeen = () => {
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowTutorial(false);
  };

  if (error) {
    return (
      <div className="app">
        <div className="loading">Could not load the game: {error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="app">
        <div className="loading">Loading word list…</div>
      </div>
    );
  }

  return (
    <>
      {view === "home" ? (
        <Home
          themeMode={theme.mode}
          onToggleTheme={theme.toggle}
          onPlay={() => setStartMode("vs-computer")}
          onPractice={() => setStartMode("practice")}
          onHowToPlay={() => setShowTutorial(true)}
        />
      ) : (
        <Game
          key={startNonce}
          rules={data.rules}
          vocab={data.vocab}
          settings={settings}
          themeMode={theme.mode}
          onToggleTheme={theme.toggle}
          onExit={() => setView("home")}
        />
      )}

      {startMode && (
        <SettingsModal
          initial={{ ...settings, mode: startMode }}
          title={startMode === "practice" ? "Practice game" : "New game"}
          confirmLabel="Start game"
          onConfirm={(s) => {
            setSettings(s);
            setStartMode(null);
            setStartNonce((n) => n + 1);
            setView("game");
          }}
          onCancel={() => setStartMode(null)}
        />
      )}

      {showTutorial && <Tutorial onDone={markTutorialSeen} />}
    </>
  );
}
