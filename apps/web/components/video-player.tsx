'use client';

import { useState } from 'react';
import { preconnect } from 'react-dom';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { activeEmbedUrl, type EmbedInfo } from '@/lib/embed';
import { PlayIcon } from '@/components/icons';

const PLATFORM_ORIGIN: Record<EmbedInfo['platform'], string> = {
  youtube: 'https://www.youtube.com',
  vk: 'https://vk.com',
};

export function VideoPlayer({ embed, title }: { embed: EmbedInfo; title?: string }) {
  const [started, setStarted] = useState(false);

  // preconnect на hover/focus — iframe стартует быстрее
  const warm = () => preconnect(PLATFORM_ORIGIN[embed.platform]);

  return (
    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-black ring-1 ring-white/10">
      {started ? (
        <iframe
          src={activeEmbedUrl(embed)}
          title={title || 'Видео'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <Facade posterUrl={embed.thumbnailUrl} title={title} onWarm={warm} onPlay={() => setStarted(true)} />
      )}
    </div>
  );
}

function Facade({
  posterUrl,
  title,
  onPlay,
  onWarm,
}: {
  posterUrl: string | null;
  title?: string;
  onPlay: () => void;
  onWarm: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onPlay}
      onPointerEnter={onWarm}
      onFocus={onWarm}
      whileTap={{ scale: 0.99 }}
      transition={spring.snappy}
      aria-label={`Смотреть${title ? `: ${title}` : ' видео'}`}
      className="absolute inset-0 w-full h-full group/f"
    >
      {posterUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={posterUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-soft group-hover/f:scale-105"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-white/15">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </span>
      )}
      <span className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent" />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center w-16 h-16 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/40 text-white transition-transform duration-300 ease-soft group-hover/f:scale-110">
        <PlayIcon size={26} className="translate-x-[1px]" />
      </span>
    </motion.button>
  );
}
