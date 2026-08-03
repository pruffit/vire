'use client';

import { useEffect, useRef } from 'react';
import { setPartyVideoSlot } from '@/lib/jam/sources/video-slot';
import { cn } from '@/lib/utils';

/**
 * Место под видео на странице: пустой узел-плейсхолдер, по которому позиционируется док.
 * `z` нужен, когда слот лежит внутри оверлея: док живёт в app-shell со своим z-index и
 * без подсказки окажется под оверлеем — видео станет чёрным прямоугольником.
 */
export function PartyVideoSlot({ className, z }: { className?: string; z?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPartyVideoSlot(ref.current);
    return () => setPartyVideoSlot(null);
  }, []);

  return <div ref={ref} aria-hidden="true" data-video-z={z} className={cn('rounded-xl bg-black/60', className)} />;
}
