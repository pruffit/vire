'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';

const POLL_MS = 20_000;

/** «Слушают сейчас» по всем трекам артиста — живой индикатор в дашборде. */
export function LiveNow() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    async function poll() {
      const res = await fetch('/api/v1/dashboard/live').catch(() => null);
      if (!res?.ok || !alive) return;
      const data = (await res.json()) as { count?: number };
      if (alive && typeof data.count === 'number') setCount(data.count);
    }
    const timer = setInterval(poll, POLL_MS);
    poll();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={spring.snappy}
          className="inline-flex items-center gap-2 text-sm text-emerald-400"
          aria-live="polite"
        >
          <span className="relative flex w-2 h-2 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
          </span>
          <span className="tabular-nums">
            {count.toLocaleString('ru-RU')} {count === 1 ? 'слушает' : 'слушают'} сейчас
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}
