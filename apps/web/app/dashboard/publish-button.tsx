'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { toast } from '@/components/toast';

interface Props {
  releaseId: string;
  releaseDate: string | null;
}

export function PublishButton({ releaseId, releaseDate }: Props) {
  const router = useRouter();
  // Оптимистично: считаем публикацию успешной сразу, откатываем при ошибке
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  const isFuture = releaseDate !== null && new Date(releaseDate) > new Date();
  const targetStatus = isFuture ? 'SCHEDULED' : 'PUBLISHED';

  const label = isFuture
    ? `Запланировать на ${formatDate(releaseDate!)}`
    : 'Опубликовать';

  function publish() {
    setDone(true);
    startTransition(async () => {
      const res = await fetch(`/api/v1/dashboard/releases/${releaseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      }).catch(() => null);

      if (res?.ok) {
        router.refresh(); // подтянуть серверный статус-бейдж карточки
      } else {
        setDone(false);
        const json = res ? await res.json().catch(() => ({})) : {};
        toast.error(
          (json as { error?: string }).error ??
            (isFuture ? 'Не удалось запланировать релиз' : 'Не удалось опубликовать релиз'),
        );
      }
    });
  }

  return (
    <div className="h-6 flex items-center">
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.span
            key="done"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.snappy}
            className="text-xs text-emerald-400"
          >
            {isFuture ? 'Запланирован ✓' : 'Опубликован ✓'}
          </motion.span>
        ) : (
          <motion.button
            key="button"
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            onClick={publish}
            className="text-xs px-2.5 py-1 rounded bg-foreground/10 hover:bg-foreground/20 transition-colors"
          >
            {label}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
