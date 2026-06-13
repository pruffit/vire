'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReleaseType } from '@vire/core';
import { GENRE_GROUPS, GENRE_LABELS } from '@/lib/genres';

interface Initial {
  title: string;
  type: ReleaseType;
  genre: string | null;
  releaseDate: string;
  description: string;
  linerNotes: string;
  coverUrl: string | null;
}

interface Props {
  releaseId: string;
  initial: Initial;
}

type State = 'idle' | 'saving' | 'saved' | 'error';

const input =
  'rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50 w-full';

export function EditReleaseForm({ releaseId, initial }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'saving') return;

    setState('saving');
    setError(null);

    try {
      const res = await fetch(`/api/v1/dashboard/releases/${releaseId}`, {
        method: 'PATCH',
        body: new FormData(e.currentTarget),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      setState('saved');
      router.refresh();
      setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      setState('error');
    }
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  }

  const busy = state === 'saving';

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Название">
        <input name="title" type="text" required disabled={busy} defaultValue={initial.title} className={input} />
      </Field>

      <Field label="Тип">
        <select name="type" required disabled={busy} defaultValue={initial.type} className={input}>
          <option value="ALBUM">Альбом</option>
          <option value="EP">EP</option>
          <option value="SINGLE">Сингл</option>
        </select>
      </Field>

      <Field label="Жанр" hint="необязательно">
        <select name="genre" disabled={busy} defaultValue={initial.genre ?? ''} className={input}>
          <option value="">— выберите жанр</option>
          {GENRE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.genres.map((g) => (
                <option key={g} value={g}>{GENRE_LABELS[g]}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="Дата релиза" hint="необязательно">
        <input name="releaseDate" type="date" disabled={busy} defaultValue={initial.releaseDate} className={`${input} w-44`} />
      </Field>

      <Field label="Обложка" hint="Квадрат 1:1, от 1400×1400 (рек. 3000×3000) · оставь пустым — без изменений">
        <div className="flex items-start gap-4">
          <input
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={handleCoverChange}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:cursor-pointer hover:file:bg-white/20 disabled:opacity-50"
          />
          {(coverPreview ?? initial.coverUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview ?? initial.coverUrl!}
              alt="Обложка"
              className="w-16 h-16 rounded-md object-cover shrink-0"
            />
          )}
        </div>
      </Field>

      <Field label="Описание" hint="необязательно">
        <textarea name="description" rows={3} disabled={busy} defaultValue={initial.description} className={`${input} resize-none`} />
      </Field>

      <Field label="Liner notes" hint="необязательно · виден только купившим">
        <textarea name="linerNotes" rows={5} disabled={busy} defaultValue={initial.linerNotes} className={`${input} resize-none font-mono text-xs`} />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {state === 'saved' && <p className="text-sm text-green-400">Сохранено</p>}

      <div className="flex items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-white text-black px-5 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {busy ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <a href="/dashboard" className="text-sm text-white/40 hover:text-white/70 transition-colors">
          Отмена
        </a>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-white/30">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
