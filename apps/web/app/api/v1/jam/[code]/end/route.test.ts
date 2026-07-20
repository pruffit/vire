import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError } from '@vire/core';

const { resolveCode, endJam } = vi.hoisted(() => ({ resolveCode: vi.fn(), endJam: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, endJam }) }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = () => new Request('http://localhost/api/v1/jam/A2B3C4/end', { method: 'POST' });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/end', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);

    const res = await POST(req(), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1' } } as never);
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req(), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(endJam).not.toHaveBeenCalled();
  });

  it('403 when the caller is not the host', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'someone-else' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    endJam.mockResolvedValue({ ok: false, error: new ForbiddenError('Только хост может завершить джем') });

    const res = await POST(req(), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('ends the jam as the host', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    endJam.mockResolvedValue({ ok: true, value: undefined });

    const res = await POST(req(), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    expect(endJam).toHaveBeenCalledWith('jam-1', 'host-1');
  });
});
