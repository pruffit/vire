import type { IArtistCatalogRepository, ArtistCatalogQuery, ArtistCard } from '@vire/core';
import { listActiveArtists } from '../queries/artists';

/** Тонкая обёртка над listActiveArtists — SQL живёт в queries/artists.ts, не здесь. */
export class DrizzleArtistCatalogRepository implements IArtistCatalogRepository {
  list({ query, limit, offset }: ArtistCatalogQuery): Promise<ArtistCard[]> {
    return listActiveArtists({ query: query ?? undefined, limit, offset });
  }
}
