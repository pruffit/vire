'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { spring, Stagger, StaggerItem } from '@vire/ui/motion';
import { GENRE_LABELS, type Genre } from '@/lib/genres';
import type { SearchRelease } from '@vire/db';

interface Props {
  releases: SearchRelease[];
}

export function SearchReleasesSection({ releases }: Props) {
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  const genres = useMemo(() => {
    const seen = new Set<string>();
    for (const r of releases) {
      if (r.genre) seen.add(r.genre);
    }
    return Array.from(seen);
  }, [releases]);

  const filtered = useMemo(
    () => (activeGenre ? releases.filter((r) => r.genre === activeGenre) : releases),
    [releases, activeGenre],
  );

  return (
    <div className="space-y-3">
      {/* Genre chips */}
      {genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre(activeGenre === g ? null : g)}
              className={`px-2.5 py-1 rounded-full text-xs font-mono border transition-all duration-150 ${
                activeGenre === g
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
        <motion.div
          key={activeGenre ?? 'all'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={spring.snappy}
        >
          <Stagger step={0.035} className="flex flex-col divide-y divide-border">
            {filtered.map((r) => (
              <StaggerItem key={r.id}>
                <ReleaseRow release={r} />
              </StaggerItem>
            ))}
          </Stagger>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ReleaseRow({ release }: { release: SearchRelease }) {
  return (
    <Link
      href={`/artists/${release.artistSlug}/releases/${release.id}`}
      className="group flex items-center gap-3 py-3 hover:bg-accent/5 -mx-2 px-2 rounded-sm transition-colors"
    >
      <div className="relative w-9 h-9 shrink-0 rounded-sm overflow-hidden bg-muted">
        {release.coverUrl
          ? <Image src={release.coverUrl} alt={release.title} fill sizes="36px" className="object-cover" />
          : <div className="w-full h-full bg-white/5" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">{release.title}</p>
        <p className="text-xs text-muted-foreground truncate">{release.artistName}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {release.genre && (
          <span className="text-[10px] font-mono text-muted-foreground/60">
            {GENRE_LABELS[release.genre as Genre] ?? release.genre}
          </span>
        )}
        <span className="text-xs font-mono text-muted-foreground">{release.type}</span>
      </div>
    </Link>
  );
}
