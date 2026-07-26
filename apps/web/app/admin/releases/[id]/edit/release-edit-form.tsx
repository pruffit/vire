'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionAdminUpdateRelease } from '../../../actions';
import { GENRE_GROUPS, GENRE_LABELS } from '@/lib/genres';
import { fieldClass } from '@/components/admin/ui';
import { Textarea } from '@/components/ui-kit';
import { Select, type SelectGroup } from '@/components/select';
import { DateField } from '@/components/date-field';

const TYPE_OPTIONS = [
  { value: 'ALBUM', label: 'ALBUM' },
  { value: 'EP', label: 'EP' },
  { value: 'SINGLE', label: 'SINGLE' },
];

const GENRE_OPTION_GROUPS: SelectGroup[] = [
  { label: '', options: [{ value: '', label: '— без жанра —' }] },
  ...GENRE_GROUPS.map((g) => ({
    label: g.label,
    options: g.genres.map((gen) => ({ value: gen, label: GENRE_LABELS[gen] })),
  })),
];

interface Initial {
  title: string;
  type: string;
  genre: string | null;
  releaseDate: string; // yyyy-mm-dd | ''
  description: string;
  linerNotes: string;
}

const inputCls = `w-full ${fieldClass}`;

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Тип">
          <Select options={TYPE_OPTIONS} value={f.type} onValueChange={(v) => set('type', v)} aria-label="Тип" />
        </Field>
        <Field label="Дата релиза">
          <DateField value={f.releaseDate} onValueChange={(v) => set('releaseDate', v)} aria-label="Дата релиза" />
        </Field>
      </div>

      <Field label="Жанр">
        <Select
          groups={GENRE_OPTION_GROUPS}
          searchable
          value={f.genre ?? ''}
          onValueChange={(v) => set('genre', v || null)}
          aria-label="Жанр"
        />
      </Field>

      <Field label="Описание">
        <Textarea className={`${inputCls} min-h-20`} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} />
      </Field>

      <Field label="Liner notes">
        <Textarea className={`${inputCls} min-h-24`} value={f.linerNotes} onChange={(e) => set('linerNotes', e.target.value)} maxLength={10000} />
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
