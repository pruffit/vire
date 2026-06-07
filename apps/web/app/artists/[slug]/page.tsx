import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository, getFollowState, getFollowerCount } from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import type { ArtistProfile, ArtistLink, ArtistVideo, Release } from '@vire/core';
import { FadeUp, Reveal, Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { FollowButton } from './follow-button';
import { parseEmbed, type EmbedInfo } from '@/lib/embed';
import { VideoEmbed } from '@/components/video-embed';
import { formatCount, releaseYear } from '@/lib/format';
import { artistFontStyle } from '@/lib/fonts';

type Props = { params: Promise<{ slug: string }> };

async function getArtistData(slug: string) {
  const artistService = new ArtistService(new DrizzleArtistRepository(db));
  const result = await artistService.getBySlug(slug);
  if (!result.ok) return null;

  const releaseService = new ReleaseService(new DrizzleReleaseRepository(db));
  const releases = await releaseService.getPublishedByArtist(result.value.id);

  return { artist: result.value, releases };
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

  const { artist, releases } = data;
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
        <ReleasesSection releases={releases} artistSlug={artist.slug} />
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
        style={{ background: 'var(--artist-accent)', color: 'var(--artist-bg, #0d0d0d)' }}
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
      <header className="flex flex-col sm:flex-row items-start gap-8">
      {artist.avatarUrl ? (
        <Image
          src={artist.avatarUrl}
          alt={artist.name}
          width={128}
          height={128}
          className="w-32 h-32 rounded-full object-cover shrink-0 ring-1 ring-white/10"
        />
      ) : (
        <div className="w-32 h-32 rounded-full shrink-0 bg-white/5 flex items-center justify-center text-4xl font-mono opacity-40">
          {artist.name[0]}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{artist.name}</h1>
          {artist.verified && (
            <span
              className="text-xs px-2 py-0.5 rounded-full border opacity-60"
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

function ReleasesSection({ releases, artistSlug }: { releases: Release[]; artistSlug: string }) {
  if (releases.length === 0) return null;

  return (
    <Reveal>
      <section className="space-y-6">
        <h2 className="text-xs uppercase tracking-widest opacity-40 font-mono">Релизы</h2>
        <Stagger className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          {releases.map((release) => (
            <StaggerItem key={release.id}>
              <ReleaseCard release={release} artistSlug={artistSlug} />
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
              <VideoEmbed embed={v.embed} title={v.title} />
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

function ReleaseCard({ release, artistSlug }: { release: Release; artistSlug: string }) {
  const year = releaseYear(release.releaseDate);

  return (
    <Link href={`/artists/${artistSlug}/releases/${release.id}`} className="block">
      <article className="group space-y-3 transition-transform duration-300 ease-soft hover:-translate-y-1">
        <div className="relative aspect-square rounded-sm overflow-hidden bg-white/5 ring-1 ring-transparent transition-all duration-300 group-hover:ring-white/15 group-hover:shadow-xl group-hover:shadow-black/40">
          {release.coverUrl ? (
            <Image
              src={release.coverUrl}
              alt={release.title}
              fill
              sizes="(max-width: 640px) 50vw, 300px"
              className="object-cover transition-transform duration-500 ease-soft group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-20">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium leading-snug">{release.title}</p>
          <p className="text-xs opacity-40 font-mono">
            {year && `${year} · `}
            {release.type}
          </p>
        </div>
      </article>
    </Link>
  );
}
