import type { SearchTrack } from '../types/search';
import type { PlayableExternalSource } from '../types/external';

export type ClassifiedInput = { kind: 'url'; url: string } | { kind: 'query'; text: string };

const URL_RE = /https?:\/\/[^\s<>"']+/i;

/** Достаёт ссылку из произвольного текста («слушай это https://… огонь») или чистит текст под поисковый запрос. */
export function classifyInput(raw: string): ClassifiedInput {
  const trimmed = raw.trim();
  const match = trimmed.match(URL_RE);
  if (match) {
    // Хвостовая пунктуация, приставшая от окружающего предложения, не часть URL.
    const url = match[0].replace(/[)\]}>,.!?;:]+$/, '');
    return { kind: 'url', url };
  }
  return { kind: 'query', text: cleanQueryText(trimmed) };
}

function cleanQueryText(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[‍️]/gu, '')
    .replace(/["'«»]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type KnownUrlMatch = { source: PlayableExternalSource; externalId: string } | { service: string; needsPageMeta: true } | null;

export type ProviderTrackMatch = { provider: 'spotify' | 'apple-music' | 'deezer'; id: string };

const SPOTIFY_TRACK_RE = /^\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]+)\/?$/i;
const DEEZER_TRACK_RE = /^\/(?:[a-z]{2}\/)?track\/(\d+)\/?$/i;
const APPLE_SONG_RE = /^\/(?:[a-z]{2}\/)?song\/[^/]+\/(\d+)\/?$/i;

/**
 * Ссылка Spotify/Apple Music/Deezer на конкретный трек → провайдер + id для фиксированного
 * API-эндпоинта (страницы этих сервисов ботам не отдаются, см. providers.ts). Плейлисты/
 * альбомы/артисты — вне области, null.
 */
export function parseProviderTrackUrl(url: string): ProviderTrackMatch | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();

  if (host === 'open.spotify.com') {
    const m = u.pathname.match(SPOTIFY_TRACK_RE);
    return m ? { provider: 'spotify', id: m[1]! } : null;
  }
  if (host === 'music.apple.com') {
    const i = u.searchParams.get('i');
    if (i) return { provider: 'apple-music', id: i };
    const m = u.pathname.match(APPLE_SONG_RE);
    return m ? { provider: 'apple-music', id: m[1]! } : null;
  }
  if (host === 'deezer.com' || host === 'www.deezer.com') {
    const m = u.pathname.match(DEEZER_TRACK_RE);
    return m ? { provider: 'deezer', id: m[1]! } : null;
  }

  return null;
}

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
const SC_HOSTS = new Set(['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com']);
const SC_RESERVED_FIRST_SEGMENTS = new Set(['you', 'discover', 'stream', 'search', 'tags', 'charts', 'upload', 'settings']);

/** Ссылка известного сервиса → сразу играбельный дескриптор (YouTube/SoundCloud) либо флаг «нужны метаданные страницы». */
export function parseKnownUrl(url: string): KnownUrlMatch {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();

  if (YT_HOSTS.has(host)) {
    const id = extractYoutubeId(u);
    return id ? { source: 'YOUTUBE', externalId: id } : null;
  }
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return id ? { source: 'YOUTUBE', externalId: id } : null;
  }
  if (SC_HOSTS.has(host)) {
    const path = u.pathname.replace(/^\/+|\/+$/g, '');
    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 2 && !SC_RESERVED_FIRST_SEGMENTS.has(segments[0]!.toLowerCase())) {
      return { source: 'SOUNDCLOUD', externalId: path };
    }
    return null;
  }

  if (host === 'open.spotify.com' || host === 'spotify.link') return { service: 'spotify', needsPageMeta: true };
  if (host === 'music.apple.com') return { service: 'apple-music', needsPageMeta: true };
  if (host === 'music.yandex.ru' || host === 'music.yandex.com') return { service: 'yandex-music', needsPageMeta: true };
  if (host === 'vk.com' || host === 'm.vk.com' || host === 'vkvideo.ru') return { service: 'vk', needsPageMeta: true };
  if (host === 'deezer.com' || host === 'www.deezer.com' || host === 'deezer.page.link') return { service: 'deezer', needsPageMeta: true };
  if (host.endsWith('.bandcamp.com')) return { service: 'bandcamp', needsPageMeta: true };

  return null;
}

function extractYoutubeId(u: URL): string | null {
  const v = u.searchParams.get('v');
  if (v) return v;
  const m = u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/);
  return m ? m[1]! : null;
}

const UUID_SEGMENT = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const OWN_TRACK_URL_RE = new RegExp(`^/artists/[^/]+/releases/${UUID_SEGMENT}/tracks/(${UUID_SEGMENT})`, 'i');

/** Ссылка на нашу же страницу трека → её trackId напрямую, без резолва. */
export function parseOwnUrl(url: string, siteHost: string): { trackId: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const expected = siteHost.toLowerCase().replace(/^www\./, '');
  if (host !== expected) return null;

  const m = u.pathname.match(OWN_TRACK_URL_RE);
  return m ? { trackId: m[1]! } : null;
}

const STRIP_TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'si', 'feature', 't', 'start', 'time_continue', 'ref', 'context',
]);

