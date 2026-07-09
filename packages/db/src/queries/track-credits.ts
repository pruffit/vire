import { featuredNames, type TrackCredit } from '@vire/core';

/** jsonb `credits` приходит из Drizzle как unknown — приводим и считаем готовое
 *  поле `feat` одним хелпером для всех DTO дискавери/поиска/плейлистов/волны. */
export function featFromCredits(credits: unknown): string[] {
  return featuredNames(Array.isArray(credits) ? (credits as TrackCredit[]) : []);
}
