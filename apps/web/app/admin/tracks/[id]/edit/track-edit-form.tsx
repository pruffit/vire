'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionAdminUpdateTrack } from '../../../actions';
import { GENRE_GROUPS, GENRE_LABELS } from '@/lib/genres';
import { ALL_MOODS, MOOD_LABELS } from '@/lib/moods';
import { fieldClass } from '@/components/admin/ui';

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
      if (p.moods.length >= 5) return p; // лимит 5
      return { ...p, moods: [...p.moods, m] };
    });
  }

  function onGenres(e: React.ChangeEvent<HTMLSelectElement>) {
    const sel = Array.from(e.target.selectedOptions, (o) => o.value).slice(0, 3);
    set('genres', sel);
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
          <input
            type="number"
            min={1}
            className={`${inputCls} w-20`}
            value={f.trackNumber}
            onChange={(e) => set('trackNumber', Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4">
        <Check label="Explicit (18+)" checked={f.isExplicit} onChange={(v) => set('isExplicit', v)} />
        <Check label="Эксклюзив" checked={f.isExclusive} onChange={(v) => set('isExclusive', v)} />
        <Check label="WIP (демо)" checked={f.isWip} onChange={(v) => set('isWip', v)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="BPM">
          <input
            type="number"
            min={20}
            max={500}
            className={inputCls}
            value={f.bpm ?? ''}
            onChange={(e) => set('bpm', e.target.value ? Number(e.target.value) : null)}
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

      <Field label={`Жанры трека (${f.genres.length}/3, Ctrl+клик — несколько)`}>
        <select multiple value={f.genres} onChange={onGenres} className={`${inputCls} h-44`}>
          {GENRE_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.genres.map((gen) => (
                <option key={gen} value={gen}>{GENRE_LABELS[gen]}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="Текст (LRC: [mm:ss.xx]строка — для подсветки в плеере; или простой текст)">
        <textarea
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

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground/70 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-primary" />
      {label}
    </label>
  );
}
