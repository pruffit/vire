'use client';

import { useEffect, useState } from 'react';
import { getJamTransport } from './jam-controls';

const TICK_MS = 250;

function readSeconds(): number {
  return (getJamTransport()?.positionMs() ?? 0) / 1000;
}

/** Аналог useAudioTime для джема: тикает по интервалу вместо rAF (позиция читается у транспорта, не у <audio>), останавливается при active=false. */
export function useJamPosition(active: boolean): number {
  const [seconds, setSeconds] = useState(readSeconds);

  // Досинхронизация на переход active=false→true — во время рендера, не эффектом
  // (react-hooks/set-state-in-effect), как в useAudioTime.
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    if (active) setSeconds(readSeconds());
  }

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setSeconds(readSeconds()), TICK_MS);
    return () => clearInterval(interval);
  }, [active]);

  return seconds;
}
