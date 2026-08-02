import type { IMetadataIndex, MetadataHint } from '@vire/core';

const TIMEOUT_MS = 4000;

interface ItunesTrack {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
}

/** iTunes Search API — бесплатно, без ключа, только подсказки при наборе (не тратит квоту YouTube). */
export function createItunesMetadataIndex(): IMetadataIndex {
  return {
    async suggest(query, limit) {
      const url = `https://itunes.apple.com/search?media=music&entity=song&limit=${limit}&term=${encodeURIComponent(query)}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) return [];
        const data = (await res.json()) as { results?: ItunesTrack[] };
        return (data.results ?? [])
          .filter((r): r is ItunesTrack & { trackName: string; artistName: string } => Boolean(r.trackName && r.artistName))
          .map((r): MetadataHint => ({
            title: r.trackName,
            artistName: r.artistName,
            coverUrl: r.artworkUrl100 ? r.artworkUrl100.replace('100x100', '600x600') : null,
            durationSec: typeof r.trackTimeMillis === 'number' ? Math.round(r.trackTimeMillis / 1000) : null,
          }));
      } catch {
        return [];
      }
    },
  };
}
