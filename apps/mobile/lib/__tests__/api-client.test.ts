import { describe, it, expect, vi, beforeEach } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@vire/api-client', () => ({ request }));

const store = vi.hoisted(() => new Map<string, string>());
vi.mock('../secure-store', () => ({
  getStored: (key: string) => Promise.resolve(store.get(key) ?? null),
  setAuthTokens: (tokens: { accessToken: string; refreshToken: string; deviceId: string }) => {
    store.set('accessToken', tokens.accessToken);
    store.set('refreshToken', tokens.refreshToken);
    store.set('deviceId', tokens.deviceId);
    return Promise.resolve();
  },
  clearAuthTokens: () => {
    store.clear();
    return Promise.resolve();
  },
}));

import { apiRequest } from '../api-client';

const okSchema = { safeParse: (v: unknown) => ({ success: true, data: v }) } as never;

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
});

describe('apiRequest', () => {
  it('attaches Bearer из secure store', async () => {
    store.set('accessToken', 'access-1');
    request.mockResolvedValue({ ok: true, data: { hello: 'world' } });

    await apiRequest('/api/v1/auth/devices', { schema: okSchema });

    expect(request).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/devices',
      expect.objectContaining({ headers: { Authorization: 'Bearer access-1' } }),
    );
  });

  it('без токена в store — запрос без Authorization', async () => {
    request.mockResolvedValue({ ok: true, data: {} });

    await apiRequest('/api/v1/auth/devices', { schema: okSchema });

    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: {} }),
    );
  });

  it('успех без 401 — refresh не трогается', async () => {
    store.set('accessToken', 'access-1');
    request.mockResolvedValue({ ok: true, data: { n: 1 } });

    const result = await apiRequest('/api/v1/auth/devices', { schema: okSchema });

    expect(result).toEqual({ ok: true, data: { n: 1 } });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('401 → рефреш → повтор исходного запроса с новым токеном', async () => {
    store.set('accessToken', 'stale');
    store.set('refreshToken', 'refresh-1');
    request
      .mockResolvedValueOnce({ ok: false, error: { status: 401, message: 'expired' } })
      .mockResolvedValueOnce({ ok: true, data: { accessToken: 'fresh', refreshToken: 'refresh-2', deviceId: 'd1', expiresInSec: 900 } })
      .mockResolvedValueOnce({ ok: true, data: { n: 2 } });

    const result = await apiRequest('/api/v1/auth/devices', { schema: okSchema });

    expect(result).toEqual({ ok: true, data: { n: 2 } });
    expect(request).toHaveBeenCalledTimes(3);
    expect(request).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', body: { refreshToken: 'refresh-1' } }),
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/v1/auth/devices',
      expect.objectContaining({ headers: { Authorization: 'Bearer fresh' } }),
    );
    await expect(
      import('../secure-store').then((m) => m.getStored('accessToken')),
    ).resolves.toBe('fresh');
  });

  it('401 → рефреш не удался → очищает токены и возвращает исходную 401-ошибку без повтора', async () => {
    store.set('accessToken', 'stale');
    store.set('refreshToken', 'refresh-1');
    request
      .mockResolvedValueOnce({ ok: false, error: { status: 401, message: 'expired' } })
      .mockResolvedValueOnce({ ok: false, error: { status: 400, message: 'invalid refresh' } });

    const result = await apiRequest('/api/v1/auth/devices', { schema: okSchema });

    expect(result).toEqual({ ok: false, error: { status: 401, message: 'expired' } });
    expect(request).toHaveBeenCalledTimes(2);
    await expect(
      import('../secure-store').then((m) => m.getStored('accessToken')),
    ).resolves.toBeNull();
  });

  it('без refreshToken в store — не зовёт /auth/refresh вообще', async () => {
    store.set('accessToken', 'stale');
    request.mockResolvedValueOnce({ ok: false, error: { status: 401, message: 'expired' } });

    const result = await apiRequest('/api/v1/auth/devices', { schema: okSchema });

    expect(result.ok).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('два конкурентных 401 делят один рефреш (single-flight)', async () => {
    // Диспетчер по URL/заголовку, а не по порядку вызовов — порядок настоящих
    // конкурентных микротасков p1/p2 не детерминирован, а инвариант, который
    // проверяем (ровно один /auth/refresh на оба 401), от порядка не зависит.
    store.set('accessToken', 'stale');
    store.set('refreshToken', 'refresh-1');
    let refreshCalls = 0;

    request.mockImplementation((url: string, opts: { headers?: Record<string, string> }) => {
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve({
          ok: true,
          data: { accessToken: 'fresh', refreshToken: 'refresh-2', deviceId: 'd1', expiresInSec: 900 },
        });
      }
      if (opts.headers?.Authorization === 'Bearer fresh') {
        return Promise.resolve({ ok: true, data: { n: 1 } });
      }
      return Promise.resolve({ ok: false, error: { status: 401, message: 'expired' } });
    });

    const [r1, r2] = await Promise.all([
      apiRequest('/api/v1/auth/devices', { schema: okSchema }),
      apiRequest('/api/v1/auth/devices', { schema: okSchema }),
    ]);

    expect(r1).toEqual({ ok: true, data: { n: 1 } });
    expect(r2).toEqual({ ok: true, data: { n: 1 } });
    expect(refreshCalls).toBe(1);
  });
});
