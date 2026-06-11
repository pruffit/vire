'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';

export function BackfillAnalysisButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [queued, setQueued] = useState(0);

  async function run() {
    if (state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch('/api/v1/admin/backfill-analysis', { method: 'POST' });
      if (res.ok) {
        const data = await res.json() as { queued: number };
        setQueued(data.queued);
        setState('done');
        setTimeout(() => setState('idle'), 4000);
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  return (
    <motion.button
      type="button"
      onClick={run}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      disabled={state === 'loading'}
      className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-wait"
    >
      {state === 'loading' && 'Ставлю в очередь…'}
      {state === 'done' && (queued > 0 ? `✓ ${queued} треков в очереди` : '✓ Все треки проанализированы')}
      {state === 'error' && 'Ошибка'}
      {state === 'idle' && 'Заполнить BPM / Key'}
    </motion.button>
  );
}
