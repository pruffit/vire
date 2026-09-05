import type { MetadataHint } from '@vire/core';
import { sanitizeCoverUrl } from './cover-hosts';
import { getRedis } from '../redis';

const API_BASE = 'https://ws.audioscrobbler.com/2.0/';
const TIMEOUT_MS = 4000;
const CACHE_TTL_SEC = 6 * 60 * 60;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{2,64}$/;

interface LastfmTrack {
  name?: string;
  artist?: { name?: string } | string;
  image?: Array<{ '#text'?: string }>;
}

const cacheKey = (username: string) => `lastfm:top:${username.toLowerCase()}`;

export interface LastfmTaste {
  topTracks(username: string, limit: number): Promise<MetadataHint[]>;
}

/**
 * Last.fm `user.getTopTracks` — публичный API, ник вводится вручную (не OAuth, не скробблинг).
 * Без ключа / невалидного ника / сетевой ошибки → [] (деградация, как у YouTube-резолвера).
 */
export function createLastfmTaste(apiKey: string | undefined): LastfmTaste {
  return {
    async topTracks(username, limit) {
      if (!apiKey || !USERNAME_RE.test(username)) return [];

      const key = cacheKey(username);
      const cached = await readCache(key);
      if (cached) return cached.slice(0, limit);

      const hints = await fetchTopTracks(username, limit, apiKey);
      // Пустой ответ (опечатка в нике, лежащий API) не кэшируем — иначе он залипнет на 6 часов.
      if (hints.length > 0) await writeCache(key, hints);
      return hints;
    },
  };
}

async function fetchTopTracks(username: string, limit: number, apiKey: string): Promise<MetadataHint[]> {
  const url = `${API_BASE}?method=user.gettoptracks&user=${encodeURIComponent(username)}&period=3month&limit=${limit}&api_key=${apiKey}&format=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = (await res.json()) as { toptracks?: { track?: LastfmTrack[] } };
    const tracks = data.toptracks?.track ?? [];
    return tracks.map(toHint).filter((h): h is MetadataHint => h !== null);
  } catch {
    return [];
  }
}

function toHint(track: LastfmTrack): MetadataHint | null {
  const title = track.name?.trim();
  const artistName = (typeof track.artist === 'string' ? track.artist : track.artist?.name)?.trim();
  if (!title || !artistName) return null;
  // Last.fm-хост не входит в белый список обложек — sanitizeCoverUrl закономерно отдаёт null.
  const coverUrl = sanitizeCoverUrl(track.image?.at(-1)?.['#text'] || null);
  return { title, artistName, coverUrl, durationSec: null };
}

async function readCache(key: string): Promise<MetadataHint[] | null> {
  try {
    const raw = await getRedis().get(key);
    return raw ? (JSON.parse(raw) as MetadataHint[]) : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, hints: MetadataHint[]): Promise<void> {
  try {
    await getRedis().set(key, JSON.stringify(hints), 'EX', CACHE_TTL_SEC);
  } catch {
    // Недоступность Redis не должна ронять выдачу — просто ходим в API каждый раз.
  }
}
