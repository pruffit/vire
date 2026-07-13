import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const { handlerGet, handlerPost, rateLimit } = vi.hoisted(() => ({
  handlerGet: vi.fn(),
  handlerPost: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock('@/auth', () => ({ handlers: { GET: handlerGet, POST: handlerPost } }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: vi.fn(() => 'auth:127.0.0.1'),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));

import { GET, POST } from './route';

function req(method: string): NextRequest {
  return new Request('http://localhost/api/auth/callback/credentials', { method }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, remaining: 9, retryAfter: 0 });
});

describe('GET /api/auth/[...nextauth]', () => {
  it('is the raw NextAuth handler, unrated', async () => {
    expect(GET).toBe(handlerGet);
    expect(rateLimit).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/[...nextauth]', () => {
  it('429 when rate-limited', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 60 });
    const res = await POST(req('POST'));
    expect(res.status).toBe(429);
    expect(handlerPost).not.toHaveBeenCalled();
  });

  it('delegates to the NextAuth handler when within the limit', async () => {
    handlerPost.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const request = req('POST');
    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(handlerPost).toHaveBeenCalledWith(request);
  });
});
