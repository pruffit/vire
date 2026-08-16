import { err, ok, ForbiddenError, ValidationError, type Result } from '../../../errors';
import type { IDeviceRepository, DeviceRecord } from '../repositories/device';
import {
  signAccessToken,
  newRefreshToken,
  hashRefreshToken,
  refreshExpiresAt,
  ACCESS_TOKEN_TTL_SEC,
  type RandomBytes,
} from '../device-tokens';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  deviceId: string;
}

export interface DeviceAuthDeps {
  repo: IDeviceRepository;
  secret: string;
  randomBytes: RandomBytes;
  now: () => number;
  /** Роль перечитывается на каждой ротации: с момента прошлой выдачи она могла измениться. */
  resolveRole: (userId: string) => Promise<string | null>;
}

export const DEVICE_NAME_MAX = 80;
export const DEVICE_PLATFORMS = ['ios', 'android', 'desktop', 'other'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export class DeviceAuthService {
  constructor(private readonly deps: DeviceAuthDeps) {}

  private issue(device: DeviceRecord, role: string, refreshToken: string): TokenPair {
    return {
      accessToken: signAccessToken(
        this.deps.secret,
        { sub: device.userId, role, did: device.id },
        this.deps.now(),
      ),
      refreshToken,
      expiresInSec: ACCESS_TOKEN_TTL_SEC,
      deviceId: device.id,
    };
  }

  /** Обмен уже доказанной личности (cookie-сессия веба) на пару токенов устройства. */
  async register(params: {
    userId: string;
    role: string;
    name: string;
    platform: string;
  }): Promise<Result<TokenPair, ValidationError>> {
    const name = params.name.trim();
    if (!name || name.length > DEVICE_NAME_MAX) {
      return err(new ValidationError('Device name is required', 'device.name.invalid'));
    }
    if (!(DEVICE_PLATFORMS as readonly string[]).includes(params.platform)) {
      return err(new ValidationError('Unknown platform', 'device.platform.invalid'));
    }

    const nowMs = this.deps.now();
    const refreshToken = newRefreshToken(this.deps.randomBytes);
    const device = await this.deps.repo.create({
      userId: params.userId,
      name,
      platform: params.platform,
      refreshTokenHash: hashRefreshToken(refreshToken),
      refreshExpiresAt: refreshExpiresAt(nowMs),
      now: new Date(nowMs),
    });

    return ok(this.issue(device, params.role, refreshToken));
  }

  /**
   * Ротация: старый refresh перестаёт действовать сразу. Предъявленный, но уже неизвестный
   * refresh при живом устройстве трактуется как утечка — отзываем все устройства владельца.
   */
  async refresh(params: { refreshToken: string }): Promise<Result<TokenPair, ForbiddenError>> {
    const nowMs = this.deps.now();
    const device = await this.deps.repo.findByRefreshHash(hashRefreshToken(params.refreshToken));
    if (!device) return err(new ForbiddenError('Invalid refresh token', 'device.refresh.invalid'));

    if (device.revokedAt) {
      // Устройство отозвано, а токен всё ещё в ходу — считаем компрометацией.
      await this.deps.repo.revokeAllForUser(device.userId, new Date(nowMs));
      return err(new ForbiddenError('Device revoked', 'device.revoked'));
    }
    if (device.refreshExpiresAt.getTime() <= nowMs) {
      return err(new ForbiddenError('Refresh token expired', 'device.refresh.expired'));
    }

    const role = await this.deps.resolveRole(device.userId);
    // Пользователя удалили, а токен остался — доступ прекращается вместе с ролью.
    if (role === null) return err(new ForbiddenError('Owner is gone', 'device.owner.missing'));

    const next = newRefreshToken(this.deps.randomBytes);
    await this.deps.repo.rotateRefresh(
      device.id,
      hashRefreshToken(next),
      refreshExpiresAt(nowMs),
      new Date(nowMs),
    );

    return ok(this.issue(device, role, next));
  }

  async revoke(params: { userId: string; deviceId: string }): Promise<Result<void, ForbiddenError>> {
    const device = await this.deps.repo.findById(params.deviceId);
    // Чужое устройство отозвать нельзя, и знать о его существовании тоже не нужно.
    if (!device || device.userId !== params.userId) {
      return err(new ForbiddenError('Device not found', 'device.notFound'));
    }
    await this.deps.repo.revoke(params.deviceId, new Date(this.deps.now()));
    return ok(undefined);
  }

  list(userId: string): Promise<DeviceRecord[]> {
    return this.deps.repo.listActive(userId);
  }
}
