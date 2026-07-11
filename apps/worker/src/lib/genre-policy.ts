import type { TrackGenre } from '@vire/db';
import type { GenreSuggestion } from './discogs-genre-map.js';

// Порог снижен 0.1 → 0.05 с переходом на покрытие Discogs-400 ~1:1: confidence
// нормализуется по ~370 корзинам вместо 65, доля топ-жанра упала примерно вдвое.
const AUTO_APPLY_THRESHOLD = 0.05;
const AUTO_APPLY_COUNT = 2;

/**
 * Топ-2 предложения с confidence >= порога. Защита «только если жанров ещё нет»
 * не здесь, а атомарно в SQL (`setTrackGenresIfEmpty`), чтобы не ловить TOCTOU
 * между чтением текущих жанров и записью. Suggestions сохраняются в БД всегда,
 * это решение только про авто-простановку в track_genres.
 */
export function decideAutoApplyGenres(
  suggestions: readonly GenreSuggestion[],
): TrackGenre[] {
  return suggestions
    .filter((s) => s.confidence >= AUTO_APPLY_THRESHOLD)
    .slice(0, AUTO_APPLY_COUNT)
    .map((s) => s.genre);
}
