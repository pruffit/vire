'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, fieldClass, btnPrimary, Textarea } from '@/components/ui-kit';
import { GenreSelect } from '@/components/genre-select';
import { Select } from '@/components/select';
import { DateField } from '@/components/date-field';
import { titleRepeatsArtist } from '@/lib/title-hygiene';
import { cn } from '@/lib/utils';

const RELEASE_TYPE_OPTIONS = [
  { value: 'ALBUM', label: 'Альбом' },
  { value: 'EP', label: 'EP' },
  { value: 'SINGLE', label: 'Сингл' },
];

type State = 'idle' | 'submitting' | 'error';

export function CreateReleaseForm({ artistName }: { artistName: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const titleWarn = titleRepeatsArtist(title, artistName);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'submitting') return;

    setState('submitting');
    setError(null);

    try {
      const res = await fetch('/api/v1/dashboard/releases', {
        method: 'POST',
        body: new FormData(e.currentTarget),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const releaseId = (json as { releaseId?: string }).releaseId;
      router.push(releaseId ? `/dashboard/releases/${releaseId}` : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      setState('error');
    }
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  }

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const busy = state === 'submitting';

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2"
    >
      <Field
        label="Название"
        hint="без имени артиста — оно и так рядом с обложкой"
        className="sm:col-span-2"
      >
        <input
          name="title"
          type="text"
          required
          disabled={busy}
          placeholder="Название релиза"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={cn(fieldClass, 'w-full')}
        />
        {titleWarn && (
          <span className="text-[11px] text-amber-400/90 leading-snug">
            Имя артиста уже показано рядом — в названии его дублировать не нужно.
          </span>
        )}
      </Field>

      <Field label="Тип">
        <Select name="type" defaultValue="ALBUM" options={RELEASE_TYPE_OPTIONS} disabled={busy} aria-label="Тип" />
      </Field>

      <Field label="Жанр" hint="необязательно">
        <GenreSelect name="genre" disabled={busy} />
      </Field>

      <Field label="Дата релиза" hint="необязательно">
        <DateField name="releaseDate" disabled={busy} className="w-44" aria-label="Дата релиза" />
      </Field>

      <Field label="Обложка" hint="Квадрат 1:1, от 1400×1400 (рекомендуем 3000×3000) · JPEG/PNG/WebP · необязательно">
        <div className="flex items-start gap-4 min-w-0">
          <input
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={handleCoverChange}
            className="min-w-0 max-w-full flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-sm file:cursor-pointer hover:file:bg-foreground/20 disabled:opacity-50"
          />
          {coverPreview && (
            // Локальное превью выбранного файла (blob:) — next/image его не оптимизирует
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview}
              alt="Preview"
              className="w-16 h-16 rounded-md object-cover shrink-0"
            />
          )}
        </div>
      </Field>

      <Field label="Описание" hint="необязательно" className="sm:col-span-2">
        <Textarea
          name="description"
          rows={3}
          disabled={busy}
          placeholder="Пара слов о релизе…"
          className={cn(fieldClass, 'w-full')}
        />
      </Field>

      {error && <p className="text-sm text-red-400 sm:col-span-2">{error}</p>}

      <div className="flex items-center gap-4 pt-1 sm:col-span-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? 'Сохраняю…' : 'Создать релиз'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={busy}
          className="text-sm text-foreground/40 hover:text-foreground/70 transition-colors disabled:opacity-30"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
