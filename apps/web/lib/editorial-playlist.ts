// Структурный тип, не импорт из @vire/db: часть поверхностей получает params через
// packages/core, где mood — string, а не узкий union.
export interface EditorialPlaylistParams {
  mood: string;
}

export type EditorialPlaylistKey =
  | 'trending'
  | 'relisten'
  | 'fresh'
  | 'mood'
  | 'personalMix'
  | 'personalMood';

export interface EditorialPlaylistMapping {
  key: EditorialPlaylistKey;
  mood?: string;
}

/** {kind, editorialParams} → ключ в `playlist.editorial.*`. USER и подборки без
 *  ожидаемых params (легаси до бэкфилла) — null, рендер берёт заголовок из БД. */
export function editorialPlaylistMapping(
  kind: string,
  editorialParams: EditorialPlaylistParams | null | undefined,
): EditorialPlaylistMapping | null {
  switch (kind) {
    case 'TRENDING':
      return { key: 'trending' };
    case 'RELISTEN':
      return { key: 'relisten' };
    case 'FRESH':
      return { key: 'fresh' };
    case 'MOOD':
      return editorialParams ? { key: 'mood', mood: editorialParams.mood } : null;
    case 'PERSONAL':
      return editorialParams ? { key: 'personalMood', mood: editorialParams.mood } : { key: 'personalMix' };
    default:
      return null;
  }
}

type Translator = (key: string, values?: Record<string, string | number>) => string;

export interface EditorialPlaylistFallback {
  title: string;
  description: string | null;
}

/** Локализованные title/description по kind+params: `t` — неймспейс `playlist`,
 *  `tMoods` — `moods`. Сигнатура общая для useTranslations и getTranslations. */
export function editorialPlaylistText(
  t: Translator,
  tMoods: Translator,
  kind: string,
  editorialParams: EditorialPlaylistParams | null | undefined,
  fallback: EditorialPlaylistFallback,
): EditorialPlaylistFallback {
  const mapping = editorialPlaylistMapping(kind, editorialParams);
  if (!mapping) return fallback;
  const values = mapping.mood ? { mood: tMoods(mapping.mood) } : undefined;
  return {
    title: t(`editorial.${mapping.key}.title`, values),
    description: t(`editorial.${mapping.key}.description`, values),
  };
}
