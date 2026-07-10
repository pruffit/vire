import type { TrackGenre } from '@vire/db';
import type { GenreSuggestion } from './discogs-genre-map.js';

// Порог снижен 0.1 → 0.05 с переходом на покрытие Discogs-400 ~1:1: confidence
// нормализуется по ~370 корзинам вместо 65, доля топ-жанра упала примерно вдвое.
const AUTO_APPLY_THRESHOLD = 0.05;
const AUTO_APPLY_COUNT = 2;

/**
 * Отбирает кандидатов на автоприменение из предложений классификатора: топ-2
 * с confidence >= порога. Защита «применять, только если у трека ещё нет
 * жанров» — не здесь, а атомарно на уровне SQL (`setTrackGenresIfEmpty`):
 * так исключён TOCTOU-зазор между чтением текущих жанров и записью, в
 * который раньше мог провалиться ручной выбор артиста. Suggestions
 * сохраняются в БД в любом случае — это решение только про АВТО-простановку
 * в track_genres.
 */
export function decideAutoApplyGenres(
  suggestions: readonly GenreSuggestion[],
): TrackGenre[] {
  return suggestions
    .filter((s) => s.confidence >= AUTO_APPLY_THRESHOLD)
    .slice(0, AUTO_APPLY_COUNT)
    .map((s) => s.genre);
}
