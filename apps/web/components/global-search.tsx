'use client';

import { useRef, useState, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { SearchIcon } from '@/components/icons';
import { Icon } from '@/components/icon';
import type { SearchResults } from '@vire/db';
import { resolveAvatarUrl } from '@/lib/avatar';

interface Props {
  variant?: 'hero' | 'page';
  defaultValue?: string;
  autoFocus?: boolean;
}

interface FlatResult {
  href: string;
  label: string;
  sub: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  initial?: string;
}

export function GlobalSearch({ variant = 'page', defaultValue = '', autoFocus }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flat: FlatResult[] = results
    ? [
        ...results.artists.map((a) => ({
          href: `/artists/${a.slug}`,
          label: a.name,
          sub: 'Артист',
          avatarUrl: resolveAvatarUrl(a.avatarUrl, a.firstReleaseCoverUrl),
          initial: a.name[0]?.toUpperCase(),
        })),
        ...results.releases.map((r) => ({
          href: `/artists/${r.artistSlug}/releases/${r.id}`,
          label: r.title,
          sub: `${r.type} · ${r.artistName}`,
          coverUrl: r.coverUrl,
          initial: r.title[0]?.toUpperCase(),
        })),
        ...results.tracks.map((t) => ({
          href: `/artists/${t.artistSlug}/releases/${t.releaseId}/tracks/${t.id}`,
          label: t.title,
          sub: `Трек · ${t.artistName}`,
          coverUrl: t.coverUrl,
          initial: t.title[0]?.toUpperCase(),
        })),
      ]
    : [];

  const hasResults = flat.length > 0;

  const fetchResults = useCallback((q: string) => {
    if (q.length < 2) { setResults(null); setOpen(false); return; }
    fetch(`/api/v1/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data: SearchResults) => {
        setResults(data);
        const total = data.artists.length + data.releases.length + data.tracks.length;
        setOpen(total > 0);
        setActiveIdx(-1);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchResults]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && flat[activeIdx]) {
        navigate(flat[activeIdx].href);
      } else if (query.trim().length >= 2) {
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  const isHero = variant === 'hero';

  return (
    <div className={`relative ${isHero ? 'w-full max-w-xl' : 'w-full'}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (!open && e.target.value.length >= 2) setOpen(true); }}
          onFocus={() => { if (hasResults) setOpen(true); }}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          placeholder="Поиск артистов, релизов, треков…"
          autoComplete="off"
          className={[
            'w-full rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-1 focus:ring-ring',
            'pr-9',
            isHero ? 'h-12 px-4 text-base' : 'h-9 px-3',
          ].join(' ')}
        />
        <button
          type="button"
          onClick={() => {
            if (query.trim().length >= 2) {
              setOpen(false);
              router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }
          }}
          aria-label="Найти"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <SearchIcon size={isHero ? 18 : 14} />
        </button>
      </div>

      {open && hasResults && (
        <div
          ref={dropRef}
          className="absolute z-50 top-full mt-1.5 w-full rounded-lg border border-border bg-popover shadow-xl overflow-hidden"
        >
          {results && <DropdownSections results={results} flat={flat} activeIdx={activeIdx} onSelect={navigate} />}
          <div className="px-3 py-2 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Enter — все результаты</span>
            <button
              onMouseDown={(e) => { e.preventDefault(); router.push(`/search?q=${encodeURIComponent(query.trim())}`); setOpen(false); }}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Показать все <Icon name="arrow-right" size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SectionsProps {
  results: SearchResults;
  flat: FlatResult[];
  activeIdx: number;
  onSelect: (href: string) => void;
}

function DropdownSections({ results, flat, activeIdx, onSelect }: SectionsProps) {
  let offset = 0;

  const sections: { label: string; items: FlatResult[]; startIdx: number }[] = [];

  if (results.artists.length > 0) {
    sections.push({ label: 'Артисты', items: flat.slice(offset, offset + results.artists.length), startIdx: offset });
    offset += results.artists.length;
  }
  if (results.releases.length > 0) {
    sections.push({ label: 'Релизы', items: flat.slice(offset, offset + results.releases.length), startIdx: offset });
    offset += results.releases.length;
  }
  if (results.tracks.length > 0) {
    sections.push({ label: 'Треки', items: flat.slice(offset, offset + results.tracks.length), startIdx: offset });
  }

  return (
    <>
      {sections.map((section) => (
        <div key={section.label}>
          <div className="px-3 pt-2.5 pb-1">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
              {section.label}
            </span>
          </div>
          {section.items.map((item, i) => {
            const globalIdx = section.startIdx + i;
            const isActive = globalIdx === activeIdx;
            return (
              <button
                key={item.href}
                onMouseDown={(e) => { e.preventDefault(); onSelect(item.href); }}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                  isActive ? 'bg-accent/20' : 'hover:bg-accent/10',
                ].join(' ')}
              >
                <div className="relative w-7 h-7 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground">
                  {item.avatarUrl ? (
                    <Image src={item.avatarUrl} alt="" fill sizes="28px" className="object-cover rounded-full" />
                  ) : item.coverUrl ? (
                    <Image src={item.coverUrl} alt="" fill sizes="28px" className="object-cover" />
                  ) : (
                    item.initial
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate leading-tight">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

