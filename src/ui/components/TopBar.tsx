import { useEffect, useRef, type ReactNode } from "react";
import { Wordmark } from "./Wordmark";

interface Props {
  children?: ReactNode;
  leftSlot?: ReactNode;
  themeMode: string;
  onToggleTheme: () => void;
}

export function TopBar({ children, leftSlot, onToggleTheme, themeMode }: Props) {
  const ref = useRef<HTMLElement>(null);

  // Publish the top bar's height so the pool can stick right below it, even as
  // the bar wraps to more rows on narrow screens.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty("--topbar-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header className="topbar" ref={ref}>
      <Wordmark />
      {leftSlot}
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
