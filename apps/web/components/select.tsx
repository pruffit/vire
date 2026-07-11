'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { fieldClass, selectClass } from '@/components/ui-kit';
import { cn } from '@/lib/utils';

/**
 * Кастомный селект — замена нативному `<select>` (его список рисует ОС, мимо темы).
 * Портал с `position: fixed`, чтобы не обрезался скролл-контейнерами (таблицы админки).
 * Два режима значения: controlled (`value`+`onValueChange`) или form (`name` — значение
 * в скрытый input, сабмит через FormData).
 */

export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectGroup = { label: string; options: SelectOption[] };

interface Props {
  options?: SelectOption[];
  groups?: SelectGroup[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Имя скрытого input — включает form-режим (сабмит через FormData). */
  name?: string;
  /** Текст, когда ничего не выбрано (значение не найдено среди опций). */
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  /** Визуальный регистр: `md` — поле формы, `sm` — инлайн в таблице. */
  size?: 'sm' | 'md';
  /** Выравнивание выпадающего списка относительно триггера. */
  align?: 'start' | 'end';
  /** Доп. классы обёртки (ширина и т.п.). */
  className?: string;
  'aria-label'?: string;
}

interface Coords {
  top: number;
  left: number;
  right: number;
  width: number;
}

export function Select({
  options,
  groups,
  value,
  defaultValue = '',
  onValueChange,
  name,
  placeholder = 'Не выбрано',
  searchable = false,
  disabled,
  size = 'md',
  align = 'start',
  className,
  'aria-label': ariaLabel,
}: Props) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(defaultValue);
  const current = isControlled ? value : internal;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const measure = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, right: window.innerWidth - r.right, width: r.width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const onScroll = () => measure();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const allGroups: SelectGroup[] = useMemo(
    () => groups ?? [{ label: '', options: options ?? [] }],
    [groups, options],
  );
  const flat = useMemo(() => allGroups.flatMap((g) => g.options), [allGroups]);
  const selected = flat.find((o) => o.value === current) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return flat.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, flat]);

  function pick(v: string) {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
    setOpen(false);
    setQuery('');
  }

  const sm = size === 'sm';

  return (
    <div className={cn('relative', className)}>
      {name && <input type="hidden" name={name} value={current} />}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          sm ? selectClass : fieldClass,
          'flex w-full items-center justify-between gap-2 text-left',
        )}
      >
        <span className={cn('truncate', selected ? 'text-foreground' : 'text-foreground/40')}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width={sm ? 12 : 14} height={sm ? 12 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className={cn('shrink-0 text-foreground/40 transition-transform', open && 'rotate-180')}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={popRef}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={spring.snappy}
                role="listbox"
                style={{
                  position: 'fixed',
                  top: coords.top,
                  ...(align === 'end' ? { right: coords.right } : { left: coords.left }),
                  minWidth: coords.width,
                }}
                className="z-50 w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-foreground/15 bg-background shadow-xl shadow-black/40 overflow-hidden"
              >
                {searchable && (
                  <div className="p-2 border-b border-foreground/10">
                    <input
                      autoFocus
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Поиск…"
                      className="w-full rounded-md bg-foreground/5 border border-foreground/10 px-2.5 py-1.5 text-sm placeholder:text-foreground/35 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto p-1 [scrollbar-width:thin]">
                  {filtered ? (
                    filtered.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-foreground/30">Ничего не найдено</p>
                    ) : (
                      filtered.map((o) => (
                        <Option key={o.value} active={current === o.value} disabled={o.disabled} onClick={() => pick(o.value)}>
                          {o.label}
                        </Option>
                      ))
                    )
                  ) : (
                    allGroups.map((group, gi) => (
                      <div key={group.label || gi} className={cn(group.label && 'pt-1.5 first:pt-0')}>
                        {group.label && (
                          <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">
                            {group.label}
                          </p>
                        )}
                        {group.options.map((o) => (
                          <Option key={o.value} active={current === o.value} disabled={o.disabled} onClick={() => pick(o.value)}>
                            {o.label}
                          </Option>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function Option({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none',
        active ? 'bg-foreground/10 text-foreground' : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      <span className="truncate">{children}</span>
      {active && (
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <path d="M2.5 6.5 5 9l4.5-5.5" />
        </svg>
      )}
    </button>
  );
}
