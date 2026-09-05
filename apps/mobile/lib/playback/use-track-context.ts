import { useEffect, useState } from 'react';
import { trackContextResponseSchema, type TrackContextResponse } from '@vire/api-contracts';
import { apiRequest } from '../api-client';

/** Прод отвечает не всегда с первого раза; молча остаться без контекста — потерять и цвет экрана. */
const RETRY_DELAY_MS = 1500;

/**
 * Артист трека, похожие и акцент его темы — одним запросом.
 *
 * `QueueTrack` несёт только имя артиста: ни id, ни slug, ни цвета. Класть их в очередь
 * плохо — она собирается в десятке мест, — а похожих это всё равно не даёт.
 */
export function useTrackContext(trackId: string | null | undefined): TrackContextResponse | null {
  const [context, setContext] = useState<TrackContextResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setContext(null);
    if (!trackId) return;

    const load = (attempt: number) => {
      apiRequest(`/api/v1/tracks/${encodeURIComponent(trackId)}/context`, {
        schema: trackContextResponseSchema,
      }).then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setContext(r.data);
          return;
        }
        if (attempt === 0) retry = setTimeout(() => load(1), RETRY_DELAY_MS);
      });
    };
    load(0);

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [trackId]);

  return context;
}
