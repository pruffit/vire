import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DrizzleArtistCatalogRepository } from '@vire/db';
import { ArtistCatalogService } from '@vire/core';
import { FadeUp } from '@vire/ui/motion';
import { ArtistCatalog } from '@/components/artist-catalog';
import { JsonLd } from '@/components/json-ld';
import { PageContainer } from '@/components/page-container';
import { artistsCatalogJsonLd, breadcrumbListJsonLd } from '@/lib/structured-data';
import { pageMetadata } from '@/lib/metadata';
import { applyTitleTemplate } from '@/lib/site';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('artist.catalogPage'), resolveLocale()]);
  return pageMetadata({
    url: '/artists',
    title: t('title'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function ArtistsPage() {
  const [t, tBreadcrumb, locale] = await Promise.all([
    getTranslations('artist.catalogPage'),
    getTranslations('release.breadcrumb'),
    resolveLocale(),
  ]);
  const catalog = new ArtistCatalogService(new DrizzleArtistCatalogRepository());
  const { items: artists, hasMore } = await catalog.list({ limit: 200 });

  return (
    <PageContainer spaceY="8">
      <JsonLd data={artistsCatalogJsonLd({ name: applyTitleTemplate(t('title')), description: t('metaDescription'), locale })} />
      <JsonLd data={breadcrumbListJsonLd([
        { name: tBreadcrumb('home'), url: '/' },
        { name: t('title'), url: '/artists' },
      ])} />
      <FadeUp>
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          {artists.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {artists.length}{hasMore ? '+' : ''}
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
