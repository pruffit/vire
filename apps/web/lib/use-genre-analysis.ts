'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/components/toast';
import type { Genre } from '@/lib/genres';

export interface GenreSuggestion {
  genre: Genre;
  confidence: number;
}

interface Snapshot {
  suggestions: GenreSuggestion[];
  updatedAt: string | null;
}

export type GenreAnalysisStatus = 'idle' | 'running' | 'done' | 'error';

const POLL_INTERVAL_MS = 4_000;
const TIMEOUT_MS = 2 * 60 * 1_000;

/**
 * Запуск анализа жанра по требованию (кнопка в дашборде/админке) + поллинг до
 * результата. Общий для GenrePicker (артист) и TrackEditForm (админка) —
 * эндпоинты у них разные базовые пути, отличие только в этом пропе.
 *
 * Готовность определяем по смене `updatedAt` (не по появлению suggestions):
 * при повторном анализе трек может получить те же топ-5 жанров, что и раньше
 * (модель детерминирована на том же аудио) — сравнение по значению суждений
 * ложно решило бы, что анализ не завершился.
 */
export function useGenreAnalysis(
  endpoints: { analyze: string; suggestions: string },
  onResult: (suggestions: GenreSuggestion[]) => void,
) {
  const [status, setStatus] = useState<GenreAnalysisStatus>('idle');
  const stopRef = useRef<() => void>(() => {});
  const runningRef = useRef(false);
  const disposedRef = useRef(false);

  useEffect(() => () => {
    disposedRef.current = true;
    stopRef.current();
  }, []);

  const start = useCallback(async () => {
    // Guard от повторного входа: не полагаемся только на disabled кнопки — двойной
    // клик/повторный вызов до перерендера мог бы запустить два параллельных поллинга.
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('running');

    const baseline = await fetchSnapshot(endpoints.suggestions);
    if (disposedRef.current) return;

    const res = await fetch(endpoints.analyze, { method: 'POST' }).catch(() => null);
    if (disposedRef.current) return;
    if (!res?.ok) {
      runningRef.current = false;
      setStatus('error');
      toast.error('Не удалось запустить анализ жанра');
      return;
    }

    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      const snapshot = await fetchSnapshot(endpoints.suggestions);
      if (stopped) return;
      if (!snapshot || snapshot.updatedAt === (baseline?.updatedAt ?? null)) return;
      stop();
      setStatus('done');
      onResult(snapshot.suggestions);
    }, POLL_INTERVAL_MS);

    const timeout = setTimeout(() => {
      if (stopped) return;
      stop();
      setStatus('error');
      toast.error('Анализ жанра занял слишком много времени — попробуй позже');
    }, TIMEOUT_MS);

    function stop() {
      stopped = true;
      runningRef.current = false;
      clearInterval(interval);
      clearTimeout(timeout);
    }
    stopRef.current = stop;

    // Гонка анмаунта: компонент мог размонтироваться во время await'ов выше, до того
    // как stopRef успел указать на этот stop() — интервал/таймаут иначе осиротеют
    // на весь TIMEOUT_MS (2 мин), продолжая дёргать fetch с размонтированного хука.
    if (disposedRef.current) stop();
  }, [endpoints, onResult]);

  return { status, start };
}

async function fetchSnapshot(url: string): Promise<Snapshot | null> {
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as Snapshot | null;
}
