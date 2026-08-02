import { matchesExpectedTrack, type IPlayableResolver, type ExternalTrackRef } from '@vire/core';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const TIMEOUT_MS = 5000;
// Сервер в РФ: ролик, закрытый для этого региона, во встроенном плеере не пойдёт.
const SERVER_REGION = 'RU';

interface YoutubeVideoItem {
  id?: string;
  snippet?: { title?: string; channelTitle?: string; thumbnails?: { high?: { url?: string }; default?: { url?: string } } };
  status?: { embeddable?: boolean; privacyStatus?: string };
  contentDetails?: {
    duration?: string;
    contentRating?: { ytRating?: string };
    regionRestriction?: { blocked?: string[]; allowed?: string[] };
  };
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
    async searchOne(query, expect) {
      if (!apiKey) return null;
      const ids = await searchVideoIds(query, apiKey);

      // Идём по выдаче, а не берём первый: он может оказаться неиграбельным (возрастной
      // ценз, регион) или просто другим треком — поиск отдаёт что-нибудь на любой запрос.
      for (const id of ids) {
        const ref = await fetchVideoRef(id, apiKey);
        if (!ref) continue;
        if (expect && !matchesExpectedTrack(expect, { title: ref.title, artistName: ref.artistName })) continue;
        return ref;
      }
      return null;
    },
  };
}

const SEARCH_CANDIDATES = 5;

async function searchVideoIds(query: string, apiKey: string): Promise<string[]> {
  const url = `${API_BASE}/search?part=snippet&type=video&videoEmbeddable=true&maxResults=${SEARCH_CANDIDATES}&q=${encodeURIComponent(query)}&key=${apiKey}`;
  const data = await getJson<{ items?: Array<{ id?: { videoId?: string } }> }>(url);
  return (data?.items ?? []).map((i) => i.id?.videoId).filter((id): id is string => typeof id === 'string');
}

async function fetchVideoRef(id: string, apiKey: string): Promise<ExternalTrackRef | null> {
  const url = `${API_BASE}/videos?part=snippet,status,contentDetails&id=${encodeURIComponent(id)}&key=${apiKey}`;
  const data = await getJson<{ items?: YoutubeVideoItem[] }>(url);
  const item = data?.items?.[0];
  if (!item) return null;
  if (item.status?.embeddable === false) return null;
  if (item.status?.privacyStatus === 'private') return null;
  // Возрастной ценз формально оставляет embeddable: true, но во встроенном плеере такой
  // ролик молчит и показывает заглушку «нельзя смотреть во встроенном проигрывателе».
  if (item.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted') return null;
  if (isRegionBlocked(item.contentDetails?.regionRestriction)) return null;

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

function isRegionBlocked(restriction: { blocked?: string[]; allowed?: string[] } | undefined): boolean {
  if (!restriction) return false;
  if (restriction.blocked?.includes(SERVER_REGION)) return true;
  return Array.isArray(restriction.allowed) && !restriction.allowed.includes(SERVER_REGION);
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
