'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { formatDuration } from '@/lib/format';
import { ShareIcon, CheckIcon } from '@/components/icons';
import { Icon } from '@/components/icon';
import { Popover, PopoverItem, touchTargetClass } from '@/components/popover';

interface Props {
  /** Каноническая ссылка на трек без query; дефолт — текущий адрес. Плеер обязан
   *  передавать явно: играющий трек может не совпадать со страницей. */
  trackUrl?: string;
  /** Текущая позиция в секундах. Если > 2 — появляется опция «с момента». */
  currentTime?: number;
  size?: 'sm' | 'md';
  /** Сторона раскрытия поповера относительно кнопки. */
  align?: 'left' | 'right';
  /** Внешний вид триггера: плоский (плеер) или с акцент-обводкой (страница трека). */
  variant?: 'plain' | 'bordered';
}

/** Поповер «поделиться»: ссылка на трек или с таймкодом `?t=<сек>` (страница трека перематывает). */
export function TrackShare({
  trackUrl,
  currentTime,
  size = 'md',
  align = 'right',
  variant = 'plain',
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<null | 'link' | 'moment'>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const moment = currentTime && currentTime > 2 ? Math.round(currentTime) : null;

  async function copy(kind: 'link' | 'moment') {
    const base = trackUrl ?? window.location.href.split('?')[0];
    const url = kind === 'moment' && moment ? `${base}?t=${moment}` : base;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopied(null);
        setOpen(false);
      }, 1100);
    } catch {
      /* буфер недоступен */
    }
  }

  const triggerStyle =
    variant === 'bordered'
      ? { border: '1px solid var(--artist-accent)' }
      : undefined;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align={align}
      trigger={({ open: expanded, toggle, ref }) => (
        <motion.button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-label="Поделиться"
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
    >
      <ShareOption label="Ссылка на трек" done={copied === 'link'} onClick={() => copy('link')} />
      {moment != null && (
        <ShareOption
          label="С текущего момента"
          hint={formatDuration(moment)}
          done={copied === 'moment'}
          onClick={() => copy('moment')}
        />
      )}
    </Popover>
  );
}

function ShareOption({
  label,
  hint,
  done,
  onClick,
}: {
  label: string;
  hint?: string;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <PopoverItem
      label={done ? 'Скопировано' : label}
      onClick={onClick}
      icon={
        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <motion.span
              key="done"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={spring.snappy}
              className="text-primary"
            >
              <CheckIcon />
            </motion.span>
          ) : (
            <motion.span
              key="dot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-foreground/30"
            >
              <Icon name="link" size={13} />
            </motion.span>
          )}
        </AnimatePresence>
      }
      hint={
        hint && !done ? (
          <span className="text-xs font-mono tabular-nums text-foreground/40">{hint}</span>
        ) : undefined
      }
    />
  );
}
