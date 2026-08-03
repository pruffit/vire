'use client';
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import Image from 'next/image';
import type { JamQueueItem, SearchTrack, TrackCandidate } from '@vire/core';
import type { ExternalAddOutcome, OptimisticExternalGuess } from '@/lib/jam/use-jam-queue';
import { Icon } from '@/components/icon';
import { TrackTitleText } from '@/components/track-title';
import { SourceBadge } from '@/components/jam/source-badge';
import { formatDuration } from '@/lib/format';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const ADD_PANEL_LIMIT = 8;
const DEBOUNCE_MS = 250;
const RAW_TITLE_MAX = 80;
const URL_RE = /^https?:\/\//i;
const URL_GLOBAL_RE = /https?:\/\/[^\s]+/g;
// Фокус в шторке — только после её выезда: фокус во время transform заставляет мобильные
// браузеры доскроллить наполовину приехавшую панель.
const FOCUS_DELAY_MS = 280;

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
  /** Уже сыгранное на этой вечеринке — блок «Ещё раз» в простое. */
  history?: JamQueueItem[];
  /** true — внутри шторки: список тянется на всю высоту контейнера вместо своего max-h. */
  dense?: boolean;
}

function toRawGuess(text: string): OptimisticExternalGuess {
  return { title: text.length > RAW_TITLE_MAX ? `${text.slice(0, RAW_TITLE_MAX)}…` : text, artistName: '', coverUrl: null, durationSec: null };
}

function suggestionsToCandidates(tracks: SearchTrack[]): TrackCandidate[] {
  return tracks.map((t) => ({ kind: 'VIRE', trackId: t.id, title: t.title, artistName: t.artistName, coverUrl: t.coverUrl }));
}

