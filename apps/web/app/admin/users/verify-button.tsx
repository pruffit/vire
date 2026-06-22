'use client';

import { useTransition } from 'react';
import { actionVerifyArtist } from '../actions';

export function VerifyButton({
  artistProfileId,
  verified,
}: {
  artistProfileId: string;
  verified: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(() => actionVerifyArtist(artistProfileId, !verified));
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      title={verified ? 'Верифицирован — снять' : 'Верифицировать артиста'}
      className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors disabled:opacity-40 whitespace-nowrap ${
        verified
          ? 'border-sky-500/30 text-sky-300 hover:bg-sky-500/10'
          : 'border-foreground/15 text-foreground/40 hover:border-foreground/30 hover:text-foreground/70'
      }`}
    >
      {verified ? '✓ верифиц.' : 'верифиц.'}
    </button>
  );
}
