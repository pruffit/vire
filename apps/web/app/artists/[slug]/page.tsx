import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository, getFollowState, getFollowerCount, getUpcomingByArtist } from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import type { ArtistProfile, ArtistLink, ArtistVideo, Release } from '@vire/core';
import { FadeUp, Reveal, Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { FollowButton } from './follow-button';
import { parseEmbed, type EmbedInfo } from '@/lib/embed';
import { VideoPlayer } from '@/components/video-player';
import { ReleaseQuickLook } from '@/components/release-quick-look';
import { CountdownBadge } from '@/components/countdown-badge';
import { formatCount } from '@/lib/format';
import { artistFontStyle } from '@/lib/fonts';

type Props = { params: Promise<{ slug: string }> };

async function getArtistData(slug: string) {
  const artistService = new ArtistService(new DrizzleArtistRepository(db));
  const result = await artistService.getBySlug(slug);
  if (!result.ok) return null;

  const releaseService = new ReleaseService(new DrizzleReleaseRepository(db));
  const [releases, upcoming] = await Promise.all([
    releaseService.getPublishedByArtist(result.value.id),
    getUpcomingByArtist(result.value.id),
  ]);

  return { artist: result.value, releases, upcoming };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getArtistData(slug);
  if (!data) return { title: 'Не найдено' };

  const { artist } = data;
  const url = `/artists/${slug}`;
  const description = artist.bio ?? `${artist.name} на Vire — релизы, треки и ссылки.`;
  return {
    title: artist.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'profile',
      url,
      title: artist.name,
      description,
      images: artist.avatarUrl ? [{ url: artist.avatarUrl }] : [],
    },
  };
}

export default async function ArtistPage({ params }: Props) {
  const { slug } = await params;
  const data = await getArtistData(slug);
  if (!data) notFound();

  const { artist, releases, upcoming } = data;
  const { bg, text, accent, grain } = artist.themeTokens;

  const session = await auth();
  const [following, followerCount] = await Promise.all([
    session?.user?.id ? getFollowState(session.user.id, artist.id) : Promise.resolve(false),
    getFollowerCount(artist.id),
  ]);

  return (
    <div
      style={
        {
          '--artist-bg': bg,
          '--artist-text': text,
          '--artist-accent': accent,
          ...artistFontStyle(artist.themeTokens),
        } as React.CSSProperties
      }
      className="min-h-full bg-[var(--artist-bg)] text-[var(--artist-text)] font-sans"
    >
      {grain && <GrainOverlay />}

      <div className="mx-auto max-w-4xl px-6 py-16 space-y-16">
        <ArtistHeader
          artist={artist}
          followButton={
            session?.user
              ? <FollowButton slug={artist.slug} initialFollowing={following} initialCount={followerCount} />
              : <GuestFollowButton slug={artist.slug} followerCount={followerCount} />
          }
        />
        {artist.links.length > 0 && <LinksSection links={artist.links} />}
        {upcoming.length > 0 && <UpcomingSection upcoming={upcoming} />}
        <ReleasesSection releases={releases} artistSlug={artist.slug} artistName={artist.name} />
        {artist.videos.length > 0 && <VideosSection videos={artist.videos} />}
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

function GuestFollowButton({ slug, followerCount }: { slug: string; followerCount: number }) {
  return (
    <div className="flex items-center gap-3">
      <a
        href={`/sign-in?callbackUrl=/artists/${slug}`}
        className="px-4 py-1.5 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--artist-accent)', color: 'var(--artist-bg, var(--background))' }}
      >
        Подписаться
      </a>
      {followerCount > 0 && (
        <span className="text-xs opacity-40 tabular-nums">
          {formatCount(followerCount)} слушателей
        </span>
      )}
    </div>
  );
}

function ArtistHeader({ artist, followButton }: { artist: ArtistProfile; followButton: ReactNode }) {
  return (
    <FadeUp>
      <header className="flex flex-col sm:flex-row items-start gap-8 sm:gap-10">
        {artist.avatarUrl ? (
          <Image
            src={artist.avatarUrl}
            alt={artist.name}
            width={192}
            height={192}
            className="w-36 h-36 sm:w-48 sm:h-48 rounded-full object-cover shrink-0"
            style={{
              boxShadow: [
                '0 0 0 2px color-mix(in oklch, var(--artist-accent) 40%, transparent)',
                '0 0 24px 4px color-mix(in oklch, var(--artist-accent) 14%, transparent)',
              ].join(', '),
            }}
          />
        ) : (
          <div
            className="w-36 h-36 sm:w-48 sm:h-48 rounded-full shrink-0 bg-white/5 flex items-center justify-center text-5xl font-mono opacity-40"
            style={{ boxShadow: '0 0 0 2px color-mix(in oklch, var(--artist-accent) 40%, transparent)' }}
          >
            {artist.name[0]}
          </div>
        )}

        <div className="space-y-4 sm:pt-3 min-w-0">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight text-balance">
              {artist.name}
            </h1>
            {artist.verified && (
              <span
                className="inline-flex text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border opacity-60"
                style={{ borderColor: 'var(--artist-accent)', color: 'var(--artist-accent)' }}
              >
                verified
              </span>
            )}
          </div>
          {artist.bio && (
            <p className="text-sm leading-relaxed opacity-70 max-w-prose">{artist.bio}</p>
          )}
          {followButton}
        </div>
      </header>
    </FadeUp>
  );
}

function LinksSection({ links }: { links: ArtistLink[] }) {
  return (
    <section className="flex flex-wrap gap-3">
      {links.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-full text-sm font-medium border transition-opacity hover:opacity-70"
          style={{ borderColor: 'var(--artist-accent)', color: 'var(--artist-accent)' }}
        >
          {link.label}
        </a>
      ))}
    </section>
  );
}

