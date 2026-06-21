'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Ошибка рендера сегмента маршрута — в Sentry (no-op без DSN).
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="min-h-full flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-8xl font-bold font-mono tabular-nums" style={{ opacity: 0.08 }}>
        500
      </p>
      <div className="space-y-2 -mt-4">
        <h1 className="text-xl font-semibold tracking-tight">Что-то пошло не так</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Произошла неожиданная ошибка. Попробуй обновить страницу.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Попробовать снова
      </button>
    </main>
  );
}
