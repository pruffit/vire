'use client';

import type { ReactNode } from 'react';

export const OPEN_ANNOUNCEMENT_EVENT = 'vire:open-announcement';

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
