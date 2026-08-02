'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useJamSession } from './jam-session-provider';
import { setPartyVideoContainer } from '@/lib/jam/sources/video-container';
import { getPartyVideoSlot, onPartyVideoSlotChange } from '@/lib/jam/sources/video-slot';

/**
 * Поверхность встраиваемого плеера живёт в app-shell, а не на странице вечеринки: iframe
 * нельзя переносить по DOM (перезагрузится), а размонтирование убивает звук. Поэтому док
 * всегда `fixed` и лишь подгоняет геометрию под слот страницы; слота нет или он уехал из
 * вида — уголковый PiP. Видима и не перекрыта — требование ToS YouTube (≥200×200).
 */
export function PartyVideoDock() {
  const session = useJamSession();
  const dockRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const slot = useSyncExternalStore(onPartyVideoSlotChange, getPartyVideoSlot, () => null);

  const activeItem = session?.room.queue.find((item) => item.id === session.activeItemId);
  const isEmbed = activeItem?.source === 'YOUTUBE' || activeItem?.source === 'SOUNDCLOUD';
  const visible = Boolean(session?.isAudioDevice && isEmbed);

  useEffect(() => {
    if (!visible) return;
    setPartyVideoContainer(surfaceRef.current);
    return () => setPartyVideoContainer(null);
  }, [visible]);

  useEffect(() => {
    const dock = dockRef.current;
    if (!visible || !slot || !dock) return;

    let frame = 0;
    let applied = '';

    const sync = (): void => {
      frame = requestAnimationFrame(sync);
      const rect = slot.getBoundingClientRect();
      const shown = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      // Слот уехал из вида (прокрутили очередь) — видео уходит в угол, а не висит над чужим контентом.
      const docked = rect.height > 0 && shown / rect.height > 0.55;
      const next = docked ? `${rect.left}|${rect.top}|${rect.width}|${rect.height}` : 'pip';
      if (next === applied) return;
      applied = next;

      if (!docked) {
        dock.removeAttribute('style');
        return;
      }
      dock.style.left = '0';
      dock.style.top = '0';
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
      dock.style.width = `${rect.width}px`;
      dock.style.height = `${rect.height}px`;
      dock.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    };

    sync();
    return () => {
      cancelAnimationFrame(frame);
      dock.removeAttribute('style');
    };
  }, [visible, slot]);

  if (!visible) return null;

  return (
    <div
      ref={dockRef}
      className="fixed bottom-24 right-3 z-40 h-[200px] w-[320px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-black shadow-2xl sm:bottom-28 sm:right-4"
    >
      <div ref={surfaceRef} className="h-full w-full" />
    </div>
  );
}
