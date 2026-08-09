'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/**
 * Создаёт пустой плейлист и ведёт на его страницу (там сразу доступно
 * переименование). Иконочный вариант — для сайдбара, полный — для /library.
 */
export function CreatePlaylistButton({ variant = 'icon' }: { variant?: 'icon' | 'full' }) {
  const t = useTranslations('nav.createPlaylist');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    if (isPending) return;
    startTransition(async () => {
      const res = await fetch('/api/v1/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t('defaultTitle') }),
      }).catch(() => null);
      const data = res?.ok ? await res.json() : null;
      if (!data?.id) {
        toast.error(t('failed'));
        return;
      }
      router.push(`/playlists/${data.id}`);
    });
  }

  if (variant === 'full') {
    return (
      <button
        onClick={handleCreate}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
      >
        <Icon name="plus" size={14} />
        {t('label')}
      </button>
    );
  }

  return (
    <button
      onClick={handleCreate}
      disabled={isPending}
      aria-label={t('label')}
      title={t('label')}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md text-foreground/45 transition-colors',
        'hover:bg-foreground/5 hover:text-foreground disabled:opacity-50',
      )}
    >
      <Icon name="plus" size={16} />
    </button>
  );
}
