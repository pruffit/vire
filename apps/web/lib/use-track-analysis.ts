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
 * Движок «анализ по требованию» (кнопка → BullMQ джоба → поллинг снимка).
 * Готовность — по смене `updatedAt`, не по значению: детерминированная модель может
 * вернуть тот же результат. Дедлайн + AbortController покрывают весь прогон
 * (baseline-GET → POST → поллинг) — иначе зависший запрос крутит спиннер вечно.
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

  // disposedRef сбрасываем и в setup: StrictMode/Fast Refresh делает mount→unmount→remount,
  // и без сброса start() после baseline-GET молча не шлёт POST (спиннер навсегда).
  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      stopRef.current();
    };
  }, []);

  const start = useCallback(async () => {
    // Guard от повторного входа — двойной клик до перерендера запустил бы два поллинга.
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('running');
    if (errorMessages.pending) toast(errorMessages.pending);

    const controller = new AbortController();
    // const-холдер вместо `let` — finish() ссылается на таймер до его создания.
    const timers: { poll?: ReturnType<typeof setInterval> } = {};
    let finished = false;

    // Идемпотентное завершение; setState/onResult — только если компонент жив.
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
