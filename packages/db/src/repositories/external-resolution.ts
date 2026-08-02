import { and, desc, eq, sql } from 'drizzle-orm';
import { externalResolutions } from '../schema';
import type { DB } from '../client';
import type { IResolutionCache, IResolvedIndex, ResolutionKey, CachedResolution, ExternalTrackRef, PlayableExternalSource } from '@vire/core';

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

const MIN_TOKEN_LEN = 2;
const MAX_TOKENS = 4;

/**
 * Поиск по уже отрезолвленному: то, что кто-то однажды добавил на вечеринке, находится
 * мгновенно и без квоты. Ищем по «артист + название» всеми токенами запроса, популярное выше.
 */
export class DrizzleResolvedIndex implements IResolvedIndex {
  constructor(private readonly db: DB) {}

  async search(query: string, limit: number): Promise<ExternalTrackRef[]> {
    const tokens = query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= MIN_TOKEN_LEN)
      .slice(0, MAX_TOKENS);
    if (tokens.length === 0) return [];

    const haystack = sql`lower(coalesce(${externalResolutions.artistName}, '') || ' ' || coalesce(${externalResolutions.title}, ''))`;
    const rows = await this.db
      .select({
        source: externalResolutions.source,
        externalId: externalResolutions.externalId,
        externalUrl: externalResolutions.externalUrl,
        title: externalResolutions.title,
        artistName: externalResolutions.artistName,
        coverUrl: externalResolutions.coverUrl,
        durationSec: externalResolutions.durationSec,
      })
      .from(externalResolutions)
      .where(and(
        eq(externalResolutions.notFound, false),
        ...tokens.map((token) => sql`${haystack} like ${`%${token}%`}`),
      ))
      .orderBy(desc(externalResolutions.hits))
      .limit(limit * 2);

    const seen = new Set<string>();
    const refs: ExternalTrackRef[] = [];
    for (const row of rows) {
      if (!row.source || !row.externalId || !row.title) continue;
      const key = `${row.source}:${row.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({
        source: row.source as PlayableExternalSource,
        externalId: row.externalId,
        externalUrl: row.externalUrl,
        title: row.title,
        artistName: row.artistName ?? '',
        coverUrl: row.coverUrl,
        durationSec: row.durationSec,
      });
      if (refs.length >= limit) break;
    }
    return refs;
  }
}
