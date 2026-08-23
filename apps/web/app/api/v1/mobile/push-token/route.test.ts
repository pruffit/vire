import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getCaller: vi.fn(),
  upsertExpoPushToken: vi.fn(),
  deleteExpoPushToken: vi.fn(),
}));

vi.mock('@/lib/caller', () => ({ getCaller: h.getCaller }));
vi.mock('@vire/db', () => ({
  upsertExpoPushToken: h.upsertExpoPushToken,
  deleteExpoPushToken: h.deleteExpoPushToken,
}));

import { POST, DELETE } from './route';

const CALLER = { id: 'user-1', role: 'LISTENER', source: 'session', deviceId: null };

beforeEach(() => {
  vi.clearAllMocks();
  h.getCaller.mockResolvedValue(CALLER);
});

describe('POST /api/v1/mobile/push-token', () => {
  it('без актора → 401', async () => {
    h.getCaller.mockResolvedValue(null);
    const res = await POST(new Request('http://x', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
    expect(h.upsertExpoPushToken).not.toHaveBeenCalled();
  });

  it('невалидное тело → 400', async () => {
    const res = await POST(
      new Request('http://x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '', platform: 'ios' }),
      }),
    );
    expect(res.status).toBe(400);
    expect(h.upsertExpoPushToken).not.toHaveBeenCalled();
  });

  it('валидный токен → 200 + upsert', async () => {
    const body = { token: 'ExponentPushToken[abc]', platform: 'android' };
    const res = await POST(
      new Request('http://x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(200);
    expect(h.upsertExpoPushToken).toHaveBeenCalledWith('user-1', {
      token: 'ExponentPushToken[abc]',
      platform: 'android',
      deviceId: undefined,
    });
  });

  it('с deviceId → пробрасывает его в upsert', async () => {
    const deviceId = '11111111-1111-1111-1111-111111111111';
    const body = { token: 'ExponentPushToken[abc]', platform: 'ios', deviceId };
    const res = await POST(
      new Request('http://x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(200);
    expect(h.upsertExpoPushToken).toHaveBeenCalledWith('user-1', {
      token: 'ExponentPushToken[abc]',
      platform: 'ios',
      deviceId,
    });
  });
});

describe('DELETE /api/v1/mobile/push-token', () => {
  it('без актора → 401', async () => {
    h.getCaller.mockResolvedValue(null);
    const res = await DELETE(
      new Request('http://x', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'ExponentPushToken[abc]' }),
      }),
    );
    expect(res.status).toBe(401);
    expect(h.deleteExpoPushToken).not.toHaveBeenCalled();
  });

  it('невалидное тело → 400', async () => {
    const res = await DELETE(
      new Request('http://x', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' }),
      }),
    );
    expect(res.status).toBe(400);
    expect(h.deleteExpoPushToken).not.toHaveBeenCalled();
  });

  it('удаляет по токену → 200', async () => {
    const res = await DELETE(
      new Request('http://x', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'ExponentPushToken[abc]' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(h.deleteExpoPushToken).toHaveBeenCalledWith('user-1', 'ExponentPushToken[abc]');
  });
});
