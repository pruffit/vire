'use client';

import dynamic from 'next/dynamic';

const Player = dynamic(() => import('./index').then((m) => ({ default: m.Player })), {
  ssr: false,
});

export function PlayerWrapper() {
  return <Player />;
}
