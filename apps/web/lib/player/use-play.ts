'use client';

import { useCallback, useRef, useState } from 'react';
import type { PlaylistTrackRow } from '@vire/db';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls } from '@/components/player/audio-engine';
import { toPlayerTracks } from './to-player-track';

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

export interface LazyReleaseTrack {
  id: string;
  title: string;
  trackNumber: number;
  durationSec: number | null;
  status: 'PROCESSING' | 'READY' | 'BLOCKED';
  isExplicit?: boolean;
}

interface LazyQueueResult<T> {
  /** Фетчит (единожды, дальше из кэша) и возвращает готовую к playQueue очередь READY-треков. */
  load: () => Promise<PlayerTrack[] | null>;
  loading: boolean;
  /** Сырые строки для рендера трек-листа (все статусы) — тот же фетч, что и load(). */
  items: T[] | null;
}

async function fetchReleaseTracks(releaseId: string): Promise<LazyReleaseTrack[]> {
  const res = await fetch(`/api/v1/releases/${releaseId}`).catch(() => null);
  if (!res?.ok) return [];
  const data = (await res.json()) as { tracks?: LazyReleaseTrack[] };
  return data.tracks ?? [];
}

async function fetchPlaylistTracks(playlistId: string): Promise<PlaylistTrackRow[]> {
  const res = await fetch(`/api/v1/playlists/${playlistId}`).catch(() => null);
  if (!res?.ok) return [];
  const data = (await res.json()) as { playlist?: { tracks?: PlaylistTrackRow[] } };
  return data.playlist?.tracks ?? [];
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
  const fetchingRef = useRef(false);
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
    if (fetchingRef.current) return null;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const rows: LazyRow[] = kind === 'release' ? await fetchReleaseTracks(id) : await fetchPlaylistTracks(id);
      cacheRef.current = rows;
      setItems(rows);
      return toQueue(rows);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [kind, id, artistName, artistSlug, coverUrl, accentColor]);

  return { load, loading, items };
}
