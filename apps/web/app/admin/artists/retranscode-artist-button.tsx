'use client';

import { useState, useTransition } from 'react';
import { actionRetranscodeArtist } from '../actions';

interface Props {
  artistProfileId: string;
}

/**
 * Массовый пере-транскод HLS всех треков артиста (полезно при системно битом HLS,
 * напр. вшитая обложка-видео у всех файлов артиста).
 */
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
        className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs font-mono hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-40 cursor-pointer whitespace-nowrap"
      >
        {pending ? '…' : '⟳ HLS'}
      </button>
      {msg && <span className="text-[10px] text-white/50" title={msg}>{msg}</span>}
    </span>
  );
}
