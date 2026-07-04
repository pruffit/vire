'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { toast } from '@/components/toast';
import { MoodPicker } from '@/components/mood-picker';
import { GenrePicker } from '@/components/genre-picker';
import { CreditsEditor } from '@/components/credits-editor';
import { LyricsEditor } from '@/components/lyrics-editor';
import { Check, TrackStatusBadge, fieldClass } from '@/components/ui-kit';
import { NumberField } from '@/components/number-field';
import { titleRepeatsArtist } from '@/lib/title-hygiene';
import { featLabel } from '@/lib/track-display';
import { cn } from '@/lib/utils';
import type { Mood } from '@/lib/moods';
import type { Genre } from '@/lib/genres';
import type { TrackCredit } from '@/lib/upload';
import type { LyricLine } from '@/lib/lrc';
import { Icon } from '@/components/icon';

export interface GenreSuggestion {
  genre: Genre;
  confidence: number;
}

export interface ManagedTrack {
  id: string;
  title: string;
  version: string | null;
  trackNumber: number;
  status: 'PROCESSING' | 'READY' | 'BLOCKED' | 'FAILED';
  moods: Mood[];
  genres: Genre[];
  genreSuggestions: GenreSuggestion[];
  credits: TrackCredit[];
  bpm: number | null;
  musicalKey: string | null;
  isExplicit: boolean;
  isExclusive: boolean;
  isWip: boolean;
  lyrics: LyricLine[] | null;
}

async function patchTrack(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`/api/v1/dashboard/tracks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => null);
  return res?.ok ?? false;
}

/**
 * Управление треками релиза: переименование, удаление, перетаскивание порядка
 * (drag-n-drop), флаги (18+/эксклюзив/демо), аудио-теги, кредиты, текст — всё
 * с оптимистичным UI (меняем сразу, откатываем при ошибке запроса).
 */
export function TrackManager({
  initial,
  releaseId,
  artistName,
}: {
  initial: ManagedTrack[];
  releaseId: string;
  artistName: string;
}) {
  const [tracks, setTracks] = useState<ManagedTrack[]>(initial);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set());
  // Снимок порядка/состава, известного серверу — для отката DnD при ошибке.
  const committed = useRef<ManagedTrack[]>(initial);

  // Пока есть треки в обработке — опрашиваем статус, чтобы показать
  // «обрабатывается → готов» вживую, без перезагрузки.
  const hasProcessing = tracks.some((t) => t.status === 'PROCESSING');
  useEffect(() => {
    if (!hasProcessing) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/v1/dashboard/releases/${releaseId}/tracks`).catch(() => null);
      if (cancelled || !res?.ok) return;
      const data = (await res.json().catch(() => null)) as
        | { tracks?: { id: string; status: ManagedTrack['status'] }[] }
        | null;
      if (cancelled || !data?.tracks) return;
      const map = new Map(data.tracks.map((t) => [t.id, t.status]));
      setTracks((ts) => ts.map((t) => {
        const s = map.get(t.id);
        return s && s !== t.status ? { ...t, status: s } : t;
      }));
    }, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [hasProcessing, releaseId]);

  function markBusy(id: string, on: boolean) {
    setBusy((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });
  }

  // Короткая отметка «✓ сохранено» у строки после успешной правки.
  function flashSaved(id: string) {
    setJustSaved((p) => new Set(p).add(id));
    setTimeout(() => setJustSaved((p) => { const n = new Set(p); n.delete(id); return n; }), 1600);
  }

  function setTitle(id: string, title: string) {
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, title } : t)));
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── DnD: меняем порядок локально на каждый шаг, персистим при отпускании ──
  function handleReorder(next: ManagedTrack[]) {
    setTracks(next.map((t, i) => ({ ...t, trackNumber: i + 1 })));
  }

  async function commitOrder() {
    const ids = tracks.map((t) => t.id);
    const prevIds = committed.current.map((t) => t.id);
    if (ids.length === prevIds.length && ids.every((id, i) => id === prevIds[i])) return;

    const snapshot = committed.current;
    setBusy((p) => { const n = new Set(p); ids.forEach((id) => n.add(id)); return n; });
    const res = await fetch(`/api/v1/dashboard/releases/${releaseId}/tracks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: ids }),
    }).catch(() => null);
    setBusy((p) => { const n = new Set(p); ids.forEach((id) => n.delete(id)); return n; });

    if (res?.ok) {
      committed.current = tracks;
    } else {
      setTracks(snapshot);
      toast.error('Не удалось изменить порядок треков');
    }
  }

  async function commitTitle(id: string) {
    const current = tracks.find((t) => t.id === id);
    if (!current) return;
    const title = current.title.trim();
    const savedTitle = committed.current.find((t) => t.id === id)?.title ?? '';
    if (title === savedTitle) return;
    if (!title) { setTitle(id, savedTitle); return; }
    markBusy(id, true);
    const ok = await patchTrack(id, { title });
    markBusy(id, false);
    if (ok) {
      committed.current = committed.current.map((t) => (t.id === id ? { ...t, title } : t));
      flashSaved(id);
    } else {
      setTitle(id, savedTitle);
      toast.error('Не удалось переименовать трек');
    }
  }

  async function commitField(id: string, field: 'bpm' | 'musicalKey' | 'version', value: number | string | null) {
    markBusy(id, true);
    const ok = await patchTrack(id, { [field]: value });
    markBusy(id, false);
    if (ok) {
      setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
      committed.current = committed.current.map((t) => (t.id === id ? { ...t, [field]: value } : t));
      flashSaved(id);
    } else {
      toast.error('Не удалось сохранить');
    }
  }

  async function toggleFlag(id: string, flag: 'isExplicit' | 'isExclusive' | 'isWip', next: boolean) {
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, [flag]: next } : t)));
    markBusy(id, true);
    const ok = await patchTrack(id, { [flag]: next });
    markBusy(id, false);
    if (ok) {
      committed.current = committed.current.map((t) => (t.id === id ? { ...t, [flag]: next } : t));
      flashSaved(id);
    } else {
      setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, [flag]: !next } : t)));
      toast.error('Не удалось сохранить метку');
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить трек? Это действие необратимо.')) return;
    const prev = tracks;
    setTracks((ts) => ts.filter((t) => t.id !== id));
    const res = await fetch(`/api/v1/dashboard/tracks/${id}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) {
      committed.current = committed.current.filter((t) => t.id !== id);
    } else {
      setTracks(prev);
      toast.error('Не удалось удалить трек');
    }
  }

  if (tracks.length === 0) {
    return <p className="text-sm text-foreground/30 px-1">Пока нет треков. Добавь первый ниже.</p>;
  }

  return (
    <Reorder.Group
      axis="y"
      values={tracks}
      onReorder={handleReorder}
      className="rounded-xl bg-foreground/[0.025] border border-foreground/10 divide-y divide-foreground/[0.06] overflow-hidden"
    >
      {tracks.map((track) => (
        <TrackRow
          key={track.id}
          track={track}
          busy={busy.has(track.id)}
          expanded={expanded.has(track.id)}
          justSaved={justSaved.has(track.id)}
          artistName={artistName}
          onReorderEnd={commitOrder}
          onTitleChange={(v) => setTitle(track.id, v)}
          onTitleCommit={() => commitTitle(track.id)}
          onToggleExpanded={() => toggleExpanded(track.id)}
          onToggleFlag={(flag, next) => toggleFlag(track.id, flag, next)}
          onCommitField={(field, value) => commitField(track.id, field, value)}
          onRemove={() => remove(track.id)}
        />
      ))}
    </Reorder.Group>
  );
}

