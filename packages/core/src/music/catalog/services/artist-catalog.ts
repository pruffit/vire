import type { IArtistCatalogRepository } from '../repositories/artist-catalog';
import type { ArtistCard } from '../types/artist-card';

const DEFAULT_LIMIT = 200;
const MIN_LIMIT = 1;
const MAX_LIMIT = 200;
const MAX_OFFSET = 10000;

export interface ArtistCatalogInput {
  query?: string | null;
  limit?: number | null;
  offset?: number | null;
}

export interface ArtistCatalogView {
  items: ArtistCard[];
  hasMore: boolean;
}

function clampLimit(limit: number | null | undefined): number {
  if (limit == null) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.floor(limit)));
}

function clampOffset(offset: number | null | undefined): number {
  if (offset == null) return 0;
  return Math.min(MAX_OFFSET, Math.max(0, Math.floor(offset)));
}

function normalizeQuery(query: string | null | undefined): string | null {
  if (query == null) return null;
  const trimmed = query.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class ArtistCatalogService {
  constructor(private readonly repo: IArtistCatalogRepository) {}

  async list(input: ArtistCatalogInput): Promise<ArtistCatalogView> {
    const query = normalizeQuery(input.query);
    const limit = clampLimit(input.limit);
    const offset = clampOffset(input.offset);

    const rows = await this.repo.list({ query, limit: limit + 1, offset });
    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
  }
}
