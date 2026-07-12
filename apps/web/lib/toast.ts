import { create } from 'zustand';

type ToastKind = 'default' | 'error';

export interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ToastStore {
  toasts: ToastItem[];
  _push(item: ToastItem): void;
  _dismiss(id: number): void;
}

export const useToastStore = create<ToastStore>((set) => ({
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
