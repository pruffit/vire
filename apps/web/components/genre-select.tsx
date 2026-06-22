'use client';

import { useMemo } from 'react';
import { Select, type SelectGroup } from '@/components/select';
import { GENRE_GROUPS, GENRE_LABELS } from '@/lib/genres';

/**
 * Селект жанра — тонкая обёртка над общим `Select`: группы из `GENRE_GROUPS`,
 * поиск, ведущая опция «Без жанра» для сброса. Значение кладётся в скрытый input
 * (`name`), чтобы форма сабмитилась через FormData.
 */
export function GenreSelect({
  name,
  defaultValue = '',
  disabled,
}: {
  name: string;
  defaultValue?: string;
  disabled?: boolean;
}) {
  const groups = useMemo<SelectGroup[]>(
    () => [
      { label: '', options: [{ value: '', label: 'Без жанра' }] },
      ...GENRE_GROUPS.map((g) => ({
        label: g.label,
        options: g.genres.map((gen) => ({ value: gen, label: GENRE_LABELS[gen] })),
      })),
    ],
    [],
  );

  return (
    <Select
      name={name}
      defaultValue={defaultValue}
      disabled={disabled}
      groups={groups}
      searchable
      placeholder="Жанр не выбран"
      aria-label="Жанр"
    />
  );
}
