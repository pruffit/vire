'use client';

import { useState, useTransition } from 'react';
import { actionRetranscodeTrack } from '../actions';

interface Props {
  trackId: string;
}

/**
 * Пере-транскод трека: пересобирает HLS из исходника. Полезно когда трек READY,
 * но HLS-файлы в бакете битые/отсутствуют (плеер бесконечно грузится).
 */
export function RetranscodeButton({ trackId }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    if (!window.confirm('Пересобрать HLS из исходника? Трек уйдёт в обработку.')) return;
    startTransition(async () => {
      const res = await actionRetranscodeTrack(trackId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title="Пересобрать HLS из исходника"
        className="rounded-md border border-foreground/10 bg-foreground/5 px-2 py-1 font-mono text-xs transition-colors hover:bg-foreground/10 hover:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40 whitespace-nowrap active:scale-[0.98]"
      >
        {pending ? '…' : '⟳ HLS'}
      </button>
      {error && <span className="text-[10px] text-red-400" title={error}>!</span>}
    </span>
  );
}
