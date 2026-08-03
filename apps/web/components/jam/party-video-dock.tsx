'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { useJamSession } from './jam-session-provider';
import { setPartyVideoContainer } from '@/lib/jam/sources/video-container';
import { getPartyVideoSlot, onPartyVideoSlotChange } from '@/lib/jam/sources/video-slot';
import { Icon } from '@/components/icon';

type Corner = 'tl' | 'tr' | 'bl' | 'br';

const CORNER_KEY = 'vire-party-pip-corner';
const MARGIN = 12;
// Плеер (64) + мобильный таб-бар (64) + запас: PiP не должен садиться на них.
const BOTTOM_RESERVE = 140;
const TOP_RESERVE = 68;
// ToS YouTube: встраиваемый плеер не меньше 200×200.
const MIN_SIDE = 200;

function readCorner(): Corner {
  if (typeof window === 'undefined') return 'br';
  try {
    const stored = localStorage.getItem(CORNER_KEY);
    return stored === 'tl' || stored === 'tr' || stored === 'bl' || stored === 'br' ? stored : 'br';
  } catch {
    return 'br';
  }
}

/**
 * Поверхность встраиваемого плеера живёт в app-shell, а не на странице вечеринки: iframe
 * нельзя переносить по DOM (перезагрузится), а размонтирование убивает звук. Поэтому док
 * всегда `fixed` и лишь подгоняет геометрию под слот страницы; слота нет или он уехал из
 * вида — PiP в углу, который можно перетащить (по умолчанию он висит над контентом).
 */
export function PartyVideoDock() {
  const session = useJamSession();
  const dockRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const slot = useSyncExternalStore(onPartyVideoSlotChange, getPartyVideoSlot, () => null);
  const [corner, setCorner] = useState<Corner>(readCorner);
  const [docked, setDocked] = useState(false);
  const [dragging, setDragging] = useState(false);

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
    if (!visible || !slot || !dock || dragging) {
      setDocked(false);
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
      const next = fits ? `${rect.left}|${rect.top}|${rect.width}|${rect.height}|${slot.dataset.videoZ ?? ''}` : 'pip';
      if (next === applied) return;
      applied = next;
      setDocked(fits);

      if (!fits) {
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
      // Слот внутри оверлея — док обязан подняться над ним, иначе видео скрыто фоном сцены.
      dock.style.zIndex = slot.dataset.videoZ ?? '';
    };

    sync();
    return () => {
      cancelAnimationFrame(frame);
      dock.removeAttribute('style');
      setDocked(false);
    };
  }, [visible, slot, dragging]);

  function handleDragStart(e: ReactPointerEvent<HTMLButtonElement>): void {
    if (docked) return;
    e.preventDefault();
    const dock = dockRef.current;
    if (!dock) return;
    const rect = dock.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    setDragging(true);

    const move = (event: PointerEvent): void => {
      dock.style.left = '0';
      dock.style.top = '0';
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
      dock.style.transform = `translate(${event.clientX - offsetX}px, ${event.clientY - offsetY}px)`;
    };

    const finish = (event: PointerEvent): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      const next: Corner = `${event.clientY < window.innerHeight / 2 ? 't' : 'b'}${event.clientX < window.innerWidth / 2 ? 'l' : 'r'}` as Corner;
      dock.removeAttribute('style');
      setCorner(next);
      setDragging(false);
      try {
        localStorage.setItem(CORNER_KEY, next);
      } catch {
        // не сохранилось — угол просто не переживёт перезагрузку
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
  }

  if (!visible) return null;

  const vertical = corner.startsWith('t') ? { top: TOP_RESERVE } : { bottom: BOTTOM_RESERVE };
  const horizontal = corner.endsWith('l') ? { left: MARGIN } : { right: MARGIN };

  return (
    <div
      ref={dockRef}
      style={{ ...vertical, ...horizontal, width: 'min(56vw, 320px)', height: MIN_SIDE }}
      className="fixed z-40 overflow-hidden rounded-xl border border-border bg-black shadow-2xl"
    >
      <div ref={surfaceRef} className="h-full w-full" />
      {!docked && (
        <button
          type="button"
          onPointerDown={handleDragStart}
          aria-label="Перетащить окно видео"
          className="absolute right-1 top-1 grid h-8 w-8 cursor-grab touch-none place-items-center rounded-full bg-black/60 text-white/70 transition-colors hover:text-white active:cursor-grabbing"
        >
          <Icon name="more-vertical" size={14} />
        </button>
      )}
    </div>
  );
}
