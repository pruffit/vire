import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { getReleasePage } from '@/lib/release-page';
import { ZoomableCover } from '@/components/zoomable-cover';
import { ReleaseHeroPlay } from '@/components/release-hero-play';
import { ReleaseShareButton } from '@/components/release-share-button';
import { ReleaseCountdown } from '@/components/release-countdown';
import { TrackList, type ClientTrack } from './track-list';
import type { PlayerTrack } from '@/store/player';
import { JsonLd } from '@/components/json-ld';
import { GrainOverlay } from '@/components/grain-overlay';
import { AmbientBackdrop } from '@/components/ambient-backdrop';
import { PageContainer } from '@/components/page-container';
import { musicAlbumJsonLd, breadcrumbListJsonLd } from '@/lib/structured-data';
import { releaseYear, totalDuration } from '@/lib/format';
import { releaseMetaDescription } from '@/lib/meta-descriptions';
import { pageMetadata } from '@/lib/metadata';
import { resolveLocale } from '@/lib/locale';
import { artistFontStyle } from '@/lib/fonts';
import { genreLabel } from '@/lib/genres';
import { Icon } from '@/components/icon';
import { SectionHeader } from '@/components/section-header';

type Props = { params: Promise<{ slug: string; releaseId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, releaseId } = await params;
  const data = await getReleasePage(slug, releaseId);
  if (!data) {
    const t = await getTranslations('release');
    return { title: t('notFound') };
  }

  const { artist, release, tracks } = data;
  const locale = await resolveLocale();
  const url = `/artists/${slug}/releases/${releaseId}`;
  const description = release.description ?? (await releaseMetaDescription({
    title: release.title,
    artistName: artist.name,
    type: release.type,
    year: releaseYear(release.releaseDate),
    trackCount: tracks.length,
    locale,
  }));
  const title = `${release.title} — ${artist.name}`;
  return pageMetadata({
    url,
    title,
    description,
    locale,
    type: 'music.album',
    images: null, // своя брендовая карточка — opengraph-image.tsx этого сегмента
  });
}

