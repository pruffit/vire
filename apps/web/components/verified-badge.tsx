import { cn } from '@/lib/utils';

/** Чип «verified»; `color` перекрывает дефолтный `var(--artist-accent)` (живое превью). */
export function VerifiedBadge({
  color = 'var(--artist-accent)',
  fontFamily,
  className,
}: {
  color?: string;
  fontFamily?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[10px] px-2 py-0.5 rounded-sm border align-middle',
        className,
      )}
      style={{ borderColor: `color-mix(in oklch, ${color} 40%, transparent)`, color, fontFamily }}
    >
      <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
        <path d="M5 0L6.18 3.32L9.76 3.09L7.1 5.27L8.09 8.82L5 6.9L1.91 8.82L2.9 5.27L0.24 3.09L3.82 3.32L5 0Z" />
      </svg>
      verified
    </span>
  );
}
