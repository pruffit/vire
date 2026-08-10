import type { Clock } from '../../../platform/ports/effects';
import type { IMetadataIndex, IPlayableResolver, IPlayableSearch, IPageMetaFetcher, IResolutionCache, IResolvedIndex, ResolutionKey, PageMeta } from '../ports/external';
import type { ExternalTrackRef, MetadataHint, TrackCandidate, PlayableExternalSource } from '../types/external';
import type { SearchTrack } from '../../../platform/search/types/search';
import { SearchService } from '../../../platform/search/services/search';
import { classifyInput, parseKnownUrl, parseOwnUrl, normalizeUrlKey, normalizeQueryKey, scoreCatalogMatch, matchesExpectedTrack } from './external-resolve';

const CACHE_STALE_DAYS = 30;
const CACHE_STALE_MS = CACHE_STALE_DAYS * 24 * 60 * 60 * 1000;
// Меняется вместе с логикой каскада: старые записи (в первую очередь негативные — «не нашли»)
// не должны закрывать дорогу новому пути резолва на 30 дней вперёд.
const CACHE_VERSION = 2;

export type ResolveOutcome =
  | { outcome: 'vire'; trackId: string }
  | { outcome: 'external'; ref: ExternalTrackRef }
  | { outcome: 'candidates'; candidates: TrackCandidate[] };

export interface ExternalResolveDeps {
  search: SearchService;
  metadataIndex: IMetadataIndex;
  playableResolver: IPlayableResolver;
  /** Свободный играбельный каталог (Audius) — ищем в нём до платного поиска YouTube. */
  playableSearch: IPlayableSearch;
  pageMetaFetcher: IPageMetaFetcher;
  cache: IResolutionCache;
  /** Индекс уже отрезолвленного — играбельные подсказки без сети и квоты. */
  resolvedIndex: IResolvedIndex;
  clock: Clock;
  /** Хост своего сайта (без протокола) — для распознавания собственных ссылок на трек. */
  siteHost: string;
}

/**
 * Каскад «любой ввод → играбельная позиция очереди». Каждый шаг деградирует в следующий,
 * тупика нет — при полном провале возвращается outcome:'candidates' (может быть пустым),
 * никогда ошибка.
 */
export class ExternalResolveService {
  constructor(private readonly deps: ExternalResolveDeps) {}

  async resolve(rawInput: string): Promise<ResolveOutcome> {
    const classified = classifyInput(rawInput);
    if (classified.kind === 'query') return this.resolveHint({ title: classified.text, artistName: '', coverUrl: null, durationSec: null });

    const own = parseOwnUrl(classified.url, this.deps.siteHost);
    if (own) return { outcome: 'vire', trackId: own.trackId };

    const known = parseKnownUrl(classified.url);
    if (known && 'source' in known) return this.resolveKnownPlayableUrl(classified.url, known.source, known.externalId);

    return this.resolveViaPageMeta(classified.url);
  }

  /**
   * Подсказки при наборе — без платных API: каталог, уже отрезолвленное кем-то (играет сразу)
   * и бесплатный метаиндекс. Порядок = порядок готовности к воспроизведению.
   */
  async suggest(query: string, limit: number): Promise<TrackCandidate[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const [searchResult, resolved, playable, hints] = await Promise.all([
      this.deps.search.search(trimmed, limit),
      this.deps.resolvedIndex.search(trimmed, limit).catch(() => []),
      this.deps.playableSearch.search(trimmed, limit).catch(() => []),
      this.deps.metadataIndex.suggest(trimmed, limit),
    ]);

    const catalog = searchResult.ok ? toVireCandidates(searchResult.value.tracks) : [];
    const ready: TrackCandidate[] = [...resolved, ...playable].map((ref) => ({ kind: 'EXTERNAL', ref }));
    const hintCandidates: TrackCandidate[] = hints.map((hint) => ({ kind: 'HINT', hint }));

    return dedupeCandidates([...catalog, ...ready, ...hintCandidates]).slice(0, limit);
  }

  private async resolveKnownPlayableUrl(url: string, source: PlayableExternalSource, externalId: string): Promise<ResolveOutcome> {
    const key = urlKey(url);
    const cached = await this.deps.cache.get(key);
    if (cached?.found) return { outcome: 'external', ref: cached.ref };
    if (cached && !cached.found && !this.isStale(cached.resolvedAt)) return { outcome: 'candidates', candidates: [] };

    let ref = source === 'YOUTUBE' || source === 'AUDIUS' ? await this.deps.playableResolver.resolveUrl(url) : null;
    if (!ref) {
      const meta = await this.deps.pageMetaFetcher.fetch(url);
      if (meta) ref = toRef(source, externalId, url, meta);
    }

    await this.deps.cache.put(key, ref);
    if (ref) {
      await this.deps.cache.put(queryKey(ref.artistName, ref.title), ref);
      return { outcome: 'external', ref };
    }
    return { outcome: 'candidates', candidates: [] };
  }

