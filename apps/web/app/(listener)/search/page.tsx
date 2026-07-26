import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { Stagger, StaggerItem } from '@vire/ui/motion';
import { db, DrizzleSearchRepository } from '@vire/db';
import type { SearchArtist } from '@vire/db';
import { SearchService } from '@vire/core';
import { GlobalSearch } from '@/components/global-search';
import { Icon } from '@/components/icon';
import { resolveAvatarUrl } from '@/lib/avatar';
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

  const searchResult =
    query.length >= 2 ? await new SearchService(new DrizzleSearchRepository(db)).search(query, 20) : null;
  const results = searchResult?.ok ? searchResult.value : null;

  const total = results
    ? results.artists.length + results.releases.length + results.tracks.length
    : 0;

  return (
    <main className="w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="max-w-2xl">
        <GlobalSearch variant="page" defaultValue={query} autoFocus={!query} />
      </div>

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
              <Stagger step={0.035} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-9 gap-x-5 gap-y-6">
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
  const avatar = resolveAvatarUrl(artist.avatarUrl, artist.firstReleaseCoverUrl);
  return (
    <Link href={`/artists/${artist.slug}`} className="block group text-center">
      <div className="relative mx-auto w-full aspect-square rounded-full overflow-hidden bg-muted ring-1 ring-white/5 transition-shadow duration-300 ease-soft group-hover:ring-white/20">
        {avatar ? (
          <Image src={avatar} alt={artist.name} fill sizes="(max-width: 640px) 30vw, 128px" className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]" />
        ) : (
          <div className="w-full h-full grid place-items-center text-xl font-mono text-muted-foreground">
            {artist.name[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <p className="mt-2 flex items-center justify-center gap-1 text-xs font-medium leading-snug group-hover:text-foreground transition-colors">
        <span className="truncate">{artist.name}</span>
        {artist.verified && <Icon name="check" size={11} className="text-muted-foreground shrink-0" />}
      </p>
    </Link>
  );
}


