'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/toast';

export interface SwitcherArtist {
  id: string;
  name: string;
  slug: string;
}

/**
 * Переключатель активного артиста — для аккаунтов, управляющих несколькими
 * карточками. Меняет cookie через эндпоинт и перезагружает данные дашборда.
 */
export function ArtistSwitcher({
  artists,
  activeId,
}: {
  artists: SwitcherArtist[];
  activeId: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(activeId);
  const [isPending, startTransition] = useTransition();

  function select(id: string) {
    if (id === value) return;
    const prev = value;
    setValue(id);
    startTransition(async () => {
      const res = await fetch('/api/v1/dashboard/active-artist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId: id }),
      }).catch(() => null);
      if (res?.ok) {
        router.refresh();
      } else {
        setValue(prev);
        toast.error('Не удалось переключить артиста');
      }
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-white/40 shrink-0">Артист</span>
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => select(e.target.value)}
        className="min-w-0 max-w-[200px] truncate rounded-md bg-white/10 border border-white/10 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50"
      >
        {artists.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} (@{a.slug})
          </option>
        ))}
      </select>
    </label>
  );
}
