'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from '@/components/toast';
import type { ContributorRole, TrackCredit } from '@/lib/upload';

const ROLES: { value: ContributorRole; label: string }[] = [
  { value: 'PERFORMER', label: 'Исполнитель' },
  { value: 'LYRICIST', label: 'Автор текста' },
  { value: 'COMPOSER', label: 'Композитор' },
  { value: 'PRODUCER', label: 'Продюсер' },
];

const MAX = 20;

const inp =
  'bg-transparent border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50';

/** Редактор кредитов трека — имя + роль, с явным сохранением (PATCH /tracks/[id]). */
export function CreditsEditor({ trackId, initial }: { trackId: string; initial: TrackCredit[] }) {
  const [credits, setCredits] = useState<TrackCredit[]>(initial);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function touch() { setSaved(false); }

  function setRow(i: number, patch: Partial<TrackCredit>) {
    setCredits((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    touch();
  }
  function addRow() {
    if (credits.length >= MAX) return;
    setCredits((prev) => [...prev, { name: '', role: 'PERFORMER' }]);
    touch();
  }
  function removeRow(i: number) {
    setCredits((prev) => prev.filter((_, j) => j !== i));
    touch();
  }

  function handleSave() {
    const cleaned = credits.map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.name.length > 0);
    startTransition(async () => {
      const res = await fetch(`/api/v1/dashboard/tracks/${trackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: cleaned }),
      }).catch(() => null);
      if (res?.ok) {
        setCredits(cleaned.length ? cleaned : []);
        setSaved(true);
      } else {
        toast.error('Не удалось сохранить кредиты');
      }
    });
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Кредиты</span>
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.span
              key="saved"
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs font-mono text-green-400"
            >
              ✓ сохранено
            </motion.span>
          ) : (
            <motion.button
              key="save"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleSave}
              disabled={isPending}
              className="text-xs font-mono text-white underline-offset-2 hover:underline disabled:opacity-40"
            >
              {isPending ? 'Сохраняю…' : 'Сохранить'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-2">
        {credits.length === 0 && (
          <p className="text-xs text-white/30">Кредитов пока нет.</p>
        )}
        <AnimatePresence initial={false}>
          {credits.map((c, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Имя"
                value={c.name}
                disabled={isPending}
                onChange={(e) => setRow(i, { name: e.target.value })}
                className={`${inp} flex-1 min-w-0`}
              />
              <select
                value={c.role}
                disabled={isPending}
                onChange={(e) => setRow(i, { role: e.target.value as ContributorRole })}
                className={`${inp} shrink-0`}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={isPending}
                onClick={() => removeRow(i)}
                className="shrink-0 text-white/30 hover:text-red-400 transition-colors text-lg leading-none disabled:opacity-30"
                aria-label="Удалить кредит"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {credits.length < MAX && (
          <button
            type="button"
            disabled={isPending}
            onClick={addRow}
            className="self-start text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
          >
            + добавить
          </button>
        )}
      </div>
    </div>
  );
}
