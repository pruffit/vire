'use client';

import { useTranslations } from 'next-intl';

export function PlayingBars({ animate }: { animate: boolean }) {
  const t = useTranslations('player');
  return (
    <span className="flex items-end gap-[2px] h-3" style={{ color: 'var(--artist-accent, var(--foreground))' }} aria-label={t('nowPlayingSr')}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] bg-current rounded-full"
          style={{
            height: animate ? undefined : '40%',
            animation: animate ? `vire-eq 0.9s ease-in-out ${i * 0.15}s infinite` : undefined,
          }}
        />
      ))}
    </span>
  );
}
