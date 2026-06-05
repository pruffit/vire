import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository } from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import type { Track } from '@vire/core';

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
  const year = release.releaseDate ? new Date(release.releaseDate).getFullYear() : null;

  return {
    title: `${release.title} — ${artist.name}`,
    description: release.description ?? undefined,
    openGraph: {
      title: `${release.title} — ${artist.name}`,
      description: release.description ?? undefined,
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
  const year = release.releaseDate ? new Date(release.releaseDate).getFullYear() : null;

  return (
    <div
      style={
        {
          '--artist-bg': bg,
          '--artist-text': text,
          '--artist-accent': accent,
        } as React.CSSProperties
      }
      className="min-h-screen bg-[var(--artist-bg)] text-[var(--artist-text)]"
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
                <img
                  src={release.coverUrl}
                  alt={release.title}
                  className="w-52 h-52 shadow-2xl"
                />
              ) : (
                <div className="w-52 h-52 bg-white/5 flex items-center justify-center opacity-20">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
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

      {/* Track list */}
      <div className="mx-auto max-w-4xl px-6 pb-24 space-y-12">
        <TrackList tracks={tracks} />

        {release.linerNotes && (
          <section className="space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-widest opacity-30">
              Liner notes
            </h2>
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

function TrackList({ tracks }: { tracks: Track[] }) {
  if (tracks.length === 0) return null;

  return (
    <section className="space-y-1">
      {tracks.map((track) => (
        <TrackRow key={track.id} track={track} />
      ))}
    </section>
  );
}

function TrackRow({ track }: { track: Track }) {
  const isReady = track.status === 'READY';
  const isProcessing = track.status === 'PROCESSING';

  return (
    <div
      className={`group flex items-center gap-4 px-3 py-2.5 rounded-sm transition-colors ${
        isReady ? 'hover:bg-white/5 cursor-pointer' : 'opacity-40 cursor-default'
      }`}
    >
      <span className="w-6 text-right text-xs font-mono opacity-30 shrink-0">
        {track.trackNumber}
      </span>

      <span className="flex-1 text-sm truncate">
        {track.title}
      </span>

      <div className="flex items-center gap-2 shrink-0">
        {track.isExclusive && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm"
            style={{ color: 'var(--artist-accent)', background: 'color-mix(in oklch, var(--artist-accent) 15%, transparent)' }}
          >
            excl
          </span>
        )}
        {track.isWip && (
          <span className="text-[10px] font-mono opacity-40 px-1.5 py-0.5">
            wip
          </span>
        )}
        {isProcessing && (
          <span className="text-[10px] font-mono opacity-30">
            обработка…
          </span>
        )}
        {track.durationSec != null && isReady && (
          <span className="text-xs font-mono opacity-30 w-10 text-right">
            {formatDuration(track.durationSec)}
          </span>
        )}
      </div>
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function totalDuration(tracks: Track[]): string | null {
  const ready = tracks.filter((t) => t.status === 'READY' && t.durationSec != null);
  if (ready.length === 0) return null;
  const total = ready.reduce((sum, t) => sum + (t.durationSec ?? 0), 0);
  return formatDuration(total);
}

function pluralTracks(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'трек';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'трека';
  return 'треков';
}
