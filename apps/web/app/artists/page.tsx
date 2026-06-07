import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { FadeUp, Stagger, StaggerItem } from '@vire/ui/motion';
import { listActiveArtists } from '@vire/db';
import type { ArtistListItem } from '@vire/db';

export const metadata: Metadata = {
  title: 'Артисты',
  description: 'Все артисты на платформе Vire',
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ArtistsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() || undefined;
  const artists = await listActiveArtists(query);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-10">
      <FadeUp>
        <header className="space-y-6">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Артисты</h1>
            {artists.length > 0 && (
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {artists.length}
              </span>
            )}
          </div>
          <SearchBar defaultValue={query} />
        </header>
      </FadeUp>

      {artists.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {artists.map((artist) => (
            <StaggerItem key={artist.id}>
              <ArtistCard artist={artist} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </main>
  );
}

function SearchBar({ defaultValue }: { defaultValue?: string }) {
  return (
    <form action="/artists" method="GET" className="relative">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Поиск артиста..."
        autoComplete="off"
        className="w-full sm:w-80 h-9 rounded-md border border-border bg-background px-3 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        aria-label="Найти"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
      {defaultValue && (
        <Link
          href="/artists"
          aria-label="Сбросить поиск"
          className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </Link>
      )}
    </form>
  );
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="py-24 text-center text-sm text-muted-foreground">
      {query ? (
        <>
          Артист <span className="text-foreground">&ldquo;{query}&rdquo;</span> не найден.{' '}
          <Link href="/artists" className="underline underline-offset-2 hover:text-foreground">
            Сбросить
          </Link>
        </>
      ) : (
        'Пока нет ни одного артиста.'
      )}
    </div>
  );
}

function ArtistCard({ artist }: { artist: ArtistListItem }) {
  return (
    <Link href={`/artists/${artist.slug}`} className="block">
      <article className="group space-y-3 text-center transition-transform duration-300 ease-soft hover:-translate-y-1">
        <div className="relative mx-auto w-full aspect-square rounded-full overflow-hidden bg-muted ring-1 ring-white/5 transition-shadow duration-300 group-hover:ring-white/25">
          {artist.avatarUrl ? (
            <Image
              src={artist.avatarUrl}
              alt={artist.name}
              fill
              sizes="(max-width: 640px) 50vw, 200px"
              className="object-cover transition-transform duration-500 ease-soft group-hover:scale-105"
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
