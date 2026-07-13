import { describe, it, expect, vi, beforeEach } from 'vitest';

const { generateAllEditorialPlaylists } = vi.hoisted(() => ({
  generateAllEditorialPlaylists: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ generateAllEditorialPlaylists }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
  generateAllEditorialPlaylists.mockResolvedValue(undefined);
});

describe('POST /api/v1/admin/editorial', () => {
  // Как и backfill-analysis: анонима и не-админа роут не различает — оба 403.
  it('403 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(generateAllEditorialPlaylists).not.toHaveBeenCalled();
  });

  it('403 for a non-admin role', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'MODERATOR' } } as never);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(generateAllEditorialPlaylists).not.toHaveBeenCalled();
  });

  it('VIEWER is a silent no-op: 200 ok without generating', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'VIEWER' } } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(generateAllEditorialPlaylists).not.toHaveBeenCalled();
  });

  it('ADMIN triggers generation', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(generateAllEditorialPlaylists).toHaveBeenCalledTimes(1);
  });

  it('SUPERADMIN triggers generation', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'SUPERADMIN' } } as never);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(generateAllEditorialPlaylists).toHaveBeenCalledTimes(1);
  });
});
