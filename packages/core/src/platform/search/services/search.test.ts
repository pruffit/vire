import { describe, it, expect, vi } from 'vitest';
import { SearchService } from './search';
import type { ISearchRepository } from '../repositories/search';
import type { SearchResults } from '../types/search';

const RESULTS: SearchResults = {
  artists: [{ id: 'a1', slug: 'a1', name: 'Artist', avatarUrl: null, firstReleaseCoverUrl: null, verified: false }],
  releases: [],
  tracks: [],
};

function makeRepo(overrides?: Partial<ISearchRepository>): ISearchRepository {
  return {
    searchAll: vi.fn().mockResolvedValue(RESULTS),
    ...overrides,
  };
}

describe('SearchService.search', () => {
  it('returns an empty result without calling the repository when q is shorter than 2 chars', async () => {
    const repo = makeRepo();
    const service = new SearchService(repo);

    const result = await service.search('a', 4);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ artists: [], releases: [], tracks: [] });
    expect(repo.searchAll).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only query as too short after trimming', async () => {
    const repo = makeRepo();
    const service = new SearchService(repo);

    const result = await service.search('  a ', 4);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.artists).toEqual([]);
    expect(repo.searchAll).not.toHaveBeenCalled();
  });

  it('delegates to the repository with a trimmed query and the given limit', async () => {
    const repo = makeRepo();
    const service = new SearchService(repo);

    const result = await service.search('  hello  ', 4);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(RESULTS);
    expect(repo.searchAll).toHaveBeenCalledWith('hello', 4);
  });
});
