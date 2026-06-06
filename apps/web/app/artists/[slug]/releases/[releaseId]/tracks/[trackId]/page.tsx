import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository, getTrackAudio, getLikeState, getLikeCount } from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import { auth } from '@/auth';
import { LikeButton } from './like-button';
import { TrackWaveformPlayer } from './waveform-player';

type Props = { params: Promise<{ slug: string; releaseId: string; trackId: string }> };

async function getPageData(slug: string, releaseId: string, trackId: string) {
  const [artistResult, releaseResult] = await Promise.all([
    new ArtistService(new DrizzleArtistRepository(db)).getBySlug(slug),
    new ReleaseService(new DrizzleReleaseRepository(db)).getWithTracks(releaseId),
  ]);

  if (!artistResult.ok || !releaseResult.ok) return null;

  const artist = artistResult.value;
  const { release, tracks } = releaseResult.value;

  if (release.artistProfileId !== artist.id) return null;

  const track = tracks.find((t) => t.id === trackId);
  if (!track) return null;

  return { artist, release, tracks, track };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, releaseId, trackId } = await params;
  const data = await getPageData(slug, releaseId, trackId);
  if (!data) return { title: 'Не найдено' };

  const { artist, release, track } = data;
  return {
    title: `${track.title} — ${artist.name}`,
    description: `${track.title} · ${release.title}`,
    openGraph: {
      title: `${track.title} — ${artist.name}`,
      images: release.coverUrl ? [{ url: release.coverUrl }] : [],
    },
  };
}

export default async function TrackPage({ params }: Props) {
  const { slug, releaseId, trackId } = await params;
  const data = await getPageData(slug, releaseId, trackId);
  if (!data) notFound();

  const { artist, release, tracks, track } = data;
  const { bg, text, accent, grain } = artist.themeTokens;

  const [session, trackAudio, likeCount] = await Promise.all([
    auth(),
    getTrackAudio(trackId),
    getLikeCount(trackId),
  ]);

  const liked = session?.user?.id
    ? await getLikeState(session.user.id, trackId)
    : false;

  const queue = tracks
    .filter((t) => t.status === 'READY')
    .map((t) => ({ id: t.id, title: t.title, artistName: artist.name, coverUrl: release.coverUrl }));

  const playerTrack = track.status === 'READY'
    ? { id: track.id, title: track.title, artistName: artist.name, coverUrl: release.coverUrl }
    : null;

  return (
    <div
      style={{ '--artist-bg': bg, '--artist-text': text, '--artist-accent': accent } as React.CSSProperties}
      className="min-h-screen bg-[var(--artist-bg)] text-[var(--artist-text)]"
    >
      {grain && <GrainOverlay />}

      <div className="mx-auto max-w-2xl px-6 py-12 space-y-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-mono opacity-40">
          <Link href={`/artists/${slug}`} className="hover:opacity-100 transition-opacity">
            {artist.name}
          </Link>
          <span>/</span>
          <Link href={`/artists/${slug}/releases/${releaseId}`} className="hover:opacity-100 transition-opacity">
            {release.title}
          </Link>
        </nav>

        {/* Track header */}
        <header className="flex items-start gap-6">
          {release.coverUrl ? (
            <img
              src={release.coverUrl}
              alt={release.title}
              className="w-24 h-24 shrink-0 shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 shrink-0 bg-white/5" />
          )}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-mono opacity-40">
              {track.trackNumber}. {release.title}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">
              {track.title}
            </h1>
            <div className="flex items-center gap-4">
              {track.durationSec && (
                <span className="text-xs font-mono opacity-40">{fmt(track.durationSec)}</span>
              )}
              {session?.user
                ? <LikeButton trackId={trackId} initialLiked={liked} initialCount={likeCount} />
                : likeCount > 0 && (
                    <span className="text-xs font-mono opacity-30 flex items-center gap-1">
                      <HeartOutline /> {likeCount}
                    </span>
                  )
              }
            </div>
          </div>
        </header>

        {/* Waveform player */}
        {playerTrack && (
          <TrackWaveformPlayer
            track={playerTrack}
            queue={queue}
            queueIndex={queue.findIndex((q) => q.id === track.id)}
            peaks={trackAudio?.waveformPeaks ?? null}
          />
        )}
        {track.status === 'PROCESSING' && (
          <div className="py-8 text-center text-sm opacity-30 font-mono">
            Трек обрабатывается…
          </div>
        )}

        {/* Metadata */}
        {(trackAudio?.bpm || trackAudio?.musicalKey) && (
          <div className="flex gap-4">
            {trackAudio.bpm && (
              <MetaPill label="BPM" value={String(trackAudio.bpm)} />
            )}
            {trackAudio.musicalKey && (
              <MetaPill label="Key" value={trackAudio.musicalKey} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 space-y-0.5">
      <p className="text-[10px] font-mono uppercase tracking-widest opacity-40">{label}</p>
      <p className="text-sm font-mono">{value}</p>
    </div>
  );
}

function HeartOutline() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
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

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
