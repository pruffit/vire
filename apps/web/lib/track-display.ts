import type { TrackCredit } from '@/lib/upload';

/**
 * Отображение трека: фиты (кредиты с ролью FEATURED) и версия («Radio Edit»,
 * «Slowed + Reverb») держатся отдельно от названия и приклеиваются на витрине —
 * чтобы артист не засорял title. Чистые функции, покрыты тестами.
 */

/** Имена приглашённых артистов (роль FEATURED), без пустых. */
export function featuredNames(credits: TrackCredit[]): string[] {
  return credits.filter((c) => c.role === 'FEATURED').map((c) => c.name.trim()).filter(Boolean);
}

/** Подпись «feat. A, B» из FEATURED-кредитов, либо '' если фитов нет. */
export function featLabel(credits: TrackCredit[]): string {
  const names = featuredNames(credits);
  return names.length ? `feat. ${names.join(', ')}` : '';
}

/**
 * Полное отображаемое имя трека: «Title (feat. A, B) — Version».
 * feat и версия добавляются только если заданы.
 */
export function displayTrackTitle(
  title: string,
  opts?: { version?: string | null; credits?: TrackCredit[] },
): string {
  const feat = opts?.credits ? featLabel(opts.credits) : '';
  const version = opts?.version?.trim();
  return `${title}${feat ? ` (${feat})` : ''}${version ? ` — ${version}` : ''}`;
}
