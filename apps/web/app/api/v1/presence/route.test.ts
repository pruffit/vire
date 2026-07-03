import { describe, it, expect, vi, beforeEach } from 'vitest';

const { recordSitePresence, rateLimit } = vi.hoisted(() => ({
  recordSitePresence: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
}));

vi.mock('@/lib/presence', () => ({ recordSitePresence }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: vi.fn(() => 'presence:test'),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));

import { POST } from './route';

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/v1/presence', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 });
});

describe('POST /api/v1/presence', () => {
  it('429 when rate-limited', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 60 });
    const res = await POST(postReq({ sessionId: 'a'.repeat(10) }));
    expect(res.status).toBe(429);
    expect(recordSitePresence).not.toHaveBeenCalled();
  });

  it('400 on invalid JSON', async () => {
    const req = new Request('http://localhost/api/v1/presence', { method: 'POST', body: 'not json' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('400 when sessionId is too short or too long', async () => {
    expect((await POST(postReq({ sessionId: 'short' }))).status).toBe(400);
    expect((await POST(postReq({ sessionId: 'a'.repeat(101) }))).status).toBe(400);
    expect(recordSitePresence).not.toHaveBeenCalled();
  });

  it('records presence and returns the online count', async () => {
    recordSitePresence.mockResolvedValue(7);
    const res = await POST(postReq({ sessionId: 'a'.repeat(10) }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ online: 7 });
  });

  it('degrades to online 0 when Redis throws', async () => {
    recordSitePresence.mockRejectedValue(new Error('redis down'));
    const res = await POST(postReq({ sessionId: 'a'.repeat(10) }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ online: 0 });
  });
});
