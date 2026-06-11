import type { Metadata } from 'next';
import { FeedbackForm } from './feedback-form';

export const metadata: Metadata = {
  title: 'Обратная связь',
  description: 'Сообщи о баге, предложи идею или просто напиши нам.',
  alternates: { canonical: '/feedback' },
};

export default function FeedbackPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-14 space-y-10">
      <header className="space-y-2">
        <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase">Vire</p>
        <h1 className="text-3xl font-bold tracking-tight">Обратная связь</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Нашёл баг, есть идея или просто хочешь что-то сказать — пиши.
          Читаем всё.
        </p>
      </header>
      <FeedbackForm />
    </main>
  );
}
