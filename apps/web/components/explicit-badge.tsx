/**
 * Метка explicit (18+, 436-ФЗ). Размер в em с потолком 0.8rem — рядом с крупным
 * заголовком (text-3xl/5xl) без потолка значок раздувался до ~30–50px.
 */
export function ExplicitBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Explicit · 18+ — ненормативная лексика или откровенный контент"
      aria-label="Explicit, возрастное ограничение 18 плюс"
      style={{ width: '1.5em', height: '1.5em', fontSize: 'min(0.7em, 0.8rem)' }}
      className={`inline-flex shrink-0 items-center justify-center rounded-[0.28em] bg-white/15 font-semibold leading-none text-white/75 ${className}`}
    >
      E
    </span>
  );
}
