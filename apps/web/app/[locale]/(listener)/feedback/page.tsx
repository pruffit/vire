import type { Metadata } from 'next';
import { ContentHero } from '@/components/content-kit';
import { FeedbackForm, type FeedbackType } from './feedback-form';

export const metadata: Metadata = {
  title: 'Обратная связь',
  description: 'Сообщи о баге, предложи идею, подай заявку артиста или просто напиши нам.',
  alternates: { canonical: '/feedback' },
};

const VALID: FeedbackType[] = ['bug', 'idea', 'artist', 'other'];

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const initialType = (VALID as string[]).includes(type ?? '') ? (type as FeedbackType) : 'bug';
  const isArtist = initialType === 'artist';

  return (
    <main className="mx-auto min-h-full max-w-lg px-6 py-14 space-y-10">
      <ContentHero
        size="md"
        glow
        eyebrow="VireMusic · Обратная связь"
        title={isArtist ? 'Стать артистом' : 'Обратная связь'}
        subtitle={
          isArtist
            ? 'На Этапе 1 профили артистов мы заводим вручную. Расскажите о себе и оставьте ссылки на музыку — мы свяжемся и откроем доступ к загрузке.'
            : 'Нашёл баг, есть идея или просто хочешь что-то сказать — пиши. Читаем всё.'
        }
      />
      <FeedbackForm initialType={initialType} />
    </main>
  );
}
