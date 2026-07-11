import type { Mood } from './track-moods';

/** Ниже этого числа треков личная подборка не создаётся — короче выглядит как мусор. */
export const MIN_PERSONAL_PLAYLIST_TRACKS = 5;

/** Треков в подборке — карточка на витрине должна быть полной. */
export const PLAYLIST_LIST_LIMIT = 25;

/**
 * Добивает подборку до лимита треками из пула — подлинные совпадения идут
 * первыми, филлер — хвостом. Два яруса: сперва треки вне `avoid` (не занятые
 * другими карточками прогона), при исчерпании — переиспользование занятых
 * (полная карточка важнее строгого непересечения; дублей внутри одной подборки
 * не бывает). Короче лимита результат остаётся только когда весь пул (видимый
 * каталог) меньше лимита.
 */
export function fillToLimit(
  ids: string[],
  pool: string[],
  avoid: ReadonlySet<string> = new Set(),
  limit: number = PLAYLIST_LIST_LIMIT,
): string[] {
  const out = ids.slice(0, limit);
  const have = new Set(out);
  for (const id of pool) {
    if (out.length >= limit) break;
    if (!have.has(id) && !avoid.has(id)) {
      out.push(id);
      have.add(id);
    }
  }
  for (const id of pool) {
    if (out.length >= limit) break;
    if (!have.has(id)) {
      out.push(id);
      have.add(id);
    }
  }
  return out;
}

export function hasEnoughTracksForPersonalPlaylist(trackCount: number): boolean {
  return trackCount >= MIN_PERSONAL_PLAYLIST_TRACKS;
}

/**
 * Настроения для личных mood-подборок: следующие по значимости из профиля
 * вкуса, пропуская уже занятые общими MOOD-подборками текущего прогона —
 * иначе на главной дублируется одно и то же настроение общей и личной карточкой.
 */
export function pickPersonalMoods(
  tasteMoods: Mood[],
  excludedMoods: Mood[],
  count: number,
): Mood[] {
  if (count <= 0) return [];
  const excluded = new Set(excludedMoods);
  const picked: Mood[] = [];
  for (const mood of tasteMoods) {
    if (excluded.has(mood)) continue;
    picked.push(mood);
    if (picked.length >= count) break;
  }
  return picked;
}
