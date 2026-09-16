import type { ReactNode } from "react";

interface Props {
  children?: ReactNode;
  themeMode: string;
  onToggleTheme: () => void;
}

export function TopBar({ children, onToggleTheme, themeMode }: Props) {
  return (
    <header className="topbar">
      <span className="wordmark">Agrams</span>
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
