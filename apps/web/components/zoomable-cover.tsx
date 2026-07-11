'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { Tilt } from './tilt';
import { Icon } from '@/components/icon';

/** Обложка с разворотом в полноэкранный просмотр: shared-element (layoutId), закрытие свайп/клик/Esc. */
export function ZoomableCover({
  src,
  alt,
  className,
  sizes = '208px',
  priority = false,
}: {
  src: string;
  alt: string;
  /** Размеры/тень маленькой обложки, напр. "w-52 h-52 shadow-2xl". */
  className?: string;
  sizes?: string;
  /** Грузить сразу (для обложки над сгибом — LCP). */
  priority?: boolean;
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
        {/* Тилт на внутреннем слое, чтобы не мешать layoutId-морфу кнопки */}
        <Tilt className="absolute inset-0">
          <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors grid place-items-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white drop-shadow">
              <ExpandIcon />
            </span>
          </span>
        </Tilt>
      </motion.button>

      {/* Оверлей — порталом в body: страницы артиста оборачивают контент в
          stacking context (relative z-10), внутри которого z-[60] не поднял бы
          оверлей над навбаром и плеером. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[70] grid place-items-center p-6 bg-black/80 backdrop-blur-xl cursor-zoom-out"
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
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function ExpandIcon() {
  return <Icon name="maximize-2" size={22} />;
}
