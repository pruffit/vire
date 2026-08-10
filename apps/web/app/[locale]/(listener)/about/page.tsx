import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AboutContent } from './about-content';
import { JsonLd } from '@/components/json-ld';
import { faqPageJsonLd } from '@/lib/structured-data';
import { getSiteFaq } from '@/lib/faq';
import { pageMetadata } from '@/lib/metadata';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('about.meta'), resolveLocale()]);
  return pageMetadata({
    url: '/about',
    title: t('title'),
    description: t('description'),
    locale,
  });
}

export default async function AboutPage() {
  const t = await getTranslations('faq');
  return (
    <>
      <JsonLd data={faqPageJsonLd(getSiteFaq(t))} />
      <AboutContent />
    </>
  );
}
