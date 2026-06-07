import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { listActiveArtists } from '@vire/db';
import type { ArtistListItem } from '@vire/db';

export const metadata: Metadata = {
  title: 'Артисты',
  description: 'Все артисты на платформе Vire',
};

export default async function ArtistsPage() {
  const artists = await listActiveArtists();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Артисты</h1>
        {artists.length > 0 && (
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {artists.length}
          </span>
        )}
      </header>

      {artists.length === 0 ? (
        <div className="py-24 text-center text-sm text-muted-foreground">
          Пока нет ни одного артиста.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </main>
  );
}

function ArtistCard({ artist }: { artist: ArtistListItem }) {
  return (
    <Link href={`/artists/${artist.slug}`} className="block">
      <article className="group space-y-3 text-center">
        <div className="relative mx-auto w-full aspect-square rounded-full overflow-hidden bg-muted ring-1 ring-white/5 transition-shadow duration-300 ease-soft group-hover:ring-white/20">
          {artist.avatarUrl ? (
            <Image
              src={artist.avatarUrl}
              alt={artist.name}
              fill
              sizes="(max-width: 640px) 50vw, 200px"
              className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.03]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-mono text-muted-foreground">
              {artist.name[0]?.toUpperCase()}
            </div>
          )}
        </div>

        <div className="space-y-0.5 px-1">
          <p className="text-sm font-medium leading-snug truncate group-hover:text-foreground transition-colors">
            {artist.name}
            {artist.verified && (
              <span className="ml-1.5 text-[10px] align-middle text-muted-foreground">✓</span>
            )}
          </p>
          {artist.releaseCount > 0 && (
            <p className="text-xs text-muted-foreground font-mono tabular-nums">
              {artist.releaseCount}{' '}
              {pluralReleases(artist.releaseCount)}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}

function pluralReleases(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'релиз';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'релиза';
  return 'релизов';
}
