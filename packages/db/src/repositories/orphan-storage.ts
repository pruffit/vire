import { and, asc, isNull, lte, sql, inArray, eq } from 'drizzle-orm';
import type {
  IOrphanedStorageRepository, OrphanedEntry, OrphanedPrefix, StorageBucket,
} from '@vire/core';
import { db } from '../client';
import { storageOrphans } from '../schema/storage-orphans';

export class DrizzleOrphanedStorageRepository implements IOrphanedStorageRepository {
  async enqueue(entries: OrphanedPrefix[]): Promise<void> {
    if (entries.length === 0) return;
    await db.insert(storageOrphans).values(entries.map((e) => ({
      bucket: e.bucket,
      prefix: e.prefix,
      reason: e.reason,
      entityId: e.entityId,
    })));
  }

  async listDue(now: Date, graceMs: number, limit: number): Promise<OrphanedEntry[]> {
    const threshold = new Date(now.getTime() - graceMs);
    const rows = await db
      .select()
      .from(storageOrphans)
      .where(and(isNull(storageOrphans.cleanedAt), lte(storageOrphans.createdAt, threshold)))
      .orderBy(asc(storageOrphans.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      bucket: r.bucket as StorageBucket,
      prefix: r.prefix,
      reason: r.reason,
      entityId: r.entityId,
      createdAt: r.createdAt,
      attempts: r.attempts,
    }));
  }

  async markCleaned(ids: string[], now: Date): Promise<void> {
    if (ids.length === 0) return;
    await db.update(storageOrphans).set({ cleanedAt: now }).where(inArray(storageOrphans.id, ids));
  }

  async markFailed(id: string, error: string): Promise<void> {
    await db
      .update(storageOrphans)
      .set({ attempts: sql`${storageOrphans.attempts} + 1`, lastError: error.slice(0, 500) })
      .where(eq(storageOrphans.id, id));
  }
}
