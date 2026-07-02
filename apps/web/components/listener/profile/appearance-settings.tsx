'use client';

import { useReduceMotionPref, setReduceMotionPref } from '@vire/ui/motion';
import { cn } from '@/lib/utils';

export function AppearanceSettings() {
  const reduce = useReduceMotionPref();

  return (
    <div className="flex items-center justify-between gap-4 py-1">
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
        className="shrink-0 grid place-items-center min-h-11 min-w-11"
      >
        <span
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            reduce ? 'bg-primary' : 'bg-secondary',
          )}
        >
          <span
            className={cn(
              'absolute left-0.5 inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
              reduce && 'translate-x-5',
            )}
          />
        </span>
      </button>
    </div>
  );
}
