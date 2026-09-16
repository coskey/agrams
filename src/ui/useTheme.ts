import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "agrams:theme";

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore unavailable storage */
  }
  return "system";
}

function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", mode);
  }
}

/** Theme state with light/dark/system, persisted per viewer. */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readStored);

  useEffect(() => {
    applyTheme(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const toggle = useCallback(() => {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setMode((m) => {
      // Cycle through the two visible states relative to what is shown now.
      const showingDark = m === "dark" || (m === "system" && prefersDark);
      return showingDark ? "light" : "dark";
    });
  }, []);

  return { mode, setMode, toggle };
}
