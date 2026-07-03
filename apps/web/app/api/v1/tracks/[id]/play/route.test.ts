import { describe, it, expect, vi, beforeEach } from 'vitest';

const { playAdd, rateLimit } = vi.hoisted(() => ({
  playAdd: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/queue', () => ({ playEventQueue: { add: playAdd } }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: vi.fn(() => 'play:test'),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = 'track-1';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function makeReq(body: unknown): Request {
  return new Request(`http://localhost/api/v1/tracks/${TRACK_ID}/play`, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const validBody = {
  sessionId: 'sid-123',
  source: 'feed',
  durationPlayedSec: 42,
  startedAt: new Date('2026-06-07T10:00:00Z').toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 });
});

describe('POST /api/v1/tracks/[id]/play', () => {
  it('429 when rate-limited', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 60 });
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(makeReq(validBody), ctx);
    expect(res.status).toBe(429);
    expect(playAdd).not.toHaveBeenCalled();
  });

  it('400 when the body is not JSON', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(makeReq(undefined), ctx);
    expect(res.status).toBe(400);
    expect(playAdd).not.toHaveBeenCalled();
  });

  it('400 when required fields are invalid', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(makeReq({ ...validBody, sessionId: '' }), ctx);
    expect(res.status).toBe(400);
    expect(playAdd).not.toHaveBeenCalled();
  });

  it('400 on a non-integer duration', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(makeReq({ ...validBody, durationPlayedSec: 1.5 }), ctx);
    expect(res.status).toBe(400);
  });

  it('enqueues a play event for an anonymous listener (userId null)', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(makeReq(validBody), ctx);
    expect(res.status).toBe(200);
    expect(playAdd).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: TRACK_ID, sessionId: 'sid-123', source: 'feed', userId: null }),
    );
  });

  it('records the userId when authenticated and defaults an unknown source to direct', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(makeReq({ ...validBody, source: 'bogus' }), ctx);
    expect(res.status).toBe(200);
    expect(playAdd).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', source: 'direct' }),
    );
  });

  it('accepts "wave" as a valid PLAY_SOURCES value', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(makeReq({ ...validBody, source: 'wave' }), ctx);
    expect(res.status).toBe(200);
    expect(playAdd).toHaveBeenCalledWith(expect.objectContaining({ source: 'wave' }));
  });
});
