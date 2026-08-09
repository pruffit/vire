import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('email.unsubscribe.presave');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function PresaveUnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const ok = status !== 'bad';
  const t = await getTranslations('email.unsubscribe.presave');

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">VireMusic</p>
        <h1 className="text-2xl font-semibold mb-3">
          {ok ? t('doneTitle') : t('invalidTitle')}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          {ok ? t('doneBody') : t('invalidBody')}
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t('home')}
        </Link>
      </div>
    </div>
  );
}
