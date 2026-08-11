import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { DrizzleReleaseCatalogRepository } from '@vire/db';
import { ReleaseCatalogService } from '@vire/core';
import { FadeUp } from '@vire/ui/motion';
import { JsonLd } from '@/components/json-ld';
import { ReleasesGrid } from './releases-grid';
import { PageContainer } from '@/components/page-container';
import { breadcrumbListJsonLd } from '@/lib/structured-data';
import { touchPill } from '@/components/popover';
import { pageMetadata } from '@/lib/metadata';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('catalog'), resolveLocale()]);
  return pageMetadata({
    url: '/releases',
    title: t('releasesPage.metaTitle'),
    description: t('releasesPage.metaDescription'),
    locale,
  });
}

type Tab = 'fresh' | 'week' | 'popular';

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function ReleasesPage({ searchParams }: Props) {
  const t = await getTranslations('catalog');
  const TABS: { key: Tab; label: string }[] = [
    { key: 'fresh', label: t('releasesPage.tabs.fresh') },
    { key: 'week', label: t('releasesPage.tabs.week') },
    { key: 'popular', label: t('releasesPage.tabs.popular') },
  ];

  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((x) => x.key === tabParam) ? (tabParam as Tab) : 'fresh';

  const catalog = new ReleaseCatalogService(new DrizzleReleaseCatalogRepository());
  const { items: releases } = await catalog.list(
    tab === 'week'
      ? { sort: 'fresh', sinceDays: 7, limit: 60 }
      : tab === 'popular'
        ? { sort: 'popular', limit: 60 }
        : { sort: 'fresh', limit: 60 },
  );

  return (
    <PageContainer spaceY="8">
      <JsonLd data={breadcrumbListJsonLd([
        { name: t('releasesPage.breadcrumbHome'), url: '/' },
        { name: t('releasesPage.breadcrumbReleases'), url: '/releases' },
      ])} />

      <FadeUp>
        <header className="space-y-5">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">{t('releasesPage.title')}</h1>
            {releases.length > 0 && (
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {releases.length}
              </span>
            )}
          </div>
          <nav className="flex flex-wrap gap-2" aria-label={t('releasesPage.sortAria')}>
            {TABS.map((tabItem) => {
              const active = tabItem.key === tab;
              return (
                <Link
                  key={tabItem.key}
                  href={tabItem.key === 'fresh' ? '/releases' : `/releases?tab=${tabItem.key}`}
                  aria-current={active ? 'page' : undefined}
                  className={`px-3.5 py-1.5 rounded-full text-sm transition-colors ${touchPill} ${
                    active
                      ? 'bg-foreground text-background'
                      : 'border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  {tabItem.label}
                </Link>
              );
            })}
          </nav>
        </header>
      </FadeUp>

      {releases.length === 0 ? (
        <div className="py-24 text-center text-sm text-muted-foreground">
          {tab === 'week' ? t('releasesPage.emptyWeek') : t('releasesPage.emptyAll')}
        </div>
      ) : (
        <ReleasesGrid key={tab} releases={releases} />
      )}
    </PageContainer>
  );
}
