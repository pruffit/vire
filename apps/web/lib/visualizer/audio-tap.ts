export type VisualizerTap =
  | { kind: 'element'; element: HTMLMediaElement }
  | { kind: 'stream'; stream: MediaStream }
  | null;

type Listener = (tap: VisualizerTap) => void;

let element: HTMLMediaElement | null = null;
let stream: MediaStream | null = null;
const listeners = new Set<Listener>();

/**
 * Кто отдаёт звук на анализ. Источники вечеринки регистрируют свой `<audio>` — но только те,
 * чей поток не заграждён CORS: `createMediaElementSource` на чужом домене без CORS отдаёт
 * тишину И глушит воспроизведение. Захват вкладки (`getDisplayMedia`) перебивает элемент:
 * он слышит в том числе YouTube, до которого из кода не дотянуться.
 */
function current(): VisualizerTap {
  if (stream) return { kind: 'stream', stream };
  if (element) return { kind: 'element', element };
  return null;
}

function emit(): void {
  const tap = current();
  listeners.forEach((listener) => listener(tap));
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
  return current();
}

export function onVisualizerTapChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
