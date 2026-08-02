type SlotListener = (el: HTMLElement | null) => void;

let slot: HTMLElement | null = null;
const listeners = new Set<SlotListener>();

/**
 * Куда страница просит поставить видео. Сам iframe туда не переезжает — по DOM его двигать
 * нельзя; док в app-shell лишь подгоняет свою геометрию под этот узел.
 */
export function setPartyVideoSlot(el: HTMLElement | null): void {
  slot = el;
  listeners.forEach((l) => l(el));
}

export function getPartyVideoSlot(): HTMLElement | null {
  return slot;
}

export function onPartyVideoSlotChange(listener: SlotListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
