'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
interface ReleaseOption {
  id: string;
  title: string;
  status: string;
}

interface Props {
  releases: ReleaseOption[];
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export function UploadTrackForm({ releases }: Props) {
  const router = useRouter();
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'uploading') return;

    setError(null);
    setState('uploading');

    const data = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/v1/dashboard/tracks/upload', {
        method: 'POST',
        body: data,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      setState('done');
      formRef.current?.reset();
      setTimeout(() => {
        setState('idle');
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setState('error');
    }
  }

  const isUploading = state === 'uploading';

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Release */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[var(--color-text-secondary,#9ca3af)]">
          Релиз
        </label>
        <select
          name="releaseId"
          required
          disabled={isUploading}
          className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] disabled:opacity-50"
        >
          <option value="">— выбери релиз —</option>
          {releases.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title} ({r.status})
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[var(--color-text-secondary,#9ca3af)]">
          Название трека
        </label>
        <input
          name="title"
          type="text"
          required
          disabled={isUploading}
          placeholder="Название трека"
          className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] disabled:opacity-50"
        />
      </div>

      {/* Track number */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[var(--color-text-secondary,#9ca3af)]">
          Номер трека
        </label>
        <input
          name="trackNumber"
          type="number"
          min={1}
          defaultValue={1}
          required
          disabled={isUploading}
          className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent,#6366f1)] disabled:opacity-50"
        />
      </div>

      {/* File */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[var(--color-text-secondary,#9ca3af)]">
          FLAC-файл
        </label>
        <input
          name="file"
          type="file"
          accept=".flac,audio/flac"
          required
          disabled={isUploading}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:cursor-pointer hover:file:bg-white/20 disabled:opacity-50"
        />
      </div>

      {/* Status */}
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {state === 'done' && (
        <p className="text-sm text-green-400">Трек загружен, транскодирование запущено</p>
      )}

      <button
        type="submit"
        disabled={isUploading}
        className="mt-1 rounded-md bg-[var(--color-accent,#6366f1)] px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed self-start"
      >
        {isUploading ? 'Загружаю…' : 'Загрузить трек'}
      </button>
    </form>
  );
}
