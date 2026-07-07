'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/components/toast';

export type TrackAnalysisStatus = 'idle' | 'running' | 'done' | 'error';

const POLL_INTERVAL_MS = 2_000;
const TIMEOUT_MS = 2 * 60 * 1_000;

interface Endpoints {
  analyze: string;
  snapshot: string;
}

interface ErrorMessages {
  start: string;
  timeout: string;
  success?: string;
}

/**
 * Обобщённый движок «анализ по требованию» (кнопка → BullMQ джоба → поллинг снимка
 * до готовности): выделен из `use-genre-analysis` — жанр и BPM/тональность отличаются
 * только эндпоинтами, формой снимка и текстами ошибок, сама механика поллинга общая.
 *
 * Готовность определяем по смене `updatedAt` в снимке (не по значению): при повторном
 * анализе результат может совпасть с предыдущим (детерминированная модель) —
 * сравнение по значению ложно решило бы, что анализ не завершился.
 */
export function useTrackAnalysis<TSnapshot extends { updatedAt: string | null }>(
  endpoints: Endpoints,
  onResult: (snapshot: TSnapshot) => void,
  errorMessages: ErrorMessages,
) {
  const [status, setStatus] = useState<TrackAnalysisStatus>('idle');
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

    const baseline = await fetchSnapshot<TSnapshot>(endpoints.snapshot);
    if (disposedRef.current) return;

    const res = await fetch(endpoints.analyze, { method: 'POST' }).catch(() => null);
    if (disposedRef.current) return;
    if (!res?.ok) {
      runningRef.current = false;
      setStatus('error');
      toast.error(errorMessages.start);
      return;
    }

    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      const snapshot = await fetchSnapshot<TSnapshot>(endpoints.snapshot);
      if (stopped) return;
      if (!snapshot || snapshot.updatedAt === (baseline?.updatedAt ?? null)) return;
      stop();
      setStatus('done');
      onResult(snapshot);
      if (errorMessages.success) toast(errorMessages.success);
    }, POLL_INTERVAL_MS);

    const timeout = setTimeout(() => {
      if (stopped) return;
      stop();
      setStatus('error');
      toast.error(errorMessages.timeout);
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
  }, [endpoints, onResult, errorMessages]);

  return { status, start };
}

async function fetchSnapshot<T>(url: string): Promise<T | null> {
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}
