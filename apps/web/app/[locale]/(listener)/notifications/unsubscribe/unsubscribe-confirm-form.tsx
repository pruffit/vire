'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

type Status = 'idle' | 'sending' | 'done' | 'error';

export function UnsubscribeConfirmForm({ uid, token }: { uid: string; token: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const t = useTranslations('email.unsubscribe.notifications');

  async function confirm() {
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const url = `/api/v1/notifications/unsubscribe?uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}`;
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw new Error('Server error');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <>
        <h1 className="text-2xl font-semibold mb-3">{t('doneTitle')}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          {t('doneBody')}
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t('home')}
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold mb-3">{t('confirmTitle')}</h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        {t('confirmBody')}
      </p>
      <button
        type="button"
        onClick={confirm}
        disabled={status === 'sending'}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {status === 'sending' ? t('confirmPending') : t('confirmCta')}
      </button>
      {status === 'error' && (
        <p className="mt-4 text-sm text-destructive">
          {t('errorBody')}{' '}
          <a href="mailto:hello@viremusic.ru" className="underline underline-offset-2">
            hello@viremusic.ru
          </a>
        </p>
      )}
    </>
  );
}
