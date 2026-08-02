import type { ExternalTrackRef, MetadataHint } from '../types/external';

export interface IMetadataIndex {
  suggest(query: string, limit: number): Promise<MetadataHint[]>;
}

export interface IPlayableResolver {
  /** Известный playable-URL (YouTube) — авторитетный резолв через платный API (нужен ключ). */
  resolveUrl(url: string): Promise<ExternalTrackRef | null>;
  /**
   * Текстовый запрос → YouTube search.list (100 юнитов), только на резолве добавления.
   * `expect` — что именно искали: найденное сверяется с ним, иначе поиск подсунет «что-нибудь».
   */
  searchOne(query: string, expect?: { title: string; artistName: string }): Promise<ExternalTrackRef | null>;
}

export interface PageMeta {
  title: string;
  artistName: string | null;
  coverUrl: string | null;
  durationSec: number | null;
}

export interface IPageMetaFetcher {
  fetch(url: string): Promise<PageMeta | null>;
}

export type ResolutionKeyKind = 'URL' | 'QUERY';
export type ResolutionKey = { kind: ResolutionKeyKind; value: string };

export type CachedResolution = { found: true; ref: ExternalTrackRef } | { found: false; resolvedAt: Date };

export interface IResolutionCache {
  get(key: ResolutionKey): Promise<CachedResolution | null>;
  put(key: ResolutionKey, ref: ExternalTrackRef | null): Promise<void>;
}

/**
 * Уже отрезолвленное кем угодно — готовый к добавлению результат без обращения к сети и
 * без квоты поиска. Кэш резолвов работает индексом: чем больше вечеринок, тем быстрее поиск.
 */
export interface IResolvedIndex {
  search(query: string, limit: number): Promise<ExternalTrackRef[]>;
}
