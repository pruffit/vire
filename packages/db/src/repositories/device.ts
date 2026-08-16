import { and, eq, isNull, desc } from 'drizzle-orm';
import type { IDeviceRepository, DeviceRecord, CreateDeviceInput } from '@vire/core/identity/device';
import { db } from '../client';
import { devices } from '../schema/devices';

type Row = typeof devices.$inferSelect;

function toRecord(row: Row): DeviceRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    platform: row.platform,
    refreshExpiresAt: row.refreshExpiresAt,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
  };
}

export class DrizzleDeviceRepository implements IDeviceRepository {
  async create(input: CreateDeviceInput): Promise<DeviceRecord> {
    const [row] = await db
      .insert(devices)
      .values({
        userId: input.userId,
        name: input.name,
        platform: input.platform,
        refreshTokenHash: input.refreshTokenHash,
        refreshExpiresAt: input.refreshExpiresAt,
        createdAt: input.now,
        lastUsedAt: input.now,
      })
      .returning();
    return toRecord(row!);
  }

  async findByRefreshHash(hash: string): Promise<DeviceRecord | null> {
    const [row] = await db.select().from(devices).where(eq(devices.refreshTokenHash, hash)).limit(1);
    return row ? toRecord(row) : null;
  }

  async findById(deviceId: string): Promise<DeviceRecord | null> {
    const [row] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
    return row ? toRecord(row) : null;
  }

  async listActive(userId: string): Promise<DeviceRecord[]> {
    const rows = await db
      .select()
      .from(devices)
      .where(and(eq(devices.userId, userId), isNull(devices.revokedAt)))
      .orderBy(desc(devices.lastUsedAt));
    return rows.map(toRecord);
  }

  async rotateRefresh(deviceId: string, hash: string, expiresAt: Date, now: Date): Promise<void> {
    await db
      .update(devices)
      .set({ refreshTokenHash: hash, refreshExpiresAt: expiresAt, lastUsedAt: now })
      .where(eq(devices.id, deviceId));
  }

  async revoke(deviceId: string, now: Date): Promise<void> {
    await db.update(devices).set({ revokedAt: now }).where(eq(devices.id, deviceId));
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    await db
      .update(devices)
      .set({ revokedAt: now })
      .where(and(eq(devices.userId, userId), isNull(devices.revokedAt)));
  }

  async touch(deviceId: string, now: Date): Promise<void> {
    await db.update(devices).set({ lastUsedAt: now }).where(eq(devices.id, deviceId));
  }
}
