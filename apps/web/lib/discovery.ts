import { getDiscoveryCandidates, getSimilarArtists } from '@vire/db';
import { composeDiscovery, type RankedDiscoveryArtist } from '@vire/core';

export const DISCOVERY_LIMIT = 12;
export const SIMILAR_ARTISTS_LIMIT = 8;

// пул кандидатов больше конечного лимита — из БД идёт грубая сортировка (по co-listen
// intersection/жанрам), composeDiscovery досортировывает по настоящему взвешенному score
const CANDIDATE_POOL = 30;

/** «Открытия для вас» на главной (stage-2 §7.4): все три сигнала. Порог рендера — забота UI, не lib. */
export async function buildDiscovery(userId: string, limit = DISCOVERY_LIMIT): Promise<RankedDiscoveryArtist[]> {
  const candidates = await getDiscoveryCandidates(userId, CANDIDATE_POOL);
  return composeDiscovery(candidates, { limit });
}

/**
 * «Похожие артисты» на странице артиста: co-listen + вкус, без сигнала друзей.
 * Кандидаты все привязаны к одному sourceArtistId (сам artistProfileId) — кап
 * «1 карточка на источник» тут неприменим (он защищает от одного домининующего
 * seed-артиста среди нескольких, здесь источник всегда один), поэтому отключаем его.
 */
export async function buildSimilarArtists(artistProfileId: string, limit = SIMILAR_ARTISTS_LIMIT): Promise<RankedDiscoveryArtist[]> {
  const candidates = await getSimilarArtists(artistProfileId, CANDIDATE_POOL);
  return composeDiscovery(candidates, { limit, maxPerSource: CANDIDATE_POOL });
}
