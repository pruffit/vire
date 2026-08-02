import type { PageMeta } from '@vire/core';

const ENDPOINT = 'https://api.song.link/v1-alpha.1/links';
const TIMEOUT_MS = 7000;

interface OdesliEntity {
  title?: unknown;
  artistName?: unknown;
  thumbnailUrl?: unknown;
}

interface OdesliResponse {
  entityUniqueId?: unknown;
  entitiesByUniqueId?: Record<string, OdesliEntity>;
}

/**
 * Последняя надежда для ссылок, чьи страницы нам не отдаются (Яндекс.Музыка, VK, Tidal):
 * Odesli знает трек по ссылке любого сервиса и отдаёт исполнителя с названием. Играбельных
 * ссылок YouTube оттуда не приходит — это только метаданные для дальнейшего каскада.
 * Фиксированный эндпоинт, пользовательский URL — параметром (SSRF не применим).
 */
export async function fetchOdesliMeta(url: string): Promise<PageMeta | null> {
  try {
    const res = await fetch(`${ENDPOINT}?url=${encodeURIComponent(url)}&userCountry=RU`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as OdesliResponse;
    const id = typeof data.entityUniqueId === 'string' ? data.entityUniqueId : null;
    const entity = id ? data.entitiesByUniqueId?.[id] : undefined;
    if (!entity || typeof entity.title !== 'string' || !entity.title) return null;

    return {
      title: entity.title,
      artistName: typeof entity.artistName === 'string' ? entity.artistName : null,
      coverUrl: typeof entity.thumbnailUrl === 'string' ? entity.thumbnailUrl : null,
      durationSec: null,
    };
  } catch {
    return null;
  }
}
