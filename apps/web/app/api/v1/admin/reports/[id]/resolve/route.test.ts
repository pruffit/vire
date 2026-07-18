import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError } from '@vire/core';

const { resolve } = vi.hoisted(() => ({ resolve: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/reports', () => ({ reportService: () => ({ resolve }) }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

const MOD_ID = '22222222-2222-2222-2222-222222222222';
const REPORT_ID = '33333333-3333-3333-3333-333333333333';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request(`http://localhost/api/v1/admin/reports/${REPORT_ID}/resolve`, { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/admin/reports/[id]/resolve', () => {
  it('403 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req({ status: 'REVIEWED' }), ctx(REPORT_ID));
    expect(res.status).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('403 for a non-privileged role', async () => {
    mockedAuth.mockResolvedValue({ user: { id: MOD_ID, role: 'LISTENER' } } as never);
    const res = await POST(req({ status: 'REVIEWED' }), ctx(REPORT_ID));
    expect(res.status).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('400 on invalid status', async () => {
    mockedAuth.mockResolvedValue({ user: { id: MOD_ID, role: 'MODERATOR' } } as never);
    const res = await POST(req({ status: 'NOPE' }), ctx(REPORT_ID));
    expect(res.status).toBe(400);
  });

  it('404 when report not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: MOD_ID, role: 'MODERATOR' } } as never);
    resolve.mockResolvedValue({ ok: false, error: new NotFoundError('Report', REPORT_ID) });
    const res = await POST(req({ status: 'DISMISSED' }), ctx(REPORT_ID));
    expect(res.status).toBe(404);
  });

  it('resolves the report', async () => {
    mockedAuth.mockResolvedValue({ user: { id: MOD_ID, role: 'ADMIN' } } as never);
    resolve.mockResolvedValue({ ok: true, value: undefined });
    const res = await POST(req({ status: 'REVIEWED' }), ctx(REPORT_ID));
    expect(res.status).toBe(200);
    expect(resolve).toHaveBeenCalledWith(REPORT_ID, MOD_ID, 'REVIEWED');
  });
});
