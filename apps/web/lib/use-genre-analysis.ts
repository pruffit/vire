'use client';

import { useTrackAnalysis } from '@/lib/use-track-analysis';
import type { Genre } from '@/lib/genres';

export interface GenreSuggestion {
  genre: Genre;
  confidence: number;
}

export interface GenreAnalysisResult {
  suggestions: GenreSuggestion[];
  // Жанры, реально проставленные воркером (автотоп-2) — UI синхронизирует ими выбор.
  appliedGenres: Genre[];
}

interface Snapshot extends GenreAnalysisResult {
  updatedAt: string | null;
}

const ERROR_MESSAGES = {
  pending: 'Определяю жанр…',
  start: 'Не удалось запустить анализ жанра',
  timeout: 'Анализ жанра занял слишком много времени — попробуй позже',
  success: 'Жанр определён',
};

/** Анализ жанра по требованию + поллинг: обёртка над `useTrackAnalysis`, общая для GenrePicker и
 *  админского TrackEditForm. Сообщения необязательны — админка (вне next-intl) получает дефолт,
 *  дашборд передаёт переведённые через next-intl. */
export function useGenreAnalysis(
  endpoints: { analyze: string; suggestions: string },
  onResult: (result: GenreAnalysisResult) => void,
  messages: typeof ERROR_MESSAGES = ERROR_MESSAGES,
) {
  return useTrackAnalysis<Snapshot>(
    { analyze: endpoints.analyze, snapshot: endpoints.suggestions },
    onResult,
    messages,
  );
}
