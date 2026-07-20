import type { Metadata } from 'next';
import Link from 'next/link';
import { UnsubscribeConfirmForm } from './unsubscribe-confirm-form';

export const metadata: Metadata = {
  title: 'Отписка от уведомлений',
  robots: { index: false, follow: false },
};

export default async function NotifyUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string; token?: string; status?: string }>;
}) {
  const { uid, token, status } = await searchParams;

  if (status === 'bad' || !uid || !token) {
    return (
      <div className="min-h-full flex items-center justify-center px-6 py-24">
        <div className="max-w-md text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">Vire</p>
          <h1 className="text-2xl font-semibold mb-3">Ссылка недействительна</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            Не удалось подтвердить отписку — похоже, ссылка повреждена или устарела. Откройте
            её из письма целиком.
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

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">Vire</p>
        <UnsubscribeConfirmForm uid={uid} token={token} />
      </div>
    </div>
  );
}
