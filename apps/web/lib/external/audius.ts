import type { ExternalTrackRef } from '@vire/core';

// Публичный шлюз Audius: без ключа, только с обязательным app_name.
const HOST = 'https://discoveryprovider.audius.co';
const APP = 'vire';
const TIMEOUT_MS = 5000;

interface AudiusTrack {
  id?: unknown;
  title?: unknown;
  duration?: unknown;
  permalink?: unknown;
  user?: { name?: unknown; handle?: unknown };
  artwork?: Record<string, unknown>;
  is_streamable?: unknown;
}

export function audiusStreamUrl(trackId: string): string {
  return `${HOST}/v1/tracks/${encodeURIComponent(trackId)}/stream?app_name=${APP}`;
}

function toRef(track: AudiusTrack): ExternalTrackRef | null {
  const id = typeof track.id === 'string' ? track.id : null;
  const title = typeof track.title === 'string' ? track.title : null;
  if (!id || !title || track.is_streamable === false) return null;
  const artist = typeof track.user?.name === 'string' ? track.user.name : typeof track.user?.handle === 'string' ? track.user.handle : '';
  const artwork = track.artwork?.['480x480'] ?? track.artwork?.['150x150'];
  return {
    source: 'AUDIUS',
    externalId: id,
    externalUrl: typeof track.permalink === 'string' ? `https://audius.co${track.permalink}` : null,
    title,
    artistName: artist,
    coverUrl: typeof artwork === 'string' ? artwork : null,
    durationSec: typeof track.duration === 'number' ? track.duration : null,
  };
}

async function fetchJson(url: string): Promise<{ data?: unknown } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return (await res.json()) as { data?: unknown };
  } catch {
    return null;
  }
}

/** Поиск по Audius — бесплатный и без квоты, результаты сразу играбельны (прямой аудиопоток). */
export async function searchAudius(query: string, limit: number): Promise<ExternalTrackRef[]> {
  const data = await fetchJson(`${HOST}/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=${APP}`);
  const list = Array.isArray(data?.data) ? (data.data as AudiusTrack[]) : [];
  return list.map(toRef).filter((ref): ref is ExternalTrackRef => ref !== null).slice(0, limit);
}

/** Ссылка вида audius.co/artist/track — резолв в играбельную позицию по permalink. */
export async function resolveAudiusUrl(url: string): Promise<ExternalTrackRef | null> {
  const data = await fetchJson(`${HOST}/v1/resolve?url=${encodeURIComponent(url)}&app_name=${APP}`);
  const track = Array.isArray(data?.data) ? (data.data[0] as AudiusTrack | undefined) : (data?.data as AudiusTrack | undefined);
  return track ? toRef(track) : null;
}
