'use client';

import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';

type ToastKind = 'default' | 'error';

interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ToastStore {
  toasts: ToastItem[];
  _push(item: ToastItem): void;
  _dismiss(id: number): void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  _push: (item) =>
    set((s) => ({
      // Держим максимум 3 одновременно, старые уходят первыми
      toasts: [...s.toasts.slice(-2), item],
    })),
  _dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

let nextId = 1;
const DURATION_MS = 3500;

/** Показать тост. Текст должен быть конкретным («Не удалось сохранить лайк»), не generic. */
export function toast(text: string, kind: ToastKind = 'default'): void {
  const id = nextId++;
  useToastStore.getState()._push({ id, text, kind });
  setTimeout(() => useToastStore.getState()._dismiss(id), DURATION_MS);
}
toast.error = (text: string) => toast(text, 'error');

/** Стек тостов снизу по центру, над плеером. Монтируется один раз в layout. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s._dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 px-4 w-full max-w-md"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            layout
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.15 } }}
            transition={spring.smooth}
            onClick={() => dismiss(t.id)}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-popover/95 backdrop-blur-md border border-border shadow-xl text-sm text-left"
          >
            {t.kind === 'error' && (
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
            )}
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
