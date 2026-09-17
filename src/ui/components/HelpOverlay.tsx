import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Desktop: a card that follows the cursor and never intercepts pointer events,
 *  so tiles underneath stay clickable while the suggestions show. */
export function HelpTooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; ready: boolean }>({
    left: x + 14,
    top: y + 18,
    ready: false,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x + 14;
    if (left + w > vw - 8) left = x - w - 14;
    left = clamp(left, 8, Math.max(8, vw - w - 8));
    let top = y + 18;
    if (top + h > vh - 8) top = y - h - 18;
    top = clamp(top, 8, Math.max(8, vh - h - 8));
    setPos({ left, top, ready: true });
  }, [x, y, children]);

  return (
    <div
      ref={ref}
      className="help-overlay help-tooltip"
      style={{ left: pos.left, top: pos.top, visibility: pos.ready ? "visible" : "hidden" }}
    >
      {children}
    </div>
  );
}

interface Anchor {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

/** Mobile: a card pinned near a word (above it if there's room, else below),
 *  dismissed by tapping elsewhere, tapping a tile, or scrolling. */
export function HelpPopover({
  anchor,
  onClose,
  children,
}: {
  anchor: Anchor;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; ready: boolean }>({
    left: anchor.left,
    top: anchor.top,
    ready: false,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = clamp(anchor.left, 8, Math.max(8, vw - w - 8));
    // Prefer above the word; drop below if it wouldn't fit.
    let top = anchor.top - h - 8;
    if (top < 8) top = Math.min(anchor.bottom + 8, vh - h - 8);
    top = clamp(top, 8, Math.max(8, vh - h - 8));
    setPos({ left, top, ready: true });
  }, [anchor, children]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest(".help-popover") || t.closest(".help-badge"))) return;
      onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="help-overlay help-popover"
      style={{ left: pos.left, top: pos.top, visibility: pos.ready ? "visible" : "hidden" }}
    >
      <button className="help-close" onClick={onClose} aria-label="Close help">
        ✕
      </button>
      {children}
    </div>
  );
}
