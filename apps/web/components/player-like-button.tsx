'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { useLikesStore } from '@/store/likes';
import { toast } from '@/components/toast';

export function PlayerLikeButton({
  trackId,
  size = 'md',
}: {
  trackId: string;
  size?: 'sm' | 'md';
}) {
  const load = useLikesStore((s) => s.load);
  const update = useLikesStore((s) => s.update);
  const liked = useLikesStore((s) => s.state[trackId] ?? null);

  useEffect(() => { load(trackId); }, [trackId, load]);

  function toggle() {
    if (liked === null) return;
    const next = !liked;
    update(trackId, next);
    fetch(`/api/v1/tracks/${trackId}/like`, { method: next ? 'POST' : 'DELETE' })
      .then((r) => { if (!r.ok) rollback(); })
      .catch(rollback);

    function rollback() {
      update(trackId, !next);
      toast.error('Не удалось сохранить лайк');
    }
  }

  if (liked === null) return null;

  const px = size === 'sm' ? 15 : 18;

  return (
    <motion.button
      type="button"
      onClick={toggle}
      aria-label={liked ? 'Убрать лайк' : 'Лайкнуть'}
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.15 }}
      transition={spring.snappy}
      className="shrink-0 inline-flex transition-[color,opacity] duration-150"
      style={{
        color: liked ? 'var(--artist-accent, var(--foreground))' : undefined,
        opacity: liked ? 1 : 0.35,
      }}
    >
      <motion.span
        animate={{ scale: liked ? [1, 1.35, 1] : 1 }}
        transition={liked ? { duration: 0.38, ease: [0.22, 1, 0.36, 1] } : spring.snappy}
        className="inline-flex"
      >
        <HeartIcon filled={liked} size={px} />
      </motion.span>
    </motion.button>
  );
}

function HeartIcon({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
