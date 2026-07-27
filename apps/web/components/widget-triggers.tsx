'use client';

import { useRef, type ReactNode } from 'react';

export const OPEN_ANNOUNCEMENT_EVENT = 'vire:open-announcement';
export const PARTY_EVENT = 'vire:party';

export function AnnouncementReopenLink({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent(OPEN_ANNOUNCEMENT_EVENT, { detail: { id } }))
      }
      className={className}
    >
      {children}
    </button>
  );
}

/** Тройной клик по содержимому запускает нотный дождь («© VireMusic» в футере). */
export function PartyText({ children, className }: { children: ReactNode; className?: string }) {
  const clicks = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onClick = () => {
    clicks.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => (clicks.current = 0), 600);
    if (clicks.current >= 3) {
      clicks.current = 0;
      window.dispatchEvent(new Event(PARTY_EVENT));
    }
  };

  return (
    <span onClick={onClick} className={className}>
      {children}
    </span>
  );
}
