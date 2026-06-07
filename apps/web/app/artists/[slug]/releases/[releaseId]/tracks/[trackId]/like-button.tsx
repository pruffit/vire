'use client';

import { useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';

interface Props {
  trackId: string;
  initialLiked: boolean;
  initialCount: number;
}

export function LikeButton({ trackId, initialLiked, initialCount }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));

    startTransition(async () => {
      const res = await fetch(`/api/v1/tracks/${trackId}/like`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) {
        setLiked(!next);
        setCount((c) => c + (next ? -1 : 1));
      }
    });
  }

  return (
    <motion.button
      onClick={toggle}
      disabled={pending}
      aria-label={liked ? 'Убрать лайк' : 'Лайкнуть'}
      whileTap={{ scale: 0.85 }}
      transition={spring.snappy}
      className="flex items-center gap-1.5 text-sm transition-[color,opacity] duration-200 disabled:opacity-40"
      style={{ color: liked ? 'var(--artist-accent)' : undefined, opacity: liked ? 1 : 0.4 }}
    >
      {/* «Поп» сердечка при лайке: короткий всплеск масштаба. */}
      <motion.span
        animate={{ scale: liked ? [1, 1.35, 1] : 1 }}
        transition={liked ? { duration: 0.4, ease: [0.22, 1, 0.36, 1] } : spring.snappy}
        className="inline-flex"
      >
        <HeartIcon filled={liked} />
      </motion.span>

      {count > 0 && (
        <span className="font-mono tabular-nums text-xs relative inline-flex h-4 overflow-hidden items-center">
          {/* Роллинг цифры: старое значение уезжает, новое въезжает. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={count}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={spring.snappy}
              className="inline-block"
            >
              {count}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
    </motion.button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
