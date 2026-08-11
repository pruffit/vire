import type { IReleaseCatalogRepository, ReleaseCatalogQuery, ReleaseCard } from '@vire/core';
import { listReleases } from '../queries/discovery';

/** Тонкая обёртка над listReleases — SQL живёт в queries/discovery.ts, не здесь. */
export class DrizzleReleaseCatalogRepository implements IReleaseCatalogRepository {
  list({ sort, sinceDays, limit, offset }: ReleaseCatalogQuery): Promise<ReleaseCard[]> {
    return listReleases({ sort, sinceDays: sinceDays ?? undefined, limit, offset });
  }
}
