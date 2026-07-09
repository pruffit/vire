import type { TrackCredit } from '@/lib/upload';
import { featuredNames } from '@vire/core';

/**
 * Отображение трека: фиты (кредиты с ролью FEATURED) и версия («Radio Edit»,
 * «Slowed + Reverb») держатся отдельно от названия. `displayTrackTitle` — ТОЛЬКО
 * для metadata/SEO/JSON-LD (единая строка). Весь остальной UI — через
 * `TrackTitleText` (`components/track-title.tsx`), не через эту склейку.
 */

// Единый источник правды — @vire/core (используется и БД-запросами для DTO).
export { featuredNames } from '@vire/core';

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
