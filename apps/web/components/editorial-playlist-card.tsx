'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import type { EditorialPlaylist } from '@vire/db';
import { editorialPlaylistText } from '@/lib/editorial-playlist';
import { HeartIcon } from '@/components/icons';
import { touchTargetClass } from '@/components/popover';
import { CoverPlaceholder } from './playlist-cover';
import { usePlaylistLike } from './use-playlist-like';
import { PlaylistPeekSheet } from './playlist-quick-look';

const KIND_BADGE_KEYS: Record<string, string | undefined> = {
  MOOD: 'mood',
  TRENDING: 'trending',
  RELISTEN: 'relisten',
  FRESH: 'fresh',
};

interface FanLayer {
  src: string;
  rot: number;
  dx: number;
  z: number;
}

// только плоские 2D-трансформы (без 3D/blur/will-change) — иначе дрожит при скролле
export function buildFan(covers: string[]): FanLayer[] {
  const stack = Array.from(new Set(covers)).slice(0, 3);
  if (stack.length === 0) return [];
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
  const fan = buildFan(covers);

  if (fan.length === 0) return <CoverPlaceholder />;

  return (
    <div className="absolute inset-0">
      {fan.map((l, i) => (
        <div
          key={i}
          // тень только у лицевой: box-shadow на повёрнутых обложках дорог при скролле
          className={`absolute left-1/2 top-1/2 w-[62%] aspect-square rounded-[4px] overflow-hidden bg-muted ring-1 ring-black/40 ${
            l.z >= 30 ? 'shadow-md shadow-black/40' : ''
          }`}
          style={{
            transform: `translate(-50%, -50%) translateX(${l.dx}%) rotate(${l.rot}deg)`,
            zIndex: l.z,
          }}
        >
          <Image
            src={l.src}
            alt=""
            fill
            quality={60}
            // sizes не занижать: на ретине нужен ~320px исходник, иначе мыло на зернистой текстуре
            sizes="(max-width: 640px) 33vw, (max-width: 768px) 20vw, 180px"
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
  const t = useTranslations('playlist');
  const tCommon = useTranslations('common');
  const tMoods = useTranslations('moods');
  const [open, setOpen] = useState(false);
  const { liked, likes, toggle } = usePlaylistLike(playlist.id, initialLiked, playlist.likesCount);

  function toggleLike(e: React.MouseEvent) {
    e.preventDefault();
    void toggle();
  }

  const { title } = editorialPlaylistText(t, tMoods, playlist.kind, playlist.editorialParams, {
    title: playlist.title,
    description: playlist.description,
  });
  const badgeKey = KIND_BADGE_KEYS[playlist.kind];
  const kindLabel = badgeKey ? t(`editorial.kindLabels.${badgeKey}`) : undefined;

  return (
    <div className="group flex flex-col gap-2.5">
      {/* href сохраняет SEO и Ctrl/⌘-клик; левый клик перехватываем в peek-оверлей */}
      <a
        href={`/playlists/${playlist.id}`}
        onClick={(e) => { e.preventDefault(); setOpen(true); }}
        className="block w-full relative aspect-square rounded-xl overflow-hidden bg-white/[0.03] ring-1 ring-white/10 transition-[transform,box-shadow] duration-300 ease-soft group-hover:-translate-y-0.5 group-hover:ring-white/20"
      >
        <CoverFan covers={playlist.covers} />
        {kindLabel && (
          <span className="absolute top-1 left-1 z-40 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-mono text-white/80 pointer-events-none">
            {kindLabel}
          </span>
        )}
      </a>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug truncate">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tCommon('trackCount', { count: playlist.trackCount })}
          </p>
        </div>

        <motion.button
          type="button"
          onClick={toggleLike}
          whileTap={{ scale: 0.85 }}
          transition={spring.snappy}
          aria-label={liked ? t('like.remove') : t('like.add')}
          className={`shrink-0 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${touchTargetClass('sm')}`}
        >
          <HeartIcon filled={liked} size={14} strokeWidth={2} className={liked ? '[color:oklch(65%_0.20_25)]' : undefined} />
          {likes > 0 && <span className="font-mono text-[10px]">{likes}</span>}
        </motion.button>
      </div>

      <PlaylistPeekSheet
        playlistId={playlist.id}
        title={title}
        trackCount={playlist.trackCount}
        covers={playlist.covers}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
