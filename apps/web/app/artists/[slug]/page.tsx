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
  listArtistPosts,
} from '@vire/db';
import type { ArtistPost } from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import type { ArtistProfile, ArtistLink, ArtistVideo, Release } from '@vire/core';
import { FadeUp, Reveal, Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { FollowButton } from './follow-button';
import { parseEmbed, type EmbedInfo } from '@/lib/embed';
import { fetchVkPoster } from '@/lib/vk-api';
import { VideoPlayer } from '@/components/video-player';
import { ReleaseQuickLook } from '@/components/release-quick-look';
import { CountdownBadge } from '@/components/countdown-badge';
import { JsonLd } from '@/components/json-ld';
import { musicGroupJsonLd } from '@/lib/structured-data';
import { artistFontStyle } from '@/lib/fonts';
import { GrainOverlay } from '@/components/grain-overlay';
import { ArtistCollapseBar } from './artist-collapse-bar';

type Props = { params: Promise<{ slug: string }> };

async function getArtistData(slug: string) {
  const artistService = new ArtistService(new DrizzleArtistRepository(db));
  const result = await artistService.getBySlug(slug);
  if (!result.ok) return null;

  const releaseService = new ReleaseService(new DrizzleReleaseRepository(db));
  const [releases, upcoming, posts] = await Promise.all([
    releaseService.getPublishedByArtist(result.value.id),
    getUpcomingByArtist(result.value.id),
    listArtistPosts(result.value.id, 5),
  ]);

  return { artist: result.value, releases, upcoming, posts };
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

  const { artist, releases, upcoming, posts } = data;
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
          background: 'var(--artist-bg)',
          ...artistFontStyle(artist.themeTokens),
        } as React.CSSProperties
      }
      className="min-h-full text-[var(--artist-text)] font-sans"
    >
      <JsonLd
        data={musicGroupJsonLd({
          name: artist.name,
          slug: artist.slug,
          avatarUrl: artist.avatarUrl,
          bio: artist.bio,
          links: artist.links,
        })}
      />
      {grain && <GrainOverlay />}

      {/* Full-bleed hero — breaks out of any container */}
      <ArtistHero artist={artist} followButton={followButton} />

      {/* Компактная полоска при скролле за hero */}
      <ArtistCollapseBar name={artist.name} avatarUrl={artist.avatarUrl} verified={artist.verified} />

      {/* Content below hero */}
      <div className="mx-auto max-w-4xl px-5 sm:px-6 pb-16 space-y-14">
        {upcoming.length > 0 && <UpcomingSection upcoming={upcoming} />}
        <ReleasesSection
          releases={releases}
          artistSlug={artist.slug}
          artistName={artist.name}
        />
        {posts.length > 0 && <PostsSection posts={posts} />}
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
      <header
        className="relative overflow-hidden"
        style={{
          minHeight: 'clamp(320px, 50vh, 580px)',
          // Glow radiates from the right where the avatar lives
          background:
            'radial-gradient(ellipse 55% 85% at 88% 50%, color-mix(in oklch, var(--artist-accent) 20%, var(--artist-bg)), var(--artist-bg))',
        }}
      >
        <div className="relative z-10 mx-auto max-w-4xl px-5 sm:px-6 h-full flex items-end pb-10 pt-14 sm:pb-14 sm:pt-16">
          <div className="w-full grid grid-cols-1 sm:grid-cols-5 gap-5 sm:gap-10 items-end">

            {/* Left: name + bio + actions */}
            <div className="sm:col-span-3 space-y-5">
              <div className="space-y-3">
                <h1
                  className="font-bold tracking-tight leading-[0.92] text-balance break-words"
                  style={{ fontSize: 'clamp(2.2rem, 8vw, 5.5rem)' }}
                >
                  {artist.name}
                </h1>
                {artist.verified && (
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-sm border"
                    style={{
                      borderColor: 'color-mix(in oklch, var(--artist-accent) 40%, transparent)',
                      color: 'var(--artist-accent)',
                    }}
                  >
                    <VerifiedStar />
                    verified
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {artist.bio && (
                  <p className="text-sm leading-relaxed opacity-60 max-w-[44ch]">
                    {artist.bio}
                  </p>
                )}

                {/* Follow + links on one line */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {followButton}
                  {artist.links.map((link: ArtistLink, i: number) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium transition-opacity hover:opacity-80 underline-offset-2 hover:underline"
                      style={{ color: 'var(--artist-accent)', opacity: 0.55 }}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: avatar with atmospheric glow (на мобилке — сверху, слева) */}
            <div className="order-first sm:order-none sm:col-span-2 flex justify-start sm:justify-end items-center sm:items-end">
              <div className="relative">
                {/* Glow blob — fills the right side of hero */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full blur-3xl opacity-30 scale-[1.8]"
                  style={{ background: 'var(--artist-accent)' }}
                />
                {artist.avatarUrl ? (
                  <Image
                    src={artist.avatarUrl}
                    alt={artist.name}
                    width={280}
                    height={280}
                    priority
                    className="relative z-10 w-28 h-28 sm:w-64 sm:h-64 rounded-full object-cover"
                    style={{
                      boxShadow:
                        '0 0 0 1.5px color-mix(in oklch, var(--artist-accent) 50%, transparent)',
                    }}
                  />
                ) : (
                  <div
                    className="relative z-10 w-28 h-28 sm:w-64 sm:h-64 rounded-full bg-white/5 flex items-center justify-center font-mono"
                    style={{
                      fontSize: 'clamp(3rem, 8vw, 5rem)',
                      opacity: 0.2,
                      boxShadow:
                        '0 0 0 1.5px color-mix(in oklch, var(--artist-accent) 50%, transparent)',
                    }}
                  >
                    {artist.name[0]}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Bottom fade — hero bleeds into content below */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent, var(--artist-bg))',
          }}
        />
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
          <div className="max-w-[200px]">
            <ReleaseQuickLook showArtist={false} release={toQL(first)} />
          </div>
        ) : (
          <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {/* First release spans 2 cols — larger, more prominent */}
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

// ─── Posts (анонсы) ──────────────────────────────────────────────────────────

function PostsSection({ posts }: { posts: ArtistPost[] }) {
  return (
    <Reveal>
      <section className="space-y-4">
        {posts.map((post) => (
          <article
            key={post.id}
            className="rounded-xl p-4 sm:p-5 space-y-1.5"
            style={{
              background: 'color-mix(in oklch, var(--artist-accent) 5%, transparent)',
              border: '1px solid color-mix(in oklch, var(--artist-accent) 14%, transparent)',
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              {post.title ? (
                <h3 className="font-medium leading-snug">{post.title}</h3>
              ) : (
                <span />
              )}
              <time className="text-[11px] font-mono opacity-40 shrink-0">
                {postDate(post.createdAt)}
              </time>
            </div>
            <p className="text-sm leading-relaxed opacity-75 whitespace-pre-line">{post.body}</p>
          </article>
        ))}
      </section>
    </Reveal>
  );
}

function postDate(d: Date): string {
  return new Date(d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Videos ────────────────────────────────────────────────────────────────

async function VideosSection({ videos }: { videos: ArtistVideo[] }) {
  const parsed = videos
    .map((v) => ({ title: v.title, embed: parseEmbed(v.url) }))
    .filter((v): v is { title: string; embed: EmbedInfo } => v.embed !== null);

  // У VK постер не выводится из ссылки — подтягиваем через video.get (server-only)
  const embeds = await Promise.all(
    parsed.map(async (v) =>
      v.embed.platform === 'vk' && !v.embed.thumbnailUrl
        ? { ...v, embed: { ...v.embed, thumbnailUrl: await fetchVkPoster(v.embed.id) } }
        : v,
    ),
  );

  if (embeds.length === 0) return null;

  return (
    <Reveal>
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {embeds.map((v, i) => (
            <div key={i} className="space-y-2">
              <VideoPlayer embed={v.embed} title={v.title} />
              {v.title && <p className="text-sm opacity-55 leading-snug">{v.title}</p>}
            </div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}

// ─── Utilities ─────────────────────────────────────────────────────────────

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
    <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <path d="M5 0L6.18 3.32L9.76 3.09L7.1 5.27L8.09 8.82L5 6.9L1.91 8.82L2.9 5.27L0.24 3.09L3.82 3.32L5 0Z" />
    </svg>
  );
}
