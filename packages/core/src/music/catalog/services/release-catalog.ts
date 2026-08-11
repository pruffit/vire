import type { IReleaseCatalogRepository, ReleaseSort } from '../repositories/release-catalog';
import type { ReleaseCard } from '../types/release-card';

const DEFAULT_LIMIT = 60;
const MIN_LIMIT = 1;
const MAX_LIMIT = 60;
const MIN_SINCE_DAYS = 1;
const MAX_SINCE_DAYS = 365;
const MAX_OFFSET = 10000;

export interface ReleaseCatalogInput {
  sort?: ReleaseSort | null;
  sinceDays?: number | null;
  limit?: number | null;
  offset?: number | null;
}

export interface ReleaseCatalogView {
  items: ReleaseCard[];
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

function clampSinceDays(sinceDays: number | null | undefined): number | null {
  if (sinceDays == null) return null;
  return Math.min(MAX_SINCE_DAYS, Math.max(MIN_SINCE_DAYS, Math.floor(sinceDays)));
}

export class ReleaseCatalogService {
  constructor(private readonly repo: IReleaseCatalogRepository) {}

  async list(input: ReleaseCatalogInput): Promise<ReleaseCatalogView> {
    const sort: ReleaseSort = input.sort ?? 'fresh';
    const limit = clampLimit(input.limit);
    const offset = clampOffset(input.offset);
    const sinceDays = clampSinceDays(input.sinceDays);

    const rows = await this.repo.list({ sort, sinceDays, limit: limit + 1, offset });
    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
  }
}
