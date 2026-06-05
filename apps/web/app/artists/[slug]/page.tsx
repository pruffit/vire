import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository } from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import type { ArtistProfile, Release } from '@vire/core';

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
  return {
    title: artist.name,
    description: artist.bio ?? undefined,
    openGraph: {
      title: artist.name,
      description: artist.bio ?? undefined,
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

  return (
    <div
      style={
        {
          '--artist-bg': bg,
          '--artist-text': text,
          '--artist-accent': accent,
        } as React.CSSProperties
      }
      className="min-h-screen bg-[var(--artist-bg)] text-[var(--artist-text)]"
    >
      {grain && <GrainOverlay />}

      <div className="mx-auto max-w-4xl px-6 py-16 space-y-16">
        <ArtistHeader artist={artist} />
        <ReleasesSection releases={releases} artistSlug={artist.slug} />
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

function ArtistHeader({ artist }: { artist: ArtistProfile }) {
  return (
    <header className="flex flex-col sm:flex-row items-start gap-8">
      {artist.avatarUrl ? (
        <img
          src={artist.avatarUrl}
          alt={artist.name}
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
      </div>
    </header>
  );
}

function ReleasesSection({ releases, artistSlug }: { releases: Release[]; artistSlug: string }) {
  if (releases.length === 0) return null;

  return (
    <section className="space-y-6">
      <h2 className="text-xs uppercase tracking-widest opacity-40 font-mono">Релизы</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
        {releases.map((release) => (
          <ReleaseCard key={release.id} release={release} artistSlug={artistSlug} />
        ))}
      </div>
    </section>
  );
}

function ReleaseCard({ release, artistSlug }: { release: Release; artistSlug: string }) {
  const year = release.releaseDate ? new Date(release.releaseDate).getFullYear() : null;

  return (
    <Link href={`/artists/${artistSlug}/releases/${release.id}`}>
      <article className="group space-y-3">
        <div className="aspect-square rounded-sm overflow-hidden bg-white/5">
          {release.coverUrl ? (
            <img
              src={release.coverUrl}
              alt={release.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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
