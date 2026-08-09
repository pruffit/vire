import { Link, redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository, getArtistPlayStats, getArtistRelistenStats } from '@vire/db';
import { getActiveArtistForPage } from '@/lib/active-artist';
import { LiveNow } from './live-now';
import { TopTracksCard, RelistenCard } from './stats-section';
import { ReleaseList, type DashboardRelease } from './release-list';
import { StatCard, MetricGrid, EmptyState, Panel, SectionLabel, btnPrimary } from '@/components/ui-kit';
import { Icon } from '@/components/icon';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [session, locale, t] = await Promise.all([auth(), getLocale(), getTranslations('dashboard.home')]);
  if (!session?.user?.id) return redirect({ href: '/sign-in?callbackUrl=/dashboard', locale });

  const artist = await getActiveArtistForPage(session.user.id);

  if (!artist) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-24 text-center">
        <h1 className="text-lg font-semibold">{t('noArtistTitle')}</h1>
        <p className="text-sm text-foreground/50">
          {t('noArtistBody')}
        </p>
      </div>
    );
  }

  const [rawReleases, playStats, relistenStats] = await Promise.all([
    new DrizzleReleaseRepository(db).findAllByArtist(artist.id),
    getArtistPlayStats(artist.id),
    getArtistRelistenStats(artist.id),
  ]);

  const releases: DashboardRelease[] = rawReleases.map(({ release, tracks }) => ({
    id: release.id,
    title: release.title,
    type: release.type,
    status: release.status,
    coverUrl: release.coverUrl,
    releaseDate: release.releaseDate ? release.releaseDate.toISOString() : null,
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      trackNumber: t.trackNumber,
      durationSec: t.durationSec,
      status: t.status,
    })),
  }));

  const published = releases.filter((r) => r.status === 'PUBLISHED').length;
  const hasPlays = (playStats?.totalPlays ?? 0) > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <LiveNow />
          </div>
          <p className="mt-1 font-mono text-sm text-foreground/45">
            @{artist.slug} · {artist.name}
          </p>
        </div>
        <Link href="/dashboard/releases/new" className={`${btnPrimary} gap-1.5`}>
          <Icon name="plus" size={16} /> {t('createRelease')}
        </Link>
      </header>

      <MetricGrid>
        <StatCard label={t('metricPlays')} value={playStats?.totalPlays ?? 0} sub={t('metricPlaysSub')} />
        <StatCard label={t('metricPlays7d')} value={playStats?.totalPlays7d ?? 0} sub={t('metricPlays7dSub')} />
        <StatCard label={t('metricRelisten')} value={relistenStats?.totalReturning ?? 0} sub={t('metricRelistenSub')} />
        <StatCard label={t('metricReleases')} value={releases.length} sub={t('metricReleasesPublished', { count: published })} />
      </MetricGrid>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>{t('releasesHeading')}</SectionLabel>
          <Link
            href="/dashboard/releases/new"
            className="inline-flex items-center gap-1 text-xs text-foreground/50 transition-colors hover:text-foreground"
          >
            <Icon name="plus" size={13} /> {t('create')}
          </Link>
        </div>
        {releases.length === 0 ? (
          <Panel>
            <EmptyState
              title={t('releasesEmptyTitle')}
              hint={t('releasesEmptyHint')}
            />
          </Panel>
        ) : (
          <ReleaseList releases={releases} artistSlug={artist.slug} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionLabel>{t('statsHeading')}</SectionLabel>
        {hasPlays && playStats ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <TopTracksCard stats={playStats} />
            {relistenStats && <RelistenCard relisten={relistenStats} />}
          </div>
        ) : (
          <Panel>
            <EmptyState
              title={t('statsEmptyTitle')}
              hint={t('statsEmptyHint')}
            />
          </Panel>
        )}
      </section>
    </div>
  );
}
