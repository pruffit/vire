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
      className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${
        verified
          ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
          : 'border-white/15 text-white/35 hover:border-white/30 hover:text-white/60'
      }`}
    >
      {verified ? '✓ верифицирован' : 'верифицировать'}
    </button>
  );
}
