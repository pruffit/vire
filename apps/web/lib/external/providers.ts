import type { PageMeta } from '@vire/core';
import { parseProviderTrackUrl } from '@vire/core';

const TIMEOUT_MS = 5000;

interface ItunesLookupTrack {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
}

interface DeezerTrackResponse {
  title?: string;
  artist?: { name?: string };
  album?: { cover_medium?: string };
  duration?: number;
  error?: unknown;
}

/**
 * Официальные API-эндпоинты Spotify/Apple Music/Deezer — их страницы боту не отдаются
 * (гео-редирект на логин, SPA-шелуха, /soon). Пользовательский URL идёт только по
 * извлечённому id или в query, SSRF не применим (см. lib/external/oembed.ts).
 */
export async function fetchProviderMeta(url: string): Promise<PageMeta | null> {
  const parsed = parseProviderTrackUrl(url);
  if (!parsed) return null;

  switch (parsed.provider) {
    case 'spotify':
      return fetchSpotify(url);
    case 'apple-music':
      return fetchAppleMusic(parsed.id);
    case 'deezer':
      return fetchDeezer(parsed.id);
  }
}

// oEmbed не отдаёт исполнителя — восстанавливается на шаг выше через метаиндекс (lib/external/index.ts).
async function fetchSpotify(url: string): Promise<PageMeta | null> {
  const data = await fetchJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
  if (!data || typeof data.title !== 'string' || !data.title) return null;
  return {
    title: data.title,
    artistName: null,
    coverUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null,
    durationSec: null,
  };
}

async function fetchAppleMusic(id: string): Promise<PageMeta | null> {
  const data = await fetchJson(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}`);
  const track = (data?.results as ItunesLookupTrack[] | undefined)?.[0];
  if (!track?.trackName || !track.artistName) return null;
  return {
    title: track.trackName,
    artistName: track.artistName,
    coverUrl: track.artworkUrl100 ? track.artworkUrl100.replace('100x100', '600x600') : null,
    durationSec: typeof track.trackTimeMillis === 'number' ? Math.round(track.trackTimeMillis / 1000) : null,
  };
}

async function fetchDeezer(id: string): Promise<PageMeta | null> {
  const data = (await fetchJson(`https://api.deezer.com/track/${encodeURIComponent(id)}`)) as DeezerTrackResponse | null;
  if (!data || data.error || typeof data.title !== 'string' || !data.title || !data.artist?.name) return null;
  return {
    title: data.title,
    artistName: data.artist.name,
    coverUrl: data.album?.cover_medium ?? null,
    durationSec: typeof data.duration === 'number' ? data.duration : null,
  };
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
