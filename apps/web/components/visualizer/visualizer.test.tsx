// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { Visualizer, useVisualizerPreset } from './index';
import { createScene, parseAccent, rotateHue } from './presets';

vi.mock('@/lib/player/manifest-cache', () => ({
  fetchManifest: vi.fn().mockResolvedValue({ hlsUrl: 'x.m3u8', waveformPeaks: [0.1, 0.9, 0.4] }),
}));

const rafSpy = vi.fn<(cb: FrameRequestCallback) => number>();
const cancelSpy = vi.fn<(id: number) => void>();

beforeEach(() => {
  let id = 0;
  rafSpy.mockImplementation(() => ++id);
  vi.stubGlobal('requestAnimationFrame', rafSpy);
  vi.stubGlobal('cancelAnimationFrame', cancelSpy);
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    disconnect(): void {}
  });
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    stroke: vi.fn(), createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    globalCompositeOperation: '', fillStyle: '', strokeStyle: '', lineWidth: 0,
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const base = { accentColor: '#3366ff', playing: true, positionSec: 0, durationSec: 100 };

describe('Visualizer', () => {
  it('preset=off ничего не рисует', () => {
    const { container } = render(<Visualizer {...base} preset="off" />);
    expect(container.querySelector('canvas')).toBeNull();
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('на паузе кадр рисуется, но цикл не крутится', () => {
    render(<Visualizer {...base} preset="spiral" playing={false} />);
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('размонтирование снимает кадр анимации', () => {
    const { unmount } = render(<Visualizer {...base} preset="particles" />);
    expect(rafSpy).toHaveBeenCalled();
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });
});

describe('useVisualizerPreset', () => {
  it('читает сохранённый пресет и пишет выбранный', () => {
    localStorage.setItem('vire-visualizer', 'plasma');
    const { result } = renderHook(() => useVisualizerPreset());
    expect(result.current[0]).toBe('plasma');

    act(() => result.current[1]('spiral'));
    expect(localStorage.getItem('vire-visualizer')).toBe('spiral');
  });

  it('мусор в хранилище игнорируется', () => {
    localStorage.setItem('vire-visualizer', 'нет-такого');
    const { result } = renderHook(() => useVisualizerPreset());
    expect(result.current[0]).toBe('off');
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

  it('все сцены создаются и рисуют без ошибок', () => {
    const ctx = HTMLCanvasElement.prototype.getContext.call(document.createElement('canvas'), '2d') as CanvasRenderingContext2D;
    for (const preset of ['spiral', 'plasma', 'particles'] as const) {
      const scene = createScene(preset);
      expect(() => scene.draw(ctx, { width: 800, height: 600, time: 3, amp: 0.7, accent: parseAccent('#3366ff') })).not.toThrow();
    }
  });
});
