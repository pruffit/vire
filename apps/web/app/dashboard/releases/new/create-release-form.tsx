'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type State = 'idle' | 'submitting' | 'error';

export function CreateReleaseForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

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
      <Field label="Название">
        <input
          name="title"
          type="text"
          required
          disabled={busy}
          placeholder="Название релиза"
          className={input}
        />
      </Field>

      {/* Type */}
      <Field label="Тип">
        <select name="type" required disabled={busy} className={input}>
          <option value="ALBUM">Альбом</option>
          <option value="EP">EP</option>
          <option value="SINGLE">Сингл</option>
        </select>
      </Field>

      {/* Release date */}
      <Field label="Дата релиза" hint="необязательно">
        <input
          name="releaseDate"
          type="date"
          disabled={busy}
          className={`${input} w-44`}
        />
      </Field>

      {/* Cover */}
      <Field label="Обложка" hint="JPEG, PNG или WebP · необязательно">
        <div className="flex items-start gap-4">
          <input
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={handleCoverChange}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:cursor-pointer hover:file:bg-white/20 disabled:opacity-50"
          />
          {coverPreview && (
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
          className={`${input} resize-none`}
        />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-white text-black px-5 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? 'Сохраняю…' : 'Создать релиз'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={busy}
          className="text-sm text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

const input =
  'rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50 w-full';
