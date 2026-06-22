'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';

export function DeleteReleaseButton({
  releaseId,
  title,
}: {
  releaseId: string;
  title: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/dashboard/releases/${releaseId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Ошибка удаления');
        setLoading(false);
        setConfirming(false);
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('Ошибка сети');
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <div className="pt-2">
      <AnimatePresence mode="wait" initial={false}>
        {!confirming ? (
          <motion.button
            key="trigger"
            type="button"
            onClick={() => setConfirming(true)}
            whileTap={{ scale: 0.96, y: 1 }}
            transition={spring.snappy}
            className="text-sm text-red-400/60 hover:text-red-400 transition-colors"
          >
            Удалить релиз
          </motion.button>
        ) : (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={spring.smooth}
            className="flex flex-wrap items-center gap-3"
          >
            <span className="text-sm text-foreground/60">
              Удалить{' '}
              <span className="text-foreground/90 font-medium">«{title}»</span>
              {' '}и все треки?{' '}
              <span className="text-red-400/70">Необратимо.</span>
            </span>
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                whileTap={{ scale: 0.95, y: 1 }}
                transition={spring.snappy}
                className="text-sm px-3 py-1 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-40 transition-colors"
              >
                {loading ? 'Удаляем…' : 'Да, удалить'}
              </motion.button>
              <button
                type="button"
                onClick={() => { setConfirming(false); setError(null); }}
                disabled={loading}
                className="text-sm text-foreground/40 hover:text-foreground/70 transition-colors"
              >
                Отмена
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
