'use client';

import { useCallback, useRef, useState } from 'react';
import type { PlaylistTrackRow } from '@vire/db';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls } from '@/components/player/audio-engine';
import { featuredNames } from '@/lib/track-display';
import { toPlayerTracks } from './to-player-track';
import { fetchReleaseTracks, fetchPlaylistTracks, type LazyReleaseTrack } from './lazy-queue-fetchers';

export type { LazyReleaseTrack } from './lazy-queue-fetchers';

/** Единый вход воспроизведения: только действия, без подписки на стор. */
export function usePlay() {
  return {
    playQueue: controls.playQueue,
    toggle: (trackId: string) => controls.toggle(trackId),
  };
}

/** Состояние конкретного трека. Сравнение внутри селектора — ререндерятся только
 *  две затронутые строки, а не каждый трек-лист на любую смену track.id/play-pause. */
export function useTrackPlayState(trackId: string): { isActive: boolean; isPlaying: boolean } {
  const isActive = usePlayerStore((s) => s.track?.id === trackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying && s.track?.id === trackId);
  return { isActive, isPlaying };
}

export interface ReleaseQueueMeta {
  artistName: string;
  artistSlug: string;
  coverUrl: string | null;
  accentColor?: string | null;
}

interface LazyQueueResult<T> {
  /** Фетчит (успех кэшируется, сбой — нет) и возвращает очередь READY-треков; null — сбой загрузки. */
  load: () => Promise<PlayerTrack[] | null>;
  loading: boolean;
  /** Сырые строки для рендера трек-листа (все статусы) — тот же фетч, что и load(). */
  items: T[] | null;
}

type LazyRow = LazyReleaseTrack | PlaylistTrackRow;

/** Ленивая загрузка треков релиза/плейлиста для quick-look и featured — один общий фетч+маппинг. */
export function useLazyQueue(kind: 'release', id: string, meta: ReleaseQueueMeta): LazyQueueResult<LazyReleaseTrack>;
export function useLazyQueue(kind: 'playlist', id: string): LazyQueueResult<PlaylistTrackRow>;
export function useLazyQueue(
  kind: 'release' | 'playlist',
  id: string,
  meta?: ReleaseQueueMeta,
): LazyQueueResult<LazyRow> {
  const cacheRef = useRef<LazyRow[] | null>(null);
  // Общий in-flight-промис: параллельные load() ждут один fetch, а не получают ложный null.
  const inflightRef = useRef<Promise<LazyRow[] | null> | null>(null);
  // React переиспользует инстанс хука при смене id — кэш/inflight могут держать старый ключ.
  const keyRef = useRef(`${kind}:${id}`);
  const [items, setItems] = useState<LazyRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Депсы — примитивы meta, не сам объект: вызывающие передают литерал, load() пересоздавался бы каждый рендер.
  const { artistName, artistSlug, coverUrl, accentColor } = meta ?? {};

  const load = useCallback(async (): Promise<PlayerTrack[] | null> => {
    function toQueue(rows: LazyRow[]): PlayerTrack[] {
      if (kind === 'release') {
        const ready = (rows as LazyReleaseTrack[]).filter((t) => t.status === 'READY');
        return toPlayerTracks(
          ready.map((t) => ({
            id: t.id,
            title: t.title,
            artistName: artistName ?? '',
            artistSlug,
            coverUrl,
            releaseId: id,
            accentColor,
            isExplicit: t.isExplicit,
            version: t.version,
            feat: featuredNames(t.credits),
          })),
        );
      }
      return toPlayerTracks(rows as PlaylistTrackRow[]);
    }

    // Сброс синхронно (не в useEffect) — иначе первый клик после смены id отдаёт старую очередь.
    const key = `${kind}:${id}`;
    if (keyRef.current !== key) {
      keyRef.current = key;
      cacheRef.current = null;
      inflightRef.current = null;
      setItems(null);
    }

    if (cacheRef.current) return toQueue(cacheRef.current);

    if (!inflightRef.current) {
      setLoading(true);
      const promise: Promise<LazyRow[] | null> = (kind === 'release' ? fetchReleaseTracks(id) : fetchPlaylistTracks(id))
        .finally(() => {
          // По ссылке, не занулением — .finally брошенного запроса не должен затереть inflight нового ключа.
          if (inflightRef.current === promise) inflightRef.current = null;
          if (keyRef.current === key) setLoading(false);
        });
      inflightRef.current = promise;
    }

    const rows = await inflightRef.current;
    // Ключ сменился, пока fetch летел — результат чужого id не кэшируем и не отдаём.
    if (keyRef.current !== key) return null;
    // Сбой не кэшируем — следующий load() перезапросит; кэшируем только успех (включая пустой []).
    if (rows === null) return null;
    cacheRef.current = rows;
    setItems(rows);
    return toQueue(rows);
  }, [kind, id, artistName, artistSlug, coverUrl, accentColor]);

  return { load, loading, items };
}