function TrackRow({
  track,
  busy,
  expanded,
  justSaved,
  artistName,
  onReorderEnd,
  onTitleChange,
  onTitleCommit,
  onToggleExpanded,
  onToggleFlag,
  onCommitField,
  onRemove,
}: {
  track: ManagedTrack;
  busy: boolean;
  expanded: boolean;
  justSaved: boolean;
  artistName: string;
  onReorderEnd: () => void;
  onTitleChange: (v: string) => void;
  onTitleCommit: () => void;
  onToggleExpanded: () => void;
  onToggleFlag: (flag: 'isExplicit' | 'isExclusive' | 'isWip', next: boolean) => void;
  onCommitField: (field: 'bpm' | 'musicalKey' | 'version', value: number | string | null) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  const [bpm, setBpm] = useState<number | null>(track.bpm);
  const [key, setKey] = useState(track.musicalKey ?? '');
  const [version, setVersion] = useState(track.version ?? '');
  const titleWarn = artistName ? titleRepeatsArtist(track.title, artistName) : false;
  const feat = featLabel(track.credits);

  function commitBpm() {
    if (bpm === track.bpm) return;
    onCommitField('bpm', bpm);
  }
  function commitKey() {
    const raw = key.trim();
    if (raw === (track.musicalKey ?? '')) return;
    onCommitField('musicalKey', raw === '' ? null : raw);
  }
  function commitVersion() {
    const raw = version.trim();
    if (raw === (track.version ?? '')) return;
    onCommitField('version', raw === '' ? null : raw);
  }

  return (
    <Reorder.Item
      value={track}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onReorderEnd}
      whileDrag={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.04)', zIndex: 10 }}
      transition={spring.snappy}
      className="bg-background"
    >
      <div className="flex items-center gap-2 px-2 sm:px-3 py-2.5 text-sm">
        {/* тач-таргет ≥44px по высоте строки */}
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
          aria-label="Перетащить для изменения порядка"
          title="Перетащить"
          className="grid h-9 w-7 shrink-0 cursor-grab touch-none place-items-center text-foreground/25 hover:text-foreground/60 active:cursor-grabbing transition-colors"
        >
          <GripIcon />
        </button>

        <span className="w-5 text-right text-foreground/30 shrink-0 font-mono text-xs tabular-nums">
          {track.trackNumber}
        </span>

        <div className="flex-1 min-w-0">
          <input
            value={track.title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleCommit}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            aria-label="Название трека"
            className="w-full bg-transparent rounded px-2 py-1 -mx-2 hover:bg-foreground/5 focus:bg-foreground/5 focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-colors"
          />
          {titleWarn && (
            <p className="px-0.5 pt-1 text-[11px] text-amber-400/90 leading-snug">
              Имя артиста уже показано рядом — в названии его дублировать не нужно.
            </p>
          )}
          {(feat || track.version) && (
            <p className="px-0.5 pt-0.5 text-[11px] font-mono text-foreground/35 leading-snug truncate">
              {feat}
              {feat && track.version ? ' · ' : ''}
              {track.version}
            </p>
          )}
        </div>

        {justSaved ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring.snappy}
            className="inline-flex shrink-0 text-emerald-400"
          >
            <Icon name="check" size={14} />
          </motion.span>
        ) : (
          <span className="shrink-0">
            <TrackStatusBadge status={track.status} />
          </span>
        )}

        <motion.button
          type="button"
          onClick={onToggleExpanded}
          whileTap={{ scale: 0.9 }}
          transition={spring.snappy}
          aria-label="Параметры трека"
          aria-expanded={expanded}
          title="Параметры трека"
          className={cn(
            'shrink-0 grid place-items-center size-9 rounded-full transition-colors',
            expanded ? 'bg-foreground/10 text-foreground/70' : 'text-foreground/30 hover:bg-foreground/10 hover:text-foreground/60',
          )}
        >
          <TagIcon />
        </motion.button>

        <motion.button
          type="button"
          onClick={onRemove}
          disabled={busy}
          whileTap={{ scale: 0.9 }}
          transition={spring.snappy}
          aria-label="Удалить трек"
          title="Удалить трек"
          className="shrink-0 grid place-items-center size-9 rounded-full text-foreground/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30 transition-colors"
        >
          <Icon name="trash" size={14} />
        </motion.button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.snappy}
            className="overflow-hidden border-t border-foreground/[0.06]"
          >
            <div className="px-3 sm:px-4 py-3 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
                <Check
                  label={<><span className="font-mono font-semibold text-foreground/80">18+</span> Explicit</>}
                  hint="Мат/контент 18+ — бейдж «E» на витрине"
                  checked={track.isExplicit}
                  disabled={busy}
                  onChange={(v) => onToggleFlag('isExplicit', v)}
                />
                <Check
                  label="Эксклюзив"
                  hint="Метка «excl» в трек-листе релиза"
                  checked={track.isExclusive}
                  disabled={busy}
                  onChange={(v) => onToggleFlag('isExclusive', v)}
                />
                <Check
                  label="WIP (демо)"
                  hint="Черновик/демо — метка «wip»"
                  checked={track.isWip}
                  disabled={busy}
                  onChange={(v) => onToggleFlag('isWip', v)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-foreground/[0.06] pt-3">
                <label className="flex items-center gap-2">
                  <span className="text-xs font-mono text-foreground/40 w-8">BPM</span>
                  <NumberField
                    value={bpm}
                    onChange={setBpm}
                    onCommit={commitBpm}
                    min={20}
                    max={500}
                    placeholder="—"
                    disabled={busy}
                    size="sm"
                    className="w-24"
                    aria-label="BPM"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-xs font-mono text-foreground/40 shrink-0">Тональность</span>
                  <input
                    type="text"
                    placeholder="—"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    onBlur={commitKey}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    disabled={busy}
                    className="w-20 bg-transparent border border-foreground/10 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-foreground/30 disabled:opacity-50"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/45">
                  Версия <span className="normal-case tracking-normal text-foreground/30">необязательно</span>
                </span>
                <input
                  type="text"
                  placeholder="Radio Edit · Slowed + Reverb · Sped Up · Acoustic…"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  onBlur={commitVersion}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  disabled={busy}
                  maxLength={80}
                  className={cn(fieldClass, 'w-full sm:max-w-sm')}
                />
              </label>

              <div className="border-t border-foreground/[0.06] pt-3">
                <GenrePicker trackId={track.id} initial={track.genres} suggestions={track.genreSuggestions} />
              </div>

              <div className="border-t border-foreground/[0.06] pt-3">
                <MoodPicker trackId={track.id} initial={track.moods} />
              </div>

              <div className="border-t border-foreground/[0.06] pt-3">
                <CreditsEditor trackId={track.id} initial={track.credits} artistName={artistName} />
              </div>

              <div className="border-t border-foreground/[0.06] pt-3">
                <LyricsEditor trackId={track.id} initial={track.lyrics} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

function TagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}
