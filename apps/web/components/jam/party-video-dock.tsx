'use client';

import { useEffect, useRef } from 'react';
import { useJamSession } from './jam-session-provider';
import { setPartyVideoContainer } from '@/lib/jam/sources/video-container';

/**
 * Поверхность встраиваемого плеера живёт в app-shell, а не на странице вечеринки: iframe
 * нельзя переносить по DOM (перезагрузится), а размонтирование убивает звук — уход на главную
 * обрывал бы вечеринку ровно так же, как раньше уход со страницы обрывал джем.
 * Видима и не перекрыта — требование ToS YouTube (≥200×200).
 */
export function PartyVideoDock() {
  const session = useJamSession();
  const ref = useRef<HTMLDivElement>(null);

  const activeItem = session?.room.queue.find((item) => item.id === session.activeItemId);
  const isEmbed = activeItem?.source === 'YOUTUBE' || activeItem?.source === 'SOUNDCLOUD';
  const visible = Boolean(session?.isAudioDevice && isEmbed);

  useEffect(() => {
    if (!visible) return;
    setPartyVideoContainer(ref.current);
    return () => setPartyVideoContainer(null);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] sm:bottom-24 sm:right-4">
      <div
        ref={ref}
        className="pointer-events-auto h-[200px] w-full overflow-hidden rounded-xl border border-border bg-black shadow-2xl"
      />
    </div>
  );
}
