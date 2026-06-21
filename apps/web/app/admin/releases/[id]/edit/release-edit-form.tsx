'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionAdminUpdateRelease } from '../../../actions';
import { GENRE_GROUPS, GENRE_LABELS } from '@/lib/genres';

interface Initial {
  title: string;
  type: string;
  genre: string | null;
  releaseDate: string; // yyyy-mm-dd | ''
  description: string;
  linerNotes: string;
}

const inputCls =
  'w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30';

export function ReleaseEditForm({ releaseId, initial }: { releaseId: string; initial: Initial }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [f, setF] = useState(initial);

  function set<K extends keyof Initial>(k: K, v: Initial[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await actionAdminUpdateRelease(releaseId, {
        title: f.title,
        type: f.type,
        genre: f.genre || null,
        releaseDate: f.releaseDate || null,
        description: f.description || null,
        linerNotes: f.linerNotes || null,
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
      <Field label="Название">
        <input className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Тип">
          <select className={inputCls} value={f.type} onChange={(e) => set('type', e.target.value)}>
            <option value="ALBUM">ALBUM</option>
            <option value="EP">EP</option>
            <option value="SINGLE">SINGLE</option>
          </select>
        </Field>
        <Field label="Дата релиза">
          <input type="date" className={inputCls} value={f.releaseDate} onChange={(e) => set('releaseDate', e.target.value)} />
        </Field>
      </div>

      <Field label="Жанр">
        <select className={inputCls} value={f.genre ?? ''} onChange={(e) => set('genre', e.target.value || null)}>
          <option value="">— без жанра —</option>
          {GENRE_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.genres.map((gen) => (
                <option key={gen} value={gen}>{GENRE_LABELS[gen]}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="Описание">
        <textarea className={`${inputCls} min-h-20`} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} />
      </Field>

      <Field label="Liner notes">
        <textarea className={`${inputCls} min-h-24`} value={f.linerNotes} onChange={(e) => set('linerNotes', e.target.value)} maxLength={10000} />
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-opacity"
        >
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-mono uppercase tracking-wider text-white/40">{label}</span>
      {children}
    </label>
  );
}
