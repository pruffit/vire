'use client';

import { useState } from 'react';
import Link from 'next/link';

type Status = 'idle' | 'sending' | 'done' | 'error';

export function UnsubscribeConfirmForm({ uid, token }: { uid: string; token: string }) {
  const [status, setStatus] = useState<Status>('idle');

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
        <h1 className="text-2xl font-semibold mb-3">Вы отписаны</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          Email-уведомления Vire на этот адрес больше не приходят. Включить их обратно
          можно в любой момент в настройках профиля.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          На главную
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold mb-3">Отписаться от email-уведомлений?</h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        Письма о заявках в друзья и новых сообщениях на этот адрес перестанут приходить.
        Уведомления внутри Vire останутся.
      </p>
      <button
        type="button"
        onClick={confirm}
        disabled={status === 'sending'}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {status === 'sending' ? 'Отписываю…' : 'Отписаться'}
      </button>
      {status === 'error' && (
        <p className="mt-4 text-sm text-destructive">
          Не удалось отписаться. Попробуйте ещё раз или напишите на{' '}
          <a href="mailto:hello@viremusic.ru" className="underline underline-offset-2">
            hello@viremusic.ru
          </a>
        </p>
      )}
    </>
  );
}
