'use client';

import { useMemo, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ALL_GENRES, GENRE_GROUPS, GENRE_LABELS, MAX_TRACK_GENRES, type Genre } from '@/lib/genres';
import { useGenreAnalysis, type GenreSuggestion } from '@/lib/use-genre-analysis';
import { Icon } from '@/components/icon';
import { cn } from '@/lib/utils';

interface Props {
  trackId: string;
  initial: Genre[];
  suggestions?: GenreSuggestion[];
}

export function GenrePicker({ trackId, initial, suggestions: initialSuggestions = [] }: Props) {
  const [selected, setSelected] = useState<Set<Genre>>(new Set(initial));
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { status: analysisStatus, start: startAnalysis } = useGenreAnalysis(
    {
      analyze: `/api/v1/dashboard/tracks/${trackId}/analyze-genre`,
      suggestions: `/api/v1/dashboard/tracks/${trackId}/genre-suggestions`,
    },
    setSuggestions,
  );
  const analyzing = analysisStatus === 'running';

  const atMax = selected.size >= MAX_TRACK_GENRES;
  const pendingSuggestions = suggestions.filter((s) => !selected.has(s.genre));

  // Результаты поиска — плоский список по подписи (регистронезависимо).
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL_GENRES.filter((g) => GENRE_LABELS[g].toLowerCase().includes(q));
  }, [query]);

  function toggle(genre: Genre) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else if (next.size < MAX_TRACK_GENRES) next.add(genre);
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    const genres = Array.from(selected);
    startTransition(async () => {
      await fetch(`/api/v1/dashboard/tracks/${trackId}/genres`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genres }),
      });
      setSaved(true);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-white/40 uppercase tracking-widest">
          Жанры <span className="opacity-50">({selected.size}/{MAX_TRACK_GENRES})</span>
        </span>
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.span
              key="saved"
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs font-mono text-white/40"
            >
              Сохранено
            </motion.span>
          ) : (
            <motion.button
              key="save"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleSave}
              disabled={isPending}
              className="text-xs font-mono text-white underline-offset-2 hover:underline disabled:opacity-40"
            >
              {isPending ? 'Сохраняю…' : 'Сохранить'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Выбранное — всегда на виду, клик снимает */}
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from(selected).map((g) => (
            <button
              key={g}
              onClick={() => toggle(g)}
              className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-white text-black"
            >
              {GENRE_LABELS[g]}
              <Icon name="x" size={12} className="opacity-50 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      {/* Автоопределённые жанры — клик добавляет (уважая MAX_TRACK_GENRES); повторный анализ рядом */}
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono text-white/25 uppercase tracking-widest">
            Предложено
          </span>
          {pendingSuggestions.map((s) => (
            <button
              key={s.genre}
              onClick={() => toggle(s.genre)}
              disabled={atMax}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/15 px-2.5 py-1 text-xs font-mono text-white/40 transition-colors hover:border-white/30 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon name="plus" size={11} className="opacity-60" />
              {GENRE_LABELS[s.genre]}
            </button>
          ))}
          <button
            onClick={startAnalysis}
            disabled={analyzing}
            aria-label="Определить жанр заново"
            title="Определить жанр заново"
            className="inline-flex items-center justify-center size-6 rounded-full text-foreground/30 transition-colors hover:bg-foreground/10 hover:text-foreground/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="refresh-cw" size={12} className={cn(analyzing && 'animate-spin')} />
          </button>
        </div>
      ) : (
        <button
          onClick={startAnalysis}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-foreground/50 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="refresh-cw" size={12} className={cn(analyzing && 'animate-spin')} />
          {analyzing ? 'Определяю жанр…' : 'Определить жанр'}
        </button>
      )}

      {/* Поиск по всему списку */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск жанра…"
        className="w-full min-w-0 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs font-mono placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
      />

      {/* Скролл-область: либо результаты поиска плоско, либо группы */}
      <div className="max-h-64 overflow-y-auto pr-1 space-y-4 [scrollbar-width:thin]">
        {matches ? (
          matches.length === 0 ? (
            <p className="text-xs font-mono text-white/30 py-2">Ничего не найдено</p>
          ) : (
            <Pills genres={matches} selected={selected} atMax={atMax} onToggle={toggle} />
          )
        ) : (
          GENRE_GROUPS.map((group) => (
            <section key={group.label} className="space-y-2">
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">{group.label}</p>
              <Pills genres={group.genres} selected={selected} atMax={atMax} onToggle={toggle} />
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function Pills({
  genres,
  selected,
  atMax,
  onToggle,
}: {
  genres: Genre[];
  selected: Set<Genre>;
  atMax: boolean;
  onToggle: (g: Genre) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((genre) => {
        const active = selected.has(genre);
        return (
          <button
            key={genre}
            onClick={() => onToggle(genre)}
            aria-pressed={active}
            disabled={!active && atMax}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-mono border transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              active
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-white/40 border-white/10 hover:border-white/40 hover:text-white/70',
            )}
          >
            {GENRE_LABELS[genre]}
          </button>
        );
      })}
    </div>
  );
}
