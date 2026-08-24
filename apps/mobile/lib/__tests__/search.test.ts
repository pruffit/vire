import { describe, it, expect, vi, beforeEach } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../api-client', () => ({ apiRequest: request }));

import { search } from '../search';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('search', () => {
  it('GET /api/v1/search?q=... с нужной схемой', async () => {
    request.mockResolvedValue({ ok: true, data: { artists: [], releases: [], tracks: [] } });

    await search('interference');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/search?q=interference',
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('экранирует query', async () => {
    request.mockResolvedValue({ ok: true, data: { artists: [], releases: [], tracks: [] } });

    await search('a b/c');

    expect(request).toHaveBeenCalledWith(
      `/api/v1/search?q=${encodeURIComponent('a b/c')}`,
      expect.anything(),
    );
  });

  it('limit — добавляет параметр только если передан', async () => {
    request.mockResolvedValue({ ok: true, data: { artists: [], releases: [], tracks: [] } });

    await search('sam', 12);

    expect(request).toHaveBeenCalledWith('/api/v1/search?q=sam&limit=12', expect.anything());
  });
});
