import { describe, it, expect, vi, beforeEach } from 'vitest';

const { suggest, tasteSuggestions } = vi.hoisted(() => ({ suggest: vi.fn(), tasteSuggestions: vi.fn() }));
vi.mock('@/lib/external', () => ({ externalResolveService: () => ({ suggest }) }));
vi.mock('@/lib/external/taste-suggestions', () => ({ tasteSuggestions }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { GET } from './route';

const mockedResolveIdentity = vi.mocked(resolveJamIdentity);

const req = (query: string) => new Request(`http://localhost/api/v1/party/suggest${query}`);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/party/suggest', () => {
  it('401 without a resolvable identity', async () => {
    mockedResolveIdentity.mockResolvedValue(null);
    const res = await GET(req('?q=song'));
    expect(res.status).toBe(401);
    expect(suggest).not.toHaveBeenCalled();
  });

  it('returns candidates for an authenticated user', async () => {
    mockedResolveIdentity.mockResolvedValue({ userId: 'u1' });
    const candidates = [{ kind: 'VIRE', trackId: 't1', title: 'X', artistName: 'Y', coverUrl: null }];
    suggest.mockResolvedValue(candidates);

    const res = await GET(req('?q=Кино'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ candidates });
    expect(suggest).toHaveBeenCalledWith('Кино', 8);
  });

  it('a guest passes sessionId through resolveJamIdentity', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });
    suggest.mockResolvedValue([]);

    await GET(req('?q=song&sessionId=g1.sig'));

    expect(mockedResolveIdentity).toHaveBeenCalledWith('g1.sig');
  });

  it('without q, a guest gets empty candidates without touching taste suggestions', async () => {
    mockedResolveIdentity.mockResolvedValue({ guestSessionId: 'g1' });

    const res = await GET(req(''));

    expect(await res.json()).toEqual({ candidates: [] });
    expect(tasteSuggestions).not.toHaveBeenCalled();
  });

  it('without q, an authenticated user gets Last.fm taste suggestions', async () => {
    mockedResolveIdentity.mockResolvedValue({ userId: 'u1' });
    const hints = [{ kind: 'HINT', hint: { title: 'X', artistName: 'Y', coverUrl: null, durationSec: null } }];
    tasteSuggestions.mockResolvedValue(hints);

    const res = await GET(req('?q='));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ candidates: hints });
    expect(tasteSuggestions).toHaveBeenCalledWith('u1', 8);
    expect(suggest).not.toHaveBeenCalled();
  });
});
