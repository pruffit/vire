'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { formatDuration } from '@/lib/format';
import { ShareIcon, CheckIcon } from '@/components/icons';

interface Props {
  /**
   * Каноническая ссылка на трек без query. Если не передана — берётся из
   * текущего адреса (для страницы трека, где трек = текущая страница).
   * Плеер обязан передавать явно: играющий трек может не совпадать со страницей.
   */
  trackUrl?: string;
  /** Текущая позиция в секундах. Если > 2 — появляется опция «с момента». */
  currentTime?: number;
  size?: 'sm' | 'md';
  /** Сторона раскрытия поповера относительно кнопки. */
  align?: 'left' | 'right';
  /** Внешний вид триггера: плоский (плеер) или с акцент-обводкой (страница трека). */
  variant?: 'plain' | 'bordered';
}

/**
 * Кнопка «поделиться» с поповером: ссылка на трек или ссылка с таймкодом
 * (`?t=<сек>`). Приёмная сторона — страница трека — читает `?t=` и
 * перематывает. Концепт: поделиться моментом без публичного комментария.
 */
export function TrackShare({
  trackUrl,
  currentTime,
  size = 'md',
  align = 'right',
  variant = 'plain',
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<null | 'link' | 'moment'>(null);
  const ref = useRef<HTMLDivElement>(null);

  const moment = currentTime && currentTime > 2 ? Math.round(currentTime) : null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function copy(kind: 'link' | 'moment') {
    const base = trackUrl ?? window.location.href.split('?')[0];
    const url = kind === 'moment' && moment ? `${base}?t=${moment}` : base;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
      setTimeout(() => {
        setCopied(null);
        setOpen(false);
      }, 1100);
    } catch {
      /* буфер недоступен */
    }
  }

  const dim = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  const triggerStyle =
    variant === 'bordered'
      ? { border: '1px solid var(--artist-accent)' }
      : undefined;

  return (
    <div ref={ref} className="relative shrink-0">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Поделиться"
        aria-expanded={open}
        whileTap={{ scale: 0.9 }}
        whileHover={variant === 'bordered' ? { scale: 1.08 } : undefined}
        transition={spring.snappy}
        className={`${dim} rounded-full flex items-center justify-center transition-opacity`}
        style={{ opacity: open ? 0.9 : 0.5, ...triggerStyle }}
      >
        <ShareIcon />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={spring.snappy}
            className={`absolute z-50 bottom-full mb-2 min-w-[184px] rounded-xl border border-white/12 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            <ShareOption
              label="Ссылка на трек"
              done={copied === 'link'}
              onClick={() => copy('link')}
            />
            {moment != null && (
              <ShareOption
                label="С текущего момента"
                hint={formatDuration(moment)}
                done={copied === 'moment'}
                onClick={() => copy('moment')}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-foreground/85 hover:bg-white/8 transition-colors"
    >
      <span className="w-4 shrink-0 flex items-center justify-center text-primary">
        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <motion.span
              key="done"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={spring.snappy}
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
              <LinkIcon />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="flex-1">{done ? 'Скопировано' : label}</span>
      {hint && !done && (
        <span className="text-xs font-mono tabular-nums text-foreground/40">{hint}</span>
      )}
    </button>
  );
}

function LinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
