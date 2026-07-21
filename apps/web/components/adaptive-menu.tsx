'use client';

import { useRef, type ReactNode } from 'react';
import { useIsDesktopPointer } from '@/lib/is-desktop-pointer';
import { Popover, PopoverItem, type PopoverTriggerProps } from '@/components/popover';
import { Sheet } from '@/components/sheet';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface AdaptiveMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MenuItem[];
  trigger: (props: PopoverTriggerProps) => ReactNode;
  title?: string;
  align?: 'left' | 'right';
  drop?: 'up' | 'down' | 'auto';
}

export function AdaptiveMenu({ open, onOpenChange, items, trigger, title, align, drop }: AdaptiveMenuProps) {
  const desktop = useIsDesktopPointer();
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (desktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange} trigger={trigger} align={align} drop={drop}>
        {items.map((it, i) => (
          <PopoverItem
            key={i}
            label={it.label}
            icon={it.icon}
            hint={it.hint}
            disabled={it.disabled}
            onClick={() => { onOpenChange(false); it.onClick(); }}
          />
        ))}
      </Popover>
    );
  }

  return (
    <div className="relative shrink-0">
      {trigger({ open, toggle: () => onOpenChange(!open), ref: triggerRef })}
      <Sheet
        open={open}
        onClose={() => { onOpenChange(false); triggerRef.current?.focus(); }}
        anchor="bottom"
      >
        {title && (
          <p className="shrink-0 px-4 pt-1 pb-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
        )}
        <div role="menu" className="flex-1 min-h-0 overflow-y-auto pb-2">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { onOpenChange(false); it.onClick(); }}
              className="w-full min-h-11 flex items-center gap-3 px-4 text-left text-[15px] text-foreground/90 hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {it.icon && <span className="w-5 shrink-0 flex items-center justify-center text-foreground/40">{it.icon}</span>}
              <span className="flex-1">{it.label}</span>
              {it.hint}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
