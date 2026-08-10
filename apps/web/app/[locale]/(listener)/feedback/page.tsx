import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ContentHero } from '@/components/content-kit';
import { pageMetadata } from '@/lib/metadata';
import { resolveLocale } from '@/lib/locale';
import { FeedbackForm, type FeedbackType } from './feedback-form';

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('common.feedback'), resolveLocale()]);
  return pageMetadata({
    url: '/feedback',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

const VALID: FeedbackType[] = ['bug', 'idea', 'artist', 'other'];

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const initialType = (VALID as string[]).includes(type ?? '') ? (type as FeedbackType) : 'bug';
  const isArtist = initialType === 'artist';
  const t = await getTranslations('common.feedback');

  return (
    <main className="mx-auto min-h-full max-w-lg px-6 py-14 space-y-10">
      <ContentHero
        size="md"
        glow
        eyebrow={t('eyebrow')}
        title={isArtist ? t('becomeArtistTitle') : t('title')}
        subtitle={isArtist ? t('becomeArtistSubtitle') : t('subtitle')}
      />
      <FeedbackForm initialType={initialType} />
    </main>
  );
}
