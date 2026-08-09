'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { spring } from '@vire/ui/motion';
import { formatDuration } from '@/lib/format';
import { ShareIcon } from '@/components/icons';
import { Icon } from '@/components/icon';
import { touchTargetClass } from '@/components/popover';
import { AdaptiveMenu, type MenuItem } from '@/components/adaptive-menu';
import { toast } from '@/lib/toast';

interface Props {
  /** Каноническая ссылка на трек без query; дефолт — текущий адрес. Плеер обязан
   *  передавать явно: играющий трек может не совпадать со страницей. */
  trackUrl?: string;
  /** Текущая позиция в секундах. Если > 2 — появляется опция «с момента». */
  currentTime?: number;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  variant?: 'plain' | 'bordered';
}

/** Меню «поделиться»: ссылка на трек или с таймкодом `?t=<сек>` (страница трека перематывает). */
export function TrackShare({
  trackUrl,
  currentTime,
  size = 'md',
  align = 'right',
  variant = 'plain',
}: Props) {
  const t = useTranslations('track.share');
  const [open, setOpen] = useState(false);

  const moment = currentTime && currentTime > 2 ? Math.round(currentTime) : null;

  async function copy(kind: 'link' | 'moment') {
    const base = trackUrl ?? window.location.href.split('?')[0];
    const url = kind === 'moment' && moment ? `${base}?t=${moment}` : base;
    try {
      await navigator.clipboard.writeText(url);
      toast(t('copied'));
    } catch {
      /* буфер недоступен */
    }
  }

  const items: MenuItem[] = [
    { label: t('link'), icon: <Icon name="link" size={13} />, onClick: () => copy('link') },
  ];
  if (moment != null) {
    items.push({
      label: t('fromMoment'),
      hint: <span className="text-xs font-mono tabular-nums text-foreground/40">{formatDuration(moment)}</span>,
      onClick: () => copy('moment'),
    });
  }

  const triggerStyle =
    variant === 'bordered'
      ? { border: '1px solid var(--artist-accent)' }
      : undefined;

  return (
    <AdaptiveMenu
      open={open}
      onOpenChange={setOpen}
      align={align}
      title={t('aria')}
      items={items}
      trigger={({ open: expanded, toggle, ref }) => (
        <motion.button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-label={t('aria')}
          aria-expanded={expanded}
          whileTap={{ scale: 0.9 }}
          whileHover={variant === 'bordered' ? { scale: 1.08 } : undefined}
          transition={spring.snappy}
          className={`${touchTargetClass(size)} rounded-full flex items-center justify-center transition-opacity`}
          style={{ opacity: expanded ? 0.9 : 0.5, ...triggerStyle }}
        >
          <ShareIcon />
        </motion.button>
      )}
    />
  );
}
