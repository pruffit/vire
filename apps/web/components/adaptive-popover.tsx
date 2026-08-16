'use client';

import { useRef, type ReactNode } from 'react';
import { useIsDesktopPointer } from '@/lib/is-desktop-pointer';
import { Popover, type PopoverTriggerProps } from '@/components/popover';
import { Sheet } from '@/components/sheet';

interface AdaptivePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  title?: string;
  align?: 'left' | 'right';
  drop?: 'up' | 'down' | 'auto';
  panelClassName?: string;
}

export function AdaptivePopover({
  open,
  onOpenChange,
  trigger,
  children,
  title,
  align,
  drop,
  panelClassName,
}: AdaptivePopoverProps) {
  const desktop = useIsDesktopPointer();
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (desktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange} trigger={trigger} align={align} drop={drop} panelClassName={panelClassName} role="dialog">
        {children}
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
          <p className="shrink-0 px-4 pt-1 pb-2 label-mono text-muted-foreground">
            {title}
          </p>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-clip pb-2">{children}</div>
      </Sheet>
    </div>
  );
}
