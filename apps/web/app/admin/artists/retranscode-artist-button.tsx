'use client';

import { useState, useTransition } from 'react';
import { actionRetranscodeArtist } from '../actions';

interface Props {
  artistProfileId: string;
}

// массовый пере-транскод HLS всех треков артиста — при системно битом HLS (напр. вшитая обложка-видео)
export function RetranscodeArtistButton({ artistProfileId }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function handleClick() {
    setMsg(null);
    if (!window.confirm('Пересобрать HLS всех треков артиста? Они уйдут в обработку.')) return;
    startTransition(async () => {
      const res = await actionRetranscodeArtist(artistProfileId);
      setMsg(res.error ?? `${res.queued} в очереди`);
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title="Пересобрать HLS всех треков артиста"
        className="rounded-md border border-foreground/10 bg-foreground/5 px-2 py-1 font-mono text-xs transition-colors hover:bg-foreground/10 hover:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40 whitespace-nowrap active:scale-[0.98]"
      >
        {pending ? '…' : '⟳'}
      </button>
      {msg && <span className="text-[10px] text-foreground/50" title={msg}>{msg}</span>}
    </span>
  );
}
