import type { ReleaseCard } from '../types/release-card';

export type ReleaseSort = 'fresh' | 'popular';

export interface ReleaseCatalogQuery {
  sort: ReleaseSort;
  sinceDays: number | null;
  limit: number;
  offset: number;
}

/** Read-порт для каталога релизов (страница `/releases` и HTTP-роут читают через одну реализацию). */
export interface IReleaseCatalogRepository {
  list(params: ReleaseCatalogQuery): Promise<ReleaseCard[]>;
}
