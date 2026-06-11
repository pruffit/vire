'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';

export function EditorialGenerateButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function generate() {
    if (state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch('/api/v1/admin/editorial', { method: 'POST' });
      setState(res.ok ? 'done' : 'error');
      if (res.ok) setTimeout(() => setState('idle'), 3000);
    } catch {
      setState('error');
    }
  }

  return (
    <motion.button
      type="button"
      onClick={generate}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      disabled={state === 'loading'}
      className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-wait"
    >
      {state === 'loading' && 'Генерирую…'}
      {state === 'done' && '✓ Готово'}
      {state === 'error' && 'Ошибка'}
      {state === 'idle' && 'Обновить подборки'}
    </motion.button>
  );
}
