import Link from 'next/link';
import { headers } from 'next/headers';
import { getTranslator } from '@vire/i18n/translator';
import { DEFAULT_LOCALE, isLocale } from '@vire/i18n/config';
import { Eyebrow, FeatureCard, PillLink } from '@/components/content-kit';

const EQ_BARS = [0.0, 0.22, 0.45, 0.12, 0.34, 0.06, 0.28, 0.16, 0.4];

function EqualizerRule() {
  return (
    <div aria-hidden="true" className="flex h-7 items-end justify-center gap-1.5">
      {EQ_BARS.map((delay, i) => (
        <span
          key={`eq-${i}`}
          className="w-1 rounded-full bg-primary/70"
          style={{ height: '30%', animation: 'vire-eq 1.15s ease-in-out infinite', animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}

export default async function NotFound() {
  // Вне app/[locale] — next-intl не проставляет локаль автоматически (см. app/layout.tsx),
  // локаль читаем из заголовка, выставленного next-intl middleware в proxy.ts.
  const headerLocale = (await headers()).get('x-next-intl-locale');
  const locale = headerLocale && isLocale(headerLocale) ? headerLocale : DEFAULT_LOCALE;
  const t = await getTranslator(locale, 'common');

  return (
    <main className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-6 py-16 text-center sm:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 55% 50% at 50% 38%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 70%)',
        }}
      />

      <div className="flex animate-fade-up flex-col items-center gap-4">
        <span
          aria-hidden="true"
          className="select-none font-black leading-none tracking-tighter text-foreground/90"
          style={{ fontSize: 'clamp(6rem, 26vw, 13rem)' }}
        >
          404
        </span>
        <EqualizerRule />
      </div>

      <div className="mt-8 flex animate-fade-up flex-col items-center gap-3">
        <Eyebrow>{t('notFound.eyebrow')}</Eyebrow>
        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
          {t('notFound.title')}
        </h1>
        <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          {t('notFound.body')}
        </p>
      </div>

      <div className="mt-8 flex animate-fade-up flex-wrap justify-center gap-3">
        <PillLink href="/" tone="primary" icon="home">{t('notFound.home')}</PillLink>
        <PillLink href="/search" tone="outline" icon="search">{t('notFound.search')}</PillLink>
        <PillLink href="/artists" tone="outline" icon="users">{t('notFound.artists')}</PillLink>
      </div>

      <h2 className="sr-only">{t('notFound.quickLinksHeading')}</h2>
      <div className="mt-12 grid w-full max-w-xl animate-fade-up grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/releases" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          <FeatureCard icon="music" title={t('notFound.cards.releases.title')}>{t('notFound.cards.releases.desc')}</FeatureCard>
        </Link>
        <Link href="/artists" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          <FeatureCard icon="users" title={t('notFound.cards.artists.title')}>{t('notFound.cards.artists.desc')}</FeatureCard>
        </Link>
        <Link href="/search" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          <FeatureCard icon="search" title={t('notFound.cards.search.title')}>{t('notFound.cards.search.desc')}</FeatureCard>
        </Link>
      </div>
    </main>
  );
}
