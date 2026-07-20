import { create } from 'zustand';
import { useEffect, useRef } from 'react';

interface ChatUnreadState {
  count: number;
  initialized: boolean;
  set: (count: number) => void;
}

export const useChatUnreadStore = create<ChatUnreadState>((set) => ({
  count: 0,
  initialized: false,
  set: (count) => set({ count, initialized: true }),
}));

/** Живой бейдж непрочитанных — молча игнорит сетевые ошибки, вызывается фоново. */
export function refreshUnread(): void {
  fetch('/api/v1/chat/unread-count')
    .then((r) => (r.ok ? (r.json() as Promise<{ count: number }>) : null))
    .then((d) => {
      if (d) useChatUnreadStore.getState().set(d.count);
    })
    .catch(() => {});
}

/** SSR-проп сидирует стор один раз за монтаж вкладки; дальше источник истины — live count. */
export function useChatUnread(initial: number): number {
  const seeded = useRef(false);
  const count = useChatUnreadStore((s) => s.count);
  const initialized = useChatUnreadStore((s) => s.initialized);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (!useChatUnreadStore.getState().initialized) useChatUnreadStore.getState().set(initial);
  }, [initial]);

  return initialized ? count : initial;
}
