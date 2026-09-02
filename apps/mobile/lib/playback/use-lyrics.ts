import { useEffect, useMemo, useState } from 'react';
import { trackLyricsResponseSchema, type TrackLyricsResponse } from '@vire/api-contracts';
import { apiRequest } from '../api-client';

export type LyricLine = NonNullable<TrackLyricsResponse['lyrics']>[number];

export type Lyrics = {
  lines: LyricLine[] | null;
  loading: boolean;
  /** Есть таймкоды: строку можно вести за воспроизведением и по ней перематывать. */
  synced: boolean;
};

/** Сорвавшийся запрос неотличим от инструментала, поэтому одна повторная попытка. */
const RETRY_DELAY_MS = 1500;

/** Текст трека. Инструментал — нормальное состояние, а не пустая секция: `lines === null`. */
export function useLyrics(trackId: string | null | undefined): Lyrics {
  const [lines, setLines] = useState<LyricLine[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setLines(null);
    setLoading(Boolean(trackId));
    if (!trackId) return;

    const load = (attempt: number) => {
      apiRequest(`/api/v1/tracks/${encodeURIComponent(trackId)}/lyrics`, {
        schema: trackLyricsResponseSchema,
      }).then((r) => {
        if (cancelled) return;
        if (!r.ok && attempt === 0) {
          retry = setTimeout(() => load(1), RETRY_DELAY_MS);
          return;
        }
        const next = r.ok ? r.data.lyrics : null;
        setLines(next && next.length > 0 ? next : null);
        setLoading(false);
      });
    };
    load(0);

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [trackId]);

  const synced = useMemo(() => lines?.some((l) => l.t !== null) ?? false, [lines]);

  return { lines, loading, synced };
}

/** Индекс строки, звучащей сейчас. -1 — до первой строки или у текста без таймкодов. */
export function activeLineIndex(lines: LyricLine[] | null, positionSec: number): number {
  if (!lines) return -1;
  let index = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].t;
    if (t !== null && t <= positionSec) index = i;
  }
  return index;
}
