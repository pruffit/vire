'use client';
import { useEffect, useRef } from 'react';
import { setPartyVideoContainer } from '@/lib/jam/sources/video-container';

/**
 * Поверхность встраиваемого плеера в самой комнате. Экран вечеринки — не единственный её
 * владелец: без этой панели устройство-колонка в обычном виде комнаты молча не играло бы
 * внешнюю позицию (плеера некуда примонтировать). Видимость обязательна по ToS YouTube.
 */
export function PartyVideoSurface() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPartyVideoContainer(ref.current);
    return () => setPartyVideoContainer(null);
  }, []);

  return (
    <div className="space-y-1.5">
      <div ref={ref} className="relative aspect-video w-full max-w-sm overflow-hidden rounded-xl bg-muted" />
      <p className="text-[11px] text-muted-foreground">
        Играет во встроенном плеере. Развернуть — «Экран вечеринки».
      </p>
    </div>
  );
}
