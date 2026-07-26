'use client';

import { Sheet, SheetDragHandle } from '@/components/sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function QuickLookSheet({ open, onClose, children }: Props) {
  return (
    <Sheet open={open} onClose={onClose} anchor="center">
      {children}
    </Sheet>
  );
}

/** Шапка peek-контента тоже стартует свайп-закрытие — чтобы не целиться в узкий граббер. */
export const QuickLookDragHandle = SheetDragHandle;

export function MiniEq({ animate }: { animate: boolean }) {
  return (
    <span
      className="inline-flex items-end gap-[1.5px] h-3"
      style={{ color: 'var(--artist-accent, hsl(200 80% 65%))' }}
      aria-label="Сейчас играет"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] bg-current rounded-full"
          style={{
            height: animate ? undefined : '35%',
            animation: animate ? `vire-eq 0.9s ease-in-out ${i * 0.15}s infinite` : undefined,
          }}
        />
      ))}
    </span>
  );
}
