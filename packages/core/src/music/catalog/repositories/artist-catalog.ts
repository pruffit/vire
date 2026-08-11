import type { ArtistCard } from '../types/artist-card';

export interface ArtistCatalogQuery {
  query: string | null;
  limit: number;
  offset: number;
}

/** Read-порт для каталога артистов (страница `/artists` и HTTP-роут читают через одну реализацию). */
export interface IArtistCatalogRepository {
  list(params: ArtistCatalogQuery): Promise<ArtistCard[]>;
}
