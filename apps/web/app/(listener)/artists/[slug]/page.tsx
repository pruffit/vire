import { cache, Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  db,
  DrizzleReleaseRepository,
  getFollowState,
  getFollowerCount,
  getUpcomingByArtist,
  getExplicitReleaseIds,
  getPresaveStates,
  listArtistPosts,
  getPublishedSmartLinks,
  getArtistPlayableTracks,
} from '@vire/db';
import type { ArtistPost } from '@vire/db';
import { ReleaseService } from '@vire/core';
import type { ArtistProfile, ArtistLink, ArtistVideo, Release, SmartLink } from '@vire/core';
import { SectionHeader } from '@/components/section-header';
import { PlatformIcon } from '@/components/platform-icon';
import { BrandIcon, PLATFORM_BRAND, isBrandWordmark } from '@/components/brand-icon';
import { detectPlatform, linkLabel } from '@/lib/platforms';
import { Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { getArtist, assertArtistVisible } from './artist-guard';
import { FollowButton } from './follow-button';
import { VerifiedBadge } from '@/components/verified-badge';
import { parseEmbed, type EmbedInfo } from '@/lib/embed';
import { fetchVkPoster } from '@/lib/vk-api';
import { VideoPlayer } from '@/components/video-player';
import { ReleaseQuickLook } from '@/components/release-quick-look';
import { CountdownBadge } from '@/components/countdown-badge';
import { UpcomingPresaveButton } from '@/components/upcoming-presave-button';
import { JsonLd } from '@/components/json-ld';
import { musicGroupJsonLd, breadcrumbListJsonLd, artistPostJsonLd } from '@/lib/structured-data';
import { resolveAvatarUrl } from '@/lib/avatar';
import { pageMetadata } from '@/lib/metadata';
import { artistFontStyle } from '@/lib/fonts';
import { GrainOverlay } from '@/components/grain-overlay';
import { PageContainer } from '@/components/page-container';
import { ArtistCollapseBar } from './artist-collapse-bar';
import { ReleaseHeroPlay } from '@/components/release-hero-play';
import type { PlayerTrack } from '@/store/player';
import { pluralTracks, pluralReleases, totalDuration } from '@/lib/format';
import { ArtistPopularTracks, type ArtistPopularTrack } from './artist-popular-tracks';
import { topByPlays } from '@/lib/artist-tracks';
import { SimilarArtistsSection } from './similar-artists-section';

type Props = { params: Promise<{ slug: string }> };

// cache(): generateMetadata и page читают одно и то же на одном рендере
const getArtistData = cache(async (slug: string) => {
  const artist = await getArtist(slug);
  if (!artist) return null;

  const releaseService = new ReleaseService(new DrizzleReleaseRepository(db), { uuid: () => crypto.randomUUID() });
  const [releases, upcoming, posts, smartLinks, playableTracks] = await Promise.all([
    releaseService.getPublishedByArtist(artist.id),
    getUpcomingByArtist(artist.id),
    listArtistPosts(artist.id, 5),
    getPublishedSmartLinks(artist.id),
    getArtistPlayableTracks(artist.id),
  ]);

  const explicitReleaseIds = await getExplicitReleaseIds(releases.map((r) => r.id));

  return { artist, releases, upcoming, posts, smartLinks, explicitReleaseIds, playableTracks };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getArtistData(slug);
  if (!data) return { title: 'Не найдено' };
  await assertArtistVisible(data.artist.id);

  const { artist } = data;
  const url = `/artists/${slug}`;
  const description = artist.bio ?? `${artist.name} на VireMusic — релизы, треки и ссылки.`;
  return pageMetadata({
    url,
    title: artist.name,
    description,
    type: 'profile',
    images: null, // своя брендовая карточка — opengraph-image.tsx этого сегмента
  });
}

export default async function ArtistPage({ params }: Props) {
  const { slug } = await params;
  const data = await getArtistData(slug);
  if (!data) notFound();
  await assertArtistVisible(data.artist.id);

  const { artist, releases, upcoming, posts, smartLinks, explicitReleaseIds, playableTracks } = data;
  const { bg, text, accent, grain } = artist.themeTokens;

  const displayAvatar = resolveAvatarUrl(artist.avatarUrl, releases[0]?.coverUrl ?? null);

  const session = await auth();
  const isAuthed = !!session?.user;
  // гостю кнопка ведёт на страницу релиза (там email-флоу) — presave-состояние нужно только вошедшим
  const upcomingIds = upcoming.filter((r) => r.releaseDate).map((r) => r.id);
  const [following, followerCount, presavedIds] = await Promise.all([
    session?.user?.id ? getFollowState(session.user.id, artist.id) : Promise.resolve(false),
    getFollowerCount(artist.id),
    session?.user?.id ? getPresaveStates(session.user.id, upcomingIds) : Promise.resolve(new Set<string>()),
  ]);

  const followButton = session?.user ? (
    <FollowButton slug={artist.slug} initialFollowing={following} initialCount={followerCount} />
  ) : (
    <GuestFollowButton slug={artist.slug} followerCount={followerCount} />
  );

  const playQueue: PlayerTrack[] = playableTracks.map((t) => ({
    id: t.id,
    title: t.title,
    artistName: artist.name,
    coverUrl: t.coverUrl,
    artistSlug: artist.slug,
    releaseId: t.releaseId,
    accentColor: accent ?? undefined,
    isExplicit: t.isExplicit,
    version: t.version,
    feat: t.feat,
  }));
  const runtime = totalDuration(
    playableTracks.map((t) => ({ status: 'READY', durationSec: t.durationSec })),
  );

  const popularTracks: ArtistPopularTrack[] = topByPlays(playableTracks).map((t) => ({
    id: t.id,
    title: t.title,
    artistName: artist.name,
    coverUrl: t.coverUrl,
    artistSlug: artist.slug,
    releaseId: t.releaseId,
    accentColor: accent ?? undefined,
    isExplicit: t.isExplicit,
    durationSec: t.durationSec,
    version: t.version,
    feat: t.feat,
  }));

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
      className="min-h-full text-[var(--artist-text)] font-sans overflow-x-clip"
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
      <JsonLd data={breadcrumbListJsonLd([
        { name: 'Главная', url: '/' },
        { name: 'Артисты', url: '/artists' },
        { name: artist.name, url: `/artists/${artist.slug}` },
      ])} />
      {posts.map((post) => (
        <JsonLd key={post.id} data={artistPostJsonLd(post, { name: artist.name, slug: artist.slug })} />
      ))}
      {grain && <GrainOverlay />}

      {/* Banner — при наличии headerUrl показывает его резко; иначе — ambient-фолбэк по обложке */}
      <ArtistBanner coverUrl={releases[0]?.coverUrl ?? displayAvatar} headerUrl={artist.headerUrl} />

      <PageContainer as="div" variant="overlap">
        <div className="grid grid-cols-1 lg:grid-cols-[clamp(280px,26%,360px)_1fr] gap-8 lg:gap-12">
          {/* Левая колонка — личность артиста (sticky на lg) */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ArtistIdentity
              artist={artist}
              displayAvatar={displayAvatar}
              followButton={followButton}
              playQueue={playQueue}
              releaseCount={releases.length}
              trackCount={playableTracks.length}
              runtime={runtime}
            />
            {/* только мобилка — на lg карточка identity уже sticky */}
            <div className="lg:hidden">
              <ArtistCollapseBar name={artist.name} avatarUrl={displayAvatar} verified={artist.verified} />
            </div>
          </div>

          {/* Правая колонка — лента контента */}
          <div className="min-w-0 flex flex-col gap-14 pt-2 lg:pt-8">
            {upcoming.length > 0 && (
              <UpcomingSection
                upcoming={upcoming}
                artistSlug={artist.slug}
                presavedIds={presavedIds}
                isAuthed={isAuthed}
              />
            )}
            {popularTracks.length > 0 && (
              <section className="animate-fade-up">
                <SectionHeader label="Популярное" />
                <ArtistPopularTracks tracks={popularTracks} />
              </section>
            )}
            <ReleasesSection
              releases={releases}
              explicitReleaseIds={explicitReleaseIds}
              artistSlug={artist.slug}
              artistName={artist.name}
              accentColor={accent}
            />
            {/* Suspense изолирует co-listen выборку — её сбой не должен ронять страницу артиста */}
            <Suspense fallback={null}>
              <SimilarArtistsSection artistProfileId={artist.id} />
            </Suspense>
            {smartLinks.length > 0 && <SmartLinksSection smartLinks={smartLinks} artistSlug={artist.slug} />}
            {posts.length > 0 && <PostsSection posts={posts} />}
            {artist.videos.length > 0 && <VideosSection videos={artist.videos} />}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}

// ─── Banner ────────────────────────────────────────────────────────────────

function ArtistBanner({ coverUrl, headerUrl }: { coverUrl: string | null; headerUrl?: string | null }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'clamp(180px, 26vh, 320px)' }} aria-hidden="true">
      {headerUrl ? (
        <>
          <Image
            src={headerUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, transparent 40%, var(--artist-bg))',
            }}
          />
        </>
      ) : (
        <>
          {coverUrl && (
            <Image
              src={coverUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover scale-110 blur-2xl opacity-40"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 70% 100% at 50% 0%, color-mix(in oklch, var(--artist-accent) 28%, transparent), transparent 70%), linear-gradient(to bottom, transparent, var(--artist-bg))',
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── Identity (левая колонка) ────────────────────────────────────────────────

function ArtistIdentity({
  artist,
  displayAvatar,
  followButton,
  playQueue,
  releaseCount,
  trackCount,
  runtime,
}: {
  artist: ArtistProfile;
  displayAvatar: string | null;
  followButton: ReactNode;
  playQueue: PlayerTrack[];
  releaseCount: number;
  trackCount: number;
  runtime: string | null;
}) {
  const readout = [
    releaseCount > 0 ? `${releaseCount} ${pluralReleases(releaseCount)}` : null,
    trackCount > 0 ? `${trackCount} ${pluralTracks(trackCount)}` : null,
    runtime,
  ].filter(Boolean);
  const longestWord = Math.max(1, ...artist.name.split(/\s+/).map((w) => w.length));
  const maxRem = Math.max(2.2, Math.min(4, 22 / longestWord));

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div className="relative w-28 h-28 sm:w-36 sm:h-36">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full blur-2xl opacity-30 scale-150"
          style={{ background: 'var(--artist-accent)' }}
        />
        {displayAvatar ? (
          <Image
            src={displayAvatar}
            alt={artist.name}
            width={280}
            height={280}
            priority
            className="relative z-10 w-full h-full rounded-full object-cover"
            style={{ boxShadow: '0 0 0 1.5px color-mix(in oklch, var(--artist-accent) 50%, transparent)' }}
          />
        ) : (
          <div
            className="relative z-10 w-full h-full rounded-full flex items-center justify-center font-mono"
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 3.5rem)',
              background: 'color-mix(in oklch, var(--artist-text) 6%, transparent)',
              color: 'color-mix(in oklch, var(--artist-text) 40%, transparent)',
              boxShadow: '0 0 0 1.5px color-mix(in oklch, var(--artist-accent) 50%, transparent)',
            }}
          >
            {artist.name[0]}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h1
          className="font-bold tracking-tight leading-[0.95] text-balance break-words"
          style={{ fontSize: `clamp(2rem, 6vw, ${maxRem}rem)` }}
        >
          {artist.name}
        </h1>
        {artist.verified && <VerifiedBadge />}
      </div>

      {artist.bio && (
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'color-mix(in oklch, var(--artist-text) 62%, transparent)' }}
        >
          {artist.bio}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ReleaseHeroPlay queue={playQueue} context={{ source: 'artist', sourceId: artist.slug }} />
        {followButton}
      </div>

      {readout.length > 0 && (
        <p
          className="font-mono text-xs tabular-nums"
          style={{ color: 'color-mix(in oklch, var(--artist-text) 45%, transparent)' }}
        >
          {readout.join('  ·  ')}
        </p>
      )}

      {artist.links.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {artist.links.map((link: ArtistLink, i: number) => {
            const key = detectPlatform(link.url).key;
            const name = linkLabel(link.url, link.label);
            const brand = PLATFORM_BRAND[key];
            const wordmark = brand ? isBrandWordmark(brand) : false;
            return (
              <a
                key={`${link.url}-${i}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={name}
                aria-label={name}
                className="inline-flex h-7 min-w-7 pointer-coarse:h-11 pointer-coarse:min-w-11 items-center justify-center rounded-lg px-2 transition-opacity hover:opacity-80 sm:h-9 sm:min-w-9 sm:px-2.5"
                style={
                  brand
                    ? { background: '#fff' }
                    : {
                        background: 'color-mix(in oklch, var(--artist-text) 8%, transparent)',
                        color: 'var(--artist-accent)',
                      }
                }
              >
                {brand ? (
                  <BrandIcon name={brand} size={null} className={wordmark ? 'h-[9px] sm:h-[11px]' : 'h-3 sm:h-3.5'} />
                ) : (
                  <PlatformIcon platform={key} size={14} className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Upcoming ──────────────────────────────────────────────────────────────

function UpcomingSection({
  upcoming,
  artistSlug,
  presavedIds,
  isAuthed,
}: {
  upcoming: Array<{ id: string; title: string; releaseDate: Date | null }>;
  artistSlug: string;
  presavedIds: Set<string>;
  isAuthed: boolean;
}) {
  const withDate = upcoming.filter((r) => r.releaseDate);
  if (withDate.length === 0) return null;

  return (
    <section className="animate-fade-up">
      <SectionHeader label="Скоро" />
      <div className="flex flex-col gap-3">
        {withDate.map((r) => {
          const href = `/artists/${artistSlug}/releases/${r.id}`;
          return (
            <div key={r.id} className="flex items-center gap-3 flex-wrap">
              <Link href={href} className="self-start transition-opacity hover:opacity-80">
                <CountdownBadge releaseDate={r.releaseDate!} title={r.title} />
              </Link>
              <UpcomingPresaveButton
                releaseId={r.id}
                initialPresaved={presavedIds.has(r.id)}
                isAuthed={isAuthed}
                releaseHref={href}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Smart-links (bandlink-лендинги) ────────────────────────────────────────

function SmartLinksSection({ smartLinks, artistSlug }: { smartLinks: SmartLink[]; artistSlug: string }) {
  return (
    <section className="animate-fade-up">
      <SectionHeader label="Площадки" />
      <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
        {smartLinks.map((sl) => (
          <StaggerItem key={sl.id}>
            <a href={`/smartlink/${artistSlug}/${sl.slug}`} className="group flex flex-col gap-2.5">
              <div
                className="relative aspect-square rounded-md overflow-hidden ring-1 transition-all duration-300 ease-soft group-hover:scale-[1.02]"
                style={{ '--tw-ring-color': 'color-mix(in oklch, var(--artist-text) 12%, transparent)' } as React.CSSProperties}
              >
                {sl.coverUrl ? (
                  <Image src={sl.coverUrl} alt={sl.title} fill sizes="(max-width: 640px) 50vw, 200px" className="object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center bg-[color-mix(in_oklch,var(--artist-accent)_22%,var(--artist-bg))]">
                    <PlatformIcon platform="website" size={28} className="opacity-30" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug truncate">{sl.title}</p>
                <p className="text-xs truncate" style={{ color: 'color-mix(in oklch, var(--artist-text) 50%, transparent)' }}>
                  {sl.links.length > 0 ? `${sl.links.length} площадок` : 'ссылки'}
                </p>
              </div>
            </a>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

// ─── Releases ──────────────────────────────────────────────────────────────

function ReleasesSection({
  releases,
  explicitReleaseIds,
  artistSlug,
  artistName,
  accentColor,
}: {
  releases: Release[];
  explicitReleaseIds: Set<string>;
  artistSlug: string;
  artistName: string;
  accentColor: string | null;
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
      hasExplicit: explicitReleaseIds.has(r.id),
      accentColor,
    };
  }

  return (
    <section className="animate-fade-up">
      <SectionHeader label="Релизы" />
      {releases.length === 1 ? (
        <div className="max-w-[200px]">
          <ReleaseQuickLook showArtist={false} release={toQL(releases[0])} priority />
        </div>
      ) : (
        // без «героя» на 2 колонки: col-span-2 делал обложку вдвое выше соседей
        <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
          {releases.map((r, i) => (
            <StaggerItem key={r.id}>
              <ReleaseQuickLook showArtist={false} release={toQL(r)} priority={i === 0} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </section>
  );
}

// ─── Posts (анонсы) ──────────────────────────────────────────────────────────

function PostsSection({ posts }: { posts: ArtistPost[] }) {
  return (
    <section className="animate-fade-up">
      <SectionHeader label="Анонсы" />
      <div className="space-y-4">
        {posts.map((post) => (
          <article
            key={post.id}
            id={`post-${post.id}`}
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
              <time
                className="text-[11px] font-mono shrink-0"
                style={{ color: 'color-mix(in oklch, var(--artist-text) 40%, transparent)' }}
              >
                {postDate(post.createdAt)}
              </time>
            </div>
            <p
              className="text-sm leading-relaxed whitespace-pre-line"
              style={{ color: 'color-mix(in oklch, var(--artist-text) 75%, transparent)' }}
            >
              {post.body}
            </p>
          </article>
        ))}
      </div>
    </section>
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
    <section className="animate-fade-up">
      <SectionHeader label="Видео" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {embeds.map((v) => (
          <div key={`${v.embed.platform}:${v.embed.id}`} className="space-y-2">
            <VideoPlayer embed={v.embed} title={v.title} />
            {v.title && (
              <p
                className="text-sm leading-snug"
                style={{ color: 'color-mix(in oklch, var(--artist-text) 55%, transparent)' }}
              >
                {v.title}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
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
        className="inline-flex min-h-11 items-center justify-center px-4 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
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

