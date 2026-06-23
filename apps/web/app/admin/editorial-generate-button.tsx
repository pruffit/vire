'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Icon } from '@/components/icon';

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
      className="text-xs px-3 py-1.5 rounded-lg border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/5 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-wait"
    >
      {state === 'loading' && 'Генерирую…'}
      {state === 'done' && (
        <span className="inline-flex items-center gap-1.5"><Icon name="check" size={13} /> Готово</span>
      )}
      {state === 'error' && 'Ошибка'}
      {state === 'idle' && 'Обновить подборки'}
    </motion.button>
  );
}
