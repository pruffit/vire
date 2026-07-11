import type { TrackCredit } from '@/lib/upload';
import { featuredNames } from '@vire/core';

// `displayTrackTitle` — ТОЛЬКО для metadata/SEO/JSON-LD (единая строка);
// весь остальной UI — через `TrackTitleText`, не через эту склейку.

export { featuredNames } from '@vire/core';

/** Подпись «feat. A, B» из FEATURED-кредитов, либо '' если фитов нет. */
export function featLabel(credits: TrackCredit[]): string {
  const names = featuredNames(credits);
  return names.length ? `feat. ${names.join(', ')}` : '';
}

/** Полное отображаемое имя трека: «Title (feat. A, B) — Version»; feat/версия — только если заданы. */
export function displayTrackTitle(
  title: string,
  opts?: { version?: string | null; credits?: TrackCredit[] },
): string {
  const feat = opts?.credits ? featLabel(opts.credits) : '';
  const version = opts?.version?.trim();
  return `${title}${feat ? ` (${feat})` : ''}${version ? ` — ${version}` : ''}`;
}
