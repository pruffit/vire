'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionAdminUpdateTrack } from '../../../actions';
import { GENRE_GROUPS, GENRE_LABELS } from '@/lib/genres';
import { ALL_MOODS, MOOD_LABELS } from '@/lib/moods';
import { fieldClass } from '@/components/admin/ui';
import { Textarea } from '@/components/ui-kit';
import { NumberField } from '@/components/number-field';

interface Initial {
  title: string;
  trackNumber: number;
  isExplicit: boolean;
  isExclusive: boolean;
  isWip: boolean;
  bpm: number | null;
  musicalKey: string;
  moods: string[];
  genres: string[];
  lyrics: string; // LRC-текст (`[mm:ss.xx]строка`) или простой текст
}

const inputCls = `w-full ${fieldClass}`;

export function TrackEditForm({ trackId, initial }: { trackId: string; initial: Initial }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [f, setF] = useState(initial);

  function set<K extends keyof Initial>(k: K, v: Initial[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function toggleMood(m: string) {
    setF((p) => {
      if (p.moods.includes(m)) return { ...p, moods: p.moods.filter((x) => x !== m) };
      if (p.moods.length >= 5) return p;
      return { ...p, moods: [...p.moods, m] };
    });
  }

  function toggleGenre(gen: string) {
    setF((p) => {
      if (p.genres.includes(gen)) return { ...p, genres: p.genres.filter((x) => x !== gen) };
      if (p.genres.length >= 3) return p;
      return { ...p, genres: [...p.genres, gen] };
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await actionAdminUpdateTrack(trackId, {
        title: f.title,
        trackNumber: f.trackNumber,
        isExplicit: f.isExplicit,
        isExclusive: f.isExclusive,
        isWip: f.isWip,
        bpm: f.bpm,
        musicalKey: f.musicalKey || null,
        moods: f.moods,
        genres: f.genres,
        lyrics: f.lyrics || null,
      });
      if (res.error) setMsg({ text: res.error, ok: false });
      else {
        setMsg({ text: 'Сохранено', ok: true });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <Field label="Название">
          <input className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />
        </Field>
        <Field label="№">
          <NumberField
            value={f.trackNumber}
            onChange={(v) => set('trackNumber', v ?? 1)}
            min={1}
            className="w-24"
            aria-label="Номер трека"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
        <Check
          label="Explicit (18+)"
          hint="Мат/контент 18+ — бейдж «E» на витрине"
          checked={f.isExplicit}
          onChange={(v) => set('isExplicit', v)}
        />
        <Check
          label="Эксклюзив"
          hint="Метка «excl» в трек-листе релиза"
          checked={f.isExclusive}
          onChange={(v) => set('isExclusive', v)}
        />
        <Check
          label="WIP (демо)"
          hint="Черновик/демо — метка «wip»"
          checked={f.isWip}
          onChange={(v) => set('isWip', v)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="BPM">
          <NumberField
            value={f.bpm}
            onChange={(v) => set('bpm', v)}
            min={20}
            max={500}
            aria-label="BPM"
          />
        </Field>
        <Field label="Тональность">
          <input className={inputCls} value={f.musicalKey} onChange={(e) => set('musicalKey', e.target.value)} maxLength={20} placeholder="напр. Am" />
        </Field>
      </div>

      <Field label={`Настроения (${f.moods.length}/5)`}>
        <div className="flex flex-wrap gap-2">
          {ALL_MOODS.map((m) => {
            const on = f.moods.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMood(m)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors active:scale-[0.97] ${
                  on ? 'border-primary bg-primary/15 text-foreground' : 'border-foreground/10 text-foreground/50 hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {MOOD_LABELS[m]}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={`Жанры трека (${f.genres.length}/3)`}>
        <div className="flex flex-col gap-3 rounded-md border border-foreground/10 bg-foreground/[0.02] p-3 max-h-72 overflow-y-auto">
          {GENRE_GROUPS.map((g) => (
            <div key={g.label} className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/30">{g.label}</span>
              <div className="flex flex-wrap gap-2">
                {g.genres.map((gen) => {
                  const on = f.genres.includes(gen);
                  const full = !on && f.genres.length >= 3;
                  return (
                    <button
                      key={gen}
                      type="button"
                      onClick={() => toggleGenre(gen)}
                      disabled={full}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed ${
                        on
                          ? 'border-primary bg-primary/15 text-foreground'
                          : 'border-foreground/10 text-foreground/50 hover:text-foreground hover:border-foreground/30'
                      }`}
                    >
                      {GENRE_LABELS[gen]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Field>

      <Field label="Текст (LRC: [mm:ss.xx]строка — для подсветки в плеере; или простой текст)">
        <Textarea
          className={`${inputCls} min-h-32 font-mono text-xs`}
          value={f.lyrics}
          onChange={(e) => set('lyrics', e.target.value)}
          maxLength={20000}
          placeholder={'[00:15.20]первая строка\n[00:18.50]вторая строка'}
        />
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-opacity"
        >
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/45">{label}</span>
      {children}
    </label>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer select-none">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer size-4 appearance-none rounded border border-foreground/30 bg-foreground/5 transition-colors checked:bg-primary checked:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        />
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 6.5 5 9l4.5-5.5" />
        </svg>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm leading-tight text-foreground/85">{label}</span>
        {hint && <span className="text-[11px] leading-tight text-foreground/40">{hint}</span>}
      </span>
    </label>
  );
}
