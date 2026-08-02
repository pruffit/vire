'use client';

import { useEffect, useRef } from 'react';
import { setPartyVideoSlot } from '@/lib/jam/sources/video-slot';
import { cn } from '@/lib/utils';

/** Место под видео на странице: пустой узел-плейсхолдер, по которому позиционируется док. */
export function PartyVideoSlot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPartyVideoSlot(ref.current);
    return () => setPartyVideoSlot(null);
  }, []);

  return <div ref={ref} aria-hidden="true" className={cn('rounded-xl bg-black/60', className)} />;
}
