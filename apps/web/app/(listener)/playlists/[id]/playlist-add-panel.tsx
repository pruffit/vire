'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icon';
import { TrackTitleText } from '@/components/track-title';
import type { PlaylistAddTrack, PlaylistSuggestions, PlaylistTrackRow } from '@vire/db';

interface Props {
  playlistId: string;
  existingIds: string[];
  onAdded: (track: PlaylistTrackRow) => void;
  onAddFailed: (trackId: string) => void;
}

function toRow(t: PlaylistAddTrack): PlaylistTrackRow {
  return { id: t.id, title: t.title, durationSec: t.durationSec, position: 0,
    artistName: t.artistName, artistSlug: t.artistSlug, releaseId: t.releaseId, coverUrl: t.coverUrl,
    accentColor: t.accentColor, isExplicit: t.isExplicit, version: t.version, feat: t.feat };
}

interface TrackRowProps {
  track: PlaylistAddTrack;
  added: Set<string>;
  onAdd: (t: PlaylistAddTrack) => void;
}

function TrackRow({ track, added, onAdd }: TrackRowProps) {
  const inIt = added.has(track.id);
  return (
    <button onClick={() => onAdd(track)} disabled={inIt}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-secondary/50 transition-colors disabled:opacity-60">
      <span className="relative w-9 h-9 rounded overflow-hidden shrink-0 bg-card">
        {track.coverUrl && <Image src={track.coverUrl} alt="" fill sizes="36px" className="object-cover" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm truncate">
          <TrackTitleText title={track.title} version={track.version} feat={track.feat} />
        </span>
        <span className="block text-xs text-muted-foreground truncate">{track.artistName}</span>
      </span>
      <span className={`w-6 h-6 grid place-items-center rounded-full shrink-0 ${inIt ? 'text-primary' : 'text-muted-foreground'}`}>
        <Icon name={inIt ? 'check' : 'plus'} size={14} />
      </span>
    </button>
  );
}

interface SectionProps {
  title: string;
  items: PlaylistAddTrack[];
  added: Set<string>;
  onAdd: (t: PlaylistAddTrack) => void;
}

function TrackSection({ title, items, added, onAdd }: SectionProps) {
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      <p className="px-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{title}</p>
      {items.map((t) => <TrackRow key={t.id} track={t} added={added} onAdd={onAdd} />)}
    </div>
  );
}

export function PlaylistAddPanel({ playlistId, existingIds, onAdded, onAddFailed }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaylistAddTrack[] | null>(null);
  const [suggestions, setSuggestions] = useState<PlaylistSuggestions | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set(existingIds));
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/v1/playlists/${playlistId}/suggestions`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PlaylistSuggestions | null) => setSuggestions(d))
      .catch((e) => { if (!(e instanceof Error && e.name === 'AbortError')) setSuggestions(null); });
    return () => ac.abort();
  }, [playlistId]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    abortRef.current?.abort();
    debounce.current = setTimeout(() => {
      if (q.trim().length < 2) { setResults(null); return; }
      const ac = new AbortController();
      abortRef.current = ac;
      fetch(`/api/v1/playlists/${playlistId}/add-search?q=${encodeURIComponent(q.trim())}`, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { tracks?: PlaylistAddTrack[] } | null) => setResults(d?.tracks ?? []))
        .catch((e) => { if (!(e instanceof Error && e.name === 'AbortError')) setResults([]); });
    }, q.trim().length < 2 ? 0 : 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      abortRef.current?.abort();
    };
  }, [q, playlistId]);

  async function add(t: PlaylistAddTrack) {
    if (added.has(t.id)) return;
    setAdded((prev) => new Set(prev).add(t.id));
    onAdded(toRow(t));
    const res = await fetch(`/api/v1/playlists/${playlistId}/tracks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: t.id }),
    }).catch(() => null);
    if (!res?.ok) {
      setAdded((prev) => { const n = new Set(prev); n.delete(t.id); return n; });
      onAddFailed(t.id);
      toast.error('Не удалось добавить трек');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 p-2 space-y-3">
      <div className="flex items-center gap-2 px-2 pt-1">
        <Icon name="search" size={15} className="text-muted-foreground shrink-0" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск трека…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground py-1" />
      </div>
      <div className="max-h-80 overflow-y-auto space-y-3 pb-1">
        {results !== null ? (
          results.length
            ? results.map((t) => <TrackRow key={t.id} track={t} added={added} onAdd={add} />)
            : <p className="px-3 py-4 text-sm text-muted-foreground">Ничего не найдено</p>
        ) : suggestions ? (
          <>
            <TrackSection title="Из ваших лайков" items={suggestions.liked} added={added} onAdd={add} />
            <TrackSection title="Вы недавно слушали" items={suggestions.recent} added={added} onAdd={add} />
            <TrackSection title="Похожее на плейлист" items={suggestions.similar} added={added} onAdd={add} />
            {!suggestions.liked.length && !suggestions.recent.length && !suggestions.similar.length &&
              <p className="px-3 py-4 text-sm text-muted-foreground">Начните вводить название трека</p>}
          </>
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">Загрузка…</p>
        )}
      </div>
    </div>
  );
}
