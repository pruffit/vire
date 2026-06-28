'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { toast } from '@/components/toast';
import { cn } from '@/lib/utils';

const DEFAULT_TITLE = 'Мой плейлист';

/**
 * Создаёт пустой плейлист и ведёт на его страницу (там сразу доступно
 * переименование). Иконочный вариант — для сайдбара, полный — для /library.
 */
export function CreatePlaylistButton({ variant = 'icon' }: { variant?: 'icon' | 'full' }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    if (isPending) return;
    startTransition(async () => {
      const res = await fetch('/api/v1/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: DEFAULT_TITLE }),
      }).catch(() => null);
      const data = res?.ok ? await res.json() : null;
      if (!data?.id) {
        toast.error('Не удалось создать плейлист');
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
        Создать плейлист
      </button>
    );
  }

  return (
    <button
      onClick={handleCreate}
      disabled={isPending}
      aria-label="Создать плейлист"
      title="Создать плейлист"
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md text-foreground/45 transition-colors',
        'hover:bg-foreground/5 hover:text-foreground disabled:opacity-50',
      )}
    >
      <Icon name="plus" size={16} />
    </button>
  );
}
