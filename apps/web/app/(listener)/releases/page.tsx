import type { Metadata } from 'next';
import Link from 'next/link';
import { listReleases } from '@vire/db';
import { FadeUp } from '@vire/ui/motion';
import { JsonLd } from '@/components/json-ld';
import { ReleasesGrid } from './releases-grid';
import { PageContainer } from '@/components/page-container';
import { breadcrumbListJsonLd } from '@/lib/structured-data';
import { touchPill } from '@/components/popover';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata({
  url: '/releases',
  title: 'Релизы',
  description: 'Все релизы на VireMusic — свежее, за неделю и самое популярное.',
});

type Tab = 'fresh' | 'week' | 'popular';

const TABS: { key: Tab; label: string }[] = [
  { key: 'fresh', label: 'Свежее' },
  { key: 'week', label: 'За неделю' },
  { key: 'popular', label: 'Популярное' },
];

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function ReleasesPage({ searchParams }: Props) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'fresh';

  const releases = await listReleases(
    tab === 'week'
      ? { sort: 'fresh', sinceDays: 7, limit: 60 }
      : tab === 'popular'
        ? { sort: 'popular', limit: 60 }
        : { sort: 'fresh', limit: 60 },
  );

  return (
    <PageContainer spaceY="8">
      <JsonLd data={breadcrumbListJsonLd([
        { name: 'Главная', url: '/' },
        { name: 'Релизы', url: '/releases' },
      ])} />

      <FadeUp>
        <header className="space-y-5">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Релизы</h1>
            {releases.length > 0 && (
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {releases.length}
              </span>
            )}
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Сортировка релизов">
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <Link
                  key={t.key}
                  href={t.key === 'fresh' ? '/releases' : `/releases?tab=${t.key}`}
                  aria-current={active ? 'page' : undefined}
                  className={`px-3.5 py-1.5 rounded-full text-sm transition-colors ${touchPill} ${
                    active
                      ? 'bg-foreground text-background'
                      : 'border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </header>
      </FadeUp>

      {releases.length === 0 ? (
        <div className="py-24 text-center text-sm text-muted-foreground">
          {tab === 'week' ? 'За эту неделю релизов пока нет.' : 'Пока нет ни одного релиза.'}
        </div>
      ) : (
        <ReleasesGrid key={tab} releases={releases} />
      )}
    </PageContainer>
  );
}
