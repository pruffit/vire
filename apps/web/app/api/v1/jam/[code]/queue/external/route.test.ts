import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError } from '@vire/core';

const { resolveCode, mutateQueue, addExternalItem, assertParticipant } = vi.hoisted(() => ({
  resolveCode: vi.fn(), mutateQueue: vi.fn(), addExternalItem: vi.fn(), assertParticipant: vi.fn(),
}));
const { resolveInput } = vi.hoisted(() => ({ resolveInput: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, mutateQueue, addExternalItem, assertParticipant }) }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));
vi.mock('@/lib/external', () => ({ externalResolveService: () => ({ resolve: resolveInput }) }));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { POST } from './route';

const mockedResolveIdentity = vi.mocked(resolveJamIdentity);
const TRACK_ID = '11111111-1111-1111-1111-111111111111';

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/queue/external', { method: 'POST', body: JSON.stringify(body) });

const ytRef = {
  source: 'YOUTUBE' as const, externalId: 'x', externalUrl: 'https://youtu.be/x',
  title: 'Song', artistName: 'Artist', coverUrl: null, durationSec: 180,
};

const party = { ok: true, value: { id: 'jam-1', kind: 'PARTY' } };

beforeEach(() => {
  vi.clearAllMocks();
  assertParticipant.mockResolvedValue({ ok: true, value: { id: 'p-1' } });
});

describe('POST /api/v1/jam/[code]/queue/external', () => {
  it('400 on an empty input', async () => {
    const res = await POST(req({ input: '' }), ctx('A2B3C4'));
    expect(res.status).toBe(400);
    expect(mockedResolveIdentity).not.toHaveBeenCalled();
  });

  it('401 on a forged/missing guest session', async () => {
    mockedResolveIdentity.mockResolvedValue(null);

    const res = await POST(req({ input: 'some song' }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveInput).not.toHaveBeenCalled();
  });

  it('404 when the jam code does not exist', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({ input: 'some song' }), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(resolveInput).not.toHaveBeenCalled();
  });

  it('a VIRE resolution adds the catalog track via mutateQueue and returns 201', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue(party);
    resolveInput.mockResolvedValue({ outcome: 'vire', trackId: TRACK_ID });
    mutateQueue.mockResolvedValue({ ok: true, value: { queue: [], version: 2 } });

    const res = await POST(req({ input: 'https://viremusic.ru/artists/x/releases/r/tracks/' + TRACK_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(201);
    expect(mutateQueue).toHaveBeenCalledWith('jam-1', { guestSessionId: 'g1' }, { kind: 'add', trackId: TRACK_ID });
    expect(addExternalItem).not.toHaveBeenCalled();
  });

  it('an EXTERNAL resolution adds via addExternalItem and returns 201', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue(party);
    resolveInput.mockResolvedValue({ outcome: 'external', ref: ytRef });
    addExternalItem.mockResolvedValue({ ok: true, value: { queue: [], version: 3 } });

    const res = await POST(req({ input: 'https://youtu.be/x' }), ctx('A2B3C4'));

    expect(res.status).toBe(201);
    expect(addExternalItem).toHaveBeenCalledWith('jam-1', { guestSessionId: 'g1' }, ytRef);
    expect(mutateQueue).not.toHaveBeenCalled();
  });

  it('an ambiguous resolution returns 200 with candidates, not an error', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue(party);
    const candidates = [{ kind: 'HINT', hint: { title: 'X', artistName: 'Y', coverUrl: null, durationSec: null } }];
    resolveInput.mockResolvedValue({ outcome: 'candidates', candidates });

    const res = await POST(req({ input: 'gibberish' }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ candidates });
    expect(mutateQueue).not.toHaveBeenCalled();
    expect(addExternalItem).not.toHaveBeenCalled();
  });

  it('400 в обычном джеме — и до резолва дело не доходит (сеть и квота не тратятся)', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1', kind: 'JAM' } });

    const res = await POST(req({ input: 'https://youtu.be/x' }), ctx('A2B3C4'));

    expect(res.status).toBe(400);
    expect(resolveInput).not.toHaveBeenCalled();
  });

  it('403 непричастному — тоже до резолва', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'ghost' });
    resolveCode.mockResolvedValue(party);
    assertParticipant.mockResolvedValue({ ok: false, error: new ForbiddenError('Вы не участник этого джема') });

    const res = await POST(req({ input: 'https://youtu.be/x' }), ctx('A2B3C4'));

    expect(res.status).toBe(403);
    expect(resolveInput).not.toHaveBeenCalled();
  });

  it('409 when the queue is full', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue(party);
    resolveInput.mockResolvedValue({ outcome: 'external', ref: ytRef });
    addExternalItem.mockResolvedValue({ ok: false, error: new ConflictError('Очередь переполнена') });

    const res = await POST(req({ input: 'https://youtu.be/x' }), ctx('A2B3C4'));

    expect(res.status).toBe(409);
  });
});
