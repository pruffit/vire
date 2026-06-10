'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { toast } from '@/components/toast';

export interface ManagedTrack {
  id: string;
  title: string;
  trackNumber: number;
  status: 'PROCESSING' | 'READY' | 'BLOCKED';
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
 * Управление треками релиза: переименование, удаление и порядок — всё с
 * оптимистичным UI (меняем сразу, откатываем при ошибке запроса).
 */
export function TrackManager({ initial }: { initial: ManagedTrack[] }) {
  const [tracks, setTracks] = useState<ManagedTrack[]>(initial);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  // последний сохранённый заголовок — для отката при ошибке
  const savedTitles = useRef<Map<string, string>>(
    new Map(initial.map((t) => [t.id, t.title])),
  );

  function markBusy(id: string, on: boolean) {
    setBusy((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });
  }

  function setTitle(id: string, title: string) {
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, title } : t)));
  }

  async function commitTitle(id: string) {
    const current = tracks.find((t) => t.id === id);
    if (!current) return;
    const title = current.title.trim();
    if (title === savedTitles.current.get(id)) return; // без изменений
    if (!title) { // пустое — откат
      setTitle(id, savedTitles.current.get(id) ?? '');
      return;
    }
    markBusy(id, true);
    const ok = await patchTrack(id, { title });
    markBusy(id, false);
    if (ok) {
      savedTitles.current.set(id, title);
    } else {
      setTitle(id, savedTitles.current.get(id) ?? ''); // откат
      toast.error('Не удалось переименовать трек');
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить трек? Это действие необратимо.')) return;
    const prev = tracks;
    setTracks((ts) => ts.filter((t) => t.id !== id));
    const res = await fetch(`/api/v1/dashboard/tracks/${id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) {
      setTracks(prev); // откат
      toast.error('Не удалось удалить трек');
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const i = tracks.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= tracks.length) return;

    const prev = tracks;
    const next = [...tracks];
    [next[i], next[j]] = [next[j], next[i]];
    // пересчитываем номера по позиции
    const renumbered = next.map((t, idx) => ({ ...t, trackNumber: idx + 1 }));
    setTracks(renumbered);

    // персистим два изменившихся трека
    const a = renumbered[i], b = renumbered[j];
    markBusy(a.id, true); markBusy(b.id, true);
    const [okA, okB] = await Promise.all([
      patchTrack(a.id, { trackNumber: a.trackNumber }),
      patchTrack(b.id, { trackNumber: b.trackNumber }),
    ]);
    markBusy(a.id, false); markBusy(b.id, false);
    if (!okA || !okB) {
      setTracks(prev); // откат
      toast.error('Не удалось изменить порядок треков');
    }
  }

  if (tracks.length === 0) {
    return <p className="text-sm text-white/30 px-1">Пока нет треков. Добавь первый ниже.</p>;
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 divide-y divide-white/5 overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        {tracks.map((track, i) => (
          <motion.div
            key={track.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.snappy}
            className="flex items-center gap-2 px-3 py-2.5 text-sm"
          >
            <span className="w-5 text-right text-white/30 shrink-0 font-mono text-xs">
              {track.trackNumber}
            </span>

            {/* Порядок */}
            <div className="flex flex-col shrink-0 -my-1">
              <button
                type="button"
                onClick={() => move(track.id, -1)}
                disabled={i === 0 || busy.has(track.id)}
                aria-label="Выше"
                className="text-white/30 hover:text-white/80 disabled:opacity-20 transition-colors leading-none"
              >▲</button>
              <button
                type="button"
                onClick={() => move(track.id, 1)}
                disabled={i === tracks.length - 1 || busy.has(track.id)}
                aria-label="Ниже"
                className="text-white/30 hover:text-white/80 disabled:opacity-20 transition-colors leading-none"
              >▼</button>
            </div>

            {/* Название (редактируемое) */}
            <input
              value={track.title}
              onChange={(e) => setTitle(track.id, e.target.value)}
              onBlur={() => commitTitle(track.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              aria-label="Название трека"
              className="flex-1 min-w-0 bg-transparent rounded px-2 py-1 -mx-2 hover:bg-white/5 focus:bg-white/5 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
            />

            <span className={`text-xs font-mono shrink-0 ${
              track.status === 'READY' ? 'text-green-400'
              : track.status === 'PROCESSING' ? 'text-yellow-400'
              : 'text-red-400'
            }`}>
              {track.status === 'READY' ? 'готов'
                : track.status === 'PROCESSING' ? 'обрабатывается'
                : 'заблокирован'}
            </span>

            {/* Удалить */}
            <motion.button
              type="button"
              onClick={() => remove(track.id)}
              disabled={busy.has(track.id)}
              whileTap={{ scale: 0.9 }}
              transition={spring.snappy}
              aria-label="Удалить трек"
              title="Удалить трек"
              className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-white/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
