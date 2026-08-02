import type { IMetadataIndex, MetadataHint } from '@vire/core';

const TIMEOUT_MS = 4000;

interface DeezerTrack {
  title?: string;
  artist?: { name?: string };
  album?: { cover_medium?: string };
  duration?: number;
}

/** Deezer Search API — бесплатно, без ключа, только подсказки при наборе. */
export function createDeezerMetadataIndex(): IMetadataIndex {
  return {
    async suggest(query, limit) {
      const url = `https://api.deezer.com/search?limit=${limit}&q=${encodeURIComponent(query)}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) return [];
        const data = (await res.json()) as { data?: DeezerTrack[] };
        return (data.data ?? [])
          .filter((r): r is DeezerTrack & { title: string; artist: { name: string } } => Boolean(r.title && r.artist?.name))
          .map((r): MetadataHint => ({
            title: r.title,
            artistName: r.artist.name,
            coverUrl: r.album?.cover_medium ?? null,
            durationSec: typeof r.duration === 'number' ? r.duration : null,
          }));
      } catch {
        return [];
      }
    },
  };
}
