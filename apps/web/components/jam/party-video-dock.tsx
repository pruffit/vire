'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useJamSession } from './jam-session-provider';
import { setPartyVideoContainer } from '@/lib/jam/sources/video-container';
import { getPartyVideoSlot, onPartyVideoSlotChange } from '@/lib/jam/sources/video-slot';

// ToS YouTube: встраиваемый плеер не меньше 200×200.
const MIN_SIDE = 200;
const PARKED = 'translate(-100vw, 0)';

/**
 * Поверхность встраиваемого плеера живёт в app-shell, а не на странице вечеринки: iframe
 * нельзя переносить по DOM (перезагрузится), а размонтирование убивает звук. Поэтому док
 * всегда `fixed` и лишь подгоняет геометрию под слот страницы; слота нет или он уехал из
 * вида — док паркуется за экраном, а не висит поверх интерфейса: звук продолжает идти.
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
    if (!dock) return;
    if (!visible || !slot) {
      park(dock);
      return;
    }

    let frame = 0;
    let applied = '';

    const sync = (): void => {
      frame = requestAnimationFrame(sync);
      const rect = slot.getBoundingClientRect();
      const shown = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      // Слот виден почти целиком — только тогда садимся в него: иначе док налезет на шапку.
      const fits = rect.height > 0 && shown / rect.height > 0.9;
      const next = fits
        ? `${rect.left}|${rect.top}|${rect.width}|${rect.height}|${slot.dataset.videoZ ?? ''}`
        : 'parked';
      if (next === applied) return;
      applied = next;

      if (!fits) {
        park(dock);
        return;
      }
      dock.style.width = `${rect.width}px`;
      dock.style.height = `${rect.height}px`;
      dock.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      // Слот внутри оверлея — док обязан подняться над ним, иначе видео скрыто фоном сцены.
      dock.style.zIndex = slot.dataset.videoZ ?? '';
      dock.setAttribute('aria-hidden', 'false');
    };

    sync();
    return () => {
      cancelAnimationFrame(frame);
      park(dock);
    };
  }, [visible, slot]);

  if (!visible) return null;

  return (
    <div
      ref={dockRef}
      aria-hidden="true"
      style={{ left: 0, top: 0, width: MIN_SIDE, height: MIN_SIDE, transform: PARKED }}
      className="fixed z-40 overflow-hidden rounded-xl border border-border bg-black"
    >
      <div ref={surfaceRef} className="h-full w-full" />
    </div>
  );
}

/** Увозим за экран, а не прячем через display/размонтирование — иначе iframe теряет звук. */
function park(dock: HTMLDivElement): void {
  dock.style.width = `${MIN_SIDE}px`;
  dock.style.height = `${MIN_SIDE}px`;
  dock.style.transform = PARKED;
  dock.style.zIndex = '';
  dock.setAttribute('aria-hidden', 'true');
}
