import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { updateUserNotifyEmail, rateLimit } = vi.hoisted(() => ({
  updateUserNotifyEmail: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
}));

vi.mock('@vire/db', () => ({ updateUserNotifyEmail }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: vi.fn(() => 'notify-unsub:test'),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));

import { GET, POST } from './route';
import { signNotifyUnsub } from '@vire/core/notifications/unsubscribe';

const UID = 'user-1';
const savedSecret = process.env.AUTH_SECRET;

function reqFor(method: 'GET' | 'POST', uid: string, token: string, init?: RequestInit): Request {
  const url = new URL('http://localhost/api/v1/notifications/unsubscribe');
  url.searchParams.set('uid', uid);
  url.searchParams.set('token', token);
  return new Request(url, { method, ...init });
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

describe('GET /api/v1/notifications/unsubscribe', () => {
  it('429 when rate-limited', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 60 });
    const res = await GET(reqFor('GET', UID, 'whatever'));
    expect(res.status).toBe(429);
    expect(updateUserNotifyEmail).not.toHaveBeenCalled();
  });

  it('valid token -> 303 redirect to confirm page, no mutation', async () => {
    const token = signNotifyUnsub('test-secret', UID);
    const res = await GET(reqFor('GET', UID, token));
    expect(res.status).toBe(303);
    const location = res.headers.get('location')!;
    expect(location).toContain('/notifications/unsubscribe');
    expect(location).toContain(`uid=${UID}`);
    expect(location).toContain(`token=${token}`);
    expect(updateUserNotifyEmail).not.toHaveBeenCalled();
  });

  it('invalid token -> redirect to bad-link state, no mutation', async () => {
    const res = await GET(reqFor('GET', UID, 'deadbeef'.repeat(4)));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('status=bad');
    expect(updateUserNotifyEmail).not.toHaveBeenCalled();
  });

  it('missing uid/token -> redirect to bad-link state, no mutation', async () => {
    const res = await GET(reqFor('GET', '', ''));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('status=bad');
    expect(updateUserNotifyEmail).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/notifications/unsubscribe', () => {
  it('429 when rate-limited', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 60 });
    const res = await POST(reqFor('POST', UID, 'whatever'));
    expect(res.status).toBe(429);
    expect(updateUserNotifyEmail).not.toHaveBeenCalled();
  });

  it('valid token -> 200 and updates notify_email to false', async () => {
    const token = signNotifyUnsub('test-secret', UID);
    const res = await POST(reqFor('POST', UID, token));
    expect(res.status).toBe(200);
    expect(updateUserNotifyEmail).toHaveBeenCalledWith(UID, false);
  });

  it('invalid token -> 400, no update', async () => {
    const res = await POST(reqFor('POST', UID, 'deadbeef'.repeat(4)));
    expect(res.status).toBe(400);
    expect(updateUserNotifyEmail).not.toHaveBeenCalled();
  });

  it('missing uid/token -> 400, no update', async () => {
    const res = await POST(reqFor('POST', '', ''));
    expect(res.status).toBe(400);
    expect(updateUserNotifyEmail).not.toHaveBeenCalled();
  });

  it('one-click POST body (RFC 8058) with uid/token in the URL still unsubscribes', async () => {
    const token = signNotifyUnsub('test-secret', UID);
    const res = await POST(reqFor('POST', UID, token, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    }));
    expect(res.status).toBe(200);
    expect(updateUserNotifyEmail).toHaveBeenCalledWith(UID, false);
  });
});
