'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { LivePulse } from '@/components/live-pulse';

const POLL_MS = 25_000;

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
      // в скрытой вкладке не дёргаем сеть — счётчик никто не видит
      if (document.visibilityState !== 'visible') return;
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
          <LivePulse />
          <span className="tabular-nums">
            {count.toLocaleString('ru-RU')} {count === 1 ? 'слушает' : 'слушают'} сейчас
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}
