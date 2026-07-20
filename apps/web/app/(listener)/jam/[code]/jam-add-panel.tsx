'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { SearchTrack } from '@vire/core';
import { Icon } from '@/components/icon';
import { TrackTitleText } from '@/components/track-title';

const ADD_PANEL_LIMIT = 8;

interface Props {
  onAdd: (track: SearchTrack) => void;
}

export function JamAddPanel({ onAdd }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchTrack[] | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    abortRef.current?.abort();
    const trimmed = q.trim();
    debounce.current = setTimeout(() => {
      if (trimmed.length < 2) {
        setResults(null);
        return;
      }
      const ac = new AbortController();
      abortRef.current = ac;
      fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}&limit=${ADD_PANEL_LIMIT}`, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { tracks?: SearchTrack[] } | null) => setResults(d?.tracks ?? []))
        .catch((e) => { if (!(e instanceof Error && e.name === 'AbortError')) setResults([]); });
    }, trimmed.length < 2 ? 0 : 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      abortRef.current?.abort();
    };
  }, [q]);

  return (
    <div className="rounded-xl border border-border bg-card/50 p-2 space-y-2">
      <div className="flex items-center gap-2 px-2 pt-1">
        <Icon name="search" size={15} className="text-muted-foreground shrink-0" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Найти трек…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground py-1"
        />
      </div>
      <div className="max-h-72 overflow-y-auto space-y-1 pb-1">
        {results === null ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Начните вводить название трека</p>
        ) : results.length ? (
          results.map((t) => (
            <button
              key={t.id}
              onClick={() => onAdd(t)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-accent/5 transition-colors"
            >
              <span className="relative w-9 h-9 rounded overflow-hidden shrink-0 bg-muted">
                {t.coverUrl && <Image src={t.coverUrl} alt="" fill sizes="36px" className="object-cover" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm truncate">
                  <TrackTitleText title={t.title} version={t.version} feat={t.feat} />
                </span>
                <span className="block text-xs text-muted-foreground truncate">{t.artistName}</span>
              </span>
              <span className="w-6 h-6 grid place-items-center rounded-full shrink-0 text-muted-foreground">
                <Icon name="plus" size={14} />
              </span>
            </button>
          ))
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">Ничего не найдено</p>
        )}
      </div>
    </div>
  );
}
