'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { spring } from '@vire/ui/motion';
import { useLikesStore } from '@/store/likes';
import { HeartIcon } from '@/components/icons';

export function PlayerLikeButton({
  trackId,
  size = 'md',
}: {
  trackId: string;
  size?: 'sm' | 'md';
}) {
  const t = useTranslations('player');
  const load = useLikesStore((s) => s.load);
  const storeToggle = useLikesStore((s) => s.toggle);
  const liked = useLikesStore((s) => s.state[trackId] ?? null);

  useEffect(() => { load(trackId); }, [trackId, load]);

  function toggle() {
    storeToggle(trackId);
  }

  if (liked === null) return null;

  const px = size === 'sm' ? 15 : 18;

  return (
    <motion.button
      type="button"
      onClick={toggle}
      aria-label={liked ? t('unlike') : t('like')}
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.15 }}
      transition={spring.snappy}
      className="shrink-0 inline-flex items-center justify-center transition-[color,opacity] duration-150 pointer-coarse:w-11 pointer-coarse:h-11 pointer-coarse:-m-1.5"
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
