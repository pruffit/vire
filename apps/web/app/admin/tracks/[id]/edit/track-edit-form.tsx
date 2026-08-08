'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionAdminUpdateTrack } from '../../../actions';
import { ALL_GENRES, GENRE_GROUPS, GENRE_LABELS, MAX_TRACK_GENRES, type Genre } from '@/lib/genres';
import { ALL_MOODS, MOOD_LABELS } from '@/lib/moods';
import { fieldClass } from '@/components/admin/ui';
import { Textarea } from '@/components/ui-kit';
import { NumberField } from '@/components/number-field';
import { CreditsEditor } from '@/components/credits-editor';
import type { TrackCredit } from '@/lib/upload';
import { Icon } from '@/components/icon';
import { useGenreAnalysis, type GenreAnalysisResult, type GenreSuggestion } from '@/lib/use-genre-analysis';
import { useTrackAnalysis } from '@/lib/use-track-analysis';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface Initial {
  title: string;
  version: string;
  trackNumber: number;
  isExplicit: boolean;
  isExclusive: boolean;
  isWip: boolean;
  bpm: number | null;
  musicalKey: string;
  moods: string[];
  genres: string[];
  credits: TrackCredit[];
  lyrics: string; // LRC-текст (`[mm:ss.xx]строка`) или простой текст
}

const inputCls = `w-full ${fieldClass}`;

