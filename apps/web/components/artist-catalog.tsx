'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { spring, Stagger, StaggerItem } from '@vire/ui/motion';
import type { ArtistListItem } from '@vire/db';
import { ALL_GENRES, GENRE_LABELS, type Genre } from '@/lib/genres';
import { resolveAvatarUrl } from '@/lib/avatar';
import { Icon } from '@/components/icon';

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

  // Только встречающиеся в каталоге жанры, в порядке групп (ALL_GENRES)
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
          className="flex-1 min-w-0 px-3 py-1.5 rounded-md bg-white/5 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
        />
        <div className="flex items-center gap-0.5 shrink-0">
          {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors ${
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

      {/* Фильтр по жанрам — только встречающиеся в каталоге */}
      {availableGenres.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setGenre(null)}
            className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-mono border transition-all duration-150 ${
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
              className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-mono border transition-all duration-150 ${
                genre === g
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
              }`}
            >
              {GENRE_LABELS[g as Genre] ?? g}
            </button>
          ))}
        </div>
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
          <Stagger step={0.03} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {filtered.map((artist) => (
              <StaggerItem key={artist.id}>
                <ArtistCard artist={artist} />
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

function ArtistCard({ artist }: { artist: ArtistListItem }) {
  const displayAvatar = resolveAvatarUrl(artist.avatarUrl, artist.firstReleaseCoverUrl);
  return (
    <Link href={`/artists/${artist.slug}`} className="block">
      <motion.article
        whileHover={{ y: -2 }}
        transition={spring.snappy}
        className="group space-y-3 text-center"
      >
        <div className="relative mx-auto w-full aspect-square rounded-full overflow-hidden bg-muted ring-1 ring-white/5 transition-shadow duration-300 ease-soft group-hover:ring-white/20 group-hover:shadow-lg group-hover:shadow-black/20">
          {displayAvatar ? (
            <Image
              src={displayAvatar}
              alt={artist.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-mono text-muted-foreground">
              {artist.name[0]?.toUpperCase()}
            </div>
          )}
        </div>

        <div className="space-y-0.5 px-1">
          <p className="text-sm font-medium leading-snug truncate transition-colors">
            {artist.name}
            {artist.verified && (
              <Icon name="check" size={12} className="ml-1 inline-block align-middle text-muted-foreground" />
            )}
          </p>
          {artist.releaseCount > 0 && (
            <p className="text-xs text-muted-foreground font-mono tabular-nums">
              {artist.releaseCount} {pluralReleases(artist.releaseCount)}
            </p>
          )}
        </div>
      </motion.article>
    </Link>
  );
}

function pluralReleases(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'релиз';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'релиза';
  return 'релизов';
}
