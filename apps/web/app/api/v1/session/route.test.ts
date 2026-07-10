import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { rateLimit } = vi.hoisted(() => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: vi.fn(() => 'session:test'),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));

import { POST } from './route';

function postReq(): Request {
  return new Request('http://localhost/api/v1/session', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 });
});

describe('POST /api/v1/session', () => {
  it('429 when rate-limited', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 60 });
    const res = await POST(postReq());
    expect(res.status).toBe(429);
  });

  it('issues a fresh sessionId each call', async () => {
    const res1 = await POST(postReq());
    const res2 = await POST(postReq());
    const { sessionId: id1 } = await res1.json();
    const { sessionId: id2 } = await res2.json();
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
    expect(id1).not.toBe(id2);
  });

  describe('when a signing secret is configured', () => {
    const savedSecret = process.env.AUTH_SECRET;

    beforeEach(() => {
      process.env.AUTH_SECRET = 'test-secret';
    });

    afterEach(() => {
      if (savedSecret === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = savedSecret;
    });

    it('returns a signed id in the "<id>.<sig>" shape', async () => {
      const res = await POST(postReq());
      const { sessionId } = await res.json();
      expect(sessionId.split('.')).toHaveLength(2);
    });
  });
});
