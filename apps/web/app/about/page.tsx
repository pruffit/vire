import type { Metadata } from 'next';
import { AboutContent } from './about-content';
import { JsonLd } from '@/components/json-ld';
import { faqPageJsonLd } from '@/lib/structured-data';
import { SITE_FAQ } from '@/lib/faq';

export const metadata: Metadata = {
  title: 'О платформе',
  description:
    'Vire — независимая музыкальная площадка для артистов и слушателей СНГ. Этап 1: подробно о каждой возможности — что уже работает и что будет дальше.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <>
      <JsonLd data={faqPageJsonLd(SITE_FAQ)} />
      <AboutContent />
    </>
  );
}
