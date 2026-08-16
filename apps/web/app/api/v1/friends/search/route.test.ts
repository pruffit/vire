import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { friendSearchResponseSchema } from '@vire/api-contracts';

const { search, getStatuses } = vi.hoisted(() => ({
  search: vi.fn(),
  getStatuses: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  clientKey: vi.fn().mockReturnValue('user-search:1.2.3.4'),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/friends', () => ({
  friendshipService: () => ({ getStatuses }),
  userDirectoryService: () => ({ search }),
}));

import { auth } from '@/auth';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const mockedRateLimit = vi.mocked(rateLimit);
const mockedTooManyRequests = vi.mocked(tooManyRequests);

const SELF_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_ID = '11111111-1111-1111-1111-111111111111';

const req = (q: string) => new Request(`http://localhost/api/v1/friends/search?q=${encodeURIComponent(q)}`);

beforeEach(() => {
  vi.clearAllMocks();
  search.mockResolvedValue({ ok: true, value: [] });
  getStatuses.mockResolvedValue(new Map());
});

describe('GET /api/v1/friends/search', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req('ann'));
    expect(res.status).toBe(401);
    expect(search).not.toHaveBeenCalled();
  });

  it('429 when rate limited', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    mockedRateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 30 } as never);
    mockedTooManyRequests.mockReturnValueOnce(
      NextResponse.json({ error: 'Too many requests' }, { status: 429 }) as never,
    );
    const res = await GET(req('ann'));
    expect(res.status).toBe(429);
    expect(search).not.toHaveBeenCalled();
  });

  it('composes search + batch friendship statuses, never returns email', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    search.mockResolvedValue({
      ok: true,
      value: [
        { id: OTHER_ID, name: 'Аня', image: null },
      ],
    });
    getStatuses.mockResolvedValue(new Map([[OTHER_ID, 'OUTGOING']]));

    const res = await GET(req('ан'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      results: [{ id: OTHER_ID, name: 'Аня', image: null, status: 'OUTGOING' }],
    });
    expect(JSON.stringify(body)).not.toMatch(/email/i);
    expect(search).toHaveBeenCalledWith('ан', SELF_ID, expect.any(Number));
    expect(getStatuses).toHaveBeenCalledWith(SELF_ID, [OTHER_ID]);
  });

  it('defaults unknown status to NONE when missing from the batch map', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    search.mockResolvedValue({ ok: true, value: [{ id: OTHER_ID, name: 'Аня', image: null }] });
    getStatuses.mockResolvedValue(new Map());

    const res = await GET(req('ан'));
    const body = await res.json();
    expect(body.results[0].status).toBe('NONE');
  });

  it('ответ соответствует контракту поиска', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    search.mockResolvedValue({ ok: true, value: [{ id: OTHER_ID, name: 'Аня', image: null }] });
    getStatuses.mockResolvedValue(new Map([[OTHER_ID, 'FRIENDS']]));

    const body = await (await GET(req('ан'))).json();

    expect(friendSearchResponseSchema.safeParse(body).success).toBe(true);
  });
});