export function TrackEditForm({
  trackId,
  initial,
  genreSuggestions: initialGenreSuggestions = [],
}: {
  trackId: string;
  initial: Initial;
  genreSuggestions?: GenreSuggestion[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [f, setF] = useState(initial);
  const [genreSuggestions, setGenreSuggestions] = useState(initialGenreSuggestions);
  // воркер автопроставляет топ-2 жанра — отражаем в f.genres, чтобы не затёрлось при сохранении формы
  const handleGenreAnalysis = useCallback((result: GenreAnalysisResult) => {
    setGenreSuggestions(result.suggestions);
    if (result.appliedGenres.length === 0) return;
    setF((p) => {
      const next = [...p.genres];
      for (const g of result.appliedGenres) {
        if (next.length >= MAX_TRACK_GENRES) break;
        if (!next.includes(g)) next.push(g);
      }
      return { ...p, genres: next };
    });
  }, []);
  const { status: analysisStatus, start: startAnalysis } = useGenreAnalysis(
    {
      analyze: `/api/v1/admin/tracks/${trackId}/analyze-genre`,
      suggestions: `/api/v1/admin/tracks/${trackId}/genre-suggestions`,
    },
    handleGenreAnalysis,
  );
  const analyzing = analysisStatus === 'running';

  function set<K extends keyof Initial>(k: K, v: Initial[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  const { status: audioAnalysisStatus, start: startAudioAnalysis } = useTrackAnalysis<{
    bpm: number | null;
    musicalKey: string | null;
    updatedAt: string | null;
  }>(
    {
      analyze: `/api/v1/admin/tracks/${trackId}/analyze`,
      snapshot: `/api/v1/admin/tracks/${trackId}/audio-features`,
    },
    (snapshot) => {
      set('bpm', snapshot.bpm);
      set('musicalKey', snapshot.musicalKey ?? '');
      toast('BPM и тональность обновлены');
    },
    {
      pending: 'Определяю BPM и тональность…',
      start: 'Не удалось запустить анализ BPM/тональности',
      timeout: 'Анализ BPM/тональности занял слишком много времени — попробуй позже',
    },
  );
  const analyzingAudio = audioAnalysisStatus === 'running';

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
      if (p.genres.length >= MAX_TRACK_GENRES) return p;
      return { ...p, genres: [...p.genres, gen] };
    });
  }

  const [genreQuery, setGenreQuery] = useState('');
  const genreMatches = useMemo(() => {
    const q = genreQuery.trim().toLowerCase();
    if (!q) return null;
    return ALL_GENRES.filter((g) => GENRE_LABELS[g].toLowerCase().includes(q));
  }, [genreQuery]);

  const renderGenrePill = (gen: Genre) => {
    const on = f.genres.includes(gen);
    const full = !on && f.genres.length >= MAX_TRACK_GENRES;
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
  };

  function addSuggestedGenre(gen: Genre) {
    setF((p) => {
      if (p.genres.includes(gen) || p.genres.length >= MAX_TRACK_GENRES) return p;
      return { ...p, genres: [...p.genres, gen] };
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await actionAdminUpdateTrack(trackId, {
        title: f.title,
        version: f.version || null,
        trackNumber: f.trackNumber,
        isExplicit: f.isExplicit,
        isExclusive: f.isExclusive,
        isWip: f.isWip,
        bpm: f.bpm,
        musicalKey: f.musicalKey || null,
        moods: f.moods,
        genres: f.genres,
        credits: f.credits,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <button
        type="button"
        onClick={startAudioAnalysis}
        disabled={analyzingAudio || pending}
        className="inline-flex items-center gap-1.5 self-start text-xs text-foreground/50 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="refresh-cw" size={12} className={cn(analyzingAudio && 'animate-spin')} />
        {analyzingAudio ? 'Анализирую…' : 'Переанализировать BPM/тональность'}
      </button>

      <Field label="Версия (необязательно)">
        <input
          className={inputCls}
          value={f.version}
          onChange={(e) => set('version', e.target.value)}
          maxLength={80}
          placeholder="Radio Edit · Slowed + Reverb · Sped Up · Acoustic…"
        />
      </Field>

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

      <Field label={`Жанры трека (${f.genres.length}/${MAX_TRACK_GENRES})`}>
        <div className="flex flex-col gap-3 rounded-md border border-foreground/10 bg-foreground/[0.02] p-3">
          <input
            type="text"
            value={genreQuery}
            onChange={(e) => setGenreQuery(e.target.value)}
            placeholder="Поиск жанра…"
            className={inputCls}
          />
          <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
            {genreMatches ? (
              genreMatches.length === 0 ? (
                <span className="font-mono text-xs text-foreground/30 py-2">Ничего не найдено</span>
              ) : (
                <div className="flex flex-wrap gap-2">{genreMatches.map(renderGenrePill)}</div>
              )
            ) : (
              GENRE_GROUPS.map((g) => (
                <div key={g.label} className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/30">{g.label}</span>
                  <div className="flex flex-wrap gap-2">{g.genres.map(renderGenrePill)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label-mono text-foreground/45">
            Предложено моделью
          </span>
          <button
            type="button"
            onClick={startAnalysis}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 text-xs text-foreground/50 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="refresh-cw" size={12} className={cn(analyzing && 'animate-spin')} />
            {analyzing ? 'Анализирую…' : 'Проанализировать'}
          </button>
        </div>
        {genreSuggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {genreSuggestions.map((s) => {
              const added = f.genres.includes(s.genre);
              const full = !added && f.genres.length >= MAX_TRACK_GENRES;
              return (
                <button
                  key={s.genre}
                  type="button"
                  onClick={() => addSuggestedGenre(s.genre)}
                  disabled={added || full}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-foreground/15 px-3 py-1 text-xs text-foreground/50 transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {!added && <Icon name="plus" size={11} className="opacity-60" />}
                  {GENRE_LABELS[s.genre]}
                  <span className="font-mono text-[10px] text-foreground/35">{Math.round(s.confidence * 100)}%</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-foreground/30">Пока нет предсказаний — нажми «Проанализировать».</p>
        )}
      </div>

      <div className="border-t border-foreground/[0.06] pt-4">
        <CreditsEditor initial={initial.credits} onChange={(c) => set('credits', c)} />
      </div>

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
      <span className="label-mono text-foreground/45">{label}</span>
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
