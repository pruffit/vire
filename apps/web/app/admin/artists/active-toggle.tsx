'use client';

import { useTransition } from 'react';
import { actionSetArtistActive } from '../actions';

/** Скрыть/показать артиста на витрине (isActive). */
export function ActiveToggle({
  artistProfileId,
  isActive,
}: {
  artistProfileId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(() => actionSetArtistActive(artistProfileId, !isActive));
  }

  return (
    <button
      onClick={handle}
      disabled={pending}
      title={isActive ? 'Скрыть с витрины' : 'Вернуть на витрину'}
      className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${
        isActive
          ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
          : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
      }`}
    >
      {isActive ? 'активен' : 'скрыт'}
    </button>
  );
}
