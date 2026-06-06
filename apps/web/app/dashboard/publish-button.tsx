'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function PublishButton({ releaseId }: { releaseId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function publish() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/v1/dashboard/releases/${releaseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const json = await res.json().catch(() => ({}));
        setError((json as { error?: string }).error ?? 'Ошибка');
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={publish}
        disabled={pending}
        className="text-xs px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-40"
      >
        {pending ? 'Публикую…' : 'Опубликовать'}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
