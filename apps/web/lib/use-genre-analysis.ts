'use client';

import { useCallback } from 'react';
import { useTrackAnalysis } from '@/lib/use-track-analysis';
import type { Genre } from '@/lib/genres';

export interface GenreSuggestion {
  genre: Genre;
  confidence: number;
}

interface Snapshot {
  suggestions: GenreSuggestion[];
  updatedAt: string | null;
}

const ERROR_MESSAGES = {
  start: 'Не удалось запустить анализ жанра',
  timeout: 'Анализ жанра занял слишком много времени — попробуй позже',
};

/**
 * Запуск анализа жанра по требованию (кнопка в дашборде/админке) + поллинг до
 * результата. Общий для GenrePicker (артист) и TrackEditForm (админка) —
 * эндпоинты у них разные базовые пути, отличие только в этом пропе.
 * Тонкая обёртка над обобщённым `useTrackAnalysis` (см. там про поллинг/гонки).
 */
export function useGenreAnalysis(
  endpoints: { analyze: string; suggestions: string },
  onResult: (suggestions: GenreSuggestion[]) => void,
) {
  const handleResult = useCallback((snapshot: Snapshot) => onResult(snapshot.suggestions), [onResult]);
  return useTrackAnalysis<Snapshot>(
    { analyze: endpoints.analyze, snapshot: endpoints.suggestions },
    handleResult,
    ERROR_MESSAGES,
  );
}
