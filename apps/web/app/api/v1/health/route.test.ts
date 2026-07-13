import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ping, pingRedis } = vi.hoisted(() => ({
  ping: vi.fn(),
  pingRedis: vi.fn(),
}));

vi.mock('@vire/db', () => ({ ping }));
vi.mock('@/lib/presence', () => ({ pingRedis }));

import { GET } from './route';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/health', () => {
  it('200 ok when the db and redis are both connected', async () => {
    ping.mockResolvedValue(undefined);
    pingRedis.mockResolvedValue(2);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok', db: 'connected', redis: 'connected' });
  });

  it('200 ok with redis flagged disconnected when redis is unavailable (redis is signal-only)', async () => {
    ping.mockResolvedValue(undefined);
    pingRedis.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok', db: 'connected', redis: 'disconnected' });
  });

  it('503 when the db is unavailable (db is critical)', async () => {
    ping.mockRejectedValue(new Error('db down'));
    pingRedis.mockResolvedValue(2);
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: 'error', db: 'disconnected', redis: 'connected' });
  });

  it('503 when both the db and redis are unavailable', async () => {
    ping.mockRejectedValue(new Error('db down'));
    pingRedis.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: 'error', db: 'disconnected', redis: 'disconnected' });
  });
});
