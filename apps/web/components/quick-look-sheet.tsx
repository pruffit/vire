'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, type DragControls, type PanInfo } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

// Даёт заголовку (шапке), который рисуют потребители шторки (playlist/release
// quick-look), доступ к тем же dragControls, что и грабберу — свайп-закрытие
// стартует с любой из этих зон, а не со всей шторки, иначе тач-скролл
// трек-листа внутри был бы мёртв (drag="y" ставит touch-action:none на весь элемент).
const DragHandleContext = createContext<DragControls | null>(null);

export function QuickLookSheet({ open, onClose, children }: Props) {
  const activeTrack = usePlayerStore((s) => s.track);
  const dragControls = useDragControls();

  // Потребители передают onClose как новую стрелку на каждый рендер; держим в ref,
  // чтобы esc-listener не переподписывался при ре-рендерах родителя (напр. лайк).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  function onDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  }

  // Портал в body: оверлей должен крепиться к вьюпорту. Без портала `fixed inset-0`
  // ловит ближайшего трансформированного предка (карточки в Stagger оседают с
  // inline `transform: translateY(0px)`) и модалка позиционируется внутри ячейки.
  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
          className="fixed inset-0 z-[60] grid place-items-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl"
          style={{ paddingBottom: activeTrack ? 'calc(64px + 1.5rem)' : undefined }}
        >
          <motion.div
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            onClick={(e) => e.stopPropagation()}
            transition={spring.smooth}
            className="w-full max-w-md max-h-full flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden cursor-default"
          >
            <DragHandleContext.Provider value={dragControls}>
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="pt-2.5 pb-1 flex justify-center touch-none cursor-grab active:cursor-grabbing"
              >
                <span className="w-10 h-1 rounded-full bg-white/15" />
              </div>
              {children}
            </DragHandleContext.Provider>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}

/**
 * Оборачивает шапку (обложка+название) peek-контента — тоже стартует
 * свайп-закрытие, как и грабёр, чтобы не заставлять пользователя целиться
 * в узкую полоску. Список ниже шапки в drag-зону не входит — он скроллится сам.
 */
export function QuickLookDragHandle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const dragControls = useContext(DragHandleContext);
  return (
    <div
      onPointerDown={(e) => dragControls?.start(e)}
      className={`touch-none${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  );
}

/** Анимированные полоски эквалайзера — индикатор текущего трека в трек-листе. */
export function MiniEq({ animate }: { animate: boolean }) {
  return (
    <span
      className="inline-flex items-end gap-[1.5px] h-3"
      style={{ color: 'var(--artist-accent, hsl(200 80% 65%))' }}
      aria-label="Сейчас играет"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] bg-current rounded-full"
          style={{
            height: animate ? undefined : '35%',
            animation: animate ? `vire-eq 0.9s ease-in-out ${i * 0.15}s infinite` : undefined,
          }}
        />
      ))}
    </span>
  );
}
