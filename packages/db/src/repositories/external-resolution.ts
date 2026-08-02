import { and, eq, sql } from 'drizzle-orm';
import { externalResolutions } from '../schema';
import type { DB } from '../client';
import type { IResolutionCache, ResolutionKey, CachedResolution, ExternalTrackRef, PlayableExternalSource } from '@vire/core';

export class DrizzleResolutionCache implements IResolutionCache {
  constructor(private readonly db: DB) {}

  async get(key: ResolutionKey): Promise<CachedResolution | null> {
    const [row] = await this.db
      .select()
      .from(externalResolutions)
      .where(and(eq(externalResolutions.keyKind, key.kind), eq(externalResolutions.key, key.value)))
      .limit(1);
    if (!row) return null;

    await this.db.update(externalResolutions).set({ hits: sql`${externalResolutions.hits} + 1` }).where(eq(externalResolutions.id, row.id));

    if (row.notFound) return { found: false, resolvedAt: row.resolvedAt };
    return {
      found: true,
      ref: {
        source: row.source as PlayableExternalSource,
        externalId: row.externalId!,
        externalUrl: row.externalUrl,
        title: row.title!,
        artistName: row.artistName ?? '',
        coverUrl: row.coverUrl,
        durationSec: row.durationSec,
      },
    };
  }

  async put(key: ResolutionKey, ref: ExternalTrackRef | null): Promise<void> {
    const base = ref
      ? {
          source: ref.source, externalId: ref.externalId, externalUrl: ref.externalUrl,
          title: ref.title, artistName: ref.artistName, coverUrl: ref.coverUrl, durationSec: ref.durationSec,
          notFound: false,
        }
      : { source: null, externalId: null, externalUrl: null, title: null, artistName: null, coverUrl: null, durationSec: null, notFound: true };

    await this.db
      .insert(externalResolutions)
      .values({ keyKind: key.kind, key: key.value, ...base })
      .onConflictDoUpdate({
        target: [externalResolutions.keyKind, externalResolutions.key],
        set: { ...base, resolvedAt: sql`now()` },
      });
  }
}
