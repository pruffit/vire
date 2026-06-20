'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { spring, ease } from '@vire/ui/motion';
import { SearchIcon } from '@/components/icons';
import type { SearchResults } from '@vire/db';
import { resolveAvatarUrl } from '@/lib/avatar';

interface FlatResult {
  href: string;
  label: string;
  sub: string;
  img?: string | null;
  round?: boolean;
  initial?: string;
}

/**
 * Поиск в навбаре: свёрнут до иконки, по клику поле аккуратно раскрывается влево,
 * под ним — быстрые результаты. Enter или «показать все» → страница /search.
 * Использует тот же эндпоинт /api/v1/search, что и глобальный поиск.
 */
export function NavSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flat: FlatResult[] = results
    ? [
        ...results.artists.map((a) => ({
          href: `/artists/${a.slug}`, label: a.name, sub: 'Артист',
          img: resolveAvatarUrl(a.avatarUrl, a.firstReleaseCoverUrl), round: true, initial: a.name[0]?.toUpperCase(),
        })),
        ...results.releases.map((r) => ({
          href: `/artists/${r.artistSlug}/releases/${r.id}`, label: r.title,
          sub: `${r.type} · ${r.artistName}`, img: r.coverUrl, initial: r.title[0]?.toUpperCase(),
        })),
        ...results.tracks.map((t) => ({
          href: `/artists/${t.artistSlug}/releases/${t.releaseId}/tracks/${t.id}`, label: t.title,
          sub: `Трек · ${t.artistName}`, img: t.coverUrl, initial: t.title[0]?.toUpperCase(),
        })),
      ].slice(0, 6)
    : [];

  const fetchResults = useCallback((q: string) => {
    if (q.trim().length < 2) { setResults(null); return; }
    fetch(`/api/v1/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: SearchResults) => { setResults(d); setActiveIdx(-1); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchResults]);

  // Клик вне — свернуть
  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  // Горячая клавиша «/» — открыть поиск (если не печатаешь в поле/textarea)
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.key !== '/' && e.code !== 'Slash') || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (next) requestAnimationFrame(() => inputRef.current?.focus());
      return next;
    });
  }

  function navigate(href: string) {
    setOpen(false);
    setQuery('');
    setResults(null);
    router.push(href);
  }

  function goAll() {
    if (query.trim().length < 2) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, flat.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && flat[activeIdx]) navigate(flat[activeIdx].href);
      else goAll();
    }
  }

  return (
    <div ref={rootRef} className="relative flex items-center">
      <motion.div
        initial={false}
        animate={{ width: open ? 220 : 0, opacity: open ? 1 : 0 }}
        transition={spring.smooth}
        className="overflow-hidden"
      >
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Поиск артистов, релизов, треков…"
          autoComplete="off"
          tabIndex={open ? 0 : -1}
          className="w-[220px] h-8 rounded-md border border-border bg-card px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:border-ring focus-visible:ring-0"
        />
      </motion.div>

      <motion.button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Закрыть поиск' : 'Поиск'}
        aria-expanded={open}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="ml-1 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors flex items-center gap-1.5"
      >
        <SearchIcon size={15} />
        {/* Хинт горячей клавиши — только desktop, прячется когда поле раскрыто */}
        <AnimatePresence initial={false}>
          {!open && (
            <motion.kbd
              aria-hidden="true"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15, ease: ease.soft }}
              className="hidden md:inline-flex items-center justify-center h-4.5 px-1.5 rounded border border-border text-[10px] font-mono leading-none overflow-hidden select-none"
            >
              /
            </motion.kbd>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && flat.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: ease.soft }}
            className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover shadow-xl overflow-hidden z-50"
          >
            {flat.map((item, i) => (
              <button
                key={item.href}
                onMouseDown={(e) => { e.preventDefault(); navigate(item.href); }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  i === activeIdx ? 'bg-accent/20' : 'hover:bg-accent/10'
                }`}
              >
                <span className="relative w-7 h-7 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground">
                  {item.img ? (
                    <Image src={item.img} alt="" fill sizes="28px" className={`object-cover ${item.round ? 'rounded-full' : ''}`} />
                  ) : (
                    item.initial
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate leading-tight">{item.label}</span>
                  <span className="block text-xs text-muted-foreground truncate">{item.sub}</span>
                </span>
              </button>
            ))}
            <div className="px-3 py-2 border-t border-border flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Enter — все результаты</span>
              <button
                onMouseDown={(e) => { e.preventDefault(); goAll(); }}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Показать все →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

