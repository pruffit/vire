'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icon';

interface Props {
  releaseId: string;
  releaseDate: string | null;
}

export function PublishButton({ releaseId, releaseDate }: Props) {
  const router = useRouter();
  const format = useFormatter();
  const t = useTranslations('dashboard.publishButton');
  // Оптимистично: считаем публикацию успешной сразу, откатываем при ошибке
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  const isFuture = releaseDate !== null && new Date(releaseDate) > new Date();
  const targetStatus = isFuture ? 'SCHEDULED' : 'PUBLISHED';

  const label = isFuture
    ? t('scheduleFor', { date: formatDate(releaseDate!, format) })
    : t('publish');

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
            (isFuture ? t('scheduleFailed') : t('publishFailed')),
        );
      }
    });
  }

  return (
    <div className="min-h-6 flex items-center">
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.span
            key="done"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.snappy}
            className="inline-flex items-center gap-1 text-xs text-emerald-400"
          >
            {isFuture ? t('scheduled') : t('published')} <Icon name="check" size={13} />
          </motion.span>
        ) : (
          <motion.button
            key="button"
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            onClick={publish}
            className="text-xs px-2.5 py-1 rounded bg-foreground/10 hover:bg-foreground/20 transition-colors pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
          >
            {label}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatDate(date: string, format: ReturnType<typeof useFormatter>): string {
  return format.dateTime(new Date(date), { day: 'numeric', month: 'short', year: 'numeric' });
}
