import { describe, it, expect, vi } from 'vitest';
import { DeviceAuthService } from './device-auth';
import type { IDeviceRepository, DeviceRecord } from '../repositories/device';
import { verifyAccessToken, hashRefreshToken } from '../device-tokens';

const SECRET = 'device-secret-value';
const NOW = Date.UTC(2026, 7, 16, 12, 0, 0);

let counter = 0;
const randomBytes = (n: number) => {
  counter += 1;
  return new Uint8Array(Array.from({ length: n }, (_, i) => (i + counter) % 256));
};

function device(over: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    id: 'device-1',
    userId: 'user-1',
    name: 'iPhone',
    platform: 'ios',
    refreshExpiresAt: new Date(NOW + 30 * 24 * 3600 * 1000),
    createdAt: new Date(NOW),
    lastUsedAt: new Date(NOW),
    revokedAt: null,
    ...over,
  };
}

function makeRepo(over: Partial<IDeviceRepository> = {}): IDeviceRepository {
  return {
    create: vi.fn().mockResolvedValue(device()),
    findByRefreshHash: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(device()),
    listActive: vi.fn().mockResolvedValue([device()]),
    rotateRefresh: vi.fn().mockResolvedValue(undefined),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
    touch: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

function makeService(repo: IDeviceRepository) {
  return new DeviceAuthService({
    repo,
    secret: SECRET,
    randomBytes,
    now: () => NOW,
    resolveRole: async () => 'LISTENER',
  });
}

describe('DeviceAuthService.register', () => {
  it('выдаёт подписанный access с id устройства и refresh, хранимый хэшем', async () => {
    const repo = makeRepo();
    const result = await makeService(repo).register({ userId: 'user-1', role: 'LISTENER', name: 'iPhone', platform: 'ios' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const verified = verifyAccessToken(SECRET, result.value.accessToken, NOW);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.value).toMatchObject({ sub: 'user-1', role: 'LISTENER', did: 'device-1' });

    const created = vi.mocked(repo.create).mock.calls[0][0];
    expect(created.refreshTokenHash).toBe(hashRefreshToken(result.value.refreshToken));
    expect(created.refreshTokenHash).not.toBe(result.value.refreshToken);
  });

  it('пустое имя и неизвестная платформа отклоняются до записи', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    expect((await service.register({ userId: 'u', role: 'LISTENER', name: '   ', platform: 'ios' })).ok).toBe(false);
    expect((await service.register({ userId: 'u', role: 'LISTENER', name: 'X', platform: 'toaster' })).ok).toBe(false);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('DeviceAuthService.refresh', () => {
  it('меняет refresh на новый — старый перестаёт действовать', async () => {
    const repo = makeRepo({ findByRefreshHash: vi.fn().mockResolvedValue(device()) });
    const result = await makeService(repo).refresh({ refreshToken: 'old-token' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [deviceId, newHash] = vi.mocked(repo.rotateRefresh).mock.calls[0];
    expect(deviceId).toBe('device-1');
    expect(newHash).toBe(hashRefreshToken(result.value.refreshToken));
    expect(newHash).not.toBe(hashRefreshToken('old-token'));
  });

  it('неизвестный refresh — отказ без побочных эффектов', async () => {
    const repo = makeRepo();
    const result = await makeService(repo).refresh({ refreshToken: 'nope' });

    expect(result.ok).toBe(false);
    expect(repo.rotateRefresh).not.toHaveBeenCalled();
    expect(repo.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('refresh отозванного устройства = утечка → отзываем все устройства владельца', async () => {
    const repo = makeRepo({
      findByRefreshHash: vi.fn().mockResolvedValue(device({ revokedAt: new Date(NOW - 1000) })),
    });

    const result = await makeService(repo).refresh({ refreshToken: 'stolen' });

    expect(result.ok).toBe(false);
    expect(repo.revokeAllForUser).toHaveBeenCalledWith('user-1', new Date(NOW));
    expect(repo.rotateRefresh).not.toHaveBeenCalled();
  });

  it('роль в новом access перечитывается, а не берётся из старого токена', async () => {
    const repo = makeRepo({ findByRefreshHash: vi.fn().mockResolvedValue(device()) });
    const service = new DeviceAuthService({
      repo, secret: SECRET, randomBytes, now: () => NOW,
      resolveRole: async () => 'MODERATOR',
    });

    const result = await service.refresh({ refreshToken: 't' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const verified = verifyAccessToken(SECRET, result.value.accessToken, NOW);
    expect(verified.ok && verified.value.role).toBe('MODERATOR');
  });

  it('владелец удалён — доступ прекращается, ротации нет', async () => {
    const repo = makeRepo({ findByRefreshHash: vi.fn().mockResolvedValue(device()) });
    const service = new DeviceAuthService({
      repo, secret: SECRET, randomBytes, now: () => NOW,
      resolveRole: async () => null,
    });

    const result = await service.refresh({ refreshToken: 't' });

    expect(result.ok).toBe(false);
    expect(repo.rotateRefresh).not.toHaveBeenCalled();
  });

  it('просроченный refresh отвергается ровно на границе', async () => {
    const expired = makeRepo({ findByRefreshHash: vi.fn().mockResolvedValue(device({ refreshExpiresAt: new Date(NOW) })) });
    expect((await makeService(expired).refresh({ refreshToken: 't' })).ok).toBe(false);

    const alive = makeRepo({ findByRefreshHash: vi.fn().mockResolvedValue(device({ refreshExpiresAt: new Date(NOW + 1) })) });
    expect((await makeService(alive).refresh({ refreshToken: 't' })).ok).toBe(true);
  });
});

describe('DeviceAuthService.revoke', () => {
  it('отзывает своё устройство', async () => {
    const repo = makeRepo();
    const result = await makeService(repo).revoke({ userId: 'user-1', deviceId: 'device-1' });

    expect(result.ok).toBe(true);
    expect(repo.revoke).toHaveBeenCalledWith('device-1', new Date(NOW));
  });

  it('чужое устройство не отзывается и не подтверждает своё существование', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(device({ userId: 'someone-else' })) });
    const result = await makeService(repo).revoke({ userId: 'user-1', deviceId: 'device-1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('device.notFound');
    expect(repo.revoke).not.toHaveBeenCalled();
  });

  it('несуществующее устройство — тот же отказ, что и чужое', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const result = await makeService(repo).revoke({ userId: 'user-1', deviceId: 'ghost' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('device.notFound');
  });
});
