import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  db, DrizzleReleaseRepository,
  getTrackAudio, getLikeState, getLikeCount,
  getTrackMoods, getAggregateMoments,
} from '@vire/db';
import { ReleaseService, isReleasePubliclyVisible, type TrackCredit } from '@vire/core';
import { auth } from '@/auth';
import { getArtist } from '../../../../artist-guard';
import { ZoomableCover } from '@/components/zoomable-cover';
import { LikeButton } from './like-button';
import { TrackWaveformPlayer } from './waveform-player';
import { MoodBadges } from '@/components/mood-badges';
import { ExplicitBadge } from '@/components/explicit-badge';
import { displayTrackTitle, featLabel, featuredNames } from '@/lib/track-display';
import { TrackTitleText } from '@/components/track-title';
import { AddToPlaylistButton } from '@/components/add-to-playlist-button';
import { TrackQueueMenu } from '@/components/track-queue-menu';
import { JsonLd } from '@/components/json-ld';
import { HeartIcon } from '@/components/icons';
import { musicRecordingJsonLd, breadcrumbListJsonLd } from '@/lib/structured-data';
import { LiveListeners } from '@/components/live-listeners';
import { GrainOverlay } from '@/components/grain-overlay';
import { AmbientBackdrop } from '@/components/ambient-backdrop';
import { PageContainer } from '@/components/page-container';
import { countListening } from '@/lib/presence';
import { formatDuration, releaseYear } from '@/lib/format';
import { trackMetaDescription } from '@/lib/meta-descriptions';
import { pageMetadata } from '@/lib/metadata';
import { artistFontStyle } from '@/lib/fonts';
import { SectionHeader } from '@/components/section-header';
import { TrackLyrics } from './track-lyrics';

type Props = { params: Promise<{ slug: string; releaseId: string; trackId: string }>; searchParams: Promise<{ t?: string }> };

async function getPageData(slug: string, releaseId: string, trackId: string) {
  const [artist, releaseResult] = await Promise.all([
    getArtist(slug),
    new ReleaseService(new DrizzleReleaseRepository(db), { uuid: () => crypto.randomUUID() }).getWithTracks(releaseId),
  ]);

  if (!artist || !releaseResult.ok) return null;

  const { release, tracks } = releaseResult.value;

  if (release.artistProfileId !== artist.id) return null;

  // трек неопубликованного релиза публично не существует — иначе страница отдаст лирику и плеер до релиза
  if (!isReleasePubliclyVisible(release, new Date())) return null;

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
  const fullTitle = displayTrackTitle(track.title, { version: track.version, credits: track.credits });
  const description = trackMetaDescription({
    trackTitle: fullTitle,
    releaseTitle: release.title,
    artistName: artist.name,
    year: releaseYear(release.releaseDate),
  });
  const title = `${fullTitle} — ${artist.name}`;
  return pageMetadata({
    url,
    title,
    description,
    type: 'music.song',
    images: null, // своя брендовая карточка — opengraph-image.tsx этого сегмента
  });
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
    .map((t) => ({
      id: t.id, title: t.title, artistName: artist.name, coverUrl: release.coverUrl, artistSlug: slug,
      releaseId, accentColor: accent, isExplicit: t.isExplicit, version: t.version, feat: featuredNames(t.credits),
    }));

  const playerTrack = track.status === 'READY'
    ? {
        id: track.id, title: track.title, artistName: artist.name, coverUrl: release.coverUrl, artistSlug: slug,
        releaseId, accentColor: accent, isExplicit: track.isExplicit, version: track.version, feat: featuredNames(track.credits),
      }
    : null;

  const playContext = { source: 'release' as const, sourceId: releaseId };

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
          {
            id: track.id,
            title: displayTrackTitle(track.title, { version: track.version, credits: track.credits }),
            durationSec: track.durationSec,
          },
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

      <PageContainer as="div" variant="detail" className="py-10 sm:py-14">
        <nav className="flex flex-wrap items-center gap-2 min-w-0 text-xs font-mono text-[color-mix(in_oklch,var(--artist-text)_55%,transparent)]">
          <Link href={`/artists/${slug}`} className="truncate max-w-[16rem] hover:text-[var(--artist-text)] transition-colors">
            {artist.name}
          </Link>
          <span>·</span>
          <Link href={`/artists/${slug}/releases/${releaseId}`} className="truncate max-w-[16rem] hover:text-[var(--artist-text)] transition-colors">
            {release.title}
          </Link>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[clamp(300px,24%,380px)_1fr] gap-10 lg:gap-12 lg:items-start mt-10 sm:mt-12">
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
                  {track.title}
                  {track.isExplicit && <ExplicitBadge />}
                </h1>
                <TrackMetaLine credits={track.credits} version={track.version} />
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
                  {playerTrack && (
                    <TrackQueueMenu
                      context={playContext}
                      track={playerTrack}
                      size="md"
                      variant="artist"
                    />
                  )}
                </div>
                <LiveListeners trackId={trackId} initialCount={liveCount} />
                {moods.length > 0 && (
                  <MoodBadges moods={moods} variant="artist" className="pt-0.5" />
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-10 sm:space-y-12">
            {playerTrack && (
              <div className="rounded-2xl p-5 sm:p-6 bg-[color-mix(in_oklch,var(--artist-text)_4%,transparent)] backdrop-blur-sm ring-1 ring-[color-mix(in_oklch,var(--artist-text)_8%,transparent)]">
                <TrackWaveformPlayer
                  track={playerTrack}
                  queue={queue}
                  queueIndex={queue.findIndex((q) => q.id === track.id)}
                  peaks={trackAudio?.waveformPeaks ?? null}
                  moments={moments}
                  trackId={trackId}
                  context={playContext}
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
                    context={playContext}
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
                          <span className="truncate">
                            <TrackTitleText title={t.title} version={t.version} feat={featuredNames(t.credits)} />
                          </span>
                          {t.isExplicit && <ExplicitBadge />}
                        </span>
                        {t.status === 'PROCESSING' && (
                          <span className="text-[10px] font-mono text-[color-mix(in_oklch,var(--artist-text)_30%,transparent)] shrink-0">обработка…</span>
                        )}
                        {t.durationSec != null && t.status === 'READY' && (
                          <span className="text-xs readout text-[color-mix(in_oklch,var(--artist-text)_35%,transparent)] shrink-0">{formatDuration(t.durationSec)}</span>
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
      </PageContainer>
    </div>
  );
}

/** Фит + версия отдельной приглушённой строкой под h1 — не в display-шрифте заголовка. */
function TrackMetaLine({ credits, version }: { credits: TrackCredit[]; version: string | null }) {
  const line = [featLabel(credits), version?.trim()].filter(Boolean).join(' · ');
  if (!line) return null;
  return (
    <p className="text-sm text-[color-mix(in_oklch,var(--artist-text)_55%,transparent)]">{line}</p>
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
    <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-[color-mix(in_oklch,var(--artist-text)_62%,transparent)] tabular-nums">
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
