export type VisualizerTap =
  | { kind: 'element'; element: HTMLMediaElement }
  | { kind: 'stream'; stream: MediaStream }
  | null;

type Listener = (tap: VisualizerTap) => void;

let element: HTMLMediaElement | null = null;
let stream: MediaStream | null = null;
const listeners = new Set<Listener>();
/**
 * Снимок пересобирается только при смене источника: `useSyncExternalStore` сравнивает
 * его по ссылке, и новый объект на каждый вызов уводит React в бесконечный цикл.
 */
let snapshot: VisualizerTap = null;

/**
 * Кто отдаёт звук на анализ. Источники вечеринки регистрируют свой `<audio>` — но только те,
 * чей поток не заграждён CORS: `createMediaElementSource` на чужом домене без CORS отдаёт
 * тишину И глушит воспроизведение. Захват вкладки (`getDisplayMedia`) перебивает элемент:
 * он слышит в том числе YouTube, до которого из кода не дотянуться.
 */
function emit(): void {
  snapshot = stream ? { kind: 'stream', stream } : element ? { kind: 'element', element } : null;
  listeners.forEach((listener) => listener(snapshot));
}

export function setVisualizerElement(el: HTMLMediaElement | null): void {
  element = el;
  emit();
}

/** Источник сняли — но новый мог зарегистрироваться раньше, чем старый успел прибраться. */
export function clearVisualizerElement(el: HTMLMediaElement): void {
  if (element !== el) return;
  element = null;
  emit();
}

export function setVisualizerStream(next: MediaStream | null): void {
  stream = next;
  emit();
}

export function getVisualizerTap(): VisualizerTap {
  return snapshot;
}

export function onVisualizerTapChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
