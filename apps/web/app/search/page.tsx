import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { Stagger, StaggerItem } from '@vire/ui/motion';
import { searchAll } from '@vire/db';
import type { SearchArtist } from '@vire/db';
import { GlobalSearch } from '@/components/global-search';
import { SearchTracksSection } from '@/components/search-tracks-section';
import { SearchReleasesSection } from '@/components/search-releases-section';

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `«${q}» — Поиск · Vire` : 'Поиск — Vire' };
}

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const results = query.length >= 2 ? await searchAll(query, 20) : null;

  const total = results
    ? results.artists.length + results.releases.length + results.tracks.length
    : 0;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
      <GlobalSearch variant="page" defaultValue={query} autoFocus={!query} />

      {!query && (
        <p className="text-sm text-muted-foreground text-center pt-16">
          Начни вводить — покажем артистов, релизы и треки.
        </p>
      )}

      {query && query.length < 2 && (
        <p className="text-sm text-muted-foreground text-center pt-16">
          Введи хотя бы 2 символа.
        </p>
      )}

      {results && total === 0 && (
        <p className="text-sm text-muted-foreground text-center pt-16">
          По запросу <span className="text-foreground">«{query}»</span> ничего не найдено.
        </p>
      )}

      {results && total > 0 && (
        <div className="space-y-10">
          {results.artists.length > 0 && (
            <section className="space-y-3">
              <SectionHeader label="Артисты" count={results.artists.length} />
              <Stagger step={0.035} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {results.artists.map((a) => (
                  <StaggerItem key={a.id}><ArtistCard artist={a} /></StaggerItem>
                ))}
              </Stagger>
            </section>
          )}

          {results.releases.length > 0 && (
            <section className="space-y-2">
              <SectionHeader label="Релизы" count={results.releases.length} />
              <SearchReleasesSection releases={results.releases} />
            </section>
          )}

          {results.tracks.length > 0 && (
            <section className="space-y-2">
              <SectionHeader label="Треки" count={results.tracks.length} />
              <SearchTracksSection tracks={results.tracks} />
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</h2>
      <span className="text-xs font-mono text-muted-foreground tabular-nums">{count}</span>
    </div>
  );
}

function ArtistCard({ artist }: { artist: SearchArtist }) {
  return (
    <Link
      href={`/artists/${artist.slug}`}
      className="group flex items-center gap-3 p-3 rounded-md bg-card border border-border/40 hover:bg-accent/5 transition-colors"
    >
      {artist.avatarUrl ? (
        <Image src={artist.avatarUrl} alt={artist.name} width={36} height={36} className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
          {artist.name[0]?.toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
          {artist.name}
          {artist.verified && <span className="ml-1 text-[10px] text-muted-foreground">✓</span>}
        </p>
      </div>
    </Link>
  );
}


