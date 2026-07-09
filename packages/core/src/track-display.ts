import type { TrackCredit } from './types/release';

/**
 * Имена приглашённых артистов (роль FEATURED), без пустых. Общий пуль между
 * web-отображением (заголовок трека) и БД-запросами (готовое поле `feat` в
 * DTO дискавери/поиска/плейлистов/волны) — единственный источник правды.
 */
export function featuredNames(credits: TrackCredit[]): string[] {
  return credits.filter((c) => c.role === 'FEATURED').map((c) => c.name.trim()).filter(Boolean);
}
