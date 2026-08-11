import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSystemMetrics, getAdminHealth, countSiteOnline } = vi.hoisted(() => ({
  getSystemMetrics: vi.fn(),
  getAdminHealth: vi.fn(),
  countSiteOnline: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/system-metrics', () => ({ getSystemMetrics }));
vi.mock('@/lib/admin-health', () => ({ getAdminHealth }));
vi.mock('@/lib/presence', () => ({ countSiteOnline }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const SYSTEM = { memUsedPct: 40 };
const HEALTH = { dbLatencyMs: 3, redisLatencyMs: 1, liveListeners: 0, queues: [] };

beforeEach(() => {
  vi.clearAllMocks();
  getSystemMetrics.mockResolvedValue(SYSTEM);
  getAdminHealth.mockResolvedValue(HEALTH);
  countSiteOnline.mockResolvedValue(5);
});

describe('GET /api/v1/admin/system', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(getSystemMetrics).not.toHaveBeenCalled();
  });

  it('403 for a non-admin role', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'LISTENER' } } as never);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(getSystemMetrics).not.toHaveBeenCalled();
  });

  it('VIEWER is allowed through (read-only admin role)', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'VIEWER' } } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ system: SYSTEM, health: HEALTH, siteOnline: 5, ts: expect.any(Number) });
  });

  it('ADMIN gets the full system snapshot', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ system: SYSTEM, health: HEALTH, siteOnline: 5 });
    expect(typeof body.ts).toBe('number');
  });
});
