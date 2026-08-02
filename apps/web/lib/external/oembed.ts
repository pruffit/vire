import type { PageMeta } from '@vire/core';

const TIMEOUT_MS = 5000;

/**
 * oEmbed для YouTube/SoundCloud — фиксированный доверенный хост, пользовательская ссылка
 * идёт только в query-параметре (SSRF не применим, ср. docs/security/owasp-top-10.md A10).
 * Бесплатно, без ключа.
 */
export async function fetchOembed(sourceUrl: string): Promise<PageMeta | null> {
  const endpoint = oembedEndpointFor(sourceUrl);
  if (!endpoint) return null;

  const data = await fetchJson(endpoint);
  if (!data || typeof data.title !== 'string' || !data.title) return null;

  return {
    title: data.title,
    artistName: typeof data.author_name === 'string' ? data.author_name : null,
    coverUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null,
    durationSec: null,
  };
}

function oembedEndpointFor(sourceUrl: string): string | null {
  let host: string;
  try {
    host = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  const encoded = encodeURIComponent(sourceUrl);
  if (host.endsWith('youtube.com') || host === 'youtu.be') {
    return `https://www.youtube.com/oembed?url=${encoded}&format=json`;
  }
  if (host.endsWith('soundcloud.com')) {
    return `https://soundcloud.com/oembed?url=${encoded}&format=json`;
  }
  return null;
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
