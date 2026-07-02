'use client';

import { useReduceMotionPref, setReduceMotionPref } from '@vire/ui/motion';
import { cn } from '@/lib/utils';

export function AppearanceSettings() {
  const reduce = useReduceMotionPref();

  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Приглушить движение</p>
          <p className="text-xs text-muted-foreground">Меньше анимаций по всему сайту.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reduce}
          aria-label="Приглушить движение"
          onClick={() => setReduceMotionPref(!reduce)}
          className="shrink-0 grid place-items-center min-h-11 min-w-11 cursor-pointer"
        >
          <span
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full ring-1 ring-inset transition-colors',
              reduce ? 'bg-primary ring-primary' : 'bg-foreground/15 ring-border',
            )}
          >
            <span
              className={cn(
                'absolute left-0.5 inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                reduce && 'translate-x-5',
              )}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
