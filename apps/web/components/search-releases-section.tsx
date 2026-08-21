'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import { spring, Stagger, StaggerItem } from '@vire/ui/motion';
import { ReleaseQuickLook } from '@/components/release-quick-look';
import { genreLabel, isGenre } from '@/lib/genres';
import { touchPill } from '@/components/popover';
import type { SearchRelease } from '@vire/db';

interface Props {
  releases: SearchRelease[];
}

export function SearchReleasesSection({ releases }: Props) {
  const tGenres = useTranslations('genres');
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
      {genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre(activeGenre === g ? null : g)}
              className={`px-2.5 py-1 rounded-full text-xs font-mono border transition-all duration-150 ${touchPill} ${
                activeGenre === g
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
              }`}
            >
              {isGenre(g) ? genreLabel(g, tGenres) : g}
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
          <Stagger step={0.035} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            {filtered.map((r) => (
              <StaggerItem key={r.id}>
                <ReleaseQuickLook release={r} upcoming={r.status === 'SCHEDULED'} />
              </StaggerItem>
            ))}
          </Stagger>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
