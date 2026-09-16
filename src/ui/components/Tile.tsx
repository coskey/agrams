interface TileProps {
  letter: string;
  small?: boolean;
  used?: boolean;
  onTap?: () => void;
}

export function Tile({ letter, small, used, onTap }: TileProps) {
  const cls = [
    "tile",
    small ? "small" : "",
    onTap ? "tappable" : "",
    used ? "used" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (onTap) {
    return (
      <button
        type="button"
        className={cls}
        onClick={used ? undefined : onTap}
        aria-label={`Letter ${letter}`}
        aria-disabled={used}
      >
        {letter}
      </button>
    );
  }
  return (
    <span className={cls} aria-label={`Letter ${letter}`}>
      {letter}
    </span>
  );
}
