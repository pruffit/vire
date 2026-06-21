'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { toast } from '@/components/toast';
import { Icon } from '@/components/icon';

/**
 * Компактный пресейв для секции «Скоро выйдет» на странице артиста. Залогиненный
 * сохраняет в один клик (оптимистично). Гостю показываем ссылку на страницу
 * релиза — там полный флоу с вводом email (не тащим форму в узкую строку списка).
 * Цвета — из темы артиста (--artist-accent).
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
  const [presaved, setPresaved] = useState(initialPresaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !presaved;
    setPresaved(next); // оптимистично
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/releases/${releaseId}/presave`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) throw new Error();
    } catch {
      setPresaved(!next); // откат
      toast.error('Не удалось сохранить. Попробуй ещё раз');
    } finally {
      setBusy(false);
    }
  }

  const base =
    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors';

  if (!isAuthed) {
    return (
      <Link
        href={releaseHref}
        aria-label="Напомнить о выходе"
        className={`${base} hover:opacity-90`}
        style={{ background: 'var(--artist-accent)', color: 'var(--artist-bg, #000)' }}
      >
        <Icon name="bell" size={13} />
        Напомнить
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
      {presaved ? 'Сохранено' : 'Пресейв'}
    </motion.button>
  );
}
