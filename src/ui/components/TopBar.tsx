import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

interface Props {
  children?: ReactNode;
  themeMode: string;
  onToggleTheme: () => void;
}

export function TopBar({ children, onToggleTheme, themeMode }: Props) {
  return (
    <header className="topbar">
      <Wordmark />
      <div className="spacer" />
      {children}
      <button
        className="icon-btn"
        onClick={onToggleTheme}
        aria-label="Toggle light or dark mode"
        title={`Theme: ${themeMode}`}
      >
        ◑
      </button>
    </header>
  );
}
