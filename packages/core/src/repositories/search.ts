import type { SearchResults } from '../types/search';

export interface ISearchRepository {
  searchAll(query: string, limit: number): Promise<SearchResults>;
}
