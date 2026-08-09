'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Select, type SelectGroup } from '@/components/select';
import { GENRE_GROUPS, genreLabel, genreGroupLabel } from '@/lib/genres';

export function GenreSelect({
  name,
  defaultValue = '',
  disabled,
}: {
  name: string;
  defaultValue?: string;
  disabled?: boolean;
}) {
  const t = useTranslations('common.form.genreSelect');
  const tGenres = useTranslations('genres');
  const groups = useMemo<SelectGroup[]>(
    () => [
      { label: '', options: [{ value: '', label: t('none') }] },
      ...GENRE_GROUPS.map((g) => ({
        label: genreGroupLabel(g, tGenres),
        options: g.genres.map((gen) => ({ value: gen, label: genreLabel(gen, tGenres) })),
      })),
    ],
    [t, tGenres],
  );

  return (
    <Select
      name={name}
      defaultValue={defaultValue}
      disabled={disabled}
      groups={groups}
      searchable
      placeholder={t('placeholder')}
      aria-label={t('ariaLabel')}
    />
  );
}
