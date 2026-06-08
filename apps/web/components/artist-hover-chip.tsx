'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import type { ArtistListItem } from '@vire/db';

function pluralReleases(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'релиз';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'релиза';
  return 'релизов';
}

/**
 * Карточка артиста с hover-превью: при наведении (desktop) всплывает мини-карточка
 * с увеличенным аватаром и инфо — peek перед переходом. На тач просто ссылка.
 */
export function ArtistHoverChip({ artist }: { artist: ArtistListItem }) {
  const [preview, setPreview] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function enter() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPreview(true), 300);
  }
  function leave() {
    if (timer.current) clearTimeout(timer.current);
    setPreview(false);
  }

  return (
    <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <Link href={`/artists/${artist.slug}`} className="block group text-center">
        <div className="relative mx-auto w-full aspect-square rounded-full overflow-hidden bg-muted ring-1 ring-white/5 transition-shadow duration-300 ease-soft group-hover:ring-white/20">
          {artist.avatarUrl ? (
            <Image src={artist.avatarUrl} alt={artist.name} fill sizes="(max-width: 640px) 33vw, 160px" className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]" />
          ) : (
            <div className="w-full h-full grid place-items-center text-xl font-mono text-muted-foreground">
              {artist.name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs font-medium leading-snug truncate group-hover:text-foreground transition-colors">
          {artist.name}
        </p>
      </Link>

      {/* Hover-превью */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={spring.smooth}
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-20 w-44 rounded-xl bg-popover border border-border shadow-2xl p-3 flex items-center gap-3"
          >
            <span className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden bg-muted">
              {artist.avatarUrl ? (
                <Image src={artist.avatarUrl} alt="" fill sizes="48px" className="object-cover" />
              ) : (
                <span className="w-full h-full grid place-items-center text-sm font-mono text-muted-foreground">{artist.name[0]?.toUpperCase()}</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-medium truncate">
                {artist.name}
                {artist.verified && <span className="text-[10px] text-muted-foreground">✓</span>}
              </span>
              <span className="block text-xs text-muted-foreground">
                {artist.releaseCount > 0 ? `${artist.releaseCount} ${pluralReleases(artist.releaseCount)}` : 'Открыть →'}
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
