import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '@vire/core';

const { resolveCode, addExternalItem } = vi.hoisted(() => ({ resolveCode: vi.fn(), addExternalItem: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, addExternalItem }) }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { POST } from './route';

const mockedResolveIdentity = vi.mocked(resolveJamIdentity);

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/queue/local', { method: 'POST', body: JSON.stringify(body) });

const party = { ok: true, value: { id: 'jam-1', kind: 'PARTY' } };

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/queue/local', () => {
  it('400 без fileId/title', async () => {
    const res = await POST(req({ fileId: '', title: '' }), ctx('A2B3C4'));
    expect(res.status).toBe(400);
    expect(mockedResolveIdentity).not.toHaveBeenCalled();
  });

  it('401 без валидной идентичности', async () => {
    mockedResolveIdentity.mockResolvedValue(null);

    const res = await POST(req({ fileId: 'local-1', title: 'Track' }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(addExternalItem).not.toHaveBeenCalled();
  });

  it('404 когда код джема не найден', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({ fileId: 'local-1', title: 'Track' }), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(addExternalItem).not.toHaveBeenCalled();
  });

  it('добавляет LOCAL-позицию и возвращает 201', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue(party);
    addExternalItem.mockResolvedValue({ ok: true, value: { queue: [], version: 2 } });

    const res = await POST(req({ fileId: 'local-1', title: 'My Track', durationSec: 180 }), ctx('A2B3C4'));

    expect(res.status).toBe(201);
    expect(addExternalItem).toHaveBeenCalledWith('jam-1', { guestSessionId: 'g1' }, {
      source: 'LOCAL', externalId: 'local-1', externalUrl: null, title: 'My Track', artistName: '', coverUrl: null, durationSec: 180,
    });
  });

  it('400 в обычном джеме (гард живёт в JamService.addExternalItem)', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1', kind: 'JAM' } });
    addExternalItem.mockResolvedValue({ ok: false, error: new ValidationError('Внешние треки доступны только в режиме вечеринки') });

    const res = await POST(req({ fileId: 'local-1', title: 'Track' }), ctx('A2B3C4'));

    expect(res.status).toBe(400);
  });

  it('403 непричастному', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'ghost' });
    resolveCode.mockResolvedValue(party);
    addExternalItem.mockResolvedValue({ ok: false, error: new ForbiddenError('Вы не участник этого джема') });

    const res = await POST(req({ fileId: 'local-1', title: 'Track' }), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('409 когда очередь переполнена', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue(party);
    addExternalItem.mockResolvedValue({ ok: false, error: new ConflictError('Очередь переполнена') });

    const res = await POST(req({ fileId: 'local-1', title: 'Track' }), ctx('A2B3C4'));

    expect(res.status).toBe(409);
  });
});
