import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('search');
  return { title: q ? t('metaTitle.withQuery', { query: q }) : t('metaTitle.default') };
}

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';
  const t = await getTranslations();

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
          {t('search.startTyping')}
        </p>
      )}

      {query && query.length < 2 && (
        <p className="text-sm text-muted-foreground text-center pt-16">
          {t('search.minChars')}
        </p>
      )}

      {results && total === 0 && (
        <p className="text-sm text-muted-foreground text-center pt-16">
          {t.rich('search.noResults', {
            query,
            styled: (chunks) => <span className="text-foreground">{chunks}</span>,
          })}
        </p>
      )}

      {results && total > 0 && (
        <div className="space-y-10">
          {results.artists.length > 0 && (
            <section className="space-y-3">
              <SectionHeader label={t('common.entity.artists')} count={results.artists.length} />
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
              <SectionHeader label={t('common.entity.releases')} count={results.releases.length} />
              <SearchReleasesSection releases={results.releases} />
            </section>
          )}

          {results.tracks.length > 0 && (
            <section className="space-y-2">
              <SectionHeader label={t('common.entity.tracks')} count={results.tracks.length} />
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


