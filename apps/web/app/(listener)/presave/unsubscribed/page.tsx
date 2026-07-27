import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Отписка от пресейв-писем',
  robots: { index: false, follow: false },
};

export default async function PresaveUnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const ok = status !== 'bad';

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">VireMusic</p>
        <h1 className="text-2xl font-semibold mb-3">
          {ok ? 'Вы отписаны' : 'Ссылка недействительна'}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          {ok
            ? 'Писем о выходе сохранённых заранее релизов на этот адрес больше не будет. Продолжить слушать можно в любой момент.'
            : 'Не удалось подтвердить отписку — похоже, ссылка повреждена или устарела. Откройте её из письма целиком.'}
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
