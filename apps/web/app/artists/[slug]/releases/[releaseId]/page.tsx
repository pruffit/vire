import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository } from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import { TrackList, type ClientTrack } from './track-list';
import { pluralTracks, releaseYear, totalDuration } from '@/lib/format';
import { artistFontStyle } from '@/lib/fonts';

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

  return { artist, release, tracks };
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

  const { artist, release, tracks } = data;
  const { bg, text, accent, grain } = artist.themeTokens;

  const clientTracks: ClientTrack[] = tracks.map(({ id, title, trackNumber, durationSec, status, isExclusive, isWip, credits }) => ({
    id, title, trackNumber, durationSec, status, isExclusive, isWip, credits,
  }));
  const year = releaseYear(release.releaseDate);

  return (
    <div
      style={{ '--artist-bg': bg, '--artist-text': text, '--artist-accent': accent, ...artistFontStyle(artist.themeTokens) } as React.CSSProperties}
      className="min-h-full bg-[var(--artist-bg)] text-[var(--artist-text)] font-sans"
    >
      {grain && <GrainOverlay />}

      {/* Hero */}
      <div className="relative overflow-hidden">
        {release.coverUrl && (
          <div
            aria-hidden="true"
            className="absolute inset-0 scale-110"
            style={{
              backgroundImage: `url(${release.coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(48px) saturate(1.4)',
              opacity: 0.25,
            }}
          />
        )}

        <div className="relative mx-auto max-w-4xl px-6 pt-10 pb-12">
          <Link
            href={`/artists/${slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono opacity-40 hover:opacity-70 transition-opacity mb-10"
          >
            ← {artist.name}
          </Link>

          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <div className="shrink-0">
              {release.coverUrl ? (
                <Image src={release.coverUrl} alt={release.title} width={208} height={208} className="w-52 h-52 object-cover shadow-2xl" />
              ) : (
                <div className="w-52 h-52 bg-white/5 flex items-center justify-center opacity-20">
                  <MusicIcon />
                </div>
              )}
            </div>

            <div className="space-y-3 pt-1">
              <p className="text-xs font-mono opacity-40 uppercase tracking-widest">
                {release.type}{year ? ` · ${year}` : ''}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight leading-tight">
                {release.title}
              </h1>
              {release.description && (
                <p className="text-sm leading-relaxed opacity-60 max-w-prose">
                  {release.description}
                </p>
              )}
              <p className="text-xs font-mono opacity-30">
                {tracks.length} {pluralTracks(tracks.length)}
                {totalDuration(tracks) && ` · ${totalDuration(tracks)}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tracks + liner notes */}
      <div className="mx-auto max-w-4xl px-6 pb-32 space-y-12">
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

function GrainOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 will-change-transform"
      style={{
        opacity: 0.035,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat',
        backgroundSize: '256px 256px',
      }}
    />
  );
}

function MusicIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}

