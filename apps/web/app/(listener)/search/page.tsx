import type { Metadata } from 'next';
import { Stagger, StaggerItem } from '@vire/ui/motion';
import { db, DrizzleSearchRepository } from '@vire/db';
import { SearchService } from '@vire/core';
import { GlobalSearch } from '@/components/global-search';
import { ArtistCard } from '@/components/artist-card';
import { PageContainer } from '@/components/page-container';
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
    <PageContainer spaceY="8">
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
                  <StaggerItem key={a.id}>
                    <ArtistCard
                      id={a.id}
                      slug={a.slug}
                      name={a.name}
                      avatarUrl={a.avatarUrl}
                      coverFallbackUrl={a.firstReleaseCoverUrl}
                      verified={a.verified}
                      sizes="(max-width: 640px) 30vw, 128px"
                    />
                  </StaggerItem>
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
    </PageContainer>
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


