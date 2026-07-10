'use client';

import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { formatCount } from '@/lib/format';
import { followArtist } from '@vire/api-client';
import { useOptimisticToggle } from '@/lib/use-optimistic-toggle';

interface Props {
  slug: string;
  initialFollowing: boolean;
  initialCount: number;
}

export function FollowButton({ slug, initialFollowing, initialCount }: Props) {
  const {
    on: following,
    count,
    pending,
    toggle,
  } = useOptimisticToggle({
    id: slug,
    initial: initialFollowing,
    initialCount,
    request: (next) => followArtist(slug, next),
    errorMessage: 'Не удалось обновить подписку',
  });

  return (
    <div className="flex items-center gap-3">
      <motion.button
        onClick={toggle}
        disabled={pending}
        whileTap={{ scale: 0.95 }}
        transition={spring.snappy}
        className={`relative inline-flex min-h-11 items-center justify-center px-4 rounded-full text-sm font-medium overflow-hidden transition-colors duration-300 disabled:opacity-50 ${
          following
            ? 'bg-white/10 hover:bg-white/15 border border-white/20'
            : 'bg-[var(--artist-accent)] hover:opacity-80 border border-transparent'
        }`}
        style={following ? undefined : { color: 'var(--artist-bg, #0d0d0d)' }}
      >
        {/* Текст состояния кроссфейдится при переключении подписки. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={following ? 'on' : 'off'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring.snappy}
            className="block"
          >
            {following ? 'Подписан' : 'Подписаться'}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {count > 0 && (
        <span className="text-xs opacity-40 tabular-nums relative inline-flex h-4 overflow-hidden items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={count}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={spring.snappy}
              className="inline-block"
            >
              {formatCount(count)}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
    </div>
  );
}
