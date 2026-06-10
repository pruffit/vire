'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import type { FollowedArtist } from '@vire/db';
import { toast } from '@/components/toast';

/**
 * Список подписок с оптимистичной отпиской: карточка исчезает мгновенно (с exit-
 * анимацией), запрос уходит в фоне, при ошибке — откат. Без `router.refresh()`.
 */
export function FollowedArtists({ initial }: { initial: FollowedArtist[] }) {
  const [artists, setArtists] = useState(initial);
  const [pending, setPending] = useState<Set<string>>(new Set());

  async function unfollow(slug: string) {
    const prev = artists;
    setArtists((a) => a.filter((x) => x.slug !== slug));
    setPending((p) => new Set(p).add(slug));
    try {
      const res = await fetch(`/api/v1/artists/${slug}/follow`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setArtists(prev); // откат
      toast.error('Не удалось отписаться');
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(slug); return n; });
    }
  }

  if (artists.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Ты ни на кого не подписан.{' '}
        <Link href="/artists" className="underline underline-offset-2 hover:text-foreground transition-colors">
          Найти артистов →
        </Link>
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {artists.map((artist) => (
          <motion.div
            key={artist.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={spring.snappy}
            className="group flex items-center gap-3 p-3 rounded-md bg-card hover:bg-accent/5 transition-colors border border-border/40"
          >
            {artist.avatarUrl ? (
              <Image
                src={artist.avatarUrl}
                alt={artist.name}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-medium text-muted-foreground">
                {artist.name[0]?.toUpperCase()}
              </div>
            )}
            <Link href={`/artists/${artist.slug}`} className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                {artist.name}
              </p>
              {artist.verified && (
                <p className="text-xs text-muted-foreground">верифицирован</p>
              )}
            </Link>
            <button
              onClick={() => unfollow(artist.slug)}
              disabled={pending.has(artist.slug)}
              title="Отписаться"
              aria-label="Отписаться"
              className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-muted-foreground opacity-40 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all disabled:opacity-40 active:scale-90"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
