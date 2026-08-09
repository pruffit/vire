'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon } from '@/components/icon';
import { presaveRelease } from '@vire/api-client';
import { useOptimisticToggle } from '@/lib/use-optimistic-toggle';

/**
 * Компактный пресейв для «Скоро выйдет»: залогиненный — оптимистичный клик,
 * гость — ссылка на страницу релиза (email-форму в узкую строку не тащим).
 */
export function UpcomingPresaveButton({
  releaseId,
  initialPresaved,
  isAuthed,
  releaseHref,
}: {
  releaseId: string;
  initialPresaved: boolean;
  isAuthed: boolean;
  releaseHref: string;
}) {
  const t = useTranslations('release.presave');
  const {
    on: presaved,
    pending: busy,
    toggle,
  } = useOptimisticToggle({
    id: releaseId,
    initial: initialPresaved,
    request: (next) => presaveRelease(releaseId, next),
    errorMessage: t('saveFailed'),
  });

  const base =
    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors';

  if (!isAuthed) {
    return (
      <Link
        href={releaseHref}
        aria-label={t('remindCta')}
        className={`${base} hover:opacity-90`}
        style={{ background: 'var(--artist-accent)', color: 'var(--artist-bg, #000)' }}
      >
        <Icon name="bell" size={13} />
        {t('remindLabel')}
      </Link>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={toggle}
      disabled={busy}
      whileTap={{ scale: 0.95 }}
      transition={spring.snappy}
      aria-pressed={presaved}
      className={`${base} disabled:opacity-60`}
      style={
        presaved
          ? { background: 'color-mix(in oklch, var(--artist-accent) 18%, transparent)', color: 'var(--artist-accent)' }
          : { background: 'var(--artist-accent)', color: 'var(--artist-bg, #000)' }
      }
    >
      <Icon name={presaved ? 'check' : 'bell'} size={13} />
      {presaved ? t('savedShort') : t('presaveShort')}
    </motion.button>
  );
}
