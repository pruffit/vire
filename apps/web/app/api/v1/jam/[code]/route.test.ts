import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ValidationError } from '@vire/core';

const { resolveCode, getState } = vi.hoisted(() => ({ resolveCode: vi.fn(), getState: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, getState }) }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { GET } from './route';

const mockedResolve = vi.mocked(resolveJamIdentity);

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (qs = '') => new Request(`http://localhost/api/v1/jam/A2B3C4${qs}`);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/jam/[code]', () => {
  it('401 with no session and no valid guest sessionId', async () => {
    mockedResolve.mockResolvedValue(null);

    const res = await GET(req(), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('reads sessionId from the query string', async () => {
    mockedResolve.mockResolvedValue(null);

    await GET(req('?sessionId=g1.sig'), ctx('A2B3C4'));

    expect(mockedResolve).toHaveBeenCalledWith('g1.sig');
  });

  it('400 on a malformed code', async () => {
    mockedResolve.mockResolvedValue({ userId: 'u1' });
    resolveCode.mockResolvedValue({ ok: false, error: new ValidationError('Неверный код джема') });

    const res = await GET(req(), ctx('bad'));

    expect(res.status).toBe(400);
  });

  it('404 when the code does not exist', async () => {
    mockedResolve.mockResolvedValue({ userId: 'u1' });
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await GET(req(), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(getState).not.toHaveBeenCalled();
  });

  it('403 when the caller is not a participant', async () => {
    mockedResolve.mockResolvedValue({ userId: 'u1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1', code: 'A2B3C4' } });
    getState.mockResolvedValue({ ok: false, error: new ForbiddenError('Вы не участник этого джема') });

    const res = await GET(req(), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('returns the full jam state for a participant', async () => {
    mockedResolve.mockResolvedValue({ userId: 'u1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1', code: 'A2B3C4' } });
    const state = { session: { id: 'jam-1' }, participants: [], queue: [], playback: null };
    getState.mockResolvedValue({ ok: true, value: state });

    const res = await GET(req(), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(state);
    expect(getState).toHaveBeenCalledWith('jam-1', { userId: 'u1' });
  });
});
