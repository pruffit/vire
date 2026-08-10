import { ok, type Result } from '../../../errors';
import type { ISearchRepository } from '../repositories/search';
import type { SearchResults } from '../types/search';

const MIN_QUERY_LENGTH = 2;
const EMPTY_RESULTS: SearchResults = { artists: [], releases: [], tracks: [] };

export class SearchService {
  constructor(private readonly repo: ISearchRepository) {}

  async search(q: string, limit: number): Promise<Result<SearchResults, Error>> {
    const trimmed = q.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return ok(EMPTY_RESULTS);
    return ok(await this.repo.searchAll(trimmed, limit));
  }
}
