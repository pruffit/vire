import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  db, DrizzleArtistRepository, DrizzleReleaseRepository,
  getTrackAudio, getLikeState, getLikeCount, hasPurchasedTrack, getPendingPurchase,
  getTrackMoods, getAggregateMoments,
} from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import { auth } from '@/auth';
import { ZoomableCover } from '@/components/zoomable-cover';
import { LikeButton } from './like-button';
import { TrackWaveformPlayer } from './waveform-player';
import { DownloadButton } from './download-button';
import { MoodBadges } from '@/components/mood-badges';
import { AddToPlaylistButton } from '@/components/add-to-playlist-button';
import { JsonLd } from '@/components/json-ld';
import { musicRecordingJsonLd } from '@/lib/structured-data';
import { LiveListeners } from '@/components/live-listeners';
import { countListening } from '@/lib/presence';
import { formatDuration } from '@/lib/format';
import { artistFontStyle } from '@/lib/fonts';

type Props = { params: Promise<{ slug: string; releaseId: string; trackId: string }>; searchParams: Promise<{ t?: string }> };

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
  const url = `/artists/${slug}/releases/${releaseId}/tracks/${trackId}`;
  const description = `${track.title} · ${release.title} — ${artist.name} на Vire.`;
  return {
    title: `${track.title} — ${artist.name}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'music.song',
      url,
      title: `${track.title} — ${artist.name}`,
      description,
      images: release.coverUrl ? [{ url: release.coverUrl }] : [],
    },
  };
}

export default async function TrackPage({ params, searchParams }: Props) {
  const { slug, releaseId, trackId } = await params;
  const { t } = await searchParams;
  const seekTo = t ? parseInt(t, 10) : undefined;

  const data = await getPageData(slug, releaseId, trackId);
  if (!data) notFound();

  const { artist, release, tracks, track } = data;
  const { bg, text, accent, grain } = artist.themeTokens;

  const [session, trackAudio, likeCount, moods, moments, liveCount] = await Promise.all([
    auth(),
    getTrackAudio(trackId),
    getLikeCount(trackId),
    getTrackMoods(trackId),
    getAggregateMoments(trackId),
    countListening(trackId).catch(() => 0),
  ]);

  const userId = session?.user?.id;
  const [liked, owned, pendingPurchase] = await Promise.all([
    userId ? getLikeState(userId, trackId) : Promise.resolve(false),
    userId && track.status === 'READY' ? hasPurchasedTrack(userId, trackId) : Promise.resolve(false),
    userId && track.status === 'READY' ? getPendingPurchase(userId, trackId) : Promise.resolve(null),
  ]);
  const pending = !owned && pendingPurchase !== null;

  const queue = tracks
    .filter((t) => t.status === 'READY')
    .map((t) => ({ id: t.id, title: t.title, artistName: artist.name, coverUrl: release.coverUrl, artistSlug: slug, releaseId }));

  const playerTrack = track.status === 'READY'
    ? { id: track.id, title: track.title, artistName: artist.name, coverUrl: release.coverUrl, artistSlug: slug, releaseId }
    : null;

  return (
    <div
      style={{ '--artist-bg': bg, '--artist-text': text, '--artist-accent': accent, ...artistFontStyle(artist.themeTokens) } as React.CSSProperties}
      className="min-h-full bg-[var(--artist-bg)] text-[var(--artist-text)] font-sans"
    >
      <JsonLd
        data={musicRecordingJsonLd(
          { id: track.id, title: track.title, trackNumber: track.trackNumber, durationSec: track.durationSec },
          { id: release.id, title: release.title, coverUrl: release.coverUrl },
          { name: artist.name, slug },
        )}
      />
      {grain && <GrainOverlay />}

      <div className="mx-auto max-w-2xl px-6 py-12 space-y-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-mono opacity-40">
          <Link href={`/artists/${slug}`} className="hover:opacity-100 transition-opacity">
            {artist.name}
          </Link>
          <span className="opacity-50">·</span>
          <Link href={`/artists/${slug}/releases/${releaseId}`} className="hover:opacity-100 transition-opacity">
            {release.title}
          </Link>
        </nav>

        {/* Track header */}
        <header className="flex items-start gap-6 sm:gap-8">
          {release.coverUrl ? (
            <ZoomableCover
              src={release.coverUrl}
              alt={release.title}
              className="w-28 h-28 sm:w-36 sm:h-36 shrink-0 shadow-xl rounded-lg"
              sizes="(max-width: 640px) 112px, 144px"
            />
          ) : (
            <div className="w-28 h-28 sm:w-36 sm:h-36 shrink-0 rounded-lg bg-white/5" />
          )}
          <div className="space-y-3 pt-1 min-w-0">
            <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest">
              {track.trackNumber < 10 ? `0${track.trackNumber}` : track.trackNumber} · {release.title}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight text-balance">
              {track.title}
            </h1>
            <div className="flex items-center gap-4 flex-wrap">
              {track.durationSec && (
                <span className="text-xs font-mono opacity-40">{formatDuration(track.durationSec)}</span>
              )}
              {session?.user
                ? <LikeButton trackId={trackId} initialLiked={liked} initialCount={likeCount} />
                : likeCount > 0 && (
                    <span className="text-xs font-mono opacity-30 flex items-center gap-1">
                      <HeartOutline /> {likeCount}
                    </span>
                  )
              }
              {session?.user && track.status === 'READY' && (
                <DownloadButton
                  trackId={trackId}
                  trackTitle={`${track.title} - ${artist.name}`}
                  initialOwned={owned}
                  initialPending={pending}
                />
              )}
              {session?.user && (
                <AddToPlaylistButton trackId={trackId} variant="artist" />
              )}
            </div>

            {/* Live «слушают сейчас» */}
            <LiveListeners trackId={trackId} initialCount={liveCount} />

            {/* Mood tags */}
            {moods.length > 0 && (
              <MoodBadges moods={moods} variant="artist" className="pt-1" />
            )}
          </div>
        </header>

        {/* Waveform player */}
        {playerTrack && (
          <TrackWaveformPlayer
            track={playerTrack}
            queue={queue}
            queueIndex={queue.findIndex((q) => q.id === track.id)}
            peaks={trackAudio?.waveformPeaks ?? null}
            moments={moments}
            trackId={trackId}
            seekTo={seekTo}
          />
        )}
        {track.status === 'PROCESSING' && (
          <div className="py-8 text-center text-sm opacity-30 font-mono">
            Трек обрабатывается…
          </div>
        )}

        {/* Metadata */}
        {(trackAudio?.bpm || trackAudio?.musicalKey) && (
          <div className="flex gap-3">
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
    <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/8 space-y-1 min-w-[72px]">
      <p className="text-[9px] font-mono uppercase tracking-[0.18em] opacity-35">{label}</p>
      <p className="text-xl font-mono leading-none tabular-nums">{value}</p>
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
