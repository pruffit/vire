import type { MetadataRoute } from 'next';
import {
  db,
  DrizzleReleaseRepository,
  listActiveArtists,
  getPublishedSmartLinks,
  listTrackIdsByReleaseIds,
} from '@vire/db';
import { ReleaseService } from '@vire/core';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/artists`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/releases`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  try {
    const artists = await listActiveArtists();
    const releaseService = new ReleaseService(new DrizzleReleaseRepository(db));

    const artistRoutes: MetadataRoute.Sitemap = artists.map((a) => ({
      url: `${SITE_URL}/artists/${a.slug}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    const perArtist = await Promise.all(
      artists.map(async (a) => {
        const [releases, smartLinks] = await Promise.all([
          releaseService.getPublishedByArtist(a.id),
          getPublishedSmartLinks(a.id),
        ]);
        return { artist: a, releases, smartLinks };
      }),
    );

    // Один запрос на все треки всего каталога вместо getWithTracks(r.id) по
    // каждому релизу — раньше был N+1 (по релизу на каждый await).
    const allReleaseIds = perArtist.flatMap(({ releases }) => releases.map((r) => r.id));
    const trackIdsByRelease = await listTrackIdsByReleaseIds(allReleaseIds);

    const releaseAndSmartLinkEntries: MetadataRoute.Sitemap = perArtist.flatMap(({ artist: a, releases, smartLinks }) => {
      const releaseEntries: MetadataRoute.Sitemap = [];
      for (const r of releases) {
        const releaseUrl = `${SITE_URL}/artists/${a.slug}/releases/${r.id}`;
        releaseEntries.push({
          url: releaseUrl,
          lastModified: r.updatedAt,
          changeFrequency: 'weekly',
          priority: 0.6,
        });

        for (const trackId of trackIdsByRelease.get(r.id) ?? []) {
          releaseEntries.push({
            url: `${releaseUrl}/tracks/${trackId}`,
            lastModified: r.updatedAt,
            changeFrequency: 'weekly',
            priority: 0.5,
          });
        }
      }

      const smartLinkEntries: MetadataRoute.Sitemap = smartLinks.map((sl) => ({
        url: `${SITE_URL}/smartlink/${a.slug}/${sl.slug}`,
        changeFrequency: 'weekly',
        priority: 0.6,
      }));

      return [...releaseEntries, ...smartLinkEntries];
    });

    return [...staticRoutes, ...artistRoutes, ...releaseAndSmartLinkEntries];
  } catch {
    // БД недоступна — отдаём хотя бы статические маршруты, чтобы sitemap не падал.
    return staticRoutes;
  }
}
