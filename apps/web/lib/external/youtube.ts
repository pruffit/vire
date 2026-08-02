import type { IPlayableResolver, ExternalTrackRef } from '@vire/core';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const TIMEOUT_MS = 5000;

interface YoutubeVideoItem {
  id?: string;
  snippet?: { title?: string; channelTitle?: string; thumbnails?: { high?: { url?: string }; default?: { url?: string } } };
  status?: { embeddable?: boolean; privacyStatus?: string };
  contentDetails?: { duration?: string };
}

/**
 * YouTube Data API v3 — фиксированный хост googleapis.com, пользовательский ввод только
 * в query (не SSRF-риск). Без ключа резолвер деградирует до null (прямые ссылки всё равно
 * работают через oembed.ts, поиск чужого — нет, см. docs/features/party.md).
 */
export function createYoutubeResolver(apiKey: string | undefined): IPlayableResolver {
  return {
    async resolveUrl(url) {
      if (!apiKey) return null;
      const id = extractVideoId(url);
      if (!id) return null;
      return fetchVideoRef(id, apiKey);
    },
    async searchOne(query) {
      if (!apiKey) return null;
      const id = await searchVideoId(query, apiKey);
      if (!id) return null;
      return fetchVideoRef(id, apiKey);
    },
  };
}

async function searchVideoId(query: string, apiKey: string): Promise<string | null> {
  const url = `${API_BASE}/search?part=snippet&type=video&videoEmbeddable=true&maxResults=5&q=${encodeURIComponent(query)}&key=${apiKey}`;
  const data = await getJson<{ items?: Array<{ id?: { videoId?: string } }> }>(url);
  const id = data?.items?.[0]?.id?.videoId;
  return typeof id === 'string' ? id : null;
}

async function fetchVideoRef(id: string, apiKey: string): Promise<ExternalTrackRef | null> {
  const url = `${API_BASE}/videos?part=snippet,status,contentDetails&id=${encodeURIComponent(id)}&key=${apiKey}`;
  const data = await getJson<{ items?: YoutubeVideoItem[] }>(url);
  const item = data?.items?.[0];
  if (!item) return null;
  // Неэмбеддабельное/регионально закрытое видео кандидатом не считается (ToS YouTube).
  if (item.status?.embeddable === false) return null;
  if (item.status?.privacyStatus === 'private') return null;

  return {
    source: 'YOUTUBE',
    externalId: id,
    externalUrl: `https://www.youtube.com/watch?v=${id}`,
    title: item.snippet?.title ?? '',
    artistName: item.snippet?.channelTitle ?? '',
    coverUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    durationSec: parseIsoDuration(item.contentDetails?.duration),
  };
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/);
      return m ? m[1]! : null;
    }
    return null;
  } catch {
    return null;
  }
}

function parseIsoDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, h, min, s] = m;
  return Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}