  private async resolveViaPageMeta(url: string): Promise<ResolveOutcome> {
    const key = urlKey(url);
    const cached = await this.deps.cache.get(key);
    if (cached?.found) return { outcome: 'external', ref: cached.ref };
    if (cached && !cached.found && !this.isStale(cached.resolvedAt)) return { outcome: 'candidates', candidates: [] };

    const meta = await this.deps.pageMetaFetcher.fetch(url);
    if (!meta?.title) {
      await this.deps.cache.put(key, null);
      return { outcome: 'candidates', candidates: [] };
    }

    const hint: MetadataHint = { title: meta.title, artistName: meta.artistName ?? '', coverUrl: meta.coverUrl, durationSec: meta.durationSec };
    const outcome = await this.resolveHint(hint);
    // Успешный внешний резолв кэшируем и под URL-ключом — повторная вставка той же ссылки не должна снова фетчить страницу.
    if (outcome.outcome === 'external') await this.deps.cache.put(key, outcome.ref);
    return outcome;
  }

  private async resolveHint(hint: MetadataHint): Promise<ResolveOutcome> {
    if (!hint.title) return { outcome: 'candidates', candidates: [] };

    const query = hint.artistName ? `${hint.artistName} ${hint.title}` : hint.title;
    const searchResult = await this.deps.search.search(query, 10);
    const catalogTracks = searchResult.ok ? searchResult.value.tracks : [];

    const match = scoreCatalogMatch(hint, catalogTracks);
    if (match) return { outcome: 'vire', trackId: match.id };

    const key = queryKey(hint.artistName, hint.title);
    const cached = await this.deps.cache.get(key);
    if (cached?.found) return { outcome: 'external', ref: cached.ref };

    // Бесплатный играбельный каталог идёт до квотируемого поиска YouTube.
    const fromPlayable = await this.deps.playableSearch.search(query, 5).catch(() => []);
    const direct = fromPlayable.find((candidate) => matchesExpectedTrack({ title: hint.title, artistName: hint.artistName }, candidate));
    if (direct) {
      await this.deps.cache.put(key, direct);
      return { outcome: 'external', ref: direct };
    }

    const skipSearch = Boolean(cached && !cached.found && !this.isStale(cached.resolvedAt));
    const found = skipSearch ? null : await this.deps.playableResolver.searchOne(query, { title: hint.title, artistName: hint.artistName });
    const ref = found && labelFromHint(found, hint);
    if (!skipSearch) await this.deps.cache.put(key, ref);
    if (ref) return { outcome: 'external', ref };

    return { outcome: 'candidates', candidates: await this.candidatesFor(hint, catalogTracks) };
  }

  private async candidatesFor(hint: MetadataHint, catalogTracks: SearchTrack[]): Promise<TrackCandidate[]> {
    const query = hint.artistName ? `${hint.artistName} ${hint.title}` : hint.title;
    const hints = await this.deps.metadataIndex.suggest(query, 5);
    const hintCandidates: TrackCandidate[] = hints.map((h) => ({ kind: 'HINT', hint: h }));
    return dedupeCandidates([...toVireCandidates(catalogTracks.slice(0, 5)), ...hintCandidates]);
  }

  private isStale(resolvedAt: Date): boolean {
    return this.deps.clock() - resolvedAt.getTime() >= CACHE_STALE_MS;
  }
}

/**
 * Играет ролик с YouTube, но в очереди должно стоять «артист — трек», а не заголовок ролика
 * с названием канала («Harry — Portishead - Numbed In Moscow (1994 - Singles…)»). Подменяем
 * подпись данными хинта, когда он полноценный; сам источник и id не трогаем.
 */
function labelFromHint(ref: ExternalTrackRef, hint: MetadataHint): ExternalTrackRef {
  if (!hint.artistName || !hint.title) return ref;
  return {
    ...ref,
    title: hint.title,
    artistName: hint.artistName,
    coverUrl: ref.coverUrl ?? hint.coverUrl,
    durationSec: ref.durationSec ?? hint.durationSec,
  };
}

function urlKey(url: string): ResolutionKey {
  return { kind: 'URL', value: `v${CACHE_VERSION}:${normalizeUrlKey(url)}` };
}

function queryKey(artistName: string, title: string): ResolutionKey {
  return { kind: 'QUERY', value: `v${CACHE_VERSION}:${normalizeQueryKey(artistName, title)}` };
}

function toRef(source: PlayableExternalSource, externalId: string, url: string, meta: PageMeta): ExternalTrackRef {
  return { source, externalId, externalUrl: url, title: meta.title, artistName: meta.artistName ?? '', coverUrl: meta.coverUrl, durationSec: meta.durationSec };
}

function toVireCandidates(tracks: SearchTrack[]): TrackCandidate[] {
  return tracks.map((t) => ({ kind: 'VIRE', trackId: t.id, title: t.title, artistName: t.artistName, coverUrl: t.coverUrl }));
}

/** Дедуп по нормализованному «артист+название»; каталожные идут первыми в списке — при коллизии остаются они. */
function dedupeCandidates(candidates: TrackCandidate[]): TrackCandidate[] {
  const seen = new Set<string>();
  const out: TrackCandidate[] = [];
  for (const c of candidates) {
    const [artistName, title] = c.kind === 'VIRE' ? [c.artistName, c.title] : c.kind === 'HINT' ? [c.hint.artistName, c.hint.title] : [c.ref.artistName, c.ref.title];
    const key = normalizeQueryKey(artistName, title);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
