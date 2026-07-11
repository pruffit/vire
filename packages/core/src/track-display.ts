import type { TrackCredit } from './types/release';

/** Имена приглашённых артистов (роль FEATURED), без пустых. */
export function featuredNames(credits: TrackCredit[]): string[] {
  return credits.filter((c) => c.role === 'FEATURED').map((c) => c.name.trim()).filter(Boolean);
}
