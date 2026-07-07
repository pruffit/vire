'use client';

import { useTrackAnalysis } from '@/lib/use-track-analysis';
import type { Genre } from '@/lib/genres';

export interface GenreSuggestion {
  genre: Genre;
  confidence: number;
}

export interface GenreAnalysisResult {
  suggestions: GenreSuggestion[];
  // Жанры, реально проставленные треку (воркер автопроставляет топ-2, если их не
  // было) — UI синхронизирует ими выбор, чтобы результат «Определить жанр» был виден.
  appliedGenres: Genre[];
}

interface Snapshot extends GenreAnalysisResult {
  updatedAt: string | null;
}

const ERROR_MESSAGES = {
  start: 'Не удалось запустить анализ жанра',
  timeout: 'Анализ жанра занял слишком много времени — попробуй позже',
  success: 'Жанр определён',
};

/**
 * Запуск анализа жанра по требованию (кнопка в дашборде/админке) + поллинг до
 * результата. Общий для GenrePicker (артист) и TrackEditForm (админка) —
 * эндпоинты у них разные базовые пути, отличие только в этом пропе.
 * Тонкая обёртка над обобщённым `useTrackAnalysis` (см. там про поллинг/гонки).
 * onResult получает и suggestions, и appliedGenres — вызывающий сам решает, как
 * свести их с текущим выбором.
 */
export function useGenreAnalysis(
  endpoints: { analyze: string; suggestions: string },
  onResult: (result: GenreAnalysisResult) => void,
) {
  return useTrackAnalysis<Snapshot>(
    { analyze: endpoints.analyze, snapshot: endpoints.suggestions },
    onResult,
    ERROR_MESSAGES,
  );
}
