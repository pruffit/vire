// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { Visualizer, useVisualizerEnabled } from './index';
import { createVisualizerEngine } from './engine';
import { parseAccent, rotateHue, SCENE_FACTORIES } from './scenes';

vi.mock('@/lib/player/manifest-cache', () => ({
  fetchManifest: vi.fn().mockResolvedValue({ hlsUrl: 'x.m3u8', waveformPeaks: [0.1, 0.9, 0.4] }),
}));

const rafSpy = vi.fn<(cb: FrameRequestCallback) => number>();
const cancelSpy = vi.fn<(id: number) => void>();

function fakeContext(): CanvasRenderingContext2D {
  return {
    setTransform: vi.fn(), fillRect: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), closePath: vi.fn(), stroke: vi.fn(), drawImage: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
    createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    globalCompositeOperation: '', globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  let id = 0;
  rafSpy.mockImplementation(() => ++id);
  vi.stubGlobal('requestAnimationFrame', rafSpy);
  vi.stubGlobal('cancelAnimationFrame', cancelSpy);
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    disconnect(): void {}
  });
  HTMLCanvasElement.prototype.getContext = vi.fn(fakeContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const base = { accentColor: '#3366ff', playing: true, positionSec: 0, durationSec: 100 };

describe('Visualizer', () => {
  it('выключенный ничего не рисует', () => {
    const { container } = render(<Visualizer {...base} enabled={false} />);
    expect(container.querySelector('canvas')).toBeNull();
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('на паузе кадр рисуется, но цикл не крутится', () => {
    render(<Visualizer {...base} enabled playing={false} />);
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('размонтирование снимает кадр анимации', () => {
    const { unmount } = render(<Visualizer {...base} enabled />);
    expect(rafSpy).toHaveBeenCalled();
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });
});

describe('useVisualizerEnabled', () => {
  it('читает сохранённое состояние и пишет выбранное', () => {
    localStorage.setItem('vire-visualizer', 'on');
    const { result } = renderHook(() => useVisualizerEnabled());
    expect(result.current[0]).toBe(true);

    act(() => result.current[1](false));
    expect(localStorage.getItem('vire-visualizer')).toBe('off');
  });

  it('без записи в хранилище визуализация выключена', () => {
    const { result } = renderHook(() => useVisualizerEnabled());
    expect(result.current[0]).toBe(false);
  });
});

describe('движок визуализации', () => {
  const frame = { width: 800, height: 600, time: 0, amp: 0.7, accent: parseAccent('#3366ff') };

  it('рисует непрерывно и сам сменяет форму со временем', () => {
    const engine = createVisualizerEngine();
    const ctx = fakeContext();

    engine.draw(ctx, frame, 1);
    const beforeSwitch = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(beforeSwitch).toBe(1);

    // За пределом сегмента в кадре появляется вторая сцена — идёт перетекание.
    engine.draw(ctx, { ...frame, time: 40 }, 1);
    expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);

    engine.dispose();
  });

  it('все сцены рисуются без ошибок', () => {
    const ctx = fakeContext();
    for (const factory of SCENE_FACTORIES) {
      const scene = factory();
      expect(() => scene.draw(ctx, { ...frame, time: 3 })).not.toThrow();
    }
  });
});

describe('палитра', () => {
  it('битый акцент деградирует в дефолтный цвет', () => {
    expect(parseAccent('не цвет')).toEqual(parseAccent(null));
    expect(parseAccent('#0af')).toEqual({ r: 0, g: 170, b: 255 });
  });

  it('поворот оттенка держит канал в 0..255', () => {
    const rotated = rotateHue({ r: 200, g: 30, b: 90 }, 180);
    for (const channel of [rotated.r, rotated.g, rotated.b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  });
});
