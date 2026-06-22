'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { ALL_GENRES, GENRE_GROUPS, GENRE_LABELS, type Genre } from '@/lib/genres';
import { fieldClass } from '@/components/ui-kit';
import { cn } from '@/lib/utils';

/**
 * Кастомный одиночный селект жанра — замена уродскому нативному `<select>` с
 * optgroup. Поиск + группы + click-outside, единый дизайн с китом. Значение
 * кладётся в скрытый input (`name`), чтобы форма по-прежнему сабмитилась через FormData.
 */
export function GenreSelect({
  name,
  defaultValue = '',
  disabled,
}: {
  name: string;
  defaultValue?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<string>(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне и по Esc.
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

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL_GENRES.filter((g) => GENRE_LABELS[g].toLowerCase().includes(q));
  }, [query]);

  function pick(g: Genre | '') {
    setValue(g);
    setOpen(false);
    setQuery('');
  }

  const label = value ? GENRE_LABELS[value as Genre] : null;

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(fieldClass, 'w-full flex items-center justify-between gap-2 text-left')}
      >
        <span className={label ? 'text-foreground' : 'text-foreground/40'}>
          {label ?? 'Жанр не выбран'}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className={cn('shrink-0 text-foreground/40 transition-transform', open && 'rotate-180')}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={spring.snappy}
            className="absolute z-20 mt-1 w-full rounded-lg border border-foreground/15 bg-background shadow-xl shadow-black/40 overflow-hidden"
          >
            <div className="p-2 border-b border-foreground/10">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск жанра…"
                className="w-full rounded-md bg-foreground/5 border border-foreground/10 px-2.5 py-1.5 text-sm placeholder:text-foreground/35 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="max-h-64 overflow-y-auto p-1 [scrollbar-width:thin]">
              <Option active={value === ''} onClick={() => pick('')}>
                <span className="text-foreground/50">Без жанра</span>
              </Option>

              {matches ? (
                matches.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-foreground/30">Ничего не найдено</p>
                ) : (
                  matches.map((g) => (
                    <Option key={g} active={value === g} onClick={() => pick(g)}>
                      {GENRE_LABELS[g]}
                    </Option>
                  ))
                )
              ) : (
                GENRE_GROUPS.map((group) => (
                  <div key={group.label} className="pt-1.5 first:pt-0">
                    <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">
                      {group.label}
                    </p>
                    {group.genres.map((g) => (
                      <Option key={g} active={value === g} onClick={() => pick(g)}>
                        {GENRE_LABELS[g]}
                      </Option>
                    ))}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Option({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-foreground/10 text-foreground' : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      {children}
      {active && (
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <path d="M2.5 6.5 5 9l4.5-5.5" />
        </svg>
      )}
    </button>
  );
}
