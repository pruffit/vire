import type { PageMeta } from '@vire/core';
import { safeFetchText } from './safe-fetch';

const OEMBED_LINK_RE = /<link[^>]+type=["']application\/json\+oembed["'][^>]+href=["']([^"']+)["'][^>]*>/i;
const OG_TITLE_RE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i;
const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i;
const OG_TYPE_RE = /<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']*)["']/i;
const OG_DESC_RE = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i;
const TWITTER_TITLE_RE = /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']*)["']/i;
const TWITTER_DESC_RE = /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']*)["']/i;
const TWITTER_IMAGE_RE = /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']*)["']/i;
const ARTIST_NAME_MAX = 60;
const JSONLD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Метаданные произвольной (неизвестной или известной-но-неиграбельной) страницы:
 * oEmbed-дискавери → og/twitter теги → JSON-LD MusicRecording. Любой шаг падает — деградация
 * к следующему; полный провал — null (каскад резолвера уходит в поиск по тексту, не в ошибку).
 */
export async function fetchPageMeta(url: string): Promise<PageMeta | null> {
  const page = await safeFetchText(url);
  if (!page || !page.contentType.includes('html')) return null;

  const discovered = await fetchOembedDiscovery(page.body, page.finalUrl);
  if (discovered) return discovered;

  const title = decodeEntities(firstMatch(page.body, OG_TITLE_RE) ?? firstMatch(page.body, TWITTER_TITLE_RE) ?? jsonLdTitle(page.body) ?? '');
  if (!title) return null;

  const artistName = decodeEntities(jsonLdArtist(page.body) ?? artistFromDescription(page.body) ?? '') || null;
  const coverRaw = firstMatch(page.body, OG_IMAGE_RE) ?? firstMatch(page.body, TWITTER_IMAGE_RE);
  const coverUrl = coverRaw ? resolveUrl(decodeEntities(coverRaw), page.finalUrl) : null;

  return { title, artistName, coverUrl, durationSec: jsonLdDurationSec(page.body) };
}

/**
 * Стриминги пишут исполнителя первым сегментом описания через «·» («Monetochka · Альбом · Song · 2018»)
 * и нигде больше: у Spotify в JSON-LD нет byArtist. Берём только на `og:type: music.*` — на обычной
 * странице первый сегмент описания исполнителем не является.
 * Раньше здесь стоял `og:site_name`, и артистом становилось слово «Spotify» — каскад искал мусор.
 */
function artistFromDescription(html: string): string | null {
  const type = firstMatch(html, OG_TYPE_RE) ?? '';
  if (!type.toLowerCase().startsWith('music.')) return null;

  const description = decodeEntities(firstMatch(html, OG_DESC_RE) ?? firstMatch(html, TWITTER_DESC_RE) ?? '');
  const parts = description.split(/\s*[·•]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const first = parts[0]!;
  return first.length <= ARTIST_NAME_MAX ? first : null;
}

async function fetchOembedDiscovery(html: string, baseUrl: string): Promise<PageMeta | null> {
  const href = firstMatch(html, OEMBED_LINK_RE);
  if (!href) return null;

  const oembedUrl = resolveUrl(decodeEntities(href), baseUrl);
  if (!oembedUrl) return null;

  const fetched = await safeFetchText(oembedUrl);
  if (!fetched || !fetched.contentType.includes('json')) return null;

  try {
    const data = JSON.parse(fetched.body) as Record<string, unknown>;
    if (typeof data.title !== 'string' || !data.title) return null;
    return {
      title: data.title,
      artistName: typeof data.author_name === 'string' ? data.author_name : null,
      coverUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null,
      durationSec: null,
    };
  } catch {
    return null;
  }
}

function firstMatch(html: string, re: RegExp): string | null {
  return html.match(re)?.[1] ?? null;
}

function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function jsonLdMusicRecording(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(JSONLD_RE)) {
    try {
      const parsed = JSON.parse(match[1]!.trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const type = node?.['@type'];
        const types = Array.isArray(type) ? type : [type];
        if (types.includes('MusicRecording')) return node;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function jsonLdTitle(html: string): string | null {
  const node = jsonLdMusicRecording(html);
  return typeof node?.name === 'string' ? node.name : null;
}

function jsonLdArtist(html: string): string | null {
  const node = jsonLdMusicRecording(html);
  const artist = node?.byArtist as { name?: unknown } | undefined;
  return typeof artist?.name === 'string' ? artist.name : null;
}

function jsonLdDurationSec(html: string): number | null {
  const node = jsonLdMusicRecording(html);
  const duration = node?.duration;
  if (typeof duration !== 'string') return null;
  const m = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!m) return null;
  const [, h, min, s] = m;
  return Math.round(Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0));
}
