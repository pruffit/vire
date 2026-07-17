import type { TrackCredit } from './types/release';

export function featuredNames(credits: TrackCredit[]): string[] {
  return credits.filter((c) => c.role === 'FEATURED').map((c) => c.name.trim()).filter(Boolean);
}
