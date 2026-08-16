export interface DeviceRecord {
  id: string;
  userId: string;
  name: string;
  platform: string;
  refreshExpiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
}

export interface CreateDeviceInput {
  userId: string;
  name: string;
  platform: string;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
  now: Date;
}

export interface IDeviceRepository {
  create(input: CreateDeviceInput): Promise<DeviceRecord>;
  /** Поиск по хэшу refresh — единственный способ обменять токен. */
  findByRefreshHash(hash: string): Promise<DeviceRecord | null>;
  findById(deviceId: string): Promise<DeviceRecord | null>;
  listActive(userId: string): Promise<DeviceRecord[]>;
  rotateRefresh(deviceId: string, hash: string, expiresAt: Date, now: Date): Promise<void>;
  revoke(deviceId: string, now: Date): Promise<void>;
  /** Отзыв всех устройств пользователя — реакция на повторное использование refresh. */
  revokeAllForUser(userId: string, now: Date): Promise<void>;
  touch(deviceId: string, now: Date): Promise<void>;
}
