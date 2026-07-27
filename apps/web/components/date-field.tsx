'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { fieldClass } from '@/components/ui-kit';
import { cn } from '@/lib/utils';

/**
 * Date picker — замена нативному `<input type=date>` (попап рисует браузер, мимо темы).
 * Значение — `yyyy-MM-dd` или ''; вычисления на целых y/m/d, без Date-арифметики с TZ.
 * Режимы: form (`name` → скрытый input) и controlled (`value`+`onValueChange`).
 */

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface Props {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

function parseISO(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  return { y: +match[1], m: +match[2] - 1, d: +match[3] };
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatRU(s: string): string {
  const p = parseISO(s);
  if (!p) return '';
  return `${String(p.d).padStart(2, '0')}.${String(p.m + 1).padStart(2, '0')}.${p.y}`;
}

export function DateField({
  value,
  defaultValue = '',
  onValueChange,
  name,
  disabled,
  className,
  'aria-label': ariaLabel,
}: Props) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(defaultValue);
  const current = isControlled ? value : internal;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const now = useMemo(() => new Date(), []);
  const initial = parseISO(current);
  const [view, setView] = useState({
    y: initial?.y ?? now.getFullYear(),
    m: initial?.m ?? now.getMonth(),
  });

  function toggle() {
    if (!open) {
      const p = parseISO(current);
      if (p) setView({ y: p.y, m: p.m });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  function set(next: string) {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  }

  function pick(d: number) {
    set(toISO(view.y, view.m, d));
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const total = v.y * 12 + v.m + delta;
      return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
    });
  }

  const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const sel = parseISO(current);
  const todayISO = toISO(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {name && <input type="hidden" name={name} value={current} />}

      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(fieldClass, 'flex w-full items-center justify-between gap-2 text-left tabular-nums')}
      >
        <span className={current ? 'text-foreground' : 'text-foreground/40'}>
          {current ? formatRU(current) : 'дд.мм.гггг'}
        </span>
        <svg
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className="shrink-0 text-foreground/40"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={spring.snappy}
            role="dialog"
            className="absolute z-30 mt-1 w-[17rem] max-w-[calc(100vw-2rem)] rounded-lg border border-foreground/15 bg-background p-3 shadow-xl shadow-black/40"
          >
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-sm font-medium tabular-nums">
                {MONTHS[view.m]} {view.y}
              </span>
              <div className="flex items-center gap-1">
                <NavBtn label="Предыдущий месяц" onClick={() => shiftMonth(-1)}>
                  <path d="M15 18l-6-6 6-6" />
                </NavBtn>
                <NavBtn label="Следующий месяц" onClick={() => shiftMonth(1)}>
                  <path d="M9 18l6-6-6-6" />
                </NavBtn>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-1 text-center font-mono text-[10px] uppercase text-foreground/30">
                  {w}
                </span>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <span key={`e${i}`} />;
                const iso = toISO(view.y, view.m, d);
                const isSel = sel && sel.y === view.y && sel.m === view.m && sel.d === d;
                const isToday = iso === todayISO;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => pick(d)}
                    className={cn(
                      'h-8 rounded-md text-sm tabular-nums transition-colors',
                      isSel
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-foreground/75 hover:bg-foreground/10',
                      !isSel && isToday && 'ring-1 ring-inset ring-foreground/25',
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-foreground/10 pt-2 text-xs">
              <button
                type="button"
                onClick={() => { set(''); setOpen(false); }}
                className="text-foreground/45 transition-colors hover:text-foreground"
              >
                Очистить
              </button>
              <button
                type="button"
                onClick={() => { set(todayISO); setOpen(false); }}
                className="text-foreground/45 transition-colors hover:text-foreground"
              >
                Сегодня
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-md text-foreground/55 transition-colors hover:bg-foreground/10 hover:text-foreground"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}
