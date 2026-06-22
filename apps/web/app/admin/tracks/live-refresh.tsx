'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Пока есть треки в статусе PROCESSING — периодически обновляет серверный список
 * (router.refresh), чтобы статус сам переходил в «готов» без перезагрузки
 * страницы. Показывает живой индикатор. Когда обработка кончилась — исчезает и
 * перестаёт опрашивать.
 */
export function TracksLiveRefresh({
  processing,
  intervalMs = 5000,
}: {
  processing: number;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (processing <= 0) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [processing, intervalMs, router]);

  if (processing <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground/50">
      <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
      {processing} в обработке · обновляется
    </span>
  );
}
