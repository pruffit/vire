import type { Metadata } from 'next';
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
    <main className="mx-auto max-w-lg px-6 py-14 space-y-10">
      <header className="space-y-2">
        <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase">Vire</p>
        <h1 className="text-3xl font-bold tracking-tight">
          {isArtist ? 'Стать артистом' : 'Обратная связь'}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isArtist
            ? 'На Этапе 1 профили артистов мы заводим вручную. Расскажите о себе и оставьте ссылки на музыку — мы свяжемся и откроем доступ к загрузке.'
            : 'Нашёл баг, есть идея или просто хочешь что-то сказать — пиши. Читаем всё.'}
        </p>
      </header>
      <FeedbackForm initialType={initialType} />
    </main>
  );
}
