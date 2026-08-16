import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getCaller: vi.fn(),
  register: vi.fn(),
  list: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/caller', () => ({ getCaller: h.getCaller }));
vi.mock('@/lib/device-auth', () => ({ deviceAuthService: () => ({ register: h.register, list: h.list }) }));
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>();
  return { ...actual, rateLimit: h.rateLimit };
});

import { GET, POST } from './route';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const SESSION_CALLER = { id: USER_ID, role: 'LISTENER', source: 'session', deviceId: null };

function req(body: unknown) {
  return new Request('https://vire.test/api/v1/auth/devices', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.rateLimit.mockResolvedValue({ ok: true });
  h.register.mockResolvedValue({ ok: true, value: { accessToken: 'a', refreshToken: 'r', expiresInSec: 900, deviceId: 'd1' } });
  h.list.mockResolvedValue([]);
});

describe('POST /api/v1/auth/devices', () => {
  it('401 без актора', async () => {
    h.getCaller.mockResolvedValue(null);
    expect((await POST(req({ name: 'iPhone', platform: 'ios' }))).status).toBe(401);
    expect(h.register).not.toHaveBeenCalled();
  });

  it('403 по Bearer: выдать новое устройство можно только из cookie-сессии', async () => {
    h.getCaller.mockResolvedValue({ ...SESSION_CALLER, source: 'device', deviceId: 'd0' });

    const res = await POST(req({ name: 'iPhone', platform: 'ios' }));

    expect(res.status).toBe(403);
    expect(h.register).not.toHaveBeenCalled();
  });

  it('400 на неизвестной платформе — набор фиксирован контрактом', async () => {
    h.getCaller.mockResolvedValue(SESSION_CALLER);
    expect((await POST(req({ name: 'X', platform: 'toaster' }))).status).toBe(400);
    expect(h.register).not.toHaveBeenCalled();
  });

  it('201 и пара токенов, ответ не кэшируется', async () => {
    h.getCaller.mockResolvedValue(SESSION_CALLER);

    const res = await POST(req({ name: 'iPhone', platform: 'ios' }));

    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    await expect(res.json()).resolves.toMatchObject({ accessToken: 'a', refreshToken: 'r' });
    expect(h.register).toHaveBeenCalledWith({ userId: USER_ID, role: 'LISTENER', name: 'iPhone', platform: 'ios' });
  });

  it('429 при исчерпании лимита — регистрация устройств не безлимитна', async () => {
    h.getCaller.mockResolvedValue(SESSION_CALLER);
    h.rateLimit.mockResolvedValue({ ok: false, retryAfter: 60 });

    expect((await POST(req({ name: 'iPhone', platform: 'ios' }))).status).toBe(429);
    expect(h.getCaller).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/auth/devices', () => {
  it('401 без актора', async () => {
    h.getCaller.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it('отдаёт только свои устройства и помечает текущее', async () => {
    h.getCaller.mockResolvedValue({ ...SESSION_CALLER, source: 'device', deviceId: 'd1' });
    h.list.mockResolvedValue([
      { id: 'd1', name: 'iPhone', platform: 'ios', createdAt: new Date(0), lastUsedAt: new Date(0), userId: USER_ID, refreshExpiresAt: new Date(0), revokedAt: null },
      { id: 'd2', name: 'Pixel', platform: 'android', createdAt: new Date(0), lastUsedAt: new Date(0), userId: USER_ID, refreshExpiresAt: new Date(0), revokedAt: null },
    ]);

    const body = await (await GET()).json();

    expect(h.list).toHaveBeenCalledWith(USER_ID);
    expect(body.devices.map((d: { current: boolean }) => d.current)).toEqual([true, false]);
    // хэши и сроки refresh наружу не уходят
    expect(JSON.stringify(body)).not.toContain('refreshExpiresAt');
  });
});
