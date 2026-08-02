'use client';
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import Image from 'next/image';
import type { SearchTrack, TrackCandidate } from '@vire/core';
import type { ExternalAddOutcome, OptimisticExternalGuess } from '@/lib/jam/use-jam-queue';
import { Icon } from '@/components/icon';
import { TrackTitleText } from '@/components/track-title';
import { cn } from '@/lib/utils';

const ADD_PANEL_LIMIT = 8;
const DEBOUNCE_MS = 250;
const RAW_TITLE_MAX = 80;
const URL_RE = /^https?:\/\//i;

export interface VireCandidatePick {
  trackId: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
}

interface Props {
  onAddVire: (pick: VireCandidatePick) => void;
  addExternal: (input: string, guess: OptimisticExternalGuess | null) => Promise<ExternalAddOutcome>;
  suggestions?: SearchTrack[];
  autoFocus?: boolean;
  addedTrackIds: ReadonlySet<string>;
  /** true — внутри шторки: список тянется на всю высоту контейнера вместо своего max-h. */
  dense?: boolean;
}

function toRawGuess(text: string): OptimisticExternalGuess {
  return { title: text.length > RAW_TITLE_MAX ? `${text.slice(0, RAW_TITLE_MAX)}…` : text, artistName: '', coverUrl: null, durationSec: null };
}

function suggestionsToCandidates(tracks: SearchTrack[]): TrackCandidate[] {
  return tracks.map((t) => ({ kind: 'VIRE', trackId: t.id, title: t.title, artistName: t.artistName, coverUrl: t.coverUrl }));
}

export function PartyAddPanel({ onAddVire, addExternal, suggestions = [], autoFocus = true, addedTrackIds, dense = false }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<TrackCandidate[] | null>(null);
  const [postCandidates, setPostCandidates] = useState<TrackCandidate[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emptyHint, setEmptyHint] = useState(false);
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
      fetch(`/api/v1/party/suggest?q=${encodeURIComponent(trimmed)}&limit=${ADD_PANEL_LIMIT}`, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { candidates?: TrackCandidate[] } | null) => setResults(d?.candidates ?? []))
        .catch((e) => { if (!(e instanceof Error && e.name === 'AbortError')) setResults([]); });
    }, trimmed.length < 2 ? 0 : DEBOUNCE_MS);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      abortRef.current?.abort();
    };
  }, [q]);

  async function submitRaw(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setEmptyHint(false);
    setPostCandidates(null);
    const outcome = await addExternal(trimmed, toRawGuess(trimmed));
    setSubmitting(false);
    if (outcome.outcome === 'added') {
      setQ('');
      setResults(null);
      return;
    }
    if (outcome.outcome === 'candidates') {
      if (outcome.candidates.length === 0) {
        setEmptyHint(true);
        return;
      }
      setPostCandidates(outcome.candidates);
    }
    // outcome 'error' — тост уже показан хуком, строка остаётся для повтора
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    void submitRaw(q);
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>): void {
    const pasted = e.clipboardData.getData('text/plain').trim();
    if (!URL_RE.test(pasted)) return;
    setQ(pasted);
    void submitRaw(pasted);
  }

  function handlePickCandidate(candidate: TrackCandidate): void {
    if (candidate.kind === 'VIRE') {
      onAddVire({ trackId: candidate.trackId, title: candidate.title, artistName: candidate.artistName, coverUrl: candidate.coverUrl });
      setQ('');
      setResults(null);
      setPostCandidates(null);
      return;
    }
    if (candidate.kind === 'EXTERNAL' && candidate.ref.externalUrl) {
      void submitRaw(candidate.ref.externalUrl);
      return;
    }
    // Ещё не играбельный дескриптор (HINT либо EXTERNAL без ссылки) — дорезолвливаем как «артист + название».
    const { title, artistName } = candidateDisplay(candidate);
    void submitRaw(`${artistName} ${title}`.trim());
  }

  const isSuggesting = results === null;
  const list = postCandidates ?? results ?? suggestionsToCandidates(suggestions);
  const listTitle = postCandidates ? 'Похоже, вот это' : isSuggesting && list.length > 0 ? 'Из любимых' : null;

  return (
    <div className={cn('rounded-xl border border-border bg-card/50 p-2 space-y-2', dense && 'flex flex-1 min-h-0 flex-col')}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-2 pt-1 shrink-0">
        <Icon name="search" size={15} className="text-muted-foreground shrink-0" />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => { setQ(e.target.value); setPostCandidates(null); setEmptyHint(false); }}
          onPaste={handlePaste}
          placeholder="Вставьте ссылку или вспомните трек…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground py-1"
        />
        {submitting && <Icon name="loader" size={14} className="shrink-0 animate-spin text-muted-foreground" />}
      </form>

      <div className={cn('space-y-1 pb-1', dense ? 'flex-1 min-h-0 overflow-y-auto' : 'max-h-72 overflow-y-auto')}>
        {postCandidates && (
          <div className="flex items-center justify-between px-3 pb-1">
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{listTitle}</p>
            <button type="button" onClick={() => setPostCandidates(null)} className="text-muted-foreground hover:text-foreground">
              <Icon name="x" size={12} />
            </button>
          </div>
        )}
        {!postCandidates && listTitle && (
          <p className="px-3 pb-1 pt-1 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{listTitle}</p>
        )}

        {list.length ? (
          list.map((candidate, i) => (
            <CandidateRow
              key={candidate.kind === 'VIRE' ? candidate.trackId : `${candidate.kind}-${i}`}
              candidate={candidate}
              added={candidate.kind === 'VIRE' && addedTrackIds.has(candidate.trackId)}
              onPick={handlePickCandidate}
            />
          ))
        ) : emptyHint ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Не нашли точного совпадения — попробуйте другую формулировку</p>
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {isSuggesting ? 'Начните вводить название трека или вставьте ссылку' : 'Ничего не найдено — нажмите Enter, чтобы поискать в сети'}
          </p>
        )}
      </div>
    </div>
  );
}

function candidateDisplay(candidate: TrackCandidate): { title: string; artistName: string; coverUrl: string | null } {
  if (candidate.kind === 'VIRE') return candidate;
  if (candidate.kind === 'EXTERNAL') return candidate.ref;
  return candidate.hint;
}

function CandidateRow({ candidate, added, onPick }: { candidate: TrackCandidate; added: boolean; onPick: (c: TrackCandidate) => void }) {
  const { title, artistName, coverUrl } = candidateDisplay(candidate);

  return (
    <button
      onClick={() => { if (!added) onPick(candidate); }}
      disabled={added}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
        added ? 'opacity-50 cursor-default' : 'hover:bg-accent/5',
      )}
    >
      <span className="relative w-9 h-9 rounded overflow-hidden shrink-0 bg-muted">
        {coverUrl && <Image src={coverUrl} alt="" fill sizes="36px" className="object-cover" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm truncate">
          <TrackTitleText title={title} />
        </span>
        <span className="block text-xs text-muted-foreground truncate">{artistName || ' '}</span>
      </span>
      <span className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
        {added ? (
          <span className="text-[11px] font-mono uppercase tracking-widest">Добавлено</span>
        ) : candidate.kind === 'HINT' ? (
          <Icon name="globe" size={13} />
        ) : null}
        <span className="w-6 h-6 grid place-items-center rounded-full">
          <Icon name={added ? 'check' : 'plus'} size={14} />
        </span>
      </span>
    </button>
  );
}
