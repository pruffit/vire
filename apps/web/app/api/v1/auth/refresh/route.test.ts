import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from '@vire/core';

const h = vi.hoisted(() => ({
  refresh: vi.fn(),
  clearDeviceStateCache: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/device-auth', () => ({ deviceAuthService: () => ({ refresh: h.refresh }) }));
vi.mock('@/lib/caller', () => ({ clearDeviceStateCache: h.clearDeviceStateCache }));
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>();
  return { ...actual, rateLimit: h.rateLimit };
});

import { POST } from './route';

function req(body: unknown) {
  return new Request('https://vire.test/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.rateLimit.mockResolvedValue({ ok: true });
});

describe('POST /api/v1/auth/refresh', () => {
  it('меняет пару и не кэширует ответ', async () => {
    h.refresh.mockResolvedValue({ ok: true, value: { accessToken: 'a2', refreshToken: 'r2', expiresInSec: 900, deviceId: 'd1' } });

    const res = await POST(req({ refreshToken: 'r1' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    await expect(res.json()).resolves.toMatchObject({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('401 на негодный refresh + сброс кэша состояния устройств', async () => {
    h.refresh.mockResolvedValue({ ok: false, error: new ForbiddenError('Device revoked', 'device.revoked') });

    const res = await POST(req({ refreshToken: 'stolen' }));

    expect(res.status).toBe(401);
    expect(h.clearDeviceStateCache).toHaveBeenCalled();
  });

  it('400 на кривом теле — до обращения к сервису', async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ refreshToken: '' }))).status).toBe(400);
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('429 при переборе refresh — перебор токенов не бесплатный', async () => {
    h.rateLimit.mockResolvedValue({ ok: false, retryAfter: 60 });

    expect((await POST(req({ refreshToken: 'r' }))).status).toBe(429);
    expect(h.refresh).not.toHaveBeenCalled();
  });
});
