'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, type DragControls, type PanInfo } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { cn } from '@/lib/utils';
import { useKeyboardInset } from '@/lib/use-keyboard-inset';
import { usePlayerStore } from '@/store/player';

// drag стартует только с граббера/шапки: drag="y" на всей шторке ставит touch-action:none
// и убивает тач-скролл внутреннего контента
const DragHandleContext = createContext<DragControls | null>(null);

interface SheetProps {
  open: boolean;
  onClose: () => void;
  anchor?: 'center' | 'bottom';
  panelClassName?: string;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, anchor = 'center', panelClassName, children }: SheetProps) {
  const activeTrack = usePlayerStore((s) => s.track);
  const dragControls = useDragControls();
  const keyboardInset = useKeyboardInset();

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

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

  const isBottom = anchor === 'bottom';

  // портал в body: без него fixed ловит трансформированного предка (Stagger-карточки)
  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
          className={cn(
            'fixed inset-0 z-[60] flex bg-black/80 backdrop-blur-xl',
            isBottom ? 'items-end justify-center' : 'items-center justify-center p-4 sm:p-6',
          )}
          style={{
            paddingBottom: isBottom
              ? keyboardInset || undefined
              : `calc(${keyboardInset}px + ${activeTrack ? '64px + 1.5rem' : '0px'})`,
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            onClick={(e) => e.stopPropagation()}
            initial={isBottom ? { y: '100%' } : false}
            animate={isBottom ? { y: 0 } : undefined}
            exit={isBottom ? { y: '100%' } : undefined}
            transition={spring.smooth}
            className={cn(
              'flex flex-col bg-card border-border shadow-2xl overflow-hidden cursor-default',
              isBottom
                ? cn(
                    'w-full max-w-xl rounded-t-2xl border-t border-x',
                    // клавиатура уже съела низ overlay-падингом: своё ограничение по vh тут только мешает
                    keyboardInset > 0 ? 'max-h-full' : 'max-h-[85vh] pb-[env(safe-area-inset-bottom)]',
                  )
                : 'w-full max-w-md max-h-full rounded-2xl border',
              panelClassName,
            )}
          >
            <DragHandleContext.Provider value={dragControls}>
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="pt-2.5 pb-1 flex justify-center touch-none cursor-grab active:cursor-grabbing shrink-0"
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

export function SheetDragHandle({ children, className }: { children: React.ReactNode; className?: string }) {
  const dragControls = useContext(DragHandleContext);
  return (
    <div onPointerDown={(e) => dragControls?.start(e)} className={`touch-none${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
