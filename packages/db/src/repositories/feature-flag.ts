import { eq, sql } from 'drizzle-orm';
import type { IFeatureFlagRepository, FeatureFlagRow } from '@vire/core';
import { db } from '../client';
import { featureFlags } from '../schema/feature-flags';

export class DrizzleFeatureFlagRepository implements IFeatureFlagRepository {
  async list(): Promise<FeatureFlagRow[]> {
    return db.select().from(featureFlags);
  }

  async get(key: string): Promise<FeatureFlagRow | null> {
    const [row] = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
    return row ?? null;
  }

  async upsert(key: string, enabled: boolean, actorId: string | null): Promise<void> {
    await db
      .insert(featureFlags)
      .values({ key, enabled, updatedBy: actorId })
      .onConflictDoUpdate({
        target: featureFlags.key,
        set: { enabled, updatedBy: actorId, updatedAt: sql`now()` },
      });
  }
}
