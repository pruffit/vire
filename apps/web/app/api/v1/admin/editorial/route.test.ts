import { describe, it, expect, vi, beforeEach } from 'vitest';

const { generateAllEditorialPlaylists, insertAuditEntry } = vi.hoisted(() => ({
  generateAllEditorialPlaylists: vi.fn(),
  insertAuditEntry: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ generateAllEditorialPlaylists, insertAuditEntry }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
  generateAllEditorialPlaylists.mockResolvedValue(undefined);
  insertAuditEntry.mockResolvedValue(undefined);
});

describe('POST /api/v1/admin/editorial', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(generateAllEditorialPlaylists).not.toHaveBeenCalled();
  });

  it('403 for a non-admin role', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'MODERATOR' } } as never);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(generateAllEditorialPlaylists).not.toHaveBeenCalled();
  });

  it('403 for VIEWER — admin.jobs.run is ADMIN+, no more silent no-op', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'VIEWER' } } as never);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(generateAllEditorialPlaylists).not.toHaveBeenCalled();
    expect(insertAuditEntry).not.toHaveBeenCalled();
  });

  it('ADMIN triggers generation and writes an audit entry', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(generateAllEditorialPlaylists).toHaveBeenCalledTimes(1);
    expect(insertAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'u1', actorRole: 'ADMIN', permission: 'admin.jobs.run', action: 'editorial.generate',
    }));
  });

  it('a failed audit write does not change the response', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never);
    insertAuditEntry.mockRejectedValue(new Error('db down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    errorSpy.mockRestore();
  });

  it('SUPERADMIN triggers generation', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'SUPERADMIN' } } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(generateAllEditorialPlaylists).toHaveBeenCalledTimes(1);
  });
});
