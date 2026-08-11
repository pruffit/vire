'use client';

import { useTransition } from 'react';
import { actionSetArtistActive } from '../actions';

export function ActiveToggle({
  artistProfileId,
  isActive,
  canMutate,
}: {
  artistProfileId: string;
  isActive: boolean;
  canMutate: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(() => actionSetArtistActive(artistProfileId, !isActive));
  }

  const cls = `text-xs font-mono px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${
    isActive
      ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
      : 'border-red-500/30 text-red-300 hover:bg-red-500/10'
  }`;

  if (!canMutate) return <span className={cls}>{isActive ? 'активен' : 'скрыт'}</span>;

  return (
    <button
      onClick={handle}
      disabled={pending}
      title={isActive ? 'Скрыть с витрины' : 'Вернуть на витрину'}
      className={cls}
    >
      {isActive ? 'активен' : 'скрыт'}
    </button>
  );
}
