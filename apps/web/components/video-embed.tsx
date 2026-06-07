'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { activeEmbedUrl, type EmbedInfo } from '@/lib/embed';

/**
 * Видео-фасад: кастомная оболочка под стиль сайта вместо дефолтного плеера.
 * До клика показывает постер + свою кнопку play (iframe не грузится — это и
 * перф-выигрыш). По клику разворачивается плеер с автоплеем и приглушённым
 * брендингом платформы.
 */
export function VideoEmbed({ embed, title }: { embed: EmbedInfo; title?: string }) {
  const [active, setActive] = useState(false);

  return (
    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-white/5 ring-1 ring-white/10 group">
      {active ? (
        <iframe
          src={activeEmbedUrl(embed)}
          title={title || 'Видео'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <motion.button
          type="button"
          onClick={() => setActive(true)}
          whileTap={{ scale: 0.99 }}
          transition={spring.snappy}
          aria-label={`Смотреть${title ? `: ${title}` : ' видео'}`}
          className="absolute inset-0 w-full h-full"
        >
          {embed.thumbnailUrl ? (
            // Постер с CDN платформы — не next/image (хост не в remotePatterns),
            // оптимизация тут не нужна, это превью фасада.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={embed.thumbnailUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-soft group-hover:scale-105"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-white/15">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </span>
          )}

          {/* затемнение снизу для читаемости + кнопка play */}
          <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center w-14 h-14 rounded-full bg-black/40 backdrop-blur-md ring-1 ring-white/40 text-white transition-transform duration-300 ease-soft group-hover:scale-110">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="translate-x-[1px]">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </span>
        </motion.button>
      )}
    </div>
  );
}