function UpcomingSection({ upcoming }: { upcoming: Array<{ id: string; title: string; releaseDate: Date | null }> }) {
  const withDate = upcoming.filter((r) => r.releaseDate);
  if (withDate.length === 0) return null;

  return (
    <Reveal>
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest opacity-40 font-mono">Скоро</h2>
        <div className="flex flex-col gap-3">
          {withDate.map((r) => (
            <CountdownBadge key={r.id} releaseDate={r.releaseDate!} title={r.title} />
          ))}
        </div>
      </section>
    </Reveal>
  );
}

function ReleasesSection({ releases, artistSlug, artistName }: { releases: Release[]; artistSlug: string; artistName: string }) {
  if (releases.length === 0) return null;

  return (
    <Reveal>
      <section className="space-y-6">
        <h2 className="text-xs uppercase tracking-widest opacity-40 font-mono">Релизы</h2>
        <Stagger className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          {releases.map((release) => (
            <StaggerItem key={release.id}>
              <ReleaseQuickLook
                showArtist={false}
                release={{
                  id: release.id,
                  title: release.title,
                  coverUrl: release.coverUrl,
                  type: release.type,
                  artistName,
                  artistSlug,
                  releaseDate: release.releaseDate,
                }}
              />
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </Reveal>
  );
}

function VideosSection({ videos }: { videos: ArtistVideo[] }) {
  const embeds = videos
    .map((v) => ({ title: v.title, embed: parseEmbed(v.url) }))
    .filter((v): v is { title: string; embed: EmbedInfo } => v.embed !== null);

  if (embeds.length === 0) return null;

  return (
    <Reveal>
      <section className="space-y-6">
        <h2 className="text-xs uppercase tracking-widest opacity-40 font-mono">Видео</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {embeds.map((v, i) => (
            <div key={i} className="space-y-2">
              <VideoPlayer embed={v.embed} title={v.title} />
              {v.title && (
                <p className="text-sm opacity-70 leading-snug">{v.title}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}

