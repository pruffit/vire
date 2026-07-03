'use client';

import { useCallback, useRef, useState } from 'react';
import type { PlaylistTrackRow } from '@vire/db';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls } from '@/components/player/audio-engine';
import { toPlayerTracks } from './to-player-track';
import { fetchReleaseTracks, fetchPlaylistTracks, type LazyReleaseTrack } from './lazy-queue-fetchers';

export type { LazyReleaseTrack } from './lazy-queue-fetchers';

/** Единый вход воспроизведения для компонентов: очередь, toggle, состояние текущего трека. */
export function usePlay() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTrackId = usePlayerStore((s) => s.track?.id);

  return {
    playQueue: controls.playQueue,
    toggle: (trackId: string) => controls.toggle(trackId),
    isCurrent: (trackId: string) => currentTrackId === trackId,
    isPlaying,
  };
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
  // Общий in-flight-промис: параллельные вызовы load() ждут один fetch, а не получают ложный null.
  const inflightRef = useRef<Promise<LazyRow[] | null> | null>(null);
  const [items, setItems] = useState<LazyRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Депсы — примитивы meta, а не сам объект: вызывающие передают литерал,
  // и на объекте load() пересоздавался бы каждый рендер.
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
          })),
        );
      }
      return toPlayerTracks(rows as PlaylistTrackRow[]);
    }

    if (cacheRef.current) return toQueue(cacheRef.current);

    if (!inflightRef.current) {
      setLoading(true);
      inflightRef.current = (kind === 'release' ? fetchReleaseTracks(id) : fetchPlaylistTracks(id))
        .finally(() => {
          inflightRef.current = null;
          setLoading(false);
        });
    }

    const rows = await inflightRef.current;
    // Сбой не кэшируем — следующий load() перезапросит; кэшируем только успех (включая пустой []).
    if (rows === null) return null;
    cacheRef.current = rows;
    setItems(rows);
    return toQueue(rows);
  }, [kind, id, artistName, artistSlug, coverUrl, accentColor]);

  return { load, loading, items };
}
