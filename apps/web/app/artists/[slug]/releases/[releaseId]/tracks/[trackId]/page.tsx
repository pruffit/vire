import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  db, DrizzleArtistRepository, DrizzleReleaseRepository,
  getTrackAudio, getLikeState, getLikeCount,
  getTrackMoods, getAggregateMoments,
} from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import { auth } from '@/auth';
import { ZoomableCover } from '@/components/zoomable-cover';
import { LikeButton } from './like-button';
import { TrackWaveformPlayer } from './waveform-player';
import { MoodBadges } from '@/components/mood-badges';
import { AddToPlaylistButton } from '@/components/add-to-playlist-button';
import { JsonLd } from '@/components/json-ld';
import { musicRecordingJsonLd } from '@/lib/structured-data';
import { LiveListeners } from '@/components/live-listeners';
import { GrainOverlay } from '@/components/grain-overlay';
import { AmbientBackdrop } from '@/components/ambient-backdrop';
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
  const liked = userId ? await getLikeState(userId, trackId) : false;

  const queue = tracks
    .filter((t) => t.status === 'READY')
    .map((t) => ({ id: t.id, title: t.title, artistName: artist.name, coverUrl: release.coverUrl, artistSlug: slug, releaseId }));

  const playerTrack = track.status === 'READY'
    ? { id: track.id, title: track.title, artistName: artist.name, coverUrl: release.coverUrl, artistSlug: slug, releaseId }
    : null;

  const trackNo = track.trackNumber < 10 ? `0${track.trackNumber}` : String(track.trackNumber);

  return (
    <div
      style={{ '--artist-bg': bg, '--artist-text': text, '--artist-accent': accent, ...artistFontStyle(artist.themeTokens) } as React.CSSProperties}
      className="relative min-h-full bg-[var(--artist-bg)] text-[var(--artist-text)] font-sans overflow-hidden"
    >
      <JsonLd
        data={musicRecordingJsonLd(
          { id: track.id, title: track.title, trackNumber: track.trackNumber, durationSec: track.durationSec },
          { id: release.id, title: release.title, coverUrl: release.coverUrl },
          { name: artist.name, slug },
        )}
      />
      {release.coverUrl && <AmbientBackdrop src={release.coverUrl} />}
      {grain && <GrainOverlay />}

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-10 sm:py-14 space-y-10 sm:space-y-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-mono opacity-50">
          <Link href={`/artists/${slug}`} className="hover:opacity-100 transition-opacity">
            {artist.name}
          </Link>
          <span className="opacity-50">·</span>
          <Link href={`/artists/${slug}/releases/${releaseId}`} className="hover:opacity-100 transition-opacity">
            {release.title}
          </Link>
        </nav>

        {/* Track header — обложка крупно + информация */}
        <header className="flex flex-col sm:flex-row gap-7 sm:gap-9 items-start sm:items-end">
          {release.coverUrl ? (
            <ZoomableCover
              src={release.coverUrl}
              alt={release.title}
              className="w-44 h-44 sm:w-56 sm:h-56 shrink-0 shadow-2xl rounded-xl"
              sizes="(max-width: 640px) 176px, 224px"
            />
          ) : (
            <div className="w-44 h-44 sm:w-56 sm:h-56 shrink-0 rounded-xl bg-white/5" />
          )}
          <div className="space-y-4 min-w-0 flex-1">
            <p className="text-[11px] font-mono opacity-50 tracking-widest">
              <span style={{ color: 'var(--artist-accent)' }}>{trackNo}</span>
              <span className="opacity-60"> · {release.title}</span>
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[0.95] text-balance">
              {track.title}
            </h1>

            {/* Технический мета-ряд: длительность · BPM · тональность */}
            <MetaRow
              durationSec={track.durationSec}
              bpm={trackAudio?.bpm ?? null}
              musicalKey={trackAudio?.musicalKey ?? null}
            />

            {/* Действия */}
            <div className="flex items-center gap-4 flex-wrap pt-0.5">
              {session?.user
                ? <LikeButton trackId={trackId} initialLiked={liked} initialCount={likeCount} />
                : likeCount > 0 && (
                    <span className="text-xs font-mono opacity-40 flex items-center gap-1">
                      <HeartOutline /> {likeCount}
                    </span>
                  )
              }
              {session?.user && (
                <AddToPlaylistButton trackId={trackId} variant="artist" />
              )}
            </div>

            {/* Live «слушают сейчас» */}
            <LiveListeners trackId={trackId} initialCount={liveCount} />

            {/* Mood tags */}
            {moods.length > 0 && (
              <MoodBadges moods={moods} variant="artist" className="pt-0.5" />
            )}
          </div>
        </header>

        {/* Waveform player — центральный элемент */}
        {playerTrack && (
          <div className="rounded-2xl p-5 sm:p-6 bg-black/15 backdrop-blur-sm ring-1 ring-white/[0.06]">
            <TrackWaveformPlayer
              track={playerTrack}
              queue={queue}
              queueIndex={queue.findIndex((q) => q.id === track.id)}
              peaks={trackAudio?.waveformPeaks ?? null}
              moments={moments}
              trackId={trackId}
              seekTo={seekTo}
            />
          </div>
        )}
        {track.status === 'PROCESSING' && (
          <div className="rounded-2xl py-10 text-center text-sm opacity-40 font-mono bg-black/15 ring-1 ring-white/[0.06]">
            Трек обрабатывается…
          </div>
        )}

        {/* Контекст релиза — переход между треками, заодно заполняет полотно */}
        {tracks.length > 1 && (
          <section className="space-y-3">
            <Link
              href={`/artists/${slug}/releases/${releaseId}`}
              className="inline-flex items-center gap-2 text-xs font-mono opacity-50 hover:opacity-90 transition-opacity"
            >
              Из релиза «{release.title}»
            </Link>
            <div className="rounded-2xl overflow-hidden bg-black/15 ring-1 ring-white/[0.06]">
              {tracks.map((t) => {
                const isCurrent = t.id === track.id;
                const no = t.trackNumber < 10 ? `0${t.trackNumber}` : String(t.trackNumber);
                const inner = (
                  <>
                    <span
                      className="w-6 text-right text-xs font-mono shrink-0 tabular-nums"
                      style={{ color: isCurrent ? 'var(--artist-accent)' : undefined, opacity: isCurrent ? 1 : 0.4 }}
                    >
                      {no}
                    </span>
                    <span
                      className="flex-1 truncate text-sm"
                      style={isCurrent ? { color: 'var(--artist-accent)' } : undefined}
                    >
                      {t.title}
                    </span>
                    {t.status === 'PROCESSING' && (
                      <span className="text-[10px] font-mono opacity-30 shrink-0">обработка…</span>
                    )}
                    {t.durationSec != null && t.status === 'READY' && (
                      <span className="text-xs font-mono opacity-35 shrink-0">{formatDuration(t.durationSec)}</span>
                    )}
                  </>
                );
                return isCurrent ? (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 px-4 py-3 bg-white/[0.04]"
                    aria-current="true"
                  >
                    {inner}
                  </div>
                ) : (
                  <Link
                    key={t.id}
                    href={`/artists/${slug}/releases/${releaseId}/tracks/${t.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** Длительность · BPM · тональность одной строкой, моно, с акцент-разделителями. */
function MetaRow({
  durationSec,
  bpm,
  musicalKey,
}: {
  durationSec: number | null;
  bpm: number | null;
  musicalKey: string | null;
}) {
  const items: string[] = [];
  if (durationSec) items.push(formatDuration(durationSec));
  if (bpm) items.push(`${bpm} BPM`);
  if (musicalKey) items.push(musicalKey);
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2.5 text-xs font-mono opacity-60 tabular-nums">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-2.5">
          {i > 0 && (
            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--artist-accent)' }} aria-hidden="true" />
          )}
          {it}
        </span>
      ))}
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
