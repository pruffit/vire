'use client';

import { useRef, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { PARTY_PATH } from '@/lib/party';

const WINDOW_MS = 600;
const TAP_COUNT = 3;

/** Тройной клик за WINDOW_MS ведёт на секретный вход вечеринки — без визуальных подсказок. */
export function PartyTrigger({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const clicksRef = useRef<number[]>([]);

  function handleClick(): void {
    const now = Date.now();
    const recent = clicksRef.current.filter((t) => now - t < WINDOW_MS);
    recent.push(now);
    clicksRef.current = recent;
    if (recent.length >= TAP_COUNT) {
      clicksRef.current = [];
      router.push(PARTY_PATH);
    }
  }

  return (
    <span onClick={handleClick} className={className}>
      {children}
    </span>
  );
}
