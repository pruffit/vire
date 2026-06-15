'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import type { EditorialPlaylist } from '@vire/db';
import { pluralTracks } from '@/lib/format';
import { HeartIcon } from '@/components/icons';

const KIND_LABELS: Record<string, string | undefined> = {
  USER: undefined, // пользовательские плейлисты — бейдж не показываем
  PERSONAL: undefined, // личные — заголовок уже говорит «для тебя», бейдж лишний
  MOOD: 'Настроение',
  TRENDING: 'В тренде',
  RELISTEN: 'Снова и снова',
  FRESH: 'Свежее',
};

interface FanLayer {
  src: string;
  rot: number; // наклон, deg
  dx: number; // сдвиг по X, % ширины
  z: number;
}

// Веер обложек: первая — лицевая по центру, остальные выглядывают сзади под
// наклоном. Только плоские 2D-трансформы (никаких 3D/blur/will-change) — поэтому
// ничего не дёргается при скролле.
function buildFan(stack: string[]): FanLayer[] {
  if (stack.length === 1) {
    return [{ src: stack[0], rot: 0, dx: 0, z: 30 }];
  }
  if (stack.length === 2) {
    return [
      { src: stack[1], rot: 8, dx: 15, z: 10 },
      { src: stack[0], rot: -4, dx: -3, z: 30 },
    ];
  }
  return [
    { src: stack[1], rot: -10, dx: -16, z: 10 },
    { src: stack[2], rot: 10, dx: 16, z: 10 },
    { src: stack[0], rot: 0, dx: 0, z: 30 },
  ];
}

function CoverFan({ covers }: { covers: string[] }) {
  const stack = covers.slice(0, 3);

  if (stack.length === 0) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-white/[0.07] to-white/[0.01]">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="opacity-20">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6zm0 16a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {buildFan(stack).map((l, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 w-[62%] aspect-square rounded-[4px] overflow-hidden bg-muted ring-1 ring-black/40 shadow-lg shadow-black/40"
          style={{
            transform: `translate(-50%, -50%) translateX(${l.dx}%) rotate(${l.rot}deg)`,
            zIndex: l.z,
          }}
        >
          <Image
            src={l.src}
            alt=""
            fill
            sizes="(max-width: 640px) 30vw, 150px"
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

  const kindLabel = KIND_LABELS[playlist.kind];

  return (
    // Никаких промоутеров композит-слоя (transform-gpu/will-change/3D) — иначе
    // блок скроллится не в такт с документом и «дрожит». overflow-hidden держит
    // веер внутри карточки, чтобы между карточками был зазор сетки.
    <div className="group flex flex-col gap-2.5">
      <Link
        href={`/playlists/${playlist.id}`}
        className="block relative aspect-square rounded-md overflow-hidden transition-transform duration-500 ease-soft group-hover:-translate-y-0.5"
      >
        <CoverFan covers={playlist.covers} />
        {/* Тип подборки — только для редакционных */}
        {kindLabel && (
          <span className="absolute top-1 left-1 z-40 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-mono text-white/80 pointer-events-none">
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
          <HeartIcon filled={liked} size={14} strokeWidth={2} className={liked ? '[color:oklch(65%_0.20_25)]' : undefined} />
          {likes > 0 && <span className="font-mono text-[10px]">{likes}</span>}
        </motion.button>
      </div>
    </div>
  );
}