export default async function ReleasePage({ params }: Props) {
  const { slug, releaseId } = await params;
  const data = await getReleasePage(slug, releaseId);
  if (!data) notFound();

  const t = await getTranslations('release');
  const tCommon = await getTranslations('common');
  const tGenres = await getTranslations('genres');
  const locale = await resolveLocale();

  const { artist, release, tracks, isReleased, showCountdown, presaved } = data;
  const { bg, text, accent, grain } = artist.themeTokens;
  const releaseAtMs = release.releaseDate ? new Date(release.releaseDate).getTime() : null;

  // SCHEDULED в будущем — обратный отсчёт; черновик/архив/без даты — 404
  if (!isReleased) {
    if (!showCountdown || releaseAtMs == null) notFound();
    const session = await auth();
    return (
      <div
        style={{ '--artist-bg': bg, '--artist-text': text, '--artist-accent': accent, ...artistFontStyle(artist.themeTokens) } as React.CSSProperties}
        className="relative min-h-full bg-[var(--artist-bg)] text-[var(--artist-text)] font-sans overflow-x-clip"
      >
        <AmbientBackdrop src={release.coverUrl} />
        {grain && <GrainOverlay />}
        <ReleaseCountdown
          releaseId={release.id}
          coverUrl={release.coverUrl}
          title={release.title}
          type={release.type}
          artistName={artist.name}
          artistSlug={slug}
          releaseAtMs={releaseAtMs}
          presaved={presaved}
          isAuthed={!!session?.user}
        />
      </div>
    );
  }

  const clientTracks: ClientTrack[] = tracks.map(({ id, title, version, trackNumber, durationSec, status, isExclusive, isWip, isExplicit, credits }) => ({
    id, title, version, trackNumber, durationSec, status, isExclusive, isWip, isExplicit, credits,
  }));
  const readyQueue: PlayerTrack[] = tracks
    .filter((t) => t.status === 'READY')
    .map((t) => ({ id: t.id, title: t.title, artistName: artist.name, coverUrl: release.coverUrl, artistSlug: slug, releaseId, accentColor: accent ?? undefined, isExplicit: t.isExplicit }));
  const year = releaseYear(release.releaseDate);
  const longestWord = Math.max(1, ...release.title.split(/\s+/).map((w) => w.length));
  const titleMaxRem = Math.max(2, Math.min(3.4, 20 / longestWord));

  return (
    <div
      style={{ '--artist-bg': bg, '--artist-text': text, '--artist-accent': accent, ...artistFontStyle(artist.themeTokens) } as React.CSSProperties}
      className="relative min-h-full bg-[var(--artist-bg)] text-[var(--artist-text)] font-sans overflow-x-clip"
    >
      <JsonLd
        data={musicAlbumJsonLd(
          { id: release.id, title: release.title, coverUrl: release.coverUrl, releaseDate: release.releaseDate, description: release.description },
          { name: artist.name, slug },
          clientTracks.map((t) => ({ id: t.id, title: t.title, durationSec: t.durationSec })),
          locale,
        )}
      />
      <JsonLd data={breadcrumbListJsonLd([
        { name: t('breadcrumb.home'), url: '/' },
        { name: tCommon('entity.artists'), url: '/artists' },
        { name: artist.name, url: `/artists/${slug}` },
        { name: release.title, url: `/artists/${slug}/releases/${releaseId}` },
      ])} />
      <AmbientBackdrop src={release.coverUrl} />
      {grain && <GrainOverlay />}

      <PageContainer as="div" variant="detail" className="pt-10 pb-32">
        <Link
          href={`/artists/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[color-mix(in_oklch,var(--artist-text)_40%,transparent)] hover:text-[color-mix(in_oklch,var(--artist-text)_70%,transparent)] transition-colors mb-10"
        >
          <Icon name="arrow-left" size={13} /> {artist.name}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[clamp(300px,24%,380px)_1fr] gap-10 lg:gap-12 lg:items-start">
          <div className="lg:sticky lg:top-8 self-start">
            <div className="flex flex-col sm:flex-row lg:flex-col gap-8 sm:gap-10 lg:gap-6 items-start">
              <div className="shrink-0 mx-auto sm:mx-0">
                {release.coverUrl ? (
                  <ZoomableCover
                    src={release.coverUrl}
                    alt={release.title}
                    className="w-56 h-56 sm:w-72 sm:h-72 lg:h-80 lg:w-80 shrink-0 shadow-2xl rounded-xl"
                    sizes="(max-width: 640px) 224px, (max-width: 1024px) 288px, 320px"
                    priority
                  />
                ) : (
                  <div className="w-56 h-56 sm:w-72 sm:h-72 lg:h-80 lg:w-80 rounded-xl bg-[color-mix(in_oklch,var(--artist-text)_5%,transparent)] flex items-center justify-center text-[color-mix(in_oklch,var(--artist-text)_20%,transparent)]">
                    <MusicIcon />
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-1 flex flex-col">
                <p className="label-mono text-xs text-[color-mix(in_oklch,var(--artist-text)_55%,transparent)]">
                  <span style={{ color: 'var(--artist-accent)' }}>{release.type}</span>
                  {year ? <span className="text-[color-mix(in_oklch,var(--artist-text)_62%,transparent)]"> · {year}</span> : null}
                  {release.genre ? <span className="text-[color-mix(in_oklch,var(--artist-text)_62%,transparent)]"> · {genreLabel(release.genre, tGenres)}</span> : null}
                </p>
                <h1
                  className="font-bold tracking-tight leading-[0.95] text-balance break-words"
                  style={{ fontSize: `clamp(1.9rem, 6vw, ${titleMaxRem}rem)` }}
                >
                  {release.title}
                </h1>
                {release.description && (
                  <p className="text-sm leading-relaxed text-[color-mix(in_oklch,var(--artist-text)_62%,transparent)] max-w-prose">
                    {release.description}
                  </p>
                )}
                <p className="text-xs readout text-[color-mix(in_oklch,var(--artist-text)_40%,transparent)]">
                  {tCommon('trackCount', { count: tracks.length })}
                  {totalDuration(tracks) && ` · ${totalDuration(tracks)}`}
                </p>
                <div className="pt-2 flex items-center gap-3 flex-wrap">
                  <ReleaseHeroPlay queue={readyQueue} context={{ source: 'release', sourceId: releaseId }} />
                  <ReleaseShareButton title={release.title} artistName={artist.name} />
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-12">
            <section>
              <SectionHeader label={tCommon('entity.tracks')} />
              <TrackList
                tracks={clientTracks}
                artistName={artist.name}
                artistSlug={slug}
                releaseId={releaseId}
                coverUrl={release.coverUrl}
                accentColor={accent}
              />
            </section>

            {release.linerNotes && (
              <section>
                <SectionHeader label={t('linerNotesHeading')} />
                <p className="text-sm leading-relaxed text-[color-mix(in_oklch,var(--artist-text)_55%,transparent)] max-w-prose whitespace-pre-line">
                  {release.linerNotes}
                </p>
              </section>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}

function MusicIcon() {
  return <Icon name="music" size={48} />;
}
