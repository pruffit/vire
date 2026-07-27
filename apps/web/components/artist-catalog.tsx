'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Stagger, StaggerItem } from '@vire/ui/motion';
import type { ArtistListItem } from '@vire/db';
import { ALL_GENRES, GENRE_LABELS, type Genre } from '@/lib/genres';
import { ArtistCard } from '@/components/artist-card';
import { pluralReleases } from '@/lib/format';
import { ScrollRow } from '@/components/scroll-row';
import { touchPill } from '@/components/popover';

type Sort = 'default' | 'name' | 'releases';

const SORT_LABELS: Record<Sort, string> = {
  default: 'новые',
  name: 'A—Z',
  releases: 'релизы',
};

export function ArtistCatalog({ artists }: { artists: ArtistListItem[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('default');
  const [genre, setGenre] = useState<Genre | null>(null);

  const availableGenres = useMemo(() => {
    const present = new Set<string>();
    for (const a of artists) for (const g of a.genres) present.add(g);
    return ALL_GENRES.filter((g) => present.has(g));
  }, [artists]);

  const filtered = useMemo(() => {
    let list = artists;
    if (genre) list = list.filter((a) => a.genres.includes(genre));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    if (sort === 'releases') return [...list].sort((a, b) => b.releaseCount - a.releaseCount);
    return list;
  }, [artists, query, sort, genre]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Поиск по имени…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-0 px-3 py-1.5 rounded-md bg-white/5 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors pointer-coarse:h-11"
        />
        <div className="flex items-center gap-0.5 shrink-0">
          {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors ${touchPill} ${
                sort === s
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {availableGenres.length > 0 && (
        <ScrollRow bleedClassName="-mx-1" className="flex gap-1.5 px-1" edgeVariant="chip">
          <button
            onClick={() => setGenre(null)}
            className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-mono border transition-all duration-150 ${touchPill} ${
              genre === null
                ? 'bg-foreground text-background border-foreground'
                : 'bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
            }`}
          >
            Все
          </button>
          {availableGenres.map((g) => (
            <button
              key={g}
              onClick={() => setGenre(genre === g ? null : (g as Genre))}
              className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-mono border transition-all duration-150 ${touchPill} ${
                genre === g
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
              }`}
            >
              {GENRE_LABELS[g as Genre] ?? g}
            </button>
          ))}
        </ScrollRow>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {filtered.length === 0 ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-16 text-center text-sm text-muted-foreground"
          >
            Ничего не найдено.
          </motion.p>
        ) : (
          <Stagger step={0.03} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            {filtered.map((artist) => (
              <StaggerItem key={artist.id}>
                <ArtistCard
                  id={artist.id}
                  slug={artist.slug}
                  name={artist.name}
                  avatarUrl={artist.avatarUrl}
                  coverFallbackUrl={artist.firstReleaseCoverUrl}
                  verified={artist.verified}
                  stat={artist.releaseCount > 0 ? `${artist.releaseCount} ${pluralReleases(artist.releaseCount)}` : undefined}
                />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </AnimatePresence>

      {query && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center font-mono">
          {filtered.length} из {artists.length}
        </p>
      )}
    </div>
  );
}

