import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictError } from '@vire/core';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/jam', () => ({ jamService: () => ({ create }) }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

const req = (body: unknown) => new Request('http://localhost/api/v1/jam', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req({ title: 'Party' }));
    expect(res.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it('400 on invalid body', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1', name: 'Danya' } } as never);
    const res = await POST(req({ title: '' }));
    expect(res.status).toBe(400);
  });

  it('409 when the service cannot generate a unique code', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1', name: 'Danya' } } as never);
    create.mockResolvedValue({ ok: false, error: new ConflictError('Не удалось сгенерировать код джема') });
    const res = await POST(req({}));
    expect(res.status).toBe(409);
  });

  it('creates a jam and returns code + jamId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1', name: 'Danya' } } as never);
    create.mockResolvedValue({ ok: true, value: { id: 'jam-1', code: 'A2B3C4' } });

    const res = await POST(req({ title: 'Party' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ code: 'A2B3C4', jamId: 'jam-1' });
    expect(create).toHaveBeenCalledWith('host-1', 'Party', 'Danya', 'SYNCED', 'JAM');
  });

  it('falls back to a default host name when the session has none', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1', name: null } } as never);
    create.mockResolvedValue({ ok: true, value: { id: 'jam-1', code: 'A2B3C4' } });

    await POST(req({}));

    expect(create).toHaveBeenCalledWith('host-1', null, 'Хост', 'SYNCED', 'JAM');
  });

  it('forwards an explicit SPEAKER mode to the service', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1', name: 'Danya' } } as never);
    create.mockResolvedValue({ ok: true, value: { id: 'jam-1', code: 'A2B3C4' } });

    await POST(req({ mode: 'SPEAKER' }));

    expect(create).toHaveBeenCalledWith('host-1', null, 'Danya', 'SPEAKER', 'JAM');
  });

  it('forwards an explicit PARTY kind to the service', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1', name: 'Danya' } } as never);
    create.mockResolvedValue({ ok: true, value: { id: 'jam-1', code: 'A2B3C4' } });

    await POST(req({ kind: 'PARTY' }));

    expect(create).toHaveBeenCalledWith('host-1', null, 'Danya', 'SYNCED', 'PARTY');
  });

  it('400 on an invalid kind', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1', name: 'Danya' } } as never);
    const res = await POST(req({ kind: 'BOGUS' }));
    expect(res.status).toBe(400);
  });
});
