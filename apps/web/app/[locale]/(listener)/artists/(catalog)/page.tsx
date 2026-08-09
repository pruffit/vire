import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { listActiveArtists } from '@vire/db';
import { FadeUp } from '@vire/ui/motion';
import { ArtistCatalog } from '@/components/artist-catalog';
import { JsonLd } from '@/components/json-ld';
import { PageContainer } from '@/components/page-container';
import { artistsCatalogJsonLd, breadcrumbListJsonLd } from '@/lib/structured-data';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  url: '/artists',
  title: 'Артисты',
  description: 'Все артисты на платформе VireMusic',
});

export default async function ArtistsPage() {
  const t = await getTranslations('artist.catalogPage');
  const artists = await listActiveArtists();

  return (
    <PageContainer spaceY="8">
      <JsonLd data={artistsCatalogJsonLd()} />
      <JsonLd data={breadcrumbListJsonLd([
        { name: 'Главная', url: '/' },
        { name: 'Артисты', url: '/artists' },
      ])} />
      <FadeUp>
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          {artists.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {artists.length}
            </span>
          )}
        </header>
      </FadeUp>

      {artists.length === 0 ? (
        <div className="py-24 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <ArtistCatalog artists={artists} />
      )}
    </PageContainer>
  );
}
