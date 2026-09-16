import { useEffect, useState } from "react";
import { loadGameData, type GameData } from "../data/load";
import { DEFAULT_SETTINGS, type GameSettings } from "../engine";
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
  const [showStart, setShowStart] = useState(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(firstVisit);
  const [startNonce, setStartNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadGameData()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
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
          onPlay={() => setShowStart(true)}
          onHowToPlay={() => setShowTutorial(true)}
        />
      ) : (
        <Game
          key={startNonce}
          dictionary={data.dictionary}
          vocab={data.vocab}
          settings={settings}
          themeMode={theme.mode}
          onToggleTheme={theme.toggle}
          onExit={() => setView("home")}
        />
      )}

      {showStart && (
        <SettingsModal
          initial={settings}
          onConfirm={(s) => {
            setSettings(s);
            setShowStart(false);
            setStartNonce((n) => n + 1);
            setView("game");
          }}
          onCancel={() => setShowStart(false)}
        />
      )}

      {showTutorial && <Tutorial onDone={markTutorialSeen} />}
    </>
  );
}
