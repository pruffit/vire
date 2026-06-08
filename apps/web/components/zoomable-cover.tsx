'use client';

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { spring } from '@vire/ui/motion';

/**
 * Обложка, которая разворачивается в полноэкранный просмотр — тем же приёмом, что
 * и плеер: shared-element (layoutId) морфит маленькую обложку в большую, фон
 * blur-затемняется, закрытие свайпом/кликом/Esc. cursor-zoom-in подсказывает.
 */
export function ZoomableCover({
  src,
  alt,
  className,
  sizes = '208px',
}: {
  src: string;
  alt: string;
  /** Размеры/тень маленькой обложки, напр. "w-52 h-52 shadow-2xl". */
  className?: string;
  sizes?: string;
}) {
  const [open, setOpen] = useState(false);
  const layoutId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function onDragEnd(_e: unknown, info: PanInfo) {
    const dist = Math.hypot(info.offset.x, info.offset.y);
    const speed = Math.hypot(info.velocity.x, info.velocity.y);
    if (dist > 110 || speed > 550) setOpen(false);
  }

  return (
    <>
      <motion.button
        type="button"
        layoutId={layoutId}
        onClick={() => setOpen(true)}
        transition={spring.smooth}
        aria-label={`Открыть обложку крупнее: ${alt}`}
        className={`group relative block overflow-hidden cursor-zoom-in ${className ?? ''}`}
      >
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors grid place-items-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white drop-shadow">
            <ExpandIcon />
          </span>
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] grid place-items-center p-6 bg-black/80 backdrop-blur-xl cursor-zoom-out"
          >
            <motion.div
              layoutId={layoutId}
              transition={spring.smooth}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.5}
              onDragEnd={onDragEnd}
              onClick={(e) => e.stopPropagation()}
              className="relative aspect-square w-full max-w-[min(88vw,88vh)] rounded-xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
            >
              <Image src={src} alt={alt} fill sizes="88vw" className="object-cover pointer-events-none" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ExpandIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}
