import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  db,
  DrizzleArtistRepository,
  DrizzleReleaseRepository,
  getFollowState,
  getFollowerCount,
  getUpcomingByArtist,
} from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import type { ArtistProfile, ArtistLink, ArtistVideo, Release } from '@vire/core';
import { FadeUp, Reveal, Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { FollowButton } from './follow-button';
import { parseEmbed, type EmbedInfo } from '@/lib/embed';
import { VideoPlayer } from '@/components/video-player';
import { ReleaseQuickLook } from '@/components/release-quick-look';
import { CountdownBadge } from '@/components/countdown-badge';
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

  const followButton = session?.user ? (
    <FollowButton slug={artist.slug} initialFollowing={following} initialCount={followerCount} />
  ) : (
    <GuestFollowButton slug={artist.slug} followerCount={followerCount} />
  );

  return (
    <div
      style={
        {
          '--artist-bg': bg,
          '--artist-text': text,
          '--artist-accent': accent,
          // Stage-light gradient: accent bleeds from the top, fading into artist bg
          background:
            'radial-gradient(ellipse 90% 50% at 50% -8%, color-mix(in oklch, var(--artist-accent) 10%, var(--artist-bg)), var(--artist-bg))',
          ...artistFontStyle(artist.themeTokens),
        } as React.CSSProperties
      }
      className="min-h-full text-[var(--artist-text)] font-sans"
    >
      {grain && <GrainOverlay />}

      <div className="mx-auto max-w-4xl px-6 py-16 space-y-16">
        <ArtistHero artist={artist} followButton={followButton} />
        {upcoming.length > 0 && <UpcomingSection upcoming={upcoming} />}
        <ReleasesSection
          releases={releases}
          artistSlug={artist.slug}
          artistName={artist.name}
        />
        {artist.videos.length > 0 && <VideosSection videos={artist.videos} />}
      </div>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────

function ArtistHero({
  artist,
  followButton,
}: {
  artist: ArtistProfile;
  followButton: ReactNode;
}) {
  return (
    <FadeUp>
      <header className="flex flex-col items-center text-center gap-5 pt-4">
        {/* Avatar with layered accent glow */}
        {artist.avatarUrl ? (
          <Image
            src={artist.avatarUrl}
            alt={artist.name}
            width={200}
            height={200}
            priority
            className="w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover"
            style={{
              boxShadow: [
                '0 0 0 2px color-mix(in oklch, var(--artist-accent) 55%, transparent)',
                '0 0 40px 8px color-mix(in oklch, var(--artist-accent) 18%, transparent)',
                '0 0 100px 30px color-mix(in oklch, var(--artist-accent) 7%, transparent)',
              ].join(', '),
            }}
          />
        ) : (
          <div
            className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-white/5 flex items-center justify-center text-6xl font-mono opacity-30"
            style={{
              boxShadow: [
                '0 0 0 2px color-mix(in oklch, var(--artist-accent) 55%, transparent)',
                '0 0 40px 8px color-mix(in oklch, var(--artist-accent) 18%, transparent)',
              ].join(', '),
            }}
          >
            {artist.name[0]}
          </div>
        )}

        {/* Name */}
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-none text-balance">
            {artist.name}
          </h1>
          {artist.verified && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full border"
              style={{
                borderColor: 'color-mix(in oklch, var(--artist-accent) 45%, transparent)',
                color: 'var(--artist-accent)',
              }}
            >
              <VerifiedStar />
              verified
            </span>
          )}
        </div>

        {/* Follow */}
        <div>{followButton}</div>

        {/* Bio */}
        {artist.bio && (
          <p className="text-sm leading-relaxed opacity-60 max-w-[58ch]">{artist.bio}</p>
        )}

        {/* Links */}
        {artist.links.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {artist.links.map((link: ArtistLink, i: number) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 rounded-full text-xs font-medium border transition-all hover:opacity-70"
                style={{
                  borderColor: 'color-mix(in oklch, var(--artist-accent) 40%, transparent)',
                  color: 'var(--artist-accent)',
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </header>
    </FadeUp>
  );
}

// ─── Upcoming ──────────────────────────────────────────────────────────────

function UpcomingSection({
  upcoming,
}: {
  upcoming: Array<{ id: string; title: string; releaseDate: Date | null }>;
}) {
  const withDate = upcoming.filter((r) => r.releaseDate);
  if (withDate.length === 0) return null;

  return (
    <Reveal>
      <section className="flex flex-col gap-3">
        {withDate.map((r) => (
          <CountdownBadge key={r.id} releaseDate={r.releaseDate!} title={r.title} />
        ))}
      </section>
    </Reveal>
  );
}

// ─── Releases ──────────────────────────────────────────────────────────────

function ReleasesSection({
  releases,
  artistSlug,
  artistName,
}: {
  releases: Release[];
  artistSlug: string;
  artistName: string;
}) {
  if (releases.length === 0) return null;

  function toQL(r: Release) {
    return {
      id: r.id,
      title: r.title,
      coverUrl: r.coverUrl,
      type: r.type,
      artistName,
      artistSlug,
      releaseDate: r.releaseDate,
    };
  }

  const [first, ...rest] = releases;

  return (
    <Reveal>
      <section>
        {releases.length === 1 ? (
          // Single release: show at reasonable width
          <div className="max-w-[220px]">
            <ReleaseQuickLook showArtist={false} release={toQL(first)} />
          </div>
        ) : (
          // Multiple releases: featured first (larger), rest smaller grid
          <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {/* Featured — spans 2 cols, appears larger */}
            <StaggerItem className="col-span-2">
              <ReleaseQuickLook showArtist={false} release={toQL(first)} />
            </StaggerItem>
            {rest.map((r) => (
              <StaggerItem key={r.id}>
                <ReleaseQuickLook showArtist={false} release={toQL(r)} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </Reveal>
  );
}

// ─── Videos ────────────────────────────────────────────────────────────────

function VideosSection({ videos }: { videos: ArtistVideo[] }) {
  const embeds = videos
    .map((v) => ({ title: v.title, embed: parseEmbed(v.url) }))
    .filter((v): v is { title: string; embed: EmbedInfo } => v.embed !== null);

  if (embeds.length === 0) return null;

  return (
    <Reveal>
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {embeds.map((v, i) => (
            <div key={i} className="space-y-2">
              <VideoPlayer embed={v.embed} title={v.title} />
              {v.title && <p className="text-sm opacity-60 leading-snug">{v.title}</p>}
            </div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}

// ─── Utility components ────────────────────────────────────────────────────

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

function GuestFollowButton({
  slug,
  followerCount,
}: {
  slug: string;
  followerCount: number;
}) {
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
        <span className="text-xs opacity-40 tabular-nums font-mono">
          {followerCount.toLocaleString('ru')} слушателей
        </span>
      )}
    </div>
  );
}

function VerifiedStar() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5 0L6.18 3.32L9.76 3.09L7.1 5.27L8.09 8.82L5 6.9L1.91 8.82L2.9 5.27L0.24 3.09L3.82 3.32L5 0Z" />
    </svg>
  );
}
