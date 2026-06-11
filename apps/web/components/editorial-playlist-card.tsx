'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import type { EditorialPlaylist } from '@vire/db';

const KIND_LABELS: Record<string, string> = {
  MOOD: 'Настроение',
  TRENDING: 'В тренде',
  RELISTEN: 'Снова и снова',
  FRESH: 'Свежее',
};

function PlaylistCollage({ covers }: { covers: string[] }) {
  if (covers.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center opacity-20">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
        </svg>
      </div>
    );
  }

  if (covers.length === 1) {
    return (
      <Image
        src={covers[0]}
        alt=""
        fill
        sizes="(max-width: 640px) 50vw, 250px"
        className="object-cover"
      />
    );
  }

  // 2×2 collage — fill gaps with the last cover
  const cells = [covers[0], covers[1] ?? covers[0], covers[2] ?? covers[0], covers[3] ?? covers[0]];
  return (
    <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
      {cells.map((src, i) => (
        <div key={i} className="relative overflow-hidden">
          <Image
            src={src}
            alt=""
            fill
            sizes="(max-width: 640px) 25vw, 125px"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}

export function EditorialPlaylistCard({
  playlist,
  liked: initialLiked,
}: {
  playlist: EditorialPlaylist;
  liked: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(playlist.likesCount);
  const [pending, setPending] = useState(false);

  async function toggleLike(e: React.MouseEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const willLike = !liked;
    setLiked(willLike);
    setLikes((n) => n + (willLike ? 1 : -1));
    try {
      await fetch(`/api/v1/playlists/${playlist.id}/like`, {
        method: willLike ? 'POST' : 'DELETE',
      });
    } catch {
      // откат
      setLiked(!willLike);
      setLikes((n) => n + (willLike ? -1 : 1));
    } finally {
      setPending(false);
    }
  }

  const kindLabel = KIND_LABELS[playlist.kind] ?? playlist.kind;

  return (
    <div className="group flex flex-col gap-2.5">
      <Link
        href={`/playlists/${playlist.id}`}
        className="block relative aspect-square rounded-md overflow-hidden bg-muted ring-1 ring-white/5 transition-all duration-300 ease-soft group-hover:ring-white/20 group-hover:shadow-xl group-hover:shadow-black/30"
      >
        <PlaylistCollage covers={playlist.covers} />
        {/* Тип подборки */}
        <span className="absolute top-2 left-2 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-mono text-white/80 pointer-events-none">
          {kindLabel}
        </span>
      </Link>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug truncate">{playlist.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {playlist.trackCount} {pluralTracks(playlist.trackCount)}
          </p>
        </div>

        <motion.button
          type="button"
          onClick={toggleLike}
          whileTap={{ scale: 0.85 }}
          transition={spring.snappy}
          aria-label={liked ? 'Убрать из избранного' : 'В избранное'}
          className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5 cursor-pointer"
        >
          <HeartIcon filled={liked} />
          {likes > 0 && <span className="font-mono text-[10px]">{likes}</span>}
        </motion.button>
      </div>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={filled ? { color: 'oklch(65% 0.20 25)' } : undefined}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function pluralTracks(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'трек';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'трека';
  return 'треков';
}
