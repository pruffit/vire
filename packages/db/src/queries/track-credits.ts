import { featuredNames, type TrackCredit } from '@vire/core';

/** jsonb `credits` из Drizzle приходит как unknown: приводим и считаем `feat`
 *  одним хелпером для всех DTO (дискавери/поиск/плейлисты/волна). */
export function featFromCredits(credits: unknown): string[] {
  return featuredNames(Array.isArray(credits) ? (credits as TrackCredit[]) : []);
}
