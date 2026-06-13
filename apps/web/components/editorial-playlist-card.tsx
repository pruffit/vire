'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import type { EditorialPlaylist } from '@vire/db';
import { pluralTracks } from '@/lib/format';

const KIND_LABELS: Record<string, string | undefined> = {
  USER: undefined, // пользовательские плейлисты — бейдж не показываем
  MOOD: 'Настроение',
  TRENDING: 'В тренде',
  RELISTEN: 'Снова и снова',
  FRESH: 'Свежее',
};

interface Layer {
  src: string;
  rot: number; // поворот, deg
  dx: number; // смещение по X, % от размера карточки
  z: number;
  back: boolean; // задняя карта — приглушаем
}

// Раскладка «веером»: первая обложка — лицевая (прямо), остальные выглядывают сзади.
function buildLayers(stack: string[]): Layer[] {
  if (stack.length === 1) {
    return [{ src: stack[0], rot: 0, dx: 0, z: 30, back: false }];
  }
  if (stack.length === 2) {
    return [
      { src: stack[1], rot: 8, dx: 13, z: 10, back: true },
      { src: stack[0], rot: 0, dx: 0, z: 30, back: false },
    ];
  }
  return [
    { src: stack[1], rot: -9, dx: -13, z: 10, back: true },
    { src: stack[2], rot: 9, dx: 13, z: 10, back: true },
    { src: stack[0], rot: 0, dx: 0, z: 30, back: false },
  ];
}

function PlaylistCollage({ covers }: { covers: string[] }) {
  if (covers.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.08] to-white/[0.01]">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="opacity-20">
          <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
        </svg>
      </div>
    );
  }

  const stack = covers.slice(0, 3);
  const layers = buildLayers(stack);

  return (
    <div className="relative w-full h-full">
      {/* Размытый фон из первой обложки — цвет самой музыки.
          transform-gpu выносит блюр на отдельный композит-слой: он
          растеризуется один раз и кэшируется, а не пересчитывается на
          каждом кадре скролла (иначе джанк при прокрутке секции подборок). */}
      <Image
        src={stack[0]}
        alt=""
        fill
        sizes="(max-width: 640px) 50vw, 250px"
        className="object-cover scale-150 blur-2xl brightness-[0.45] saturate-150 transform-gpu"
      />
      <div className="absolute inset-0 bg-black/20" />

      {/* Колода обложек веером */}
      <div className="absolute inset-0 transition-transform duration-500 ease-soft group-hover:scale-[1.04]">
        {layers.map((l, i) => (
          <div
            key={i}
            className={`absolute left-1/2 top-1/2 w-[66%] h-[66%] rounded-[10px] overflow-hidden ring-1 ring-black/30 shadow-lg shadow-black/40 ${
              l.back ? 'brightness-[0.72]' : ''
            }`}
            style={{
              transform: `translate(-50%, -50%) rotate(${l.rot}deg) translateX(${l.dx}%)`,
              zIndex: l.z,
            }}
          >
            <Image src={l.src} alt="" fill sizes="(max-width: 640px) 33vw, 165px" className="object-cover" />
          </div>
        ))}
      </div>
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

  const kindLabel = KIND_LABELS[playlist.kind];

  return (
    // content-visibility:auto — карточки вне вьюпорта не отрисовываются (тяжёлые
    // блюр-коллажи рисуются только когда видимы). contain-intrinsic-size держит
    // высоту до первой отрисовки, чтобы скролл-бар не прыгал.
    <div className="group flex flex-col gap-2.5 [content-visibility:auto] [contain-intrinsic-size:auto_280px]">
      <Link
        href={`/playlists/${playlist.id}`}
        className="block relative aspect-square rounded-md overflow-hidden bg-muted ring-1 ring-white/5 transition-all duration-300 ease-soft group-hover:ring-white/20 group-hover:shadow-xl group-hover:shadow-black/30"
      >
        <PlaylistCollage covers={playlist.covers} />
        {/* Тип подборки — только для редакционных */}
        {kindLabel && (
          <span className="absolute top-2 left-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-mono text-white/80 pointer-events-none">
            {kindLabel}
          </span>
        )}
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

