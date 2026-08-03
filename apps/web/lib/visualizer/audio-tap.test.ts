import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearVisualizerElement,
  getVisualizerTap,
  onVisualizerTapChange,
  setVisualizerElement,
  setVisualizerStream,
} from './audio-tap';

const elementA = {} as HTMLMediaElement;
const elementB = {} as HTMLMediaElement;
const stream = {} as MediaStream;

beforeEach(() => {
  setVisualizerStream(null);
  setVisualizerElement(null);
});

describe('реестр источника звука', () => {
  it('без источника отдаёт null', () => {
    expect(getVisualizerTap()).toBeNull();
  });

  /** Регрессия: новый объект на каждый вызов уводил useSyncExternalStore в бесконечный цикл — экран вечеринки падал. */
  it('снимок стабилен по ссылке, пока источник не менялся', () => {
    setVisualizerElement(elementA);
    const first = getVisualizerTap();
    expect(getVisualizerTap()).toBe(first);
    expect(getVisualizerTap()).toBe(first);
    expect(first).toEqual({ kind: 'element', element: elementA });
  });

  it('смена источника даёт новый снимок', () => {
    setVisualizerElement(elementA);
    const first = getVisualizerTap();
    setVisualizerElement(elementB);
    expect(getVisualizerTap()).not.toBe(first);
  });

  it('захват вкладки перебивает элемент', () => {
    setVisualizerElement(elementA);
    setVisualizerStream(stream);
    expect(getVisualizerTap()).toEqual({ kind: 'stream', stream });
    setVisualizerStream(null);
    expect(getVisualizerTap()).toEqual({ kind: 'element', element: elementA });
  });

  it('чужой источник не снимает текущий', () => {
    setVisualizerElement(elementA);
    clearVisualizerElement(elementB);
    expect(getVisualizerTap()).toEqual({ kind: 'element', element: elementA });
    clearVisualizerElement(elementA);
    expect(getVisualizerTap()).toBeNull();
  });

  it('подписчик получает снимок и отписывается', () => {
    const listener = vi.fn();
    const off = onVisualizerTapChange(listener);
    setVisualizerElement(elementA);
    expect(listener).toHaveBeenCalledWith({ kind: 'element', element: elementA });
    off();
    setVisualizerElement(elementB);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
