import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { deletePendingGuestByEmail, rateLimit } = vi.hoisted(() => ({
  deletePendingGuestByEmail: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
}));

vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePresaveRepository: class {
    deletePendingGuestByEmail = deletePendingGuestByEmail;
  },
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: vi.fn(() => 'presave-unsub:test'),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));

import { GET } from './route';
import { signUnsubscribeToken } from '@/lib/presave-unsubscribe';

const EMAIL = 'fan@example.com';
const savedSecret = process.env.AUTH_SECRET;

function reqFor(email: string, sig: string): Request {
  const url = new URL('http://localhost/api/v1/presave/unsubscribe');
  url.searchParams.set('email', email);
  url.searchParams.set('sig', sig);
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 });
  process.env.AUTH_SECRET = 'test-secret';
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = savedSecret;
});

describe('GET /api/v1/presave/unsubscribe', () => {
  it('429 when rate-limited', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 60 });
    const res = await GET(reqFor(EMAIL, 'whatever'));
    expect(res.status).toBe(429);
    expect(deletePendingGuestByEmail).not.toHaveBeenCalled();
  });

  it('redirects to the bad-link page on a malformed request (bad email / missing sig)', async () => {
    const res = await GET(reqFor('not-an-email', 'whatever'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/presave/unsubscribed?status=bad');
    expect(deletePendingGuestByEmail).not.toHaveBeenCalled();
  });

  it('redirects to the bad-link page on an invalid signature', async () => {
    const res = await GET(reqFor(EMAIL, 'deadbeef'.repeat(4)));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/presave/unsubscribed?status=bad');
    expect(deletePendingGuestByEmail).not.toHaveBeenCalled();
  });

  it('deletes pending guest presaves and redirects to the ok page on a valid signature', async () => {
    const sig = signUnsubscribeToken(EMAIL)!;
    deletePendingGuestByEmail.mockResolvedValue(2);
    const res = await GET(reqFor(EMAIL, sig));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/presave/unsubscribed?status=ok');
    expect(deletePendingGuestByEmail).toHaveBeenCalledWith(EMAIL);
  });

  it('lowercases the email before verifying and deleting', async () => {
    const sig = signUnsubscribeToken(EMAIL)!;
    deletePendingGuestByEmail.mockResolvedValue(1);
    const res = await GET(reqFor('Fan@Example.com', sig));
    expect(res.status).toBe(303);
    expect(deletePendingGuestByEmail).toHaveBeenCalledWith(EMAIL);
  });
});
