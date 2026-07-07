import type { TrackGenre } from '@vire/db';
import type { GenreSuggestion } from './discogs-genre-map.js';

// Порог снижен 0.1 → 0.05 с переходом на покрытие Discogs-400 ~1:1: confidence
// нормализуется по ~370 корзинам вместо 65, доля топ-жанра упала примерно вдвое.
const AUTO_APPLY_THRESHOLD = 0.05;
const AUTO_APPLY_COUNT = 2;

/**
 * Решает, какие жанры автоприменить к треку по итогам классификации.
 * Артист ничего не проставлял (existingGenres пуст) → берём топ-2 предложения
 * с confidence >= порога. Если у трека уже есть жанры — ничего не трогаем,
 * артист расставил их осознанно. Suggestions сохраняются в БД в любом случае —
 * это решение только про АВТО-простановку в track_genres.
 */
export function decideAutoApplyGenres(
  existingGenres: readonly TrackGenre[],
  suggestions: readonly GenreSuggestion[],
): TrackGenre[] {
  if (existingGenres.length > 0) return [];
  return suggestions
    .filter((s) => s.confidence >= AUTO_APPLY_THRESHOLD)
    .slice(0, AUTO_APPLY_COUNT)
    .map((s) => s.genre);
}
