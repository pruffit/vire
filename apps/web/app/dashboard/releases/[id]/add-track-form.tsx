'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type ContributorRole = 'PERFORMER' | 'LYRICIST' | 'COMPOSER' | 'PRODUCER';
interface TrackCredit { name: string; role: ContributorRole }

const ROLES: { value: ContributorRole; label: string }[] = [
  { value: 'PERFORMER', label: 'Исполнитель' },
  { value: 'LYRICIST', label: 'Автор текста' },
  { value: 'COMPOSER', label: 'Композитор' },
  { value: 'PRODUCER', label: 'Продюсер' },
];

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

const inp =
  'rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50';

export function AddTrackForm({ releaseId, nextTrackNumber }: { releaseId: string; nextTrackNumber: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<TrackCredit[]>([{ name: '', role: 'PERFORMER' }]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'uploading') return;

    setError(null);
    setState('uploading');

    const data = new FormData(e.currentTarget);
    data.set('releaseId', releaseId);
    const validCredits = credits.filter((c) => c.name.trim().length > 0);
    data.set('credits', JSON.stringify(validCredits));

    try {
      const res = await fetch('/api/v1/dashboard/tracks/upload', { method: 'POST', body: data });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setState('done');
      formRef.current?.reset();
      setCredits([{ name: '', role: 'PERFORMER' }]);
      router.refresh();
      setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setState('error');
    }
  }

  const busy = state === 'uploading';

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 w-20 shrink-0">
          <label className="text-sm text-white/50">№</label>
          <input
            name="trackNumber"
            type="number"
            min={1}
            defaultValue={nextTrackNumber}
            required
            disabled={busy}
            className={inp}
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <label className="text-sm text-white/50">Название трека</label>
          <input name="title" type="text" required disabled={busy} placeholder="Название трека" className={`${inp} w-full`} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-white/50">Аудиофайл <span className="text-white/30">· WAV, FLAC или MP3</span></label>
        <input
          name="file"
          type="file"
          accept=".wav,.flac,.mp3,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/mpeg"
          required
          disabled={busy}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:cursor-pointer hover:file:bg-white/20 disabled:opacity-50"
        />
        <p className="text-xs text-white/40 leading-relaxed">
          Для наилучшего качества рекомендуем WAV 44.1&nbsp;kHz, 16/24&nbsp;бит (PCM).
          Принимаем также FLAC и MP3. Максимум 300&nbsp;МБ.
        </p>
      </div>

      {/* Credits */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-white/50">Кредиты</span>
          <span className="text-xs text-white/30">необязательно</span>
        </div>
        {credits.map((credit, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Имя"
              value={credit.name}
              disabled={busy}
              onChange={(e) => setCredits((prev) => prev.map((c, j) => j === i ? { ...c, name: e.target.value } : c))}
              className={`${inp} flex-1 min-w-0`}
            />
            <select
              value={credit.role}
              disabled={busy}
              onChange={(e) => setCredits((prev) => prev.map((c, j) => j === i ? { ...c, role: e.target.value as ContributorRole } : c))}
              className={`${inp} shrink-0`}
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {credits.length > 1 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setCredits((prev) => prev.filter((_, j) => j !== i))}
                className="text-white/30 hover:text-red-400 transition-colors text-lg leading-none shrink-0"
                aria-label="Удалить кредит"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {credits.length < 20 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setCredits((prev) => [...prev, { name: '', role: 'PERFORMER' }])}
            className="self-start text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            + добавить
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {state === 'done' && <p className="text-sm text-green-400">Трек загружен, идёт обработка</p>}

      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-md bg-white text-black px-5 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {busy ? 'Загружаю…' : 'Добавить трек'}
      </button>
    </form>
  );
}
