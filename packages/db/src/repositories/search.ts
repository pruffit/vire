import type { DB } from '../client';
import type { ISearchRepository, SearchResults } from '@vire/core';
import { searchAll as searchAllQuery } from '../queries/search';

export class DrizzleSearchRepository implements ISearchRepository {
  constructor(private readonly db: DB) {}

  searchAll(query: string, limit: number): Promise<SearchResults> {
    return searchAllQuery(query, limit);
  }
}