/** Ключ кэша по URL: для известного playable-сервиса — source:id (единый ключ для youtu.be и /watch); иначе host+path+значимые query. */
export function normalizeUrlKey(url: string): string {
  const known = parseKnownUrl(url);
  if (known && 'source' in known) return `${known.source}:${known.externalId}`;

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url.trim().toLowerCase();
  }
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, '');
  const path = u.pathname.replace(/\/+$/, '') || '/';
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !STRIP_TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length > 0 ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : '';
  const prefix = known && 'service' in known ? `${known.service}:` : '';
  return `${prefix}${host}${path}${query}`.toLowerCase();
}

/** Ключ кэша по «артист + название»: без диакритики/пунктуации/feat.-ft.-prod., но суффиксы ремиксов/версий остаются (remix ≠ оригинал). */
export function normalizeQueryKey(artistName: string, title: string): string {
  const clean = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[([][^)\]]*\b(?:feat|ft|prod)\.?\s[^)\]]*[)\]]/gi, '')
      .replace(/\b(?:feat|ft)\.?\s+[^([]+$/gi, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  return `${clean(artistName)}::${clean(title)}`;
}

// Слова версии меняют идентичность трека (ремикс ≠ оригинал) — точное совпадение обязательно.
// Слова-descriptors («official video» и т.п.) — шум YouTube-заголовков, не влияют на идентичность.
const VERSION_MARKERS = new Set(['remix', 'cover', 'acoustic', 'live', 'instrumental', 'remaster', 'remastered', 'extended', 'version', 'mix', 'demo', 'unplugged', 'edit', 'rework', 'reprise']);
// Целый альбом/сборник вместо трека — самый частый промах поиска: по токенам он проходит
// («Yes Future» ⊂ «The Toxic Avenger - Yes Future - Full Album»), поэтому судим отдельно.
const BULK_MARKERS = new Set(['album', 'lp', 'ep', 'compilation', 'megamix', 'mixtape', 'playlist', 'discography', 'anthology', 'сборник', 'альбом', 'дискография', 'концерт', 'concert', 'сет']);
const NOISE_WORDS = new Set(['official', 'video', 'audio', 'lyrics', 'lyric', 'hd', 'clip', 'music']);

function scoringTokens(artistName: string, title: string): Set<string> {
  const raw = `${artistName} ${title}`
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return new Set(raw.filter((t) => !NOISE_WORDS.has(t)));
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const t of a) if (b.has(t)) common++;
  return common / Math.max(a.size, b.size);
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}

const MATCH_THRESHOLD = 0.6;

/**
 * Достаточно ли найденное на стороннем сервисе похоже на то, что просили. Поиск YouTube отдаёт
 * что-нибудь на любой запрос: без этой проверки «Numbed In Moscow» молча превращался в «Numb».
 * Метрика та же, что и для каталога — токены плюс обязательное совпадение слов версии.
 */
export function matchesExpectedTrack(
  expected: { title: string; artistName: string },
  candidate: { title: string; artistName: string },
): boolean {
  const expectedTokens = scoringTokens(expected.artistName, expected.title);
  const candidateTokens = scoringTokens(candidate.artistName, candidate.title);
  const expectedVersions = new Set([...expectedTokens].filter((t) => VERSION_MARKERS.has(t)));
  const candidateVersions = new Set([...candidateTokens].filter((t) => VERSION_MARKERS.has(t)));
  if (!setsEqual(expectedVersions, candidateVersions)) return false;

  const expectedBulk = new Set([...expectedTokens].filter((t) => BULK_MARKERS.has(t)));
  const candidateBulk = new Set([...candidateTokens].filter((t) => BULK_MARKERS.has(t)));
  if (!setsEqual(expectedBulk, candidateBulk)) return false;

  // Заголовок ролика обычно шире запроса («Артист - Трек (Official Video)») — сравниваем
  // с покрытием ожидаемых токенов, а не с симметричным пересечением.
  const covered = [...expectedTokens].filter((t) => candidateTokens.has(t)).length;
  return expectedTokens.size > 0 && covered / expectedTokens.size >= MATCH_THRESHOLD;
}

/** Лучший каталожный кандидат для хинта (метаданные страницы/YouTube) или null, если ничего не проходит порог. */
export function scoreCatalogMatch(hint: { title: string; artistName: string }, candidates: SearchTrack[]): SearchTrack | null {
  const hintTokens = scoringTokens(hint.artistName, hint.title);
  const hintVersions = new Set([...hintTokens].filter((t) => VERSION_MARKERS.has(t)));

  let best: { candidate: SearchTrack; score: number } | null = null;
  for (const candidate of candidates) {
    const candTitle = candidate.version ? `${candidate.title} ${candidate.version}` : candidate.title;
    const candTokens = scoringTokens(candidate.artistName, candTitle);
    const candVersions = new Set([...candTokens].filter((t) => VERSION_MARKERS.has(t)));
    if (!setsEqual(hintVersions, candVersions)) continue;

    const score = tokenOverlap(hintTokens, candTokens);
    if (score === 1) return candidate;
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) best = { candidate, score };
  }
  return best?.candidate ?? null;
}
