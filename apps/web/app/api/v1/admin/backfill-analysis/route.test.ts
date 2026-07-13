import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listTracksNeedingAnalysis, analyzeAdd } = vi.hoisted(() => ({
  listTracksNeedingAnalysis: vi.fn(),
  analyzeAdd: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ listTracksNeedingAnalysis }));
vi.mock('@/lib/queue', () => ({ analyzeQueue: { add: analyzeAdd } }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const TRACKS = [
  { trackId: 't1', flacKey: 'vault/tracks/t1/source.flac' },
  { trackId: 't2', flacKey: 'vault/tracks/t2/source.flac' },
];

beforeEach(() => {
  vi.clearAllMocks();
  listTracksNeedingAnalysis.mockResolvedValue(TRACKS);
});

describe('POST /api/v1/admin/backfill-analysis', () => {
  // Роут не различает анонима и не-админа: обе ветки схлопываются в один
  // Forbidden-ответ (нет отдельного 401 для отсутствующей сессии).
  it('403 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(listTracksNeedingAnalysis).not.toHaveBeenCalled();
    expect(analyzeAdd).not.toHaveBeenCalled();
  });

  it('403 for a non-admin role', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'LISTENER' } } as never);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(listTracksNeedingAnalysis).not.toHaveBeenCalled();
  });

  it('VIEWER is a silent no-op: 200 with queued:0, nothing enqueued', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'VIEWER' } } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ queued: 0 });
    expect(listTracksNeedingAnalysis).not.toHaveBeenCalled();
    expect(analyzeAdd).not.toHaveBeenCalled();
  });

  it('ADMIN enqueues all tracks needing analysis', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ queued: 2 });
    expect(analyzeAdd).toHaveBeenCalledTimes(2);
    expect(analyzeAdd).toHaveBeenCalledWith(TRACKS[0]);
    expect(analyzeAdd).toHaveBeenCalledWith(TRACKS[1]);
  });

  it('SUPERADMIN enqueues all tracks needing analysis', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'SUPERADMIN' } } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ queued: 2 });
    expect(analyzeAdd).toHaveBeenCalledTimes(2);
  });
});
