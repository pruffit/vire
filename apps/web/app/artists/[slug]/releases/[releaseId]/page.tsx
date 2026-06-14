import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository } from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import { ZoomableCover } from '@/components/zoomable-cover';
import { ReleaseHeroPlay } from '@/components/release-hero-play';
import { ReleaseShareButton } from '@/components/release-share-button';
import { ReleaseCountdown } from '@/components/release-countdown';
import { TrackList, type ClientTrack } from './track-list';
import type { PlayerTrack } from '@/store/player';
import { JsonLd } from '@/components/json-ld';
import { GrainOverlay } from '@/components/grain-overlay';
import { AmbientBackdrop } from '@/components/ambient-backdrop';
import { musicAlbumJsonLd } from '@/lib/structured-data';
import { pluralTracks, releaseYear, totalDuration } from '@/lib/format';
import { artistFontStyle } from '@/lib/fonts';
import { GENRE_LABELS } from '@/lib/genres';

type Props = { params: Promise<{ slug: string; releaseId: string }> };

async function getPageData(slug: string, releaseId: string) {
  const [artistResult, releaseResult] = await Promise.all([
    new ArtistService(new DrizzleArtistRepository(db)).getBySlug(slug),
    new ReleaseService(new DrizzleReleaseRepository(db)).getWithTracks(releaseId),
  ]);

  if (!artistResult.ok || !releaseResult.ok) return null;

  const artist = artistResult.value;
  const { release, tracks } = releaseResult.value;

  if (release.artistProfileId !== artist.id) return null;

  // Релиз доступен (играбелен), если опубликован или запланирован с прошедшей
  // датой. Считаем здесь (не в компоненте) — иначе react-hooks/purity ругается
  // на Date.now() в рендере.
  const releaseAtMs = release.releaseDate ? new Date(release.releaseDate).getTime() : null;
  const isReleased =
    release.status === 'PUBLISHED' ||
    (release.status === 'SCHEDULED' && releaseAtMs != null && releaseAtMs <= Date.now());

  return { artist, release, tracks, releaseAtMs, isReleased };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, releaseId } = await params;
  const data = await getPageData(slug, releaseId);
  if (!data) return { title: 'Не найдено' };

  const { artist, release } = data;
  const url = `/artists/${slug}/releases/${releaseId}`;
  const description = release.description ?? `${release.title} — релиз ${artist.name} на Vire.`;
  return {
    title: `${release.title} — ${artist.name}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'music.album',
      url,
      title: `${release.title} — ${artist.name}`,
      description,
      images: release.coverUrl ? [{ url: release.coverUrl }] : [],
    },
  };
}

export default async function ReleasePage({ params }: Props) {
  const { slug, releaseId } = await params;
  const data = await getPageData(slug, releaseId);
  if (!data) notFound();

  const { artist, release, tracks, releaseAtMs, isReleased } = data;
  const { bg, text, accent, grain } = artist.themeTokens;

  // Не вышел: будущая дата → обратный отсчёт (слушать нельзя); черновик/без даты →
  // публично не показываем. (isReleased/releaseAtMs посчитаны в getPageData.)
  if (!isReleased) {
    // Отсчёт только для запланированных (SCHEDULED ⇒ дата в будущем, раз !isReleased).
    // Черновики/архив/без даты публично не показываем.
    if (release.status !== 'SCHEDULED' || releaseAtMs == null) notFound();
    return (
      <div
        style={{ '--artist-bg': bg, '--artist-text': text, '--artist-accent': accent, ...artistFontStyle(artist.themeTokens) } as React.CSSProperties}
        className="relative min-h-full bg-[var(--artist-bg)] text-[var(--artist-text)] font-sans overflow-hidden"
      >
        {release.coverUrl && <AmbientBackdrop src={release.coverUrl} />}
        {grain && <GrainOverlay />}
        <ReleaseCountdown
          coverUrl={release.coverUrl}
          title={release.title}
          type={release.type}
          artistName={artist.name}
          artistSlug={slug}
          releaseAtMs={releaseAtMs}
        />
      </div>
    );
  }

  const clientTracks: ClientTrack[] = tracks.map(({ id, title, trackNumber, durationSec, status, isExclusive, isWip, credits }) => ({
    id, title, trackNumber, durationSec, status, isExclusive, isWip, credits,
  }));
  const readyQueue: PlayerTrack[] = tracks
    .filter((t) => t.status === 'READY')
    .map((t) => ({ id: t.id, title: t.title, artistName: artist.name, coverUrl: release.coverUrl, artistSlug: slug, releaseId, accentColor: accent ?? undefined }));
  const year = releaseYear(release.releaseDate);

  return (
    <div
      style={{ '--artist-bg': bg, '--artist-text': text, '--artist-accent': accent, ...artistFontStyle(artist.themeTokens) } as React.CSSProperties}
      className="relative min-h-full bg-[var(--artist-bg)] text-[var(--artist-text)] font-sans overflow-hidden"
    >
      <JsonLd
        data={musicAlbumJsonLd(
          { id: release.id, title: release.title, coverUrl: release.coverUrl, releaseDate: release.releaseDate, description: release.description },
          { name: artist.name, slug },
          clientTracks.map((t) => ({ id: t.id, title: t.title, trackNumber: t.trackNumber, durationSec: t.durationSec })),
        )}
      />
      {release.coverUrl && <AmbientBackdrop src={release.coverUrl} />}
      {grain && <GrainOverlay />}

      {/* Hero */}
      <div className="relative z-10">
        <div className="mx-auto max-w-4xl px-6 pt-10 pb-12">
          <Link
            href={`/artists/${slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono opacity-40 hover:opacity-70 transition-opacity mb-10"
          >
            ← {artist.name}
          </Link>

          <div className="flex flex-col sm:flex-row gap-8 sm:gap-10 items-start">
            <div className="shrink-0 mx-auto sm:mx-0">
              {release.coverUrl ? (
                <ZoomableCover
                  src={release.coverUrl}
                  alt={release.title}
                  className="w-56 h-56 sm:w-[300px] sm:h-[300px] shadow-2xl rounded-xl"
                  sizes="(max-width: 640px) 224px, 300px"
                />
              ) : (
                <div className="w-56 h-56 sm:w-[300px] sm:h-[300px] rounded-xl bg-white/5 flex items-center justify-center opacity-20">
                  <MusicIcon />
                </div>
              )}
            </div>

            <div className="space-y-4 pt-1 flex flex-col">
              <p className="text-xs font-mono opacity-50 uppercase tracking-widest">
                <span style={{ color: 'var(--artist-accent)' }}>{release.type}</span>
                {year ? <span className="opacity-60"> · {year}</span> : null}
                {release.genre ? <span className="opacity-60"> · {GENRE_LABELS[release.genre]}</span> : null}
              </p>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[0.95] text-balance">
                {release.title}
              </h1>
              {release.description && (
                <p className="text-sm leading-relaxed opacity-60 max-w-prose">
                  {release.description}
                </p>
              )}
              <p className="text-xs font-mono opacity-40 tabular-nums">
                {tracks.length} {pluralTracks(tracks.length)}
                {totalDuration(tracks) && ` · ${totalDuration(tracks)}`}
              </p>
              <div className="pt-2 flex items-center gap-3 flex-wrap">
                <ReleaseHeroPlay queue={readyQueue} />
                <ReleaseShareButton title={release.title} artistName={artist.name} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tracks + liner notes */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-32 space-y-12">
        <TrackList
          tracks={clientTracks}
          artistName={artist.name}
          artistSlug={slug}
          releaseId={releaseId}
          coverUrl={release.coverUrl}
        />

        {release.linerNotes && (
          <section className="space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-widest opacity-30">Liner notes</h2>
            <p className="text-sm leading-relaxed opacity-50 max-w-prose whitespace-pre-line">
              {release.linerNotes}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function MusicIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}

