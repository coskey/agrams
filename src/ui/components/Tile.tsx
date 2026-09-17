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
    // A selected ("used") tile stays tappable so tapping it again removes that
    // letter from the word being built.
    return (
      <button
        type="button"
        className={cls}
        onClick={onTap}
        aria-label={`Letter ${letter}`}
        aria-pressed={used}
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
