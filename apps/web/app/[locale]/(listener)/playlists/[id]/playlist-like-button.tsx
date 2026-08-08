'use client';

import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { HeartIcon } from '@/components/icons';
import { usePlaylistLike } from '@/components/use-playlist-like';

export function PlaylistLikeButton({
  playlistId,
  initialLiked,
  initialCount,
}: {
  playlistId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const { liked, likes, toggle } = usePlaylistLike(playlistId, initialLiked, initialCount);

  return (
    <motion.button
      type="button"
      onClick={() => void toggle()}
      whileTap={{ scale: 0.85 }}
      transition={spring.snappy}
      aria-label={liked ? 'Убрать из избранного' : 'В избранное'}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
    >
      <HeartIcon filled={liked} size={14} strokeWidth={2} className={liked ? '[color:oklch(65%_0.20_25)]' : undefined} />
      {likes > 0 && <span className="font-mono text-xs">{likes}</span>}
    </motion.button>
  );
}
