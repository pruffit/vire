import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listTracksNeedingAnalysis, analyzeAdd, insertAuditEntry } = vi.hoisted(() => ({
  listTracksNeedingAnalysis: vi.fn(),
  analyzeAdd: vi.fn(),
  insertAuditEntry: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ listTracksNeedingAnalysis, insertAuditEntry }));
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
  insertAuditEntry.mockResolvedValue(undefined);
});

describe('POST /api/v1/admin/backfill-analysis', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(listTracksNeedingAnalysis).not.toHaveBeenCalled();
    expect(analyzeAdd).not.toHaveBeenCalled();
  });

  it('403 for a non-admin role', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'LISTENER' } } as never);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(listTracksNeedingAnalysis).not.toHaveBeenCalled();
  });

  it('403 for VIEWER — admin.jobs.run is ADMIN+, no more silent no-op', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'VIEWER' } } as never);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(listTracksNeedingAnalysis).not.toHaveBeenCalled();
    expect(analyzeAdd).not.toHaveBeenCalled();
    expect(insertAuditEntry).not.toHaveBeenCalled();
  });

  it('ADMIN enqueues all tracks needing analysis and writes an audit entry', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ queued: 2 });
    expect(analyzeAdd).toHaveBeenCalledTimes(2);
    expect(analyzeAdd).toHaveBeenCalledWith(TRACKS[0]);
    expect(analyzeAdd).toHaveBeenCalledWith(TRACKS[1]);
    expect(insertAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'u1', actorRole: 'ADMIN', permission: 'admin.jobs.run', action: 'analysis.backfill',
    }));
  });

  it('SUPERADMIN enqueues all tracks needing analysis', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'SUPERADMIN' } } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ queued: 2 });
    expect(analyzeAdd).toHaveBeenCalledTimes(2);
  });

  it('a failed audit write does not change the response', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never);
    insertAuditEntry.mockRejectedValue(new Error('db down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ queued: 2 });
    errorSpy.mockRestore();
  });
});
