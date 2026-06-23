'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from '@/components/toast';
import { fieldClass } from '@/components/ui-kit';
import { Icon } from '@/components/icon';
import { cn } from '@/lib/utils';
import type { ContributorRole, TrackCredit } from '@/lib/upload';

const ROLES: { value: ContributorRole; label: string }[] = [
  { value: 'PERFORMER', label: 'Исполнитель' },
  { value: 'FEATURED', label: 'Гость (feat.)' },
  { value: 'LYRICIST', label: 'Автор текста' },
  { value: 'COMPOSER', label: 'Композитор' },
  { value: 'PRODUCER', label: 'Продюсер' },
];

const MAX = 20;

/**
 * Редактор кредитов трека — имя + роль, с явным сохранением (PATCH /tracks/[id]).
 * Роль выбирается пилюлями (как жанры/настроения) — без нативного селекта,
 * удобнее на телефоне. При пустом списке предлагаем добавить артиста исполнителем.
 */
export function CreditsEditor({
  trackId,
  initial,
  artistName,
}: {
  trackId: string;
  initial: TrackCredit[];
  artistName?: string;
}) {
  const [credits, setCredits] = useState<TrackCredit[]>(initial);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function touch() { setSaved(false); }

  function setRow(i: number, patch: Partial<TrackCredit>) {
    setCredits((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    touch();
  }
  function addRow(preset?: TrackCredit) {
    if (credits.length >= MAX) return;
    setCredits((prev) => [...prev, preset ?? { name: '', role: 'PERFORMER' }]);
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

  const canSuggestSelf =
    !!artistName &&
    !credits.some((c) => c.name.trim().toLowerCase() === artistName.trim().toLowerCase());

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/45">
          Кредиты
        </span>
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.span
              key="saved"
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400"
            >
              <Icon name="check" size={13} /> сохранено
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
              className="text-xs font-mono text-foreground underline-offset-2 hover:underline disabled:opacity-40"
            >
              {isPending ? 'Сохраняю…' : 'Сохранить'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <p className="text-[11px] text-foreground/35 leading-snug">
        Кто работал над треком: вокал, текст, музыка, продакшн. Для фита добавь
        приглашённого артиста с ролью «Гость (feat.)» — он подпишется как feat.
        рядом с названием. Имя — без приставок.
      </p>

      <div className="space-y-2">
        {credits.length === 0 && (
          <p className="text-xs text-foreground/30">Кредитов пока нет.</p>
        )}
        <AnimatePresence initial={false}>
          {credits.map((c, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-2.5 space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Имя"
                  value={c.name}
                  disabled={isPending}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                  className={cn(fieldClass, 'flex-1 min-w-0 py-1.5 text-xs')}
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => removeRow(i)}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-foreground/30 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-30"
                  aria-label="Удалить кредит"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r) => {
                  const on = c.role === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      disabled={isPending}
                      aria-pressed={on}
                      onClick={() => setRow(i, { role: r.value })}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] transition-colors active:scale-[0.97] disabled:opacity-40',
                        on
                          ? 'border-primary bg-primary/15 text-foreground'
                          : 'border-foreground/10 text-foreground/45 hover:text-foreground hover:border-foreground/30',
                      )}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
          {credits.length < MAX && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => addRow()}
              className="text-xs text-foreground/45 hover:text-foreground transition-colors disabled:opacity-40"
            >
              + добавить
            </button>
          )}
          {canSuggestSelf && credits.length < MAX && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => addRow({ name: artistName!.trim(), role: 'PERFORMER' })}
              className="text-xs text-foreground/45 hover:text-foreground transition-colors disabled:opacity-40"
            >
              + {artistName} — исполнитель
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
