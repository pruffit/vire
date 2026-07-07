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
  pending?: string;
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
 *
 * Единый дедлайн + AbortController покрывают ВЕСЬ прогон (baseline-GET → POST →
 * поллинг). Раньше таймаут стоял только вокруг поллинга, а начальные запросы висели
 * без границы: зависший POST/GET (холодная компиляция роута, недоступный сервер)
 * крутил спиннер бесконечно без ошибки. Теперь любой стопор упирается в дедлайн и
 * честно завершается ошибкой.
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
    if (errorMessages.pending) toast(errorMessages.pending);

    const controller = new AbortController();
    // const-холдер вместо `let interval` — finish() ссылается на таймер до его
    // создания (forward-ref из дедлайна, который может сработать в фазе baseline).
    const timers: { poll?: ReturnType<typeof setInterval> } = {};
    let finished = false;

    // Идемпотентное завершение прогона: чистит интервал+дедлайн, снимает running,
    // отменяет висящие fetch'и. setState/onResult — только если компонент жив.
    const finish = (next: 'done' | 'error', snapshot?: TSnapshot, message?: string) => {
      if (finished) return;
      finished = true;
      runningRef.current = false;
      controller.abort();
      if (timers.poll) clearInterval(timers.poll);
      clearTimeout(deadline);
      if (disposedRef.current) return;
      setStatus(next);
      if (next === 'done' && snapshot) onResult(snapshot);
      if (message) (next === 'error' ? toast.error : toast)(message);
    };

    const deadline = setTimeout(() => finish('error', undefined, errorMessages.timeout), TIMEOUT_MS);
    stopRef.current = () => finish('error');

    const baseline = await fetchSnapshot<TSnapshot>(endpoints.snapshot, controller.signal);
    if (finished) return;
    if (disposedRef.current) return finish('error');

    const res = await fetch(endpoints.analyze, { method: 'POST', signal: controller.signal }).catch(() => null);
    if (finished) return;
    if (disposedRef.current) return finish('error');
    if (!res?.ok) return finish('error', undefined, errorMessages.start);

    const baselineUpdatedAt = baseline?.updatedAt ?? null;
    timers.poll = setInterval(async () => {
      const snapshot = await fetchSnapshot<TSnapshot>(endpoints.snapshot, controller.signal);
      if (finished) return;
      if (!snapshot || snapshot.updatedAt === baselineUpdatedAt) return;
      finish('done', snapshot, errorMessages.success);
    }, POLL_INTERVAL_MS);
  }, [endpoints, onResult, errorMessages]);

  return { status, start };
}

async function fetchSnapshot<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(url, { signal }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}
