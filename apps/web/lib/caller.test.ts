import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signAccessToken } from '@vire/core/identity/device-tokens';

const SECRET = 'caller-test-secret';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const DEVICE_ID = '22222222-2222-2222-2222-222222222222';

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  authHeader: null as string | null,
  findById: vi.fn(),
  secret: 'caller-test-secret' as string | null,
}));

vi.mock('@/auth', () => ({ auth: h.auth }));
vi.mock('next/headers', () => ({ headers: async () => new Headers(h.authHeader ? { authorization: h.authHeader } : {}) }));
vi.mock('@vire/db', () => ({ DrizzleDeviceRepository: class { findById = h.findById; } }));
vi.mock('@/lib/app-secret', () => ({ getSigningSecret: () => h.secret }));

import { getCaller, clearDeviceStateCache } from './caller';

function activeDevice(over: Record<string, unknown> = {}) {
  return { id: DEVICE_ID, userId: USER_ID, revokedAt: null, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.authHeader = null;
  h.secret = SECRET;
  h.auth.mockResolvedValue(null);
  h.findById.mockResolvedValue(activeDevice());
  clearDeviceStateCache();
});

describe('getCaller — cookie-сессия', () => {
  it('нет сессии → null', async () => {
    await expect(getCaller()).resolves.toBeNull();
  });

  it('сессия без id → null', async () => {
    h.auth.mockResolvedValue({ user: { role: 'LISTENER' } });
    await expect(getCaller()).resolves.toBeNull();
  });

  it('сессия → актор с источником session', async () => {
    h.auth.mockResolvedValue({ user: { id: USER_ID, role: 'ADMIN', name: 'Даня', email: 'a@b.c', image: null } });

    await expect(getCaller()).resolves.toEqual({
      id: USER_ID, role: 'ADMIN', name: 'Даня', email: 'a@b.c', image: null,
      source: 'session', deviceId: null,
    });
  });
});

describe('getCaller — Bearer устройства', () => {
  function bearer(token: string) {
    h.authHeader = `Bearer ${token}`;
  }

  it('валидный токен живого устройства → актор с источником device', async () => {
    bearer(signAccessToken(SECRET, { sub: USER_ID, role: 'LISTENER', did: DEVICE_ID }, Date.now()));

    await expect(getCaller()).resolves.toMatchObject({
      id: USER_ID, role: 'LISTENER', source: 'device', deviceId: DEVICE_ID,
    });
    expect(h.auth).not.toHaveBeenCalled();
  });

  it('отозванное устройство не пускает, хотя подпись верна', async () => {
    h.findById.mockResolvedValue(activeDevice({ revokedAt: new Date() }));
    bearer(signAccessToken(SECRET, { sub: USER_ID, role: 'LISTENER', did: DEVICE_ID }, Date.now()));

    await expect(getCaller()).resolves.toBeNull();
  });

  it('устройства нет в базе → отказ', async () => {
    h.findById.mockResolvedValue(null);
    bearer(signAccessToken(SECRET, { sub: USER_ID, role: 'LISTENER', did: DEVICE_ID }, Date.now()));

    await expect(getCaller()).resolves.toBeNull();
  });

  it('токен на чужое устройство (did принадлежит другому владельцу) → отказ', async () => {
    h.findById.mockResolvedValue(activeDevice({ userId: 'someone-else' }));
    bearer(signAccessToken(SECRET, { sub: USER_ID, role: 'LISTENER', did: DEVICE_ID }, Date.now()));

    await expect(getCaller()).resolves.toBeNull();
  });

  it('истёкший токен → отказ', async () => {
    bearer(signAccessToken(SECRET, { sub: USER_ID, role: 'LISTENER', did: DEVICE_ID }, Date.now() - 3_600_000, 60));

    await expect(getCaller()).resolves.toBeNull();
  });

  it('подпись чужим секретом → отказ, роль из тела не поднимается', async () => {
    bearer(signAccessToken('attacker-secret', { sub: USER_ID, role: 'SUPERADMIN', did: DEVICE_ID }, Date.now()));

    await expect(getCaller()).resolves.toBeNull();
    expect(h.findById).not.toHaveBeenCalled();
  });

  it('секрет не настроен → Bearer не принимается (fail-closed)', async () => {
    const token = signAccessToken(SECRET, { sub: USER_ID, role: 'LISTENER', did: DEVICE_ID }, Date.now());
    h.secret = null;
    bearer(token);

    await expect(getCaller()).resolves.toBeNull();
  });

  it('мусор в заголовке не роняет и не пускает', async () => {
    for (const value of ['Bearer', 'Bearer   ', 'Basic abc', 'Bearer not.a.token']) {
      h.authHeader = value;
      await expect(getCaller()).resolves.toBeNull();
    }
  });

  it('состояние устройства кэшируется — БД не читается на каждый запрос', async () => {
    bearer(signAccessToken(SECRET, { sub: USER_ID, role: 'LISTENER', did: DEVICE_ID }, Date.now()));

    await getCaller();
    await getCaller();

    expect(h.findById).toHaveBeenCalledTimes(1);
  });

  it('сброс кэша заставляет перечитать состояние — отзыв действует сразу', async () => {
    bearer(signAccessToken(SECRET, { sub: USER_ID, role: 'LISTENER', did: DEVICE_ID }, Date.now()));
    await getCaller();

    h.findById.mockResolvedValue(activeDevice({ revokedAt: new Date() }));
    clearDeviceStateCache();

    await expect(getCaller()).resolves.toBeNull();
    expect(h.findById).toHaveBeenCalledTimes(2);
  });

  it('сбой БД при проверке устройства не пускает по токену', async () => {
    h.findById.mockRejectedValue(new Error('db down'));
    bearer(signAccessToken(SECRET, { sub: USER_ID, role: 'LISTENER', did: DEVICE_ID }, Date.now()));

    await expect(getCaller()).resolves.toBeNull();
  });
});
