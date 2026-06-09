'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';

const POLL_MS = 25_000;

/**
 * Живой счётчик «слушают сейчас» для страницы трека. Опрашивает presence-эндпоинт
 * и показывается только когда есть хотя бы один слушатель (включая тебя, если
 * трек играет в плеере). Концепт: слушатель видит опционально.
 */
export function LiveListeners({
  trackId,
  initialCount = 0,
}: {
  trackId: string;
  initialCount?: number;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let alive = true;

    async function poll() {
      const res = await fetch(`/api/v1/tracks/${trackId}/listening`).catch(() => null);
      if (!res?.ok || !alive) return;
      const data = (await res.json()) as { count?: number };
      if (alive && typeof data.count === 'number') setCount(data.count);
    }

    const timer = setInterval(poll, POLL_MS);
    poll(); // обновляем сразу при монтировании
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [trackId]);

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={spring.snappy}
          className="inline-flex items-center gap-2 text-xs"
          style={{ color: 'var(--artist-accent)' }}
          aria-live="polite"
        >
          <span className="relative flex w-2 h-2 shrink-0" aria-hidden="true">
            <span
              className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping"
              style={{ background: 'var(--artist-accent)' }}
            />
            <span
              className="relative inline-flex w-2 h-2 rounded-full"
              style={{ background: 'var(--artist-accent)' }}
            />
          </span>
          <span className="tabular-nums">
            {count.toLocaleString('ru-RU')} {count === 1 ? 'слушает' : 'слушают'} сейчас
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}
