/** The Agrams wordmark: a lowercase "a" tile followed by "grams". */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark ${className ?? ""}`} role="img" aria-label="Agrams">
      <span className="logo-tile" aria-hidden="true">a</span>
      <span aria-hidden="true">grams</span>
    </span>
  );
}
