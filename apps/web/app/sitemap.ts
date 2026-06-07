import type { MetadataRoute } from 'next';
import { db, DrizzleReleaseRepository, listActiveArtists } from '@vire/db';
import { ReleaseService } from '@vire/core';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/artists`, changeFrequency: 'daily', priority: 0.8 },
  ];

  try {
    const artists = await listActiveArtists();
    const releaseService = new ReleaseService(new DrizzleReleaseRepository(db));

    const artistRoutes: MetadataRoute.Sitemap = artists.map((a) => ({
      url: `${SITE_URL}/artists/${a.slug}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    const releaseGroups = await Promise.all(
      artists.map(async (a) => {
        const releases = await releaseService.getPublishedByArtist(a.id);
        return releases.map((r) => ({
          url: `${SITE_URL}/artists/${a.slug}/releases/${r.id}`,
          lastModified: r.updatedAt,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }));
      }),
    );

    return [...staticRoutes, ...artistRoutes, ...releaseGroups.flat()];
  } catch {
    // БД недоступна — отдаём хотя бы статические маршруты, чтобы sitemap не падал.
    return staticRoutes;
  }
}