export function PartyAddPanel({ onAddVire, addExternal, suggestions = [], autoFocus = true, addedTrackIds, history = [], dense = false }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<TrackCandidate[] | null>(null);
  const [postCandidates, setPostCandidates] = useState<TrackCandidate[] | null>(null);
  const [tasteSuggestions, setTasteSuggestions] = useState<TrackCandidate[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emptyHint, setEmptyHint] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/v1/party/suggest', { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { candidates?: TrackCandidate[] } | null) => setTasteSuggestions(d?.candidates ?? []))
      .catch((e) => { if (!(e instanceof Error && e.name === 'AbortError')) setTasteSuggestions([]); });
    return () => ac.abort();
  }, []);

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

  function reset(): void {
    setQ('');
    setResults(null);
    setPostCandidates(null);
    setCursor(-1);
  }

  async function submitRaw(text: string, guess?: OptimisticExternalGuess): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setEmptyHint(false);
    setPostCandidates(null);
    const outcome = await addExternal(trimmed, guess ?? toRawGuess(trimmed));
    setSubmitting(false);
    if (outcome.outcome === 'added') {
      if (guess?.title) toast(`Добавлено: ${guess.artistName ? `${guess.artistName} — ` : ''}${guess.title}`);
      reset();
      return;
    }
    if (outcome.outcome === 'candidates') {
      if (outcome.candidates.length === 0) {
        setEmptyHint(true);
        return;
      }
      setPostCandidates(outcome.candidates);
      setCursor(-1);
    }
    // outcome 'error' — тост уже показан хуком, строка остаётся для повтора
  }

  async function submitAll(urls: string[]): Promise<void> {
    for (const url of urls) await submitRaw(url);
  }

  function submitCurrent(): void {
    const picked = cursor >= 0 ? list[cursor] : undefined;
    if (picked) handlePickCandidate(picked);
    else void submitRaw(q);
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    submitCurrent();
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>): void {
    const pasted = e.clipboardData.getData('text/plain').trim();
    const urls = pasted.match(URL_GLOBAL_RE);
    if (!urls || !URL_RE.test(pasted)) return;
    e.preventDefault();
    setQ(urls.length === 1 ? urls[0]! : `${urls.length} ссылки`);
    void submitAll(urls);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (list.length === 0) return;
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setCursor((prev) => {
        const next = prev + delta;
        if (next < 0) return -1;
        return next >= list.length ? list.length - 1 : next;
      });
      return;
    }
    // Enter обрабатываем здесь, а не только сабмитом формы: с выбранной стрелками строкой
    // должен добавляться именно кандидат, а не текст запроса.
    if (e.key === 'Enter' && cursor >= 0) {
      e.preventDefault();
      submitCurrent();
      return;
    }
    if (e.key === 'Escape' && q) {
      e.preventDefault();
      reset();
    }
  }

  function handlePickCandidate(candidate: TrackCandidate): void {
    if (candidate.kind === 'VIRE') {
      if (addedTrackIds.has(candidate.trackId)) return;
      onAddVire({ trackId: candidate.trackId, title: candidate.title, artistName: candidate.artistName, coverUrl: candidate.coverUrl });
      toast(`Добавлено: ${candidate.artistName} — ${candidate.title}`);
      reset();
      return;
    }

    const display = candidateDisplay(candidate);
    const guess: OptimisticExternalGuess = {
      title: display.title,
      artistName: display.artistName,
      coverUrl: display.coverUrl,
      durationSec: display.durationSec,
    };
    // Готовая ссылка резолвится по URL-кэшу мгновенно; у хинта играбельной ссылки нет —
    // отправляем «артист + название», дальше решает каскад.
    const input = candidate.kind === 'EXTERNAL' && candidate.ref.externalUrl
      ? candidate.ref.externalUrl
      : `${display.artistName} ${display.title}`.trim();
    void submitRaw(input, guess);
  }

  const typing = q.trim().length >= 2;
  const searching = typing && results === null;
  const idle = results === null && !typing && !postCandidates;
  // Пока ищем по набранному, старые «Из любимых» не показываем: подсказки, не связанные
  // с вводом, читаются как «поиск ничего не понял».
  const list = postCandidates ?? results ?? (typing ? [] : suggestionsToCandidates(suggestions));
  const ready = list.filter((c) => c.kind !== 'HINT');
  const fromWeb = list.filter((c) => c.kind === 'HINT');
  const idleTitle = postCandidates ? 'Похоже, вот это' : idle && list.length > 0 ? 'Из любимых' : null;
  const historyCandidates = historyToCandidates(history);

  function renderRow(candidate: TrackCandidate, index: number) {
    return (
      <CandidateRow
        key={candidate.kind === 'VIRE' ? candidate.trackId : `${candidate.kind}-${index}`}
        candidate={candidate}
        added={candidate.kind === 'VIRE' && addedTrackIds.has(candidate.trackId)}
        active={cursor === index}
        onPick={handlePickCandidate}
      />
    );
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card/50 p-2 space-y-2', dense && 'flex flex-1 min-h-0 flex-col')}>
      <form onSubmit={handleSubmit} className="flex items-center gap-1 px-2 pt-1 shrink-0">
        <Icon name="search" size={15} className="text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setPostCandidates(null); setEmptyHint(false); setCursor(-1); }}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          aria-label="Название трека или ссылка"
          inputMode="search"
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Вставьте ссылку или вспомните трек…"
          // text-base на мобилке: при шрифте меньше 16px iOS зумит страницу на фокусе
          className="min-w-0 flex-1 bg-transparent py-1 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        {q.length > 0 ? (
          <button
            type="button"
            onClick={() => { reset(); setEmptyHint(false); inputRef.current?.focus(); }}
            aria-label="Очистить"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="x" size={14} />
          </button>
        ) : null}
        <button
          type="submit"
          disabled={q.trim().length === 0 || submitting}
          aria-label="Добавить в очередь"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <Icon name={submitting ? 'loader' : 'arrow-right'} size={15} className={submitting ? 'animate-spin' : undefined} />
        </button>
      </form>

      <div className={cn('space-y-1 pb-1', dense ? 'flex-1 min-h-0 overflow-y-auto' : 'max-h-72 overflow-y-auto')}>
        {postCandidates && (
          <div className="flex items-center justify-between px-3 pb-1">
            <SectionTitle>{idleTitle}</SectionTitle>
            <button type="button" onClick={() => setPostCandidates(null)} className="text-muted-foreground hover:text-foreground">
              <Icon name="x" size={12} />
            </button>
          </div>
        )}
        {!postCandidates && idleTitle && <SectionTitle className="px-3 pb-1 pt-1">{idleTitle}</SectionTitle>}

        {list.length > 0 ? (
          typing && !postCandidates ? (
            <>
              {ready.length > 0 && (
                <>
                  <SectionTitle className="px-3 pb-1 pt-1">Играет сразу</SectionTitle>
                  {ready.map((candidate) => renderRow(candidate, list.indexOf(candidate)))}
                </>
              )}
              {fromWeb.length > 0 && (
                <>
                  <SectionTitle className="px-3 pb-1 pt-2">Найдём в сети</SectionTitle>
                  {fromWeb.map((candidate) => renderRow(candidate, list.indexOf(candidate)))}
                </>
              )}
            </>
          ) : (
            list.map((candidate, i) => renderRow(candidate, i))
          )
        ) : emptyHint ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Не нашли точного совпадения — попробуйте другую формулировку</p>
        ) : searching ? (
          <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Icon name="loader" size={14} className="shrink-0 animate-spin" />
            <span className="truncate">Ищем «{q.trim()}»…</span>
          </p>
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {idle ? 'Начните вводить название трека или вставьте ссылку' : 'Ничего не найдено — нажмите Enter, чтобы поискать в сети'}
          </p>
        )}

        {typing && !postCandidates && list.length > 0 && (
          <p className="px-3 pb-1 pt-2 text-[11px] text-muted-foreground">Нет нужного? Enter — поищем в сети</p>
        )}

        {idle && historyCandidates.length > 0 && (
          <>
            <SectionTitle className="px-3 pb-1 pt-2">Ещё раз</SectionTitle>
            {historyCandidates.map((candidate, i) => (
              <CandidateRow key={`again-${i}`} candidate={candidate} added={false} active={false} onPick={handlePickCandidate} />
            ))}
          </>
        )}

        {idle && tasteSuggestions && tasteSuggestions.length > 0 && (
          <>
            <SectionTitle className="px-3 pb-1 pt-2">Из вашего вкуса</SectionTitle>
            {tasteSuggestions.map((candidate, i) => (
              <CandidateRow key={`taste-${i}`} candidate={candidate} added={false} active={false} onPick={handlePickCandidate} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** Уже сыгранное на этой вечеринке — свежее первым, без повторов и без незарезолвленных позиций. */
function historyToCandidates(history: JamQueueItem[]): TrackCandidate[] {
  const seen = new Set<string>();
  const out: TrackCandidate[] = [];
  for (let i = history.length - 1; i >= 0 && out.length < 5; i--) {
    const item = history[i]!;
    const key = `${item.source}:${item.trackId ?? item.externalId ?? item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (item.source === 'VIRE' && item.trackId) {
      out.push({ kind: 'VIRE', trackId: item.trackId, title: item.title, artistName: item.artistName, coverUrl: item.coverUrl });
      continue;
    }
    if ((item.source !== 'YOUTUBE' && item.source !== 'SOUNDCLOUD') || !item.externalId) continue;
    out.push({
      kind: 'EXTERNAL',
      ref: {
        source: item.source, externalId: item.externalId, externalUrl: item.externalUrl,
        title: item.title, artistName: item.artistName, coverUrl: item.coverUrl, durationSec: item.durationSec,
      },
    });
  }
  return out;
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('font-mono text-[11px] uppercase tracking-widest text-muted-foreground', className)}>{children}</p>;
}

function candidateDisplay(candidate: TrackCandidate): { title: string; artistName: string; coverUrl: string | null; durationSec: number | null } {
  if (candidate.kind === 'VIRE') return { ...candidate, durationSec: null };
  if (candidate.kind === 'EXTERNAL') return candidate.ref;
  return candidate.hint;
}

function CandidateRow({
  candidate, added, active, onPick,
}: { candidate: TrackCandidate; added: boolean; active: boolean; onPick: (c: TrackCandidate) => void }) {
  const { title, artistName, coverUrl, durationSec } = candidateDisplay(candidate);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  return (
    <button
      ref={ref}
      onClick={() => { if (!added) onPick(candidate); }}
      disabled={added}
      aria-current={active || undefined}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
        added ? 'opacity-50 cursor-default' : active ? 'bg-accent/10' : 'hover:bg-accent/5',
      )}
    >
      <span className="relative w-9 h-9 rounded overflow-hidden shrink-0 bg-muted">
        {coverUrl && <Image src={coverUrl} alt="" fill sizes="36px" className="object-cover" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm truncate">
          <TrackTitleText title={title} />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{artistName || ' '}</span>
          {candidate.kind === 'EXTERNAL' && <SourceBadge source={candidate.ref.source} />}
          {durationSec ? <span className="shrink-0 tabular-nums">{formatDuration(durationSec)}</span> : null}
        </span>
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
