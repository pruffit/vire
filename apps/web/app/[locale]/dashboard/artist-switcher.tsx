'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@/lib/toast';
import { Select } from '@/components/select';

export interface SwitcherArtist {
  id: string;
  name: string;
  slug: string;
}

/** Общая логика переключения активного артиста — переиспользуется десктоп-селектом и мобильным шитом. */
export function useArtistSwitcher(activeId: string) {
  const router = useRouter();
  const t = useTranslations('dashboard.artistSwitcher');
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
        toast.error(t('switchFailed'));
      }
    });
  }

  return { value, isPending, select };
}

export function ArtistSwitcher({
  artists,
  activeId,
}: {
  artists: SwitcherArtist[];
  activeId: string;
}) {
  const { value, isPending, select } = useArtistSwitcher(activeId);
  const t = useTranslations('dashboard.artistSwitcher');

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="shrink-0 text-foreground/40">{t('label')}</span>
      <Select
        size="sm"
        value={value}
        disabled={isPending}
        onValueChange={select}
        aria-label={t('activeAria')}
        className="min-w-0 flex-1"
        options={artists.map((a) => ({ value: a.id, label: `${a.name} (@${a.slug})` }))}
      />
    </div>
  );
}
