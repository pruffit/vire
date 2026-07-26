'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { cn } from '@/lib/utils';

export interface PopoverTriggerProps {
  open: boolean;
  toggle: () => void;
  ref: RefObject<HTMLButtonElement | null>;
}

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  /** 'auto' флипает вниз, если триггеру нет места сверху; 'down' — принудительно (peek-шит клипает раскрытие вверх). */
  drop?: 'up' | 'down' | 'auto';
  panelClassName?: string;
  /** ARIA-роль панели: 'menu' для action-меню (дефолт), 'dialog' для контентного поповера. */
  role?: string;
}

const FLIP_THRESHOLD = 170;

export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = 'right',
  drop = 'up',
  panelClassName,
  role = 'menu',
}: PopoverProps) {
  const [dropDown, setDropDown] = useState(drop === 'down');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (!open) {
      setDropDown(
        drop === 'down' ||
          (drop === 'auto' && !!triggerRef.current && triggerRef.current.getBoundingClientRect().top < FLIP_THRESHOLD),
      );
    }
    onOpenChange(!open);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  const yEnter = dropDown ? -6 : 6;
  const yExit = dropDown ? -4 : 4;

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      {trigger({ open, toggle, ref: triggerRef })}
      <AnimatePresence>
        {open && (
          <motion.div
            role={role}
            initial={{ opacity: 0, y: yEnter, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: yExit, scale: 0.97 }}
            transition={spring.snappy}
            className={cn(
              'absolute z-50 min-w-[184px] rounded-xl border border-white/12 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1',
              align === 'right' ? 'right-0' : 'left-0',
              dropDown ? 'top-full mt-2' : 'bottom-full mb-2',
              panelClassName,
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PopoverItem({
  label,
  icon,
  hint,
  onClick,
  disabled,
}: {
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-foreground/85 hover:bg-white/8 disabled:opacity-60 disabled:pointer-events-none transition-colors"
    >
      {icon && <span className="w-4 shrink-0 flex items-center justify-center text-foreground/30">{icon}</span>}
      <span className="flex-1">{label}</span>
      {hint}
    </button>
  );
}

/** Хит-зона 44px при меньшем визуальном футпринте — тач-таргет без изменения вида кнопки. */
export function touchTargetClass(size: 'sm' | 'md'): string {
  return size === 'sm' ? 'w-11 h-11 -m-1.5' : 'w-11 h-11 -m-1';
}

/** 44px тач-таргет для текстовых пилюль/чипов/табов (десктоп-плотность сохраняется). */
export const touchPill = 'pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center';
