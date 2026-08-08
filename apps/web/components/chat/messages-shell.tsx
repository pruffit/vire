'use client';

import type { ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

// mobile: индекс /messages показывает только список, вложенный роут — только тред;
// md+ — обе панели видны одновременно, список фикс. ширины.
export function MessagesShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const isIndex = pathname === '/messages';

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
      <aside
        className={cn(
          'min-h-0 flex-col overflow-y-auto border-border/40 md:flex md:w-80 md:flex-none md:border-r xl:w-96',
          isIndex ? 'flex flex-1' : 'hidden',
        )}
      >
        {sidebar}
      </aside>
      <div
        className={cn(
          'min-h-0 min-w-0 flex-col md:flex md:flex-1',
          isIndex ? 'hidden' : 'flex flex-1',
        )}
      >
        {children}
      </div>
    </div>
  );
}
