import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getListeningNow } = vi.hoisted(() => ({ getListeningNow: vi.fn() }));

vi.mock('@/lib/listening-now', () => ({ getListeningNow }));

import { GET } from './route';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/listening-now', () => {
  it('happy path: returns tracks currently being listened to', async () => {
    const tracks = [{ id: 't1', title: 'Track', listeners: 3 }];
    getListeningNow.mockResolvedValue(tracks);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ tracks });
    expect(getListeningNow).toHaveBeenCalledWith(6);
  });

  it('degrades to an empty list when the underlying call rejects', async () => {
    getListeningNow.mockRejectedValue(new Error('redis down'));
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ tracks: [] });
  });
});
