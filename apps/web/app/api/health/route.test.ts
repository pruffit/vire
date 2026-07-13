import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pingDb, pingRedis } = vi.hoisted(() => ({
  pingDb: vi.fn(),
  pingRedis: vi.fn(),
}));

vi.mock('@vire/db', () => ({ pingDb }));
vi.mock('@/lib/presence', () => ({ pingRedis }));

import { GET } from './route';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/health', () => {
  it('200 ok when db and redis are both alive', async () => {
    pingDb.mockResolvedValue(3);
    pingRedis.mockResolvedValue(1);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok', db: true, redis: true, version: expect.any(String), ts: expect.any(String) });
  });

  it('503 degraded when the db is unavailable', async () => {
    pingDb.mockResolvedValue(null);
    pingRedis.mockResolvedValue(1);
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ status: 'degraded', db: false, redis: true });
  });

  it('503 degraded when redis is unavailable', async () => {
    pingDb.mockResolvedValue(3);
    pingRedis.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ status: 'degraded', db: true, redis: false });
  });

  it('503 degraded when both are unavailable', async () => {
    pingDb.mockRejectedValue(new Error('db down'));
    pingRedis.mockRejectedValue(new Error('redis down'));
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ status: 'degraded', db: false, redis: false });
  });
});
