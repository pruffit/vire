'use client';

import { useTransition } from 'react';
import { actionVerifyArtist } from '../actions';
import { Icon } from '@/components/icon';
import { cn } from '@/lib/utils';

export function VerifyButton({
  artistProfileId,
  verified,
  canMutate,
}: {
  artistProfileId: string;
  verified: boolean;
  canMutate: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(() => actionVerifyArtist(artistProfileId, !verified));
  }

  const cls = cn(
    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] leading-none whitespace-nowrap transition-colors disabled:opacity-40',
    verified
      ? 'bg-sky-500/15 text-sky-300 border border-sky-500/25 hover:bg-sky-500/25'
      : 'border border-foreground/15 text-foreground/45 hover:border-foreground/30 hover:text-foreground/80',
  );

  if (!canMutate) {
    if (!verified) return null;
    return (
      <span className={cls}>
        <Icon name="check" size={12} />
        верифиц.
      </span>
    );
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      title={verified ? 'Верифицирован — снять' : 'Верифицировать артиста'}
      className={cls}
    >
      {verified && <Icon name="check" size={12} />}
      верифиц.
    </button>
  );
}
