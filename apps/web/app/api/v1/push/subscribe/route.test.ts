import { describe, it, expect, vi, beforeEach } from 'vitest';

const { upsertPushSubscription, deletePushSubscription } = vi.hoisted(() => ({
  upsertPushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ upsertPushSubscription, deletePushSubscription }));

import { auth } from '@/auth';

const mockedAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
  process.env.VAPID_PUBLIC_KEY = 'vapid-public-key';
});

describe('POST /api/v1/push/subscribe', () => {
  it('без сессии → 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const { POST } = await import('./route');
    const res = await POST(new Request('http://x', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
    expect(upsertPushSubscription).not.toHaveBeenCalled();
  });

  it('без VAPID_PUBLIC_KEY → 503', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const { POST } = await import('./route');
    const body = { endpoint: 'https://push/abc', keys: { p256dh: 'k', auth: 'a' } };
    const res = await POST(
      new Request('http://x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(503);
    expect(upsertPushSubscription).not.toHaveBeenCalled();
  });

  it('невалидное тело → 400', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      new Request('http://x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'not-a-url' }),
      }),
    );
    expect(res.status).toBe(400);
    expect(upsertPushSubscription).not.toHaveBeenCalled();
  });

  it('валидной подписки → 200 + upsert', async () => {
    const { POST } = await import('./route');
    const body = { endpoint: 'https://push/abc', keys: { p256dh: 'k', auth: 'a' } };
    const res = await POST(
      new Request('http://x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertPushSubscription).toHaveBeenCalledWith('user-1', {
      endpoint: 'https://push/abc',
      p256dh: 'k',
      auth: 'a',
    });
  });
});

describe('DELETE /api/v1/push/subscribe', () => {
  it('без сессии → 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const { DELETE } = await import('./route');
    const res = await DELETE(
      new Request('http://x', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://push/abc' }),
      }),
    );
    expect(res.status).toBe(401);
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });

  it('невалидный endpoint → 400', async () => {
    const { DELETE } = await import('./route');
    const res = await DELETE(
      new Request('http://x', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'not-a-url' }),
      }),
    );
    expect(res.status).toBe(400);
    expect(deletePushSubscription).not.toHaveBeenCalled();
  });

  it('удаляет по endpoint → 200', async () => {
    const { DELETE } = await import('./route');
    const res = await DELETE(
      new Request('http://x', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://push/abc' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(deletePushSubscription).toHaveBeenCalledWith('https://push/abc');
  });
});
