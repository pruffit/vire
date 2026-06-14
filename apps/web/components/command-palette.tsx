'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { SearchIcon } from '@/components/icons';
import type { SearchResults } from '@vire/db';

interface Item {
  key: string;
  label: string;
  sub: string;
  href: string;
  img?: string | null;
  round?: boolean;
  initial?: string;
  isAction?: boolean;
}

const ACTIONS: { label: string; sub: string; href: string }[] = [
  { label: 'Главная', sub: 'Открытие и активность', href: '/' },
  { label: 'Все артисты', sub: 'Каталог', href: '/artists' },
  { label: 'Лента', sub: 'Новое у подписок', href: '/feed' },
  { label: 'Профиль', sub: 'Лайки, подписки, покупки', href: '/profile' },
  { label: 'Дашборд', sub: 'Управление релизами', href: '/dashboard' },
];

/**
 * Командная палитра (⌘K / Ctrl+K) — центр-оверлей для быстрой навигации и поиска.
 * Родственник раскрывающегося поиска в навбаре, но как модальный «прыжок куда угодно».
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = query.trim().toLowerCase();
  const actionItems: Item[] = ACTIONS
    .filter((a) => !q || a.label.toLowerCase().includes(q))
    .map((a) => ({ key: `act:${a.href}`, label: a.label, sub: a.sub, href: a.href, isAction: true }));

  const resultItems: Item[] = results
    ? [
        ...results.artists.map((a) => ({ key: `ar:${a.id}`, href: `/artists/${a.slug}`, label: a.name, sub: 'Артист', img: a.avatarUrl, round: true, initial: a.name[0]?.toUpperCase() })),
        ...results.releases.map((r) => ({ key: `re:${r.id}`, href: `/artists/${r.artistSlug}/releases/${r.id}`, label: r.title, sub: `${r.type} · ${r.artistName}`, img: r.coverUrl, initial: r.title[0]?.toUpperCase() })),
        ...results.tracks.map((t) => ({ key: `tr:${t.id}`, href: `/artists/${t.artistSlug}/releases/${t.releaseId}/tracks/${t.id}`, label: t.title, sub: `Трек · ${t.artistName}`, img: t.coverUrl, initial: t.title[0]?.toUpperCase() })),
      ]
    : [];

  const items = [...actionItems, ...resultItems];

  const fetchResults = useCallback((value: string) => {
    if (value.trim().length < 2) { setResults(null); return; }
    fetch(`/api/v1/search?q=${encodeURIComponent(value)}`)
      .then((r) => r.json())
      .then((d: SearchResults) => { setResults(d); setActiveIdx(0); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(query), 180);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchResults]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults(null);
    setActiveIdx(0);
  }, []);

  // Глобальный хоткей ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (open) close(); else setOpen(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Фокус на инпут при открытии (без setState — иначе react-hooks/set-state-in-effect)
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  function go(item: Item) {
    close();
    router.push(item.href);
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, items.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (items[activeIdx]) go(items[activeIdx]);
      else if (query.trim().length >= 2) { const t = query.trim(); close(); router.push(`/search?q=${encodeURIComponent(t)}`); }
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={close}
          className="fixed inset-0 z-[70] flex items-start justify-center pt-[16vh] px-4 bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={spring.smooth}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl bg-popover border border-border shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 border-b border-border">
              <SearchIcon size={16} className="text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Куда перейти или что найти…"
                autoComplete="off"
                className="flex-1 h-12 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">esc</kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto py-1.5" data-scroll-area>
              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {query.trim().length >= 2 ? 'Ничего не найдено' : 'Начни вводить…'}
                </p>
              ) : (
                items.map((item, i) => (
                  <button
                    key={item.key}
                    onMouseDown={(e) => { e.preventDefault(); go(item); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${i === activeIdx ? 'bg-accent/20' : 'hover:bg-accent/10'}`}
                  >
                    <span className="relative w-7 h-7 shrink-0 rounded overflow-hidden bg-muted grid place-items-center text-xs font-mono text-muted-foreground">
                      {item.isAction ? <ArrowIcon /> : item.img ? (
                        <Image src={item.img} alt="" fill sizes="28px" className={`object-cover ${item.round ? 'rounded-full' : ''}`} />
                      ) : item.initial}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate leading-tight">{item.label}</span>
                      <span className="block text-xs text-muted-foreground truncate">{item.sub}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
