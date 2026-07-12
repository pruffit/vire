import { describe, it, expect, vi, beforeEach } from 'vitest';

const { trackExists, getAggregateMoments, addMoment } = vi.hoisted(() => ({
  trackExists: vi.fn(),
  getAggregateMoments: vi.fn(),
  addMoment: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  clientKey: vi.fn().mockReturnValue('moments:1.2.3.4'),
  tooManyRequests: vi.fn(),
}));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleListenerTrackRepository: class {
    trackExists = trackExists;
    getAggregateMoments = getAggregateMoments;
    addMoment = addMoment;
  },
}));

import { auth } from '@/auth';
import { GET, POST } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = 'track-1';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function postReq(body: unknown): Request {
  return new Request(`http://localhost/api/v1/tracks/${TRACK_ID}/moments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/tracks/[id]/moments', () => {
  it('404 when the track does not exist', async () => {
    trackExists.mockResolvedValue(false);
    const res = await GET(new Request('http://localhost'), ctx);
    expect(res.status).toBe(404);
    expect(getAggregateMoments).not.toHaveBeenCalled();
  });

  it('returns the aggregate moments', async () => {
    trackExists.mockResolvedValue(true);
    getAggregateMoments.mockResolvedValue([{ positionSec: 30, count: 4 }]);
    const res = await GET(new Request('http://localhost'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ moments: [{ positionSec: 30, count: 4 }] });
  });
});

describe('POST /api/v1/tracks/[id]/moments', () => {
  it('400 on invalid body', async () => {
    trackExists.mockResolvedValue(true);
    const res = await POST(postReq({ positionSec: -1 }), ctx);
    expect(res.status).toBe(400);
    expect(addMoment).not.toHaveBeenCalled();
  });

  it('404 when the track does not exist', async () => {
    trackExists.mockResolvedValue(false);
    const res = await POST(postReq({ positionSec: 30 }), ctx);
    expect(res.status).toBe(404);
    expect(addMoment).not.toHaveBeenCalled();
  });

  it('allows an anonymous POST (no session)', async () => {
    mockedAuth.mockResolvedValue(null as never);
    trackExists.mockResolvedValue(true);
    const res = await POST(postReq({ positionSec: 30 }), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(addMoment).toHaveBeenCalledWith(TRACK_ID, 30, null);
  });

  it('passes the userId when authenticated', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    trackExists.mockResolvedValue(true);
    const res = await POST(postReq({ positionSec: 45 }), ctx);
    expect(res.status).toBe(200);
    expect(addMoment).toHaveBeenCalledWith(TRACK_ID, 45, 'u1');
  });
});
