'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GENRE_GROUPS, GENRE_LABELS } from '@/lib/genres';
import { Field, fieldClass, btnPrimary } from '@/components/ui-kit';
import { titleRepeatsArtist } from '@/lib/title-hygiene';
import { cn } from '@/lib/utils';

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

      // На страницу релиза — там добавляют треки
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
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  }

  const busy = state === 'submitting';

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* Title */}
      <Field label="Название" hint="без имени артиста — оно и так рядом с обложкой">
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

      {/* Type */}
      <Field label="Тип">
        <select name="type" required disabled={busy} className={cn(fieldClass, 'w-full')}>
          <option value="ALBUM">Альбом</option>
          <option value="EP">EP</option>
          <option value="SINGLE">Сингл</option>
        </select>
      </Field>

      {/* Genre */}
      <Field label="Жанр" hint="необязательно">
        <select name="genre" disabled={busy} className={cn(fieldClass, 'w-full')}>
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

      {/* Release date */}
      <Field label="Дата релиза" hint="необязательно">
        <input
          name="releaseDate"
          type="date"
          disabled={busy}
          className={cn(fieldClass, 'w-44')}
        />
      </Field>

      {/* Cover */}
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

      {/* Description */}
      <Field label="Описание" hint="необязательно">
        <textarea
          name="description"
          rows={3}
          disabled={busy}
          placeholder="Пара слов о релизе…"
          className={cn(fieldClass, 'w-full resize-none')}
        />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-4 pt-1">
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
