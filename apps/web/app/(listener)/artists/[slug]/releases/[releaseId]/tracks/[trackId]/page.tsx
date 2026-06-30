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
import { ExplicitBadge } from '@/components/explicit-badge';
import { displayTrackTitle } from '@/lib/track-display';
import { AddToPlaylistButton } from '@/components/add-to-playlist-button';
import { JsonLd } from '@/components/json-ld';
import { HeartIcon } from '@/components/icons';
import { musicRecordingJsonLd, breadcrumbListJsonLd } from '@/lib/structured-data';
import { LiveListeners } from '@/components/live-listeners';
import { GrainOverlay } from '@/components/grain-overlay';
import { AmbientBackdrop } from '@/components/ambient-backdrop';
import { countListening } from '@/lib/presence';
import { formatDuration } from '@/lib/format';
import { artistFontStyle } from '@/lib/fonts';
import { SectionHeader } from '@/components/section-header';
import { TrackLyrics } from './track-lyrics';

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
      images: release.coverUrl ? [{ url: release.coverUrl }] : undefined,
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
    .map((t) => ({ id: t.id, title: t.title, artistName: artist.name, coverUrl: release.coverUrl, artistSlug: slug, releaseId, isExplicit: t.isExplicit }));

  const playerTrack = track.status === 'READY'
    ? { id: track.id, title: track.title, artistName: artist.name, coverUrl: release.coverUrl, artistSlug: slug, releaseId, isExplicit: track.isExplicit }
    : null;

  const trackNo = track.trackNumber < 10 ? `0${track.trackNumber}` : String(track.trackNumber);
  const longestWord = Math.max(1, ...track.title.split(/\s+/).map((w) => w.length));
  const titleMaxRem = Math.max(2, Math.min(3.4, 20 / longestWord));

  return (
    <div
      style={{ '--artist-bg': bg, '--artist-text': text, '--artist-accent': accent, ...artistFontStyle(artist.themeTokens) } as React.CSSProperties}
      className="relative min-h-full bg-[var(--artist-bg)] text-[var(--artist-text)] font-sans overflow-x-clip"
    >
      <JsonLd
        data={musicRecordingJsonLd(
          { id: track.id, title: track.title, trackNumber: track.trackNumber, durationSec: track.durationSec },
          { id: release.id, title: release.title, coverUrl: release.coverUrl, releaseDate: release.releaseDate },
          { name: artist.name, slug },
        )}
      />
      <JsonLd data={breadcrumbListJsonLd([
        { name: 'Главная', url: '/' },
        { name: 'Артисты', url: '/artists' },
        { name: artist.name, url: `/artists/${slug}` },
        { name: release.title, url: `/artists/${slug}/releases/${releaseId}` },
        { name: track.title, url: `/artists/${slug}/releases/${releaseId}/tracks/${track.id}` },
      ])} />
      <AmbientBackdrop src={release.coverUrl} />
      {grain && <GrainOverlay />}

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <nav className="flex items-center gap-2 text-xs font-mono text-[color-mix(in_oklch,var(--artist-text)_55%,transparent)]">
          <Link href={`/artists/${slug}`} className="hover:text-[var(--artist-text)] transition-colors">
            {artist.name}
          </Link>
          <span>·</span>
          <Link href={`/artists/${slug}/releases/${releaseId}`} className="hover:text-[var(--artist-text)] transition-colors">
            {release.title}
          </Link>
        </nav>

        <div className="lg:grid lg:grid-cols-[20rem_1fr] lg:gap-14 lg:items-start mt-10 sm:mt-12">
          <div className="lg:sticky lg:top-8 self-start">
            <div className="flex flex-col sm:flex-row lg:flex-col gap-7 sm:gap-9 lg:gap-5 items-start sm:items-end lg:items-start">
              {release.coverUrl ? (
                <ZoomableCover
                  src={release.coverUrl}
                  alt={release.title}
                  className="w-56 h-56 sm:w-72 sm:h-72 lg:h-80 lg:w-80 shrink-0 shadow-2xl rounded-xl"
                  sizes="(max-width: 640px) 224px, (max-width: 1024px) 288px, 320px"
                  priority
                />
              ) : (
                <div className="w-56 h-56 sm:w-72 sm:h-72 lg:h-80 lg:w-80 shrink-0 rounded-xl bg-[color-mix(in_oklch,var(--artist-text)_5%,transparent)]" />
              )}
              <div className="space-y-4 min-w-0 flex-1 lg:flex-none lg:w-full">
                <p className="text-[11px] font-mono text-[color-mix(in_oklch,var(--artist-text)_55%,transparent)] tracking-widest">
                  <span style={{ color: 'var(--artist-accent)' }}>{trackNo}</span>
                  <span className="text-[color-mix(in_oklch,var(--artist-text)_62%,transparent)]"> · {release.title}</span>
                </p>
                <h1
                  className="font-bold tracking-tight leading-[0.95] text-balance break-words flex items-center gap-3 flex-wrap"
                  style={{ fontSize: `clamp(1.9rem, 6vw, ${titleMaxRem}rem)` }}
                >
                  {displayTrackTitle(track.title, { version: track.version, credits: track.credits })}
                  {track.isExplicit && <ExplicitBadge />}
                </h1>
                <MetaRow
                  durationSec={track.durationSec}
                  bpm={trackAudio?.bpm ?? null}
                  musicalKey={trackAudio?.musicalKey ?? null}
                />
                <div className="flex items-center gap-4 flex-wrap pt-0.5">
                  {session?.user
                    ? <LikeButton trackId={trackId} initialLiked={liked} initialCount={likeCount} />
                    : likeCount > 0 && (
                        <span className="text-xs font-mono text-[color-mix(in_oklch,var(--artist-text)_40%,transparent)] flex items-center gap-1">
                          <HeartIcon size={12} /> {likeCount}
                        </span>
                      )
                  }
                  {session?.user && (
                    <AddToPlaylistButton trackId={trackId} variant="artist" />
                  )}
                </div>
                <LiveListeners trackId={trackId} initialCount={liveCount} />
                {moods.length > 0 && (
                  <MoodBadges moods={moods} variant="artist" className="pt-0.5" />
                )}
              </div>
            </div>
          </div>

          <div className="mt-10 lg:mt-0 space-y-10 sm:space-y-12">
            {playerTrack && (
              <div className="rounded-2xl p-5 sm:p-6 bg-[color-mix(in_oklch,var(--artist-text)_4%,transparent)] backdrop-blur-sm ring-1 ring-[color-mix(in_oklch,var(--artist-text)_8%,transparent)]">
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
              <div className="rounded-2xl py-10 text-center text-sm font-mono text-[color-mix(in_oklch,var(--artist-text)_40%,transparent)] bg-[color-mix(in_oklch,var(--artist-text)_4%,transparent)] ring-1 ring-[color-mix(in_oklch,var(--artist-text)_8%,transparent)]">
                Трек обрабатывается…
              </div>
            )}
            {track.lyrics && track.lyrics.length > 0 && (
              <section className="space-y-3">
                <SectionHeader label="Текст" />
                <div className="rounded-2xl p-5 sm:p-6 bg-[color-mix(in_oklch,var(--artist-text)_4%,transparent)] ring-1 ring-[color-mix(in_oklch,var(--artist-text)_8%,transparent)]">
                  <TrackLyrics
                    lines={track.lyrics}
                    track={playerTrack}
                    queue={queue}
                    queueIndex={queue.findIndex((q) => q.id === track.id)}
                    trackId={trackId}
                  />
                </div>
              </section>
            )}
            {tracks.length > 1 && (
              <section className="space-y-3">
                <Link
                  href={`/artists/${slug}/releases/${releaseId}`}
                  className="inline-flex items-center gap-2 text-xs font-mono text-[color-mix(in_oklch,var(--artist-text)_55%,transparent)] hover:text-[color-mix(in_oklch,var(--artist-text)_90%,transparent)] transition-colors"
                >
                  Из релиза «{release.title}»
                </Link>
                <div className="rounded-2xl overflow-hidden bg-[color-mix(in_oklch,var(--artist-text)_4%,transparent)] ring-1 ring-[color-mix(in_oklch,var(--artist-text)_8%,transparent)]">
                  {tracks.map((t) => {
                    const isCurrent = t.id === track.id;
                    const no = t.trackNumber < 10 ? `0${t.trackNumber}` : String(t.trackNumber);
                    const inner = (
                      <>
                        <span
                          className={`w-6 text-right text-xs font-mono shrink-0 tabular-nums ${
                            isCurrent ? '' : 'text-[color-mix(in_oklch,var(--artist-text)_40%,transparent)]'
                          }`}
                          style={isCurrent ? { color: 'var(--artist-accent)' } : undefined}
                        >
                          {no}
                        </span>
                        <span
                          className="flex-1 truncate text-sm flex items-center gap-1.5"
                          style={isCurrent ? { color: 'var(--artist-accent)' } : undefined}
                        >
                          <span className="truncate">{t.title}</span>
                          {t.isExplicit && <ExplicitBadge />}
                        </span>
                        {t.status === 'PROCESSING' && (
                          <span className="text-[10px] font-mono text-[color-mix(in_oklch,var(--artist-text)_30%,transparent)] shrink-0">обработка…</span>
                        )}
                        {t.durationSec != null && t.status === 'READY' && (
                          <span className="text-xs font-mono text-[color-mix(in_oklch,var(--artist-text)_35%,transparent)] shrink-0">{formatDuration(t.durationSec)}</span>
                        )}
                      </>
                    );
                    return isCurrent ? (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-4 py-3 bg-[color-mix(in_oklch,var(--artist-text)_7%,transparent)]"
                        aria-current="true"
                      >
                        {inner}
                      </div>
                    ) : (
                      <Link
                        key={t.id}
                        href={`/artists/${slug}/releases/${releaseId}/tracks/${t.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-[color-mix(in_oklch,var(--artist-text)_7%,transparent)] transition-colors"
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
    <div className="flex items-center gap-2.5 text-xs font-mono text-[color-mix(in_oklch,var(--artist-text)_62%,transparent)] tabular-nums">
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
